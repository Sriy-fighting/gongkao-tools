/* =========================================================
   Supabase 数据同步层 · sync.js
   通过 Supabase REST API 实现跨设备数据同步
   =========================================================
   使用步骤:
   1. 在 https://supabase.com 注册账号（用 GitHub 登录）
   2. 创建项目 → SQL Editor → 执行下面的建表 SQL
   3. 复制 Project URL 和 anon key 填入下方常量

   -- 建表 SQL (在 Supabase SQL Editor 中执行) --
   CREATE TABLE user_data (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     sync_key text NOT NULL,
     data_key text NOT NULL,
     data_value jsonb DEFAULT '{}'::jsonb,
     updated_at timestamptz DEFAULT now(),
     UNIQUE (sync_key, data_key)
   );
   ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "用户可读写自己 sync_key 的数据"
     ON user_data FOR ALL
     USING (true)
     WITH CHECK (true);
   ========================================================= */

window.SyncStore = (function () {
  "use strict";

  // ============== 修改这里 ↓ ==============
  var SUPABASE_URL = "https://srevbdznsrvpwivvdfla.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_yDYTPr8uN7rw7oigBWaIgw_V2Fp9fzd";
  // ============== 修改这里 ↑ ==============

  var TABLE = "user_data";
  var STORED_SYNC_KEY = "gk-sync-key";
  var syncKey = null;

  var pendingWrites = {};
  var writeTimers = {};

  function generateSyncKey() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var key = "";
    for (var i = 0; i < 8; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  function init() {
    try { syncKey = localStorage.getItem(STORED_SYNC_KEY); } catch (e) {}
    if (!syncKey) {
      syncKey = generateSyncKey();
      try { localStorage.setItem(STORED_SYNC_KEY, syncKey); } catch (e) {}
    }
    return {
      hasConfig: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
      syncKey: syncKey
    };
  }

  function getSyncKey() { return syncKey; }

  function setSyncKey(key) {
    syncKey = key;
    try { localStorage.setItem(STORED_SYNC_KEY, key); } catch (e) {}
  }

  function isConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  function readData(key, callback) {
    var localData = null;
    try {
      var raw = localStorage.getItem(key);
      if (raw) localData = JSON.parse(raw);
    } catch (e) {}

    if (isConfigured() && syncKey) {
      fetchFromCloud(key, function (cloudData) {
        if (cloudData !== null) {
          try { localStorage.setItem(key, JSON.stringify(cloudData)); } catch (e) {}
          if (typeof callback === "function") callback(cloudData);
        } else if (typeof callback === "function") {
          callback(localData);
        }
      });
    } else {
      if (typeof callback === "function") {
        setTimeout(function () { callback(localData); }, 0);
      }
    }

    return localData;
  }

  function fetchFromCloud(key, callback) {
    if (!isConfigured() || !syncKey) {
      if (typeof callback === "function") callback(null);
      return;
    }

    var url = SUPABASE_URL + "/rest/v1/" + TABLE +
      "?select=data_value,updated_at" +
      "&sync_key=eq." + encodeURIComponent(syncKey) +
      "&data_key=eq." + encodeURIComponent(key);

    fetch(url, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Accept": "application/json"
      }
    })
    .then(function (resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    })
    .then(function (rows) {
      if (rows && rows.length > 0 && rows[0].data_value != null) {
        if (typeof callback === "function") callback(rows[0].data_value);
      } else {
        if (typeof callback === "function") callback(null);
      }
    })
    .catch(function () {
      if (typeof callback === "function") callback(null);
    });
  }

  function writeData(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}

    if (isConfigured() && syncKey) {
      pendingWrites[key] = value;
      if (writeTimers[key]) clearTimeout(writeTimers[key]);
      writeTimers[key] = setTimeout(function () {
        var dataToWrite = pendingWrites[key];
        delete pendingWrites[key];
        delete writeTimers[key];

        var url = SUPABASE_URL + "/rest/v1/" + TABLE + "?on_conflict=sync_key,data_key";
        var body = {
          sync_key: syncKey,
          data_key: key,
          data_value: dataToWrite,
          updated_at: new Date().toISOString()
        };

        fetch(url, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify(body)
        }).catch(function () {});
      }, 500);
    }
  }

  function fetchAllKeys(callback) {
    if (!isConfigured() || !syncKey) {
      if (typeof callback === "function") callback([]);
      return;
    }

    var url = SUPABASE_URL + "/rest/v1/" + TABLE +
      "?select=data_key,data_value,updated_at" +
      "&sync_key=eq." + encodeURIComponent(syncKey) +
      "&order=updated_at.desc";

    fetch(url, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Accept": "application/json"
      }
    })
    .then(function (resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    })
    .then(function (rows) {
      if (typeof callback === "function") callback(rows || []);
    })
    .catch(function () {
      if (typeof callback === "function") callback([]);
    });
  }


  function deleteData(key) {
    if (!isConfigured() || !syncKey) return;
    try { localStorage.removeItem(key); } catch (e) {}
    var url = SUPABASE_URL + "/rest/v1/" + TABLE +
      "?sync_key=eq." + encodeURIComponent(syncKey) +
      "&data_key=eq." + encodeURIComponent(key);
    fetch(url, {
      method: "DELETE",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      }
    }).catch(function () {});
  }

  return {
    init: init,
    getSyncKey: getSyncKey,
    setSyncKey: setSyncKey,
    isConfigured: isConfigured,
    readData: readData,
    writeData: writeData,
    fetchAllKeys: fetchAllKeys
  };
})();
