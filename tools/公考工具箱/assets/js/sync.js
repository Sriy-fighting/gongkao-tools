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
  var SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var client = null;
  var session = null;
  var initPromise = null;
  var pendingWrites = {};
  var writeTimers = {};
  var authListeners = [];

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
    try { localStorage.setItem(key, serializeValue(value)); } catch (e) {}
  }

  function getLocalValue(key) {
    try { return deserializeValue(localStorage.getItem(key)); }
    catch (e) { return null; }
  }

  function isBusinessKey(key) {
    if (!key) return false;
    if (key === LEGACY_SYNC_KEY) return false;
    return key.indexOf("gk-") === 0 ||
      key.indexOf("exam-") === 0 ||
      key.indexOf("essay-") === 0 ||
      key === "ebbinghaus_entries";
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
    ensureClient().then(function (sb) {
      if (!sb || !session) return null;
      return sb.from(TABLE)
        .select("data_value,updated_at")
        .eq("user_id", session.user.id)
        .eq("data_key", key)
        .maybeSingle();
    }).then(function (res) {
      if (!res || res.error || !res.data) {
        if (typeof callback === "function") callback(null);
        return;
      }
      if (typeof callback === "function") callback(res.data.data_value);
    }).catch(function () {
      if (typeof callback === "function") callback(null);
    });
  }

  function readData(key, callback) {
    var localData = getLocalValue(key);
    if (!isConfigured()) {
      if (typeof callback === "function") setTimeout(function () { callback(localData); }, 0);
      return localData;
    }
    fetchFromCloud(key, function (cloudData) {
      if (cloudData !== null) {
        setLocalValue(key, cloudData);
        if (typeof callback === "function") callback(cloudData);
      } else if (typeof callback === "function") {
        callback(localData);
      }
    });
    return localData;
  }

  function writeData(key, value) {
    setLocalValue(key, value);
    if (!isConfigured()) return;
    pendingWrites[key] = value;
    if (writeTimers[key]) clearTimeout(writeTimers[key]);
    writeTimers[key] = setTimeout(function () {
      var dataToWrite = pendingWrites[key];
      delete pendingWrites[key];
      delete writeTimers[key];
      upsertCloudValue(key, dataToWrite);
    }, 500);
  }

  function upsertCloudValue(key, value) {
    ensureClient().then(function (sb) {
      if (!sb || !session) return;
      return sb.from(TABLE).upsert({
        user_id: session.user.id,
        data_key: key,
        data_value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,data_key" });
    }).catch(function () {});
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
      if (typeof callback === "function") callback(res.data || []);
    }).catch(function () {
      if (typeof callback === "function") callback([]);
    });
  }

  function deleteData(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    ensureClient().then(function (sb) {
      if (!sb || !session) return;
      return sb.from(TABLE)
        .delete()
        .eq("user_id", session.user.id)
        .eq("data_key", key);
    }).catch(function () {});
  }

  function mergeLocalWithCloud(callback) {
    return ensureClient().then(function (sb) {
      if (!sb || !session) return [];
      return sb.from(TABLE)
        .select("data_key,data_value,updated_at")
        .eq("user_id", session.user.id);
    }).then(function (res) {
      if (!res || res.error) return [];
      var cloudRows = res.data || [];
      var cloudMap = {};
      cloudRows.forEach(function (row) { cloudMap[row.data_key] = row.data_value; });
      var localData = getAllLocalBusinessData();
      var localKeys = Object.keys(localData);
      var writes = [];

      cloudRows.forEach(function (row) {
        if (!Object.prototype.hasOwnProperty.call(localData, row.data_key)) {
          setLocalValue(row.data_key, row.data_value);
        }
      });

      localKeys.forEach(function (key) {
        writes.push(upsertCloudValue(key, localData[key]));
      });

      return Promise.all(writes).then(function () {
        if (typeof callback === "function") callback({ uploaded: localKeys.length, downloaded: cloudRows.length });
        return { uploaded: localKeys.length, downloaded: cloudRows.length };
      });
    }).catch(function () {
      if (typeof callback === "function") callback({ uploaded: 0, downloaded: 0 });
      return { uploaded: 0, downloaded: 0 };
    });
  }

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
    readData: readData,
    writeData: writeData,
    fetchAllKeys: fetchAllKeys,
    deleteData: deleteData
  };
})();
