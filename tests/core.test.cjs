const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../site/core.js');
const data = require('../site/items.js');
require('../site/config.js');

function state() {
  return { id: 'rq-test', consentedAt: '2026-10-01T01:00:00.000Z', completedAt: '2026-10-01T01:10:00.000Z', elapsedSeconds: 600,
    pages: core.makePages(data.items), answers: Object.fromEntries(data.items.map(item => [item.id, '3'])), background: {}, feedback: '' };
}
test('尺度の構成は23+9項目と独立した注意確認1項目', () => {
  assert.equal(data.items.length, 33);
  assert.equal(new Set(data.items.map(i => i.id)).size, 33);
  assert.deepEqual(['cognitive', 'metacognitive', 'classroom'].map(d => data.items.filter(i => i.dimension === d).length), [12, 7, 4]);
  assert.equal(data.items.filter(i => i.part === 'B').length, 9);
});
test('各パートのランダム化で項目が欠落・重複せず、元データを変更しない', () => {
  const original = JSON.stringify(data.items);
  for (const random of [() => 0, () => .999, Math.random]) {
    const pages = core.makePages(data.items, random);
    assert.equal(pages.length, 6);
    assert.ok(pages.every(p => p.ids.length <= 6));
    assert.deepEqual(pages.flatMap(p => p.ids).sort(), data.items.map(i => i.id).sort());
    assert.equal(pages.slice(0, 4).every(p => p.part === 'A'), true);
    assert.equal(pages.slice(4).every(p => p.part === 'B'), true);
  }
  assert.equal(JSON.stringify(data.items), original);
});
test('平均の分母・下位尺度・NA/SKIPの扱いが正しい', () => {
  const s = state();
  s.answers.A01 = '1'; s.answers.A02 = '5'; s.answers.A13 = 'NA'; s.answers.B01 = 'SKIP';
  const result = core.score(data.items, s.answers);
  assert.equal(result.cognitive_mean_complete, '3.0000');
  assert.equal(result.metacognitive_n, 6);
  assert.equal(result.metacognitive_mean_complete, '');
  assert.equal(result.enjoyment_pleasure_candidate_n, 2);
  assert.equal(result.enjoyment_pleasure_candidate_mean_complete, '');
  assert.equal(result.classroom_n, 4);
  assert.ok(!('total' in result));
});
test('回答が全て欠測でもゼロ得点を生成しない', () => {
  const answers = Object.fromEntries(data.items.map(item => [item.id, 'SKIP']));
  const result = core.score(data.items, answers);
  for (const [key, value] of Object.entries(result)) assert.equal(value, key.endsWith('_n') ? 0 : '');
});
test('BOM・CRLF・日本語・カンマ・引用符・改行を保持し数式を無害化', () => {
  const csv = core.toCsv([{ 日本語: '英語,読解"不安"\n続き', formula: '=1+1', tab: '\t@SUM(1)', count: 5 }]);
  assert.deepEqual([...Buffer.from(csv).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(csv, '\uFEFF"日本語","formula","tab","count"\r\n"英語,読解""不安""\n続き","\'=1+1","\'\t@SUM(1)","5"\r\n');
  for (const value of ['+1', '-1', '@SUM(A1)', '  =1', '\rtext', '\ntext']) assert.ok(core.csvCell(value).startsWith('"\''));
});
test('未回答・範囲外・壊れた提示順はCSV化を拒否', () => {
  const s = state(); delete s.answers.A01;
  assert.throws(() => core.buildRecord(globalThis.SURVEY_CONFIG, data, s), /未回答/);
  s.answers.A01 = '6';
  assert.throws(() => core.buildRecord(globalThis.SURVEY_CONFIG, data, s), /未回答/);
  s.answers.A01 = '2'; s.pages[0].ids[0] = 'B01';
  assert.throws(() => core.buildRecord(globalThis.SURVEY_CONFIG, data, s), /提示順/);
});
test('生回答と版、固定列順、注意確認を保存し自動除外しない', () => {
  const s = state(); s.answers.AC01 = '2'; s.answers.A01 = 'SKIP';
  const result = core.buildRecord(globalThis.SURVEY_CONFIG, data, s);
  assert.equal(result.data_mode, 'preview');
  assert.equal(result.A01, 'SKIP');
  assert.equal(result.scored_response_n, 31);
  assert.equal(result.attention_check, 'pass');
  s.answers.AC01 = '3';
  assert.equal(core.buildRecord(globalThis.SURVEY_CONFIG, data, s).attention_check, 'flag');
  s.answers.AC01 = 'NA';
  const other = core.buildRecord(globalThis.SURVEY_CONFIG, data, s);
  assert.equal(other.attention_check, 'missing');
  assert.deepEqual(Object.keys(result), Object.keys(other));
  assert.equal(result.presentation_order.split('|').length, 33);
});
test('本調査モードの必須説明が空欄なら開始できない', () => {
  const cfg = globalThis.SURVEY_CONFIG;
  assert.deepEqual(core.validateStudy(cfg), []);
  assert.ok(core.validateStudy({ ...cfg, mode: 'live' }).includes('contact'));
  assert.ok(core.validateStudy({ ...cfg, mode: 'typo' }).includes('mode'));
  assert.ok(core.validateStudy({ ...cfg, minimumAge: 16 }).length);
  const complete = { ...cfg, mode: 'live' };
  for (const key of core.validateStudy(complete)) complete[key] = '設定済み';
  assert.deepEqual(core.validateStudy(complete), []);
});
