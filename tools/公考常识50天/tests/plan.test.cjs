const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pagePath = path.resolve(__dirname, '../index.html');
const html = readFileSync(pagePath, 'utf8');
const script = html.match(/<script>\s*(const MODEL =[\s\S]*?)<\/script>/)[1];
const setup = script.slice(0, script.indexOf('/* ---- 渲染 ---- */'));

function load(saved = {}) {
  const values = new Map(Object.entries(saved).map(([key, value]) => [key, JSON.stringify(value)]));
  const writes = [];
  const context = vm.createContext({
    window: { SyncStore: { writeData: (key, value) => writes.push({ key, value }) } },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  });
  vm.runInContext(setup, context);
  return {
    read: expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
    run: expression => vm.runInContext(expression, context),
    values,
    writes
  };
}

test('all 494 points in 81 sections are learned once in 20 days and swept once in 10 days', () => {
  const { read } = load();
  const model = read('MODEL');
  const sections = Object.values(model.sections);
  const days = Object.values(model.schedule);
  assert.equal(sections.length, 81);
  assert.equal(sections.reduce((sum, section) => sum + section.items.filter(item => item.type === 'item').length, 0), 494);
  assert.deepEqual(Object.keys(model.schedule).map(Number), Array.from({ length: 30 }, (_, i) => i + 1));
  const gids = sections.map(section => section.gid).sort((a, b) => a - b);
  assert.deepEqual(days.flatMap(day => day.learn).sort((a, b) => a - b), gids);
  assert.deepEqual(days.flatMap(day => day.sweep?.gids || []).sort((a, b) => a - b), gids);
  for (let d = 1; d <= 30; d++) {
    const day = model.schedule[d];
    assert.equal(day.learn.length > 0, d <= 20);
    assert.equal(Boolean(day.sweep), d > 20);
    if (d <= 20) {
      const count = day.learn.reduce((sum, gid) => sum + model.sections[gid].count, 0);
      assert.ok(count >= 18 && count <= 30, `day ${d} load ${count}`);
    }
    assert.ok(read(`requiredKeys(${d}).length`) > 0);
    assert.equal(read(`cellHTML(${d})`).includes('undefined'), false);
  }
});

test('every due review uses its new learning day and does not duplicate that day’s sweep', () => {
  const { read } = load();
  const { schedule } = read('MODEL');
  const offsets = read('REVIEW_OFFSETS');
  assert.deepEqual(offsets, [1, 2, 4, 7, 15]);
  for (let d = 1; d <= 30; d++) {
    const day = schedule[d];
    const expected = offsets.flatMap(off => {
      const source = schedule[d - off];
      const gids = (source?.learn || []).filter(gid => !day.sweep?.gids.includes(gid));
      return gids.length ? [{ off, src: d - off, gids }] : [];
    });
    assert.deepEqual(day.reviews.map(({ off, src, gids }) => ({ off, src, gids })), expected);
    const keys = read(`requiredKeys(${d})`);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test('all 43 original law images remain reachable once, within the first 15 days', () => {
  const { read } = load();
  const images = Array.from({ length: 30 }, (_, i) => read(`lawImagesForDay(${i + 1})`));
  assert.deepEqual(images.flat(), Array.from({ length: 43 }, (_, i) => i + 1));
  assert.equal(images.slice(15).flat().length, 0);
  for (const image of images.flat()) {
    assert.ok(existsSync(path.resolve(path.dirname(pagePath), read(`lawImageSrc(${image})`))));
  }
});

test('legacy additions migrate all 50 days once and retain text, IDs and completion', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({
    id: `item-${i + 1}`, day: i + 1, title: `Title ${i + 1}`, text: `Text 【${i + 1}】`, order: i
  }));
  const saved = { 'gk50:custom-content': { version: 1, items }, 'gk50:checks': { l0: true, 'custom-item-50': true } };
  const first = load(saved);
  const migrated = first.read('customContent');
  assert.equal(migrated.version, 2);
  assert.equal(migrated.items.length, 50);
  for (let i = 0; i < 50; i++) {
    const source = items[i];
    assert.equal(migrated.items[i].day, source.day <= 40 ? Math.ceil(source.day / 2) : source.day - 20);
    assert.equal(migrated.items[i].text, source.text);
    assert.equal(migrated.items[i].id, source.id);
  }
  assert.equal(first.read('checks.l0'), true);
  assert.equal(first.read("checks[customCompleteKey('item-50')]"), true);
  assert.ok(first.read('requiredKeys(30)').includes('custom-item-50'));
  // Reading a legacy snapshot must not make it newer than an incoming cloud snapshot.
  assert.equal(first.writes.length, 0);
  const second = load({ ...saved, 'gk50:custom-content': migrated });
  assert.deepEqual(second.read('customContent'), migrated);
  assert.equal(second.writes.length, 0);
  first.run('customContent = loadCustomContent()');
  assert.deepEqual(first.read('customContent'), migrated);
  first.run('saveCustomContent()');
  assert.equal(JSON.parse(first.values.get('gk50:custom-content')).version, 2);
  first.run('customContent = loadCustomContent()');
  assert.deepEqual(first.read('customContent'), migrated);
});

test('new additions keep their chosen day, and invalid legacy days are rejected', () => {
  const { read } = load();
  const item = { id: 'new', day: 30, title: 'New', text: 'New 【point】' };
  assert.equal(read(`normalizeCustomContent(${JSON.stringify({ version: 2, items: [item] })}).items[0].day`), 30);
  for (const day of [0, -1, 1.5, 51]) {
    assert.equal(read(`normalizeCustomContent(${JSON.stringify({ version: 1, items: [{ ...item, day }] })}).items.length`), 0);
  }
});

test('new review checks cannot inherit old day checks; content edits invalidate both formats', () => {
  const { run, read } = load({ 'gk50:checks': { l0: true, 'r2-0-1': true, 's41-0': true, l1: true } });
  assert.ok(read('requiredKeys(2)').includes('r30d2-0-1'));
  assert.equal(read("!!checks[reviewCheckKey(2,0,1)]"), false);
  run("checks['r30d2-0-1']=true; checks['s30d21-0']=true; invalidateSectionChecks(0)");
  assert.deepEqual(read('checks'), { l1: true });
});

test('all inline page scripts parse successfully', () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1]);
  }
});
