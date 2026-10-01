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
test('利用不可CSVは回答内容・背景・自由記述・時刻・得点を一切出力しない', () => {
  const s = state();
  s.researchUseProhibited = true; s.initialResearchConsent = true;
  s.background.age_group = '20_24';
  s.daily = { exam_types: ['toeic_lr'], toeic_lr_total: '850' };
  s.openResponses = { free_learning_experience: '保存されてはいけない内容' };
  const record = core.buildRecord(globalThis.SURVEY_CONFIG, data, s);
  assert.equal(record.research_use_allowed, 'no');
  assert.equal(record.record_type, 'refusal');
  assert.equal(record.consent, 'withdrawn');
  const metadata = new Set(['schema_version', 'study_id', 'instrument_version', 'consent_version', 'data_mode', 'response_id', 'record_type', 'research_use_allowed', 'consent']);
  for (const [key, value] of Object.entries(record)) if (!metadata.has(key)) assert.equal(value, '', key);
  assert.deepEqual(Object.keys(record), Object.keys(core.buildRecord(globalThis.SURVEY_CONFIG, data, state())));
  const early = core.buildRecord(globalThis.SURVEY_CONFIG, data, { researchUseProhibited: true, id: 'rq-refused' });
  assert.equal(early.consent, 'no');
  assert.equal(early.presentation_order, '');
});
test('複数選択・noneの排他性・解除した資格の詳細を正規化', () => {
  const normalized = core.normalizeDaily(data, {
    exam_types: ['eiken', 'toeic_lr', 'eiken'], toeic_lr_total: '850', eiken_latest_passed_grade: 'pre_2_plus', other_exam_details: '残してはいけない',
    reading_materials: ['news', 'none'], reading_materials_other: '残してはいけない', extra_reading_time: '60_to_179'
  });
  assert.equal(normalized.exam_types, 'toeic_lr|eiken');
  assert.equal(normalized.toeic_lr_total, '850');
  assert.equal(normalized.other_exam_details, '');
  assert.equal(normalized.reading_materials, 'none');
  assert.equal(normalized.reading_materials_other, '');
  const none = core.normalizeDaily(data, { exam_types: ['none', 'toeic_lr'], toeic_lr_total: '900' });
  assert.equal(none.exam_types, 'none'); assert.equal(none.toeic_lr_total, '');
});
test('新しい自由記述2項目を保存し練習回答を保存しない', () => {
  const s = state(); s.openResponses = { free_learning_experience: '楽しかった', free_reading_feelings: '不安もある' }; s.practiceAnswer = '5';
  const record = core.buildRecord(globalThis.SURVEY_CONFIG, data, s);
  assert.equal(record.schema_version, '2');
  assert.equal(record.free_learning_experience, '楽しかった');
  assert.equal(record.free_reading_feelings, '不安もある');
  assert.ok(!Object.keys(record).some(key => key.includes('practice')));
});
