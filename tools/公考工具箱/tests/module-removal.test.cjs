const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const portal = path.resolve(__dirname, '..');
const syncSource = fs.readFileSync(path.join(portal, 'assets/js/sync.js'), 'utf8');
const removedKeys = ['wusi-speech-memorizer-v1', 'gk-recitation-v1', 'gk-review-library-v1', 'gk-review-library-v2', 'gk-study-plan-v2', 'gk-plan-index', 'gk-plan-2026-11', 'gk-plan-holidays', 'ebbinghaus_entries', 'ebbinghaus_entries:updatedAt'];
const journey = { active: { id: 'active', taskRef: { taskId: 'old' } }, sessions: [{ id: 'saved', minutes: 25, reflection: '保留复盘', taskRef: { taskId: 'old' } }], totalMinutes: 25, stamps: 1, settledIds: ['saved'] };
const json = value => JSON.parse(JSON.stringify(value));

function harness({ local = {}, rows = [], failDelete = false, loggedIn = true } = {}) {
  const storage = new Map(Object.entries(local).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  const localStorage = {
    get length() { return storage.size; },
    key: index => [...storage.keys()][index],
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  };
  const cloud = json(rows);
  const operations = [];
  const account = { user: { id: 'current-account', email: 'test@example.invalid' } };
  const client = {
    auth: { getSession: async () => ({ data: { session: loggedIn ? account : null } }), onAuthStateChange() {} },
    from(table) {
      assert.equal(table, 'user_data');
      const operation = { type: 'select', filters: [], keys: null };
      const query = {
        select() { return query; },
        order() { return query; },
        eq(key, value) { operation.filters.push([key, value]); return query; },
        in(key, values) { assert.equal(key, 'data_key'); operation.keys = values; return query; },
        maybeSingle() { operation.single = true; return query; },
        delete() { operation.type = 'delete'; return query; },
        upsert(value) { operation.type = 'upsert'; operation.value = json(value); return query; },
        then(resolve, reject) {
          try {
            operations.push(json(operation));
            const matches = row => operation.filters.every(([k, v]) => row[k] === v) && (!operation.keys || operation.keys.includes(row.data_key));
            let result;
            if (operation.type === 'delete') {
              if (failDelete) result = { error: new Error('delete denied') };
              else { for (let i = cloud.length - 1; i >= 0; i--) if (matches(cloud[i])) cloud.splice(i, 1); result = { error: null }; }
            } else if (operation.type === 'upsert') {
              const index = cloud.findIndex(row => row.user_id === operation.value.user_id && row.data_key === operation.value.data_key);
              if (index === -1) cloud.push(operation.value); else cloud[index] = operation.value;
              result = { error: null };
            } else {
              const selected = cloud.filter(matches);
              result = { data: operation.single ? selected[0] || null : json(selected), error: null };
            }
            return Promise.resolve(result).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        }
      };
      return query;
    }
  };
  const context = vm.createContext({ localStorage, document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } }, setTimeout() { return 1; }, clearTimeout() {}, console });
  context.window = context;
  context.supabase = { createClient: () => client };
  vm.runInContext(syncSource, context);
  return { api: context.SyncStore, storage, cloud, operations, context, localStorage };
}

test('startup removes all retired datasets and stamps, preserving other tools and focus records', () => {
  const local = { 'gk50:progress': { checked: ['a'] }, 'exam-history': [90], 'essay-draft': '正文', 'sl-stats': { score: 3 }, 'gk-theme': 'dark', 'sb-auth-token': 'untouched', 'gk-focus-journey': journey, 'gk-sync-stamp:gk-focus-journey': '2026-11-01', 'gk-tool-order': ['plan', 'exam', 'wusi', 'knowledge50', 'curve', 'review'], 'gk-tool-names-v1': { plan: '旧计划', review: '旧复盘', wusi: '背诵', curve: '安排', exam: '我的模考' } };
  removedKeys.forEach(key => { local[key] = { old: true }; local['gk-sync-stamp:' + key] = '2026-11-01'; });
  const h = harness({ local });
  removedKeys.forEach(key => { assert.equal(h.storage.has(key), false); assert.equal(h.storage.has('gk-sync-stamp:' + key), false); assert.equal(h.api.isBusinessKey(key), false); });
  assert.deepEqual(JSON.parse(h.storage.get('gk-tool-order')), ['exam', 'knowledge50']);
  assert.deepEqual(JSON.parse(h.storage.get('gk-tool-names-v1')), { exam: '我的模考' });
  const clean = JSON.parse(h.storage.get('gk-focus-journey'));
  assert.equal(clean.active.taskRef, undefined);
  assert.equal(clean.sessions[0].taskRef, undefined);
  assert.equal(clean.sessions[0].reflection, '保留复盘');
  assert.equal(clean.totalMinutes, 25);
  assert.equal(clean.stamps, 1);
  for (const key of ['gk50:progress', 'exam-history', 'essay-draft', 'sl-stats', 'gk-theme', 'sb-auth-token', 'gk-sync-stamp:gk-focus-journey']) assert.equal(h.storage.get(key), typeof local[key] === 'string' ? local[key] : JSON.stringify(local[key]));
  const before = [...h.storage]; h.api.cleanupLocalData(); assert.deepEqual([...h.storage], before);
});

test('retired reads and writes cannot recreate data or reach the cloud', async () => {
  const h = harness();
  for (const key of removedKeys) {
    h.api.writeData(key, { old: true });
    let called = false;
    assert.equal(h.api.readData(key, value => { called = true; assert.equal(value, null); }), null);
    assert.equal(called, true);
    assert.equal(h.storage.has(key), false);
  }
  assert.equal(h.operations.length, 0);
});

test('authenticated merge deletes only the current account retired rows and cleans shared cloud values', async () => {
  const rows = removedKeys.map(data_key => ({ user_id: 'current-account', data_key, data_value: { old: true }, updated_at: '2026-11-01T00:00:00Z' }));
  rows.push({ user_id: 'other-account', data_key: 'gk-review-library-v2', data_value: { private: true } });
  rows.push({ user_id: 'current-account', data_key: 'gk-focus-journey', data_value: journey, updated_at: '2026-11-14T00:00:00Z' });
  rows.push({ user_id: 'current-account', data_key: 'gk-tool-order', data_value: ['wusi', 'exam', 'plan'], updated_at: '2026-11-14T00:00:00Z' });
  rows.push({ user_id: 'current-account', data_key: 'gk50:progress', data_value: { checked: ['keep'] }, updated_at: '2026-11-14T00:00:00Z' });
  rows.push({ user_id: 'current-account', data_key: 'unrelated-private-data', data_value: 'ignore' });
  const h = harness({ rows });
  const result = await h.api.mergeLocalWithCloud();
  assert.equal(result.deleted, removedKeys.length);
  assert.equal(result.error, undefined);
  assert.equal(h.cloud.filter(row => row.user_id === 'current-account' && removedKeys.includes(row.data_key)).length, 0);
  assert.equal(h.cloud.find(row => row.user_id === 'other-account').data_value.private, true);
  const focus = h.cloud.find(row => row.data_key === 'gk-focus-journey');
  assert.equal(focus.data_value.sessions[0].taskRef, undefined);
  assert.equal(focus.data_value.totalMinutes, 25);
  assert.equal(focus.updated_at, '2026-11-14T00:00:00Z');
  assert.deepEqual(h.cloud.find(row => row.data_key === 'gk-tool-order').data_value, ['exam']);
  assert.equal(h.storage.has('unrelated-private-data'), false);
  assert.deepEqual(JSON.parse(h.storage.get('gk50:progress')), { checked: ['keep'] });
  const deletion = h.operations.find(op => op.type === 'delete');
  assert.deepEqual(deletion.filters, [['user_id', 'current-account']]);
});

test('cloud cleanup failures report an error, never restore retired rows, and retry on next sync', async () => {
  const h = harness({ failDelete: true, rows: [{ user_id: 'current-account', data_key: 'gk-study-plan-v2', data_value: { tasks: ['old'] } }] });
  assert.equal((await h.api.mergeLocalWithCloud()).error, true);
  assert.equal(h.storage.has('gk-study-plan-v2'), false);
  await h.api.mergeLocalWithCloud();
  assert.equal(h.operations.filter(op => op.type === 'delete').length, 2);
});

test('signed-out users still clean local data and receive the merge callback', async () => {
  const h = harness({ loggedIn: false, local: { 'gk-plan-index': ['old'], 'gk50:keep': { done: true } } });
  let called = false;
  await h.api.mergeLocalWithCloud(result => { called = true; assert.equal(result.skipped, true); });
  assert.equal(called, true);
  assert.equal(h.operations.length, 0);
  assert.equal(h.storage.has('gk-plan-index'), false);
  assert.equal(h.storage.has('gk50:keep'), true);
});

test('importing an old portal backup filters retired datasets and detaches focus tasks', () => {
  const h = harness({ loggedIn: false });
  const backup = { 'gk-review-library-v2': { questions: ['old'] }, 'gk-study-plan-v2': { tasks: ['old'] }, 'gk-tool-order': ['plan', 'speed'], 'gk-tool-names-v1': { review: '旧复盘', speed: '速算' }, 'gk-focus-journey': journey, 'gk50:progress': { checked: ['keep'] } };
  h.context.FileReader = class { readAsText() { this.onload({ target: { result: JSON.stringify(backup) } }); } };
  vm.runInContext(fs.readFileSync(path.join(portal, 'assets/js/portal.js'), 'utf8'), h.context);
  h.context.handleImportFile({ target: { files: [{}], value: 'backup.json' } });
  assert.equal(h.storage.has('gk-study-plan-v2'), false);
  assert.equal(h.storage.has('gk-review-library-v2'), false);
  assert.deepEqual(JSON.parse(h.storage.get('gk-tool-order')), ['speed']);
  assert.deepEqual(JSON.parse(h.storage.get('gk-tool-names-v1')), { speed: '速算' });
  assert.equal(JSON.parse(h.storage.get('gk-focus-journey')).sessions[0].taskRef, undefined);
  assert.deepEqual(JSON.parse(h.storage.get('gk50:progress')), { checked: ['keep'] });
});

test('deleted modules and dedicated assets are absent; retained page resources exist', () => {
  const root = path.resolve(portal, '../..');
  for (const relative of ['tools/五四讲话背诵', 'tools/遗忘曲线', 'tools/公考工具箱/reviews', 'tools/公考工具箱/assets/js/recitation.js', 'tools/公考工具箱/assets/js/review-app.js', 'tools/公考工具箱/assets/css/recitation.css', 'tools/公考工具箱/assets/css/review.css']) assert.equal(fs.existsSync(path.join(root, relative)), false, relative);
  const html = fs.readFileSync(path.join(portal, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /data-(?:view|tool-name)="(?:plan|curve|wusi|review)"|journey-task|journey-mark-done|journey-move-today/);
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const resource = match[1].split('?')[0];
    if (!/^(?:https?:|data:)/.test(resource)) assert.equal(fs.existsSync(path.resolve(portal, decodeURIComponent(resource))), true, resource);
  }
  assert.match(html, /data-view="knowledge50"/);
  assert.match(html, /id="journey-complete-modal"/);
});
