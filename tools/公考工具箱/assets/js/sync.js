/* =========================================================
   Supabase Auth + Data Sync

   1) Create a Supabase project and enable Email/Password Auth.
   2) Run this SQL in Supabase SQL Editor:

   create table if not exists public.user_data (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     data_key text not null,
     data_value jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now(),
     unique (user_id, data_key)
   );

   alter table public.user_data enable row level security;

   create policy "Users can read own data"
   on public.user_data for select
   using (auth.uid() = user_id);

   create policy "Users can insert own data"
   on public.user_data for insert
   with check (auth.uid() = user_id);

   create policy "Users can update own data"
   on public.user_data for update
   using (auth.uid() = user_id)
   with check (auth.uid() = user_id);

   create policy "Users can delete own data"
   on public.user_data for delete
   using (auth.uid() = user_id);

   3) Fill in SUPABASE_URL and SUPABASE_ANON_KEY below.
   ========================================================= */

window.SyncStore = (function () {
  "use strict";

  var SUPABASE_URL = "https://srevbdznsrvpwivvdfla.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_yDYTPr8uN7rw7oigBWaIgw_V2Fp9fzd";
  var AUTH_REDIRECT_URL = "https://sriy-fighting.github.io/gongkao-tools/";

  var TABLE = "user_data";
  var LEGACY_SYNC_KEY = "gk-sync-key";
  var LOCAL_STAMP_PREFIX = "gk-sync-stamp:";
  var SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var client = null;
  var session = null;
  var initPromise = null;
  var pendingWrites = {};
  var writeTimers = {};
  var authListeners = [];

  // Retired modules are excluded at every storage boundary, including old
  // backups and snapshots uploaded by devices still running an older release.
  function isRetiredKey(key) {
    if (typeof key !== "string") return false;
    if (key.indexOf(LOCAL_STAMP_PREFIX) === 0) key = key.slice(LOCAL_STAMP_PREFIX.length);
    return /^(?:wusi-|gk-recitation-|gk-review-|gk-study-plan(?:$|[-:])|gk-plan-|ebbinghaus_entries(?:$|:))/.test(key);
  }

  function sanitizeValue(key, value) {
    if (key !== "gk-tool-order" && key !== "gk-tool-names-v1" && key !== "gk-focus-journey") return value;
    var wasString = typeof value === "string";
    if (wasString) {
      try { value = JSON.parse(value); } catch (e) { return value; }
    }
    var retiredViews = ["curve", "wusi", "review", "plan"];
    if (key === "gk-tool-order" && Array.isArray(value)) {
      value = value.filter(function (view) { return retiredViews.indexOf(view) === -1; });
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      value = Object.assign({}, value);
      if (key === "gk-tool-names-v1") {
        retiredViews.forEach(function (view) { delete value[view]; });
      } else if (key === "gk-focus-journey") {
        function detach(record) {
          if (!record || typeof record !== "object") return record;
          var copy = Object.assign({}, record);
          delete copy.taskRef;
          return copy;
        }
        if (value.active) value.active = detach(value.active);
        if (Array.isArray(value.sessions)) value.sessions = value.sessions.map(detach);
      }
    }
    return wasString ? JSON.stringify(value) : value;
  }

  function cleanupLocalData() {
    try {
      // Snapshot keys before removing any entries, so no adjacent key is skipped.
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(function (key) {
        if (isRetiredKey(key)) {
          localStorage.removeItem(key);
          localStorage.removeItem(stampKey(key));
        } else {
          var raw = localStorage.getItem(key);
          var clean = sanitizeValue(key, raw);
          if (clean !== raw) localStorage.setItem(key, clean);
        }
      });
    } catch (e) {}
  }

  function isConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  function serializeValue(value) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  function deserializeValue(raw) {
    if (raw == null) return null;
    try { return JSON.parse(raw); }
    catch (e) { return raw; }
  }

  function setLocalValue(key, value) {
    if (!isBusinessKey(key)) return;
    value = sanitizeValue(key, value);
    try { localStorage.setItem(key, serializeValue(value)); } catch (e) {}
  }

  function getLocalValue(key) {
    if (!isBusinessKey(key)) return null;
    try { return sanitizeValue(key, deserializeValue(localStorage.getItem(key))); }
    catch (e) { return null; }
  }

  function getValueTimestamp(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
    return Date.parse(value.updatedAt || value.updated_at || value.modifiedAt || "") || 0;
  }

  function stampKey(key) { return LOCAL_STAMP_PREFIX + key; }

  function getLocalTimestamp(key, value) {
    var embedded = getValueTimestamp(value);
    if (embedded) return embedded;
    try { return Date.parse(localStorage.getItem(stampKey(key)) || "") || 0; }
    catch (e) { return 0; }
  }

  function setLocalTimestamp(key, value) {
    var timestamp = getValueTimestamp(value) || Date.parse(value || "") || Date.now();
    try { localStorage.setItem(stampKey(key), new Date(timestamp).toISOString()); } catch (e) {}
  }

  function isBusinessKey(key) {
    if (!key) return false;
    if (isRetiredKey(key)) return false;
    if (key === LEGACY_SYNC_KEY) return false;
    if (key.indexOf(LOCAL_STAMP_PREFIX) === 0) return false;
    return key.indexOf("gk-") === 0 ||
      key.indexOf("gk50:") === 0 ||
      key.indexOf("law50:") === 0 ||
      key.indexOf("exam-") === 0 ||
      key.indexOf("essay-") === 0 ||
      key.indexOf("sl-") === 0;
  }

  function getAllLocalBusinessData() {
    var data = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (isBusinessKey(key)) data[key] = getLocalValue(key);
      }
    } catch (e) {}
    return data;
  }

  function loadSupabaseScript() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-supabase-js="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.src = SUPABASE_JS_URL;
      script.async = true;
      script.dataset.supabaseJs = "true";
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Supabase JS 加载失败")); };
      document.head.appendChild(script);
    });
  }

  function notifyAuthListeners() {
    var info = getAuthInfo();
    authListeners.forEach(function (fn) {
      try { fn(info); } catch (e) {}
    });
  }

  function ensureClient() {
    if (!isConfigured()) return Promise.resolve(null);
    if (client) return Promise.resolve(client);
    if (initPromise) return initPromise;
    initPromise = loadSupabaseScript()
      .then(function () {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return client.auth.getSession();
      })
      .then(function (result) {
        session = result && result.data ? result.data.session : null;
        client.auth.onAuthStateChange(function (_event, nextSession) {
          session = nextSession || null;
          notifyAuthListeners();
        });
        return client;
      })
      .catch(function () {
        client = null;
        session = null;
        return null;
      });
    return initPromise;
  }

  function init() {
    ensureClient().then(function () {
      notifyAuthListeners();
      if (session) mergeLocalWithCloud(function () {});
    });
    return {
      hasConfig: isConfigured(),
      isLoggedIn: !!session,
      user: session && session.user ? session.user : null,
      syncKey: ""
    };
  }

  function getAuthInfo() {
    return {
      hasConfig: isConfigured(),
      isLoggedIn: !!session,
      user: session && session.user ? session.user : null,
      email: session && session.user ? session.user.email : ""
    };
  }

  function onAuthChange(callback) {
    if (typeof callback === "function") authListeners.push(callback);
  }

  function signUp(email, password) {
    return ensureClient().then(function (sb) {
      if (!sb) throw new Error("账号同步尚未配置 Supabase");
      return sb.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL
        }
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      session = res.data.session || session;
      if (session) return mergeLocalWithCloud().then(function () { return res; });
      notifyAuthListeners();
      return res;
    });
  }

  function signIn(email, password) {
    return ensureClient().then(function (sb) {
      if (!sb) throw new Error("账号同步尚未配置 Supabase");
      return sb.auth.signInWithPassword({ email: email, password: password });
    }).then(function (res) {
      if (res.error) throw res.error;
      session = res.data.session || null;
      return mergeLocalWithCloud().then(function () {
        notifyAuthListeners();
        return res;
      });
    });
  }

  function signOut() {
    return ensureClient().then(function (sb) {
      if (!sb) return;
      return sb.auth.signOut();
    }).then(function () {
      session = null;
      notifyAuthListeners();
    });
  }

  function getSyncKey() { return ""; }
  function setSyncKey() {}

  function fetchFromCloud(key, callback) {
    if (!isBusinessKey(key)) {
      if (typeof callback === "function") callback(null, { source: "local", exists: false });
      return;
    }
    ensureClient().then(function (sb) {
      if (!sb || !session) return null;
      return sb.from(TABLE)
        .select("data_value,updated_at")
        .eq("user_id", session.user.id)
        .eq("data_key", key)
        .maybeSingle();
    }).then(function (res) {
      if (!res || res.error || !res.data) {
        if (typeof callback === "function") callback(null, { source: "cloud", exists: false });
        return;
      }
      if (typeof callback === "function") callback(sanitizeValue(key, res.data.data_value), {
        source: "cloud",
        exists: true,
        updatedAt: res.data.updated_at || ""
      });
    }).catch(function () {
      if (typeof callback === "function") callback(null, { source: "cloud", exists: false, error: true });
    });
  }

  function readData(key, callback) {
    var localData = getLocalValue(key);
    if (!isConfigured()) {
      if (typeof callback === "function") setTimeout(function () {
        callback(localData, { source: "local", exists: localData !== null });
      }, 0);
      return localData;
    }
    fetchFromCloud(key, function (cloudData, meta) {
      if (cloudData !== null) {
        // The caller decides whether the remote snapshot is newer before saving.
        if (typeof callback === "function") callback(cloudData, meta);
      } else if (typeof callback === "function") {
        callback(localData, {
          source: "local",
          exists: localData !== null,
          cloudMissing: true,
          cloudMeta: meta || null
        });
      }
    });
    return localData;
  }

  function writeData(key, value) {
    if (!isBusinessKey(key)) return;
    value = sanitizeValue(key, value);
    setLocalValue(key, value);
    setLocalTimestamp(key, value);
    if (!isConfigured()) return;
    pendingWrites[key] = value;
    if (writeTimers[key]) clearTimeout(writeTimers[key]);
    writeTimers[key] = setTimeout(function () {
      var dataToWrite = pendingWrites[key];
      delete pendingWrites[key];
      delete writeTimers[key];
      // The local snapshot remains available for retry on the next merge.
      upsertCloudValue(key, dataToWrite).catch(function () {});
    }, 500);
  }

  function upsertCloudValue(key, value, updatedAt, userId) {
    if (!isBusinessKey(key)) return Promise.resolve();
    value = sanitizeValue(key, value);
    return ensureClient().then(function (sb) {
      if (!sb || !session) return;
      if (userId && session.user.id !== userId) return;
      return sb.from(TABLE).upsert({
        user_id: session.user.id,
        data_key: key,
        data_value: value,
        updated_at: updatedAt || new Date().toISOString()
      }, { onConflict: "user_id,data_key" });
    }).then(function (result) {
      if (result && result.error) throw result.error;
      return result;
    });
  }

  function fetchAllKeys(callback) {
    ensureClient().then(function (sb) {
      if (!sb || !session) return [];
      return sb.from(TABLE)
        .select("data_key,data_value,updated_at")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false });
    }).then(function (res) {
      if (!res || res.error) {
        if (typeof callback === "function") callback([]);
        return;
      }
      if (typeof callback === "function") callback((res.data || []).filter(function (row) {
        return isBusinessKey(row.data_key);
      }).map(function (row) {
        return Object.assign({}, row, { data_value: sanitizeValue(row.data_key, row.data_value) });
      }));
    }).catch(function () {
      if (typeof callback === "function") callback([]);
    });
  }

  function deleteData(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    try { localStorage.removeItem(stampKey(key)); } catch (e) {}
    if (writeTimers[key]) clearTimeout(writeTimers[key]);
    delete writeTimers[key];
    delete pendingWrites[key];
    ensureClient().then(function (sb) {
      if (!sb || !session) return;
      return sb.from(TABLE)
        .delete()
        .eq("user_id", session.user.id)
        .eq("data_key", key);
    }).catch(function () {});
  }

  function mergeLocalWithCloud(callback) {
    cleanupLocalData();
    var userId;
    return ensureClient().then(function (sb) {
      // Local-only users still need the completion callback. The portal uses
      // it to finish loading its in-memory state after the optional sync step.
      if (!sb || !session) {
        return { __syncSkipped: true };
      }
      userId = session.user.id;
      return sb.from(TABLE)
        .select("data_key,data_value,updated_at")
        .eq("user_id", userId);
    }).then(function (res) {
      if (res && res.__syncSkipped) {
        if (typeof callback === "function") callback({ uploaded: 0, downloaded: 0, skipped: true });
        return null;
      }
      if (!res || res.error) {
        if (typeof callback === "function") callback({ uploaded: 0, downloaded: 0, error: true });
        return null;
      }
      if (!session || session.user.id !== userId) throw new Error("账号已切换，请重新同步");
      var allRows = res.data || [];
      var retiredKeys = allRows.filter(function (row) { return isRetiredKey(row.data_key); }).map(function (row) { return row.data_key; });
      var cloudRows = allRows.filter(function (row) { return isBusinessKey(row.data_key); });
      var localData = getAllLocalBusinessData();
      var localKeys = Object.keys(localData);
      var writes = [];
      var uploaded = 0;
      var downloaded = 0;

      // RLS and this explicit user_id constrain cleanup to the signed-in account.
      if (retiredKeys.length) {
        writes.push(client.from(TABLE).delete().eq("user_id", userId).in("data_key", retiredKeys).then(function (result) {
          if (result.error) throw result.error;
        }));
      }

      cloudRows.forEach(function (row) {
        var clean = sanitizeValue(row.data_key, row.data_value);
        var needsCleanup = JSON.stringify(clean) !== JSON.stringify(row.data_value);
        row = Object.assign({}, row, { data_value: clean });
        function repairSharedCloudData() {
          // Retain the timestamp: removing a stale task reference is not a new
          // focus session and must not override a more recent device snapshot.
          if (needsCleanup) writes.push(upsertCloudValue(row.data_key, clean, row.updated_at, userId));
        }
        if (!Object.prototype.hasOwnProperty.call(localData, row.data_key)) {
          setLocalValue(row.data_key, row.data_value);
          setLocalTimestamp(row.data_key, row.updated_at || row.data_value);
          downloaded += 1;
          repairSharedCloudData();
          return;
        }
        var localAt = getLocalTimestamp(row.data_key, localData[row.data_key]);
        // Older releases did not write a per-key timestamp. Treat an
        // existing legacy snapshot as a fresh local edit before comparing it
        // with the cloud, so a first login cannot silently replace it.
        if (!localAt) {
          setLocalTimestamp(row.data_key, localData[row.data_key]);
          localAt = getLocalTimestamp(row.data_key, localData[row.data_key]);
        }
        var cloudAt = Date.parse(row.updated_at || "") || 0;
        if (cloudAt > 0 && cloudAt > localAt) {
          setLocalValue(row.data_key, row.data_value);
          setLocalTimestamp(row.data_key, row.updated_at || row.data_value);
          downloaded += 1;
          repairSharedCloudData();
          return;
        }
        writes.push(upsertCloudValue(row.data_key, localData[row.data_key], null, userId));
        uploaded += 1;
      });

      localKeys.forEach(function (key) {
        if (!cloudRows.some(function (row) { return row.data_key === key; })) {
          if (!getLocalTimestamp(key, localData[key])) setLocalTimestamp(key, localData[key]);
          writes.push(upsertCloudValue(key, localData[key], null, userId));
          uploaded += 1;
        }
      });

      return Promise.all(writes).then(function () {
        if (typeof callback === "function") callback({ uploaded: uploaded, downloaded: downloaded, deleted: retiredKeys.length });
        return { uploaded: uploaded, downloaded: downloaded, deleted: retiredKeys.length };
      });
    }).catch(function () {
      if (typeof callback === "function") callback({ uploaded: 0, downloaded: 0, error: true });
      return { uploaded: 0, downloaded: 0, error: true };
    });
  }

  cleanupLocalData();

  return {
    init: init,
    getAuthInfo: getAuthInfo,
    onAuthChange: onAuthChange,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    mergeLocalWithCloud: mergeLocalWithCloud,
    getSyncKey: getSyncKey,
    setSyncKey: setSyncKey,
    isConfigured: isConfigured,
    isBusinessKey: isBusinessKey,
    sanitizeValue: sanitizeValue,
    cleanupLocalData: cleanupLocalData,
    readData: readData,
    writeData: writeData,
    fetchAllKeys: fetchAllKeys,
    deleteData: deleteData
  };
})();
