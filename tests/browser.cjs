/* Dev-only: Playwright + installed Chrome. No runtime dependency for respondents. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const data = require('../site/items.js');
const headed = process.env.SURVEY_TEST_HEADED === '1';
const base = process.env.SURVEY_TEST_URL || 'http://127.0.0.1:8000/';
const output = path.resolve(__dirname, '../test-results');
fs.mkdirSync(output, { recursive: true });

async function start(page) {
  for (const checkbox of await page.locator('#consent-form input[required]').all()) await checkbox.check();
  await page.locator('#prohibit-use-no').check();
  await page.locator('#start').click();
}
async function answerAll(page, value = 'SKIP') {
  for (let p = 0; p < data.items.length; p++) {
    assert.doesNotMatch(await page.locator('#app').innerText(), /Part A|PART A|Part B|PART B|パート[AB]/);
    assert.equal(await page.locator('a:not([href^="#"])').count(), 0);
    for (const input of await page.locator(`.question input[value="${value}"]`).all()) await input.check();
    await page.locator('#next').click();
  }
}
async function downloadRow(page, button, name) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator(button).click()]);
  const file = path.join(output, name || download.suggestedFilename());
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
  const rows = JSON.parse(execFileSync('python3', ['-c', 'import csv,json,sys; print(json.dumps(list(csv.DictReader(open(sys.argv[1],encoding="utf-8-sig",newline=""))),ensure_ascii=False))', file], { encoding: 'utf8' }));
  assert.equal(rows.length, 1);
  return { row: rows[0], bytes, filename: download.suggestedFilename() };
}
function assertRefusal(row) {
  assert.equal(row.research_use_allowed, 'no'); assert.equal(row.record_type, 'refusal');
  const permitted = new Set(['schema_version', 'study_id', 'instrument_version', 'consent_version', 'data_mode', 'response_id', 'record_type', 'research_use_allowed', 'consent']);
  for (const [key, value] of Object.entries(row)) if (!permitted.has(key)) assert.equal(value, '', key);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: !headed });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (!request.url().startsWith(new URL(base).origin) && !request.url().startsWith('blob:')) externalRequests.push(request.url()); });
    await page.goto(base);
    assert.match(await page.locator('#app').innerText(), /結果によって成績が下がることはありません/);
    assert.match(await page.locator('#app').innerText(), /回答にかかった時間と操作の記録/);
    assert.match(await page.locator('[name=consent]').locator('..').innerText(), /調査担当者からの事前説明/);
    assert.match(await page.locator('#app').innerText(), /個人が特定されるような形式で公開することはありません/);
    await page.screenshot({ path: path.join(output, 'desktop-welcome.png'), fullPage: true });
    assert.equal(await page.locator('[name=prohibit-use]:checked').count(), 0);
    assert.equal(await page.locator('a[href="about.html"]').count(), 0);
    assert.doesNotMatch(await page.locator('body').innerText(), /試作版|preview|GitHub Pages|計時中断回数/);
    for (const checkbox of await page.locator('#consent-form input[required]').all()) await checkbox.check();
    await page.locator('#start').click();
    assert.equal(await page.locator('#consent-form').count(), 1);
    assert.match(await page.locator('#error').innerText(), /はい.*いいえ/);
    await page.locator('[name=consent]').uncheck();
    await page.locator('#prohibit-use-no').check(); await page.locator('#start').click();
    assert.equal(await page.locator('#consent-form').count(), 1);
    await start(page);
    await page.locator('[name=participant_name]').fill('山田 "テスト",確認');
    await page.locator('[name=student_id]').fill('001234');
    await page.screenshot({ path: path.join(output, 'desktop-background.png'), fullPage: true });
    await page.locator('[name=age_group]').selectOption('20_24');
    await page.locator('[name=reading_frequency]').selectOption('weekly_3_4');
    await page.locator('#next').click();
    await page.locator('[name=exam_types][value=toeic_lr]').check();
    await page.locator('[name=toeic_lr_total]').fill('995');
    await page.locator('#next').click(); assert.equal(await page.locator('#daily-form').count(), 1);
    await page.locator('[name=toeic_lr_total]').fill('850');
    await page.locator('[name=toeic_lr_reading]').fill('350');
    await page.locator('#next').click(); assert.ok(await page.locator('#error').isVisible());
    await page.locator('[name=toeic_lr_reading]').fill('400');
    assert.ok(await page.locator('#error').isHidden());
    await page.locator('[name=toeic_test_month]').fill('2025-06');
    await page.locator('[name=exam_types][value=eiken]').check();
    await page.locator('[name=eiken_latest_passed_grade]').selectOption('pre_2_plus');
    await page.locator('[name=exam_types][value=other]').check();
    await page.locator('[name=other_exam_details]').fill('=その他の試験,"結果"\n600点');
    // Exclusive none and stale details must clear.
    await page.locator('[name=exam_types][value=none]').check();
    assert.equal(await page.locator('[name=exam_types]:checked').count(), 1);
    assert.ok(await page.locator('[name=toeic_lr_total]').isDisabled());
    assert.equal(await page.locator('[name=toeic_lr_total]').inputValue(), '');
    for (const value of ['toeic_lr', 'eiken', 'other']) await page.locator(`[name=exam_types][value=${value}]`).check();
    assert.equal(await page.locator('[name=exam_types][value=none]').isChecked(), false);
    await page.locator('[name=toeic_lr_total]').fill('850');
    await page.locator('[name=toeic_lr_reading]').fill('400');
    await page.locator('[name=toeic_test_month]').fill('2025-06');
    await page.locator('[name=eiken_latest_passed_grade]').selectOption('pre_2_plus');
    await page.locator('[name=other_exam_details]').fill('=その他の試験,"結果"\n600点');
    await page.locator('[name=extra_reading_frequency]').selectOption('weekly');
    await page.locator('[name=extra_reading_time]').selectOption('30_to_59');
    await page.locator('[name=reading_materials][value=other]').check();
    await page.locator('[name=reading_materials_other]').fill('古い入力');
    await page.locator('[name=reading_materials][value=none]').check();
    assert.equal(await page.locator('[name=reading_materials_other]').inputValue(), '');
    for (const value of ['news', 'social', 'other']) await page.locator(`[name=reading_materials][value=${value}]`).check();
    await page.locator('[name=reading_materials_other]').fill('海外のレシピ');
    await page.locator('[name=extensive_reading_experience]').selectOption('yes');
    await page.locator('[name=english_country_stay_3months]').selectOption('no');
    await page.screenshot({ path: path.join(output, 'desktop-daily.png'), fullPage: true });
    await page.locator('#next').click();
    await page.locator('[name=practice][value="4"]').check();
    assert.match(await page.locator('#progress-detail').innerText(), /0 \/ 40/);
    await page.screenshot({ path: path.join(output, 'desktop-practice.png'), fullPage: true });
    await page.locator('#next').click();
    await page.locator('#next').click(); assert.ok(await page.locator('#error').isVisible());
    const initialOrder = await page.locator('.question').evaluateAll(nodes => nodes.map(n => n.id));
    assert.equal(initialOrder.length, 1);
    // 実際に別タブへ移って計時停止イベントを発生させる。
    if (headed) {
      // Playwrightは通常フォーカスを常時trueにエミュレートするため、この検証では解除する。
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
      await page.bringToFront();
      await page.waitForFunction(() => !document.hidden && document.hasFocus());
      const otherTab = await context.newPage(); await otherTab.bringToFront();
      await page.waitForFunction(() => document.hidden || !document.hasFocus());
      await otherTab.waitForTimeout(120);
      await page.bringToFront(); await otherTab.close();
      await page.waitForFunction(() => !document.hidden && document.hasFocus());
      await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await cdp.detach();
    }
    const expected = {}, displayed = [], languages = [];
    for (let p = 0; p < data.items.length; p++) {
      assert.doesNotMatch(await page.locator('body').innerText(), /PART [AB]|パート[AB]|試作版|preview/);
      assert.equal(await page.locator('a:not([href^="#"])').count(), 0);
      const names = await page.locator('.question').evaluateAll(nodes => nodes.map(n => n.id.slice(9)));
      displayed.push(...names);
      assert.equal(names.length, 1);
      const language = data.items.find(item => item.id === names[0]).language;
      languages.push(language);
      assert.match(await page.locator('h2').innerText(), language === 'ja' ? /日本語/ : /英語/);
      assert.equal(Number(await page.locator('#progress').getAttribute('value')), p + 3);
      if (language === 'ja' && !languages.slice(0, -1).includes('ja')) await page.screenshot({ path: path.join(output, 'desktop-japanese.png'), fullPage: true });
      for (const id of names) {
        const value = id === 'AC01' ? '2' : id === 'A13' ? 'NA' : id === 'B01' ? 'SKIP' : String((Number(id.slice(1)) % 5) + 1);
        expected[id] = value;
        await page.locator(`input[name="${id}"][value="${value}"]`).check();
      }
      if (p === 0) {
        await page.screenshot({ path: path.join(output, 'desktop-questions.png'), fullPage: true });
        await page.locator('#back').click(); await page.locator('#back').click();
        assert.equal(await page.locator('[name=toeic_lr_total]').inputValue(), '850');
        assert.equal(await page.locator('[name=exam_types]:checked').count(), 3);
        await page.locator('#back').click();
        assert.equal(await page.locator('[name=reading_frequency]').inputValue(), 'weekly_3_4');
        assert.equal(await page.locator('[name=participant_name]').inputValue(), '山田 "テスト",確認');
        assert.equal(await page.locator('[name=student_id]').inputValue(), '001234');
        for (let i = 0; i < 3; i++) await page.locator('#next').click();
        assert.deepEqual(await page.locator('.question').evaluateAll(nodes => nodes.map(n => n.id)), initialOrder);
        for (const id of names) assert.ok(await page.locator(`input[name="${id}"][value="${expected[id]}"]`).isChecked());
        const firstId = names[0];
        const temporary = expected[firstId] === '5' ? '4' : '5';
        await page.locator(`input[name="${firstId}"][value="${temporary}"]`).check();
        await page.locator(`input[name="${firstId}"][value="${expected[firstId]}"]`).check();
      }
      await page.locator('#next').click();
    }
    assert.equal(new Set(displayed).size, 40);
    assert.equal(languages.filter((value, i) => i > 0 && value !== languages[i - 1]).length, 1);
    assert.ok(Number(await page.locator('#progress').getAttribute('value')) < 45);
    await page.locator('#free_learning_experience').fill('=英語学習,"楽しい"\n改行テスト');
    await page.locator('#free_reading_feelings').fill('長い英文は不安。でも物語は楽しい。');
    await page.screenshot({ path: path.join(output, 'desktop-open.png'), fullPage: true });
    await page.locator('#next').click(); await page.locator('#back').click();
    assert.equal(await page.locator('#free_reading_feelings').inputValue(), '長い英文は不安。でも物語は楽しい。');
    await page.locator('#next').click();
    assert.match(await page.locator('.review-identity').innerText(), /001234/);
    await page.locator('#prohibit-use-yes').check();
    await page.locator('#edit-background').click();
    assert.equal(await page.locator('[name=student_id]').inputValue(), '001234');
    await page.locator('[name=student_id]').fill('001234A');
    await page.locator('#next').click();
    assert.equal(await page.locator('#complete').count(), 1);
    assert.ok(await page.locator('#prohibit-use-yes').isChecked());
    assert.match(await page.locator('.review-identity').innerText(), /001234A/);
    await page.locator('#edit-background').click();
    await page.locator('[name=student_id]').fill('001234');
    await page.locator('#next').click();
    await page.locator('#prohibit-use-no').check();
    await page.screenshot({ path: path.join(output, 'desktop-review.png'), fullPage: true });
    const first = await downloadRow(page, '#complete'); const row = first.row;
    for (const item of data.items) assert.equal(row[item.id], expected[item.id]);
    assert.equal(row.schema_version, '4');
    assert.equal(Object.keys(row).length, 301);
    assert.equal(row.participant_name, '山田 "テスト",確認'); assert.equal(row.student_id, '001234'); assert.equal(row.research_use_allowed, 'yes');
    assert.equal(row.data_mode, 'live');
    assert.equal(row.study_id, 'reading-questionnaire-shared'); assert.equal(row.attention_check, 'pass');
    assert.equal(row.metacognitive_mean_complete, ''); assert.equal(row.enjoyment_pleasure_candidate_mean_complete, '');
    assert.equal(row.exam_types, 'toeic_lr|eiken|other'); assert.equal(row.toeic_lr_total, '850'); assert.equal(row.toeic_lr_reading, '400');
    assert.equal(row.eiken_latest_passed_grade, 'pre_2_plus');
    assert.equal(row.other_exam_details, '\'=その他の試験,"結果"\n600点');
    assert.equal(row.reading_materials, 'social|news|other'); assert.equal(row.reading_materials_other, '海外のレシピ');
    assert.equal(row.extra_reading_frequency, 'weekly'); assert.equal(row.extra_reading_time, '30_to_59');
    assert.equal(row.extensive_reading_experience, 'yes'); assert.equal(row.english_country_stay_3months, 'no');
    assert.equal(row.free_learning_experience, '\'=英語学習,"楽しい"\n改行テスト');
    assert.equal(row.free_reading_feelings, '長い英文は不安。でも物語は楽しい。');
    assert.equal(row.presentation_order, displayed.join('|'));
    assert.equal(row.language_block_order, [...new Set(languages)].join('|'));
    assert.equal(row.timing_method, 'single_item_visible_focused_v1');
    for (const item of data.items) {
      for (const field of ['rt_first_ms', 'active_ms', 'visit_n', 'change_n', 'pause_n']) assert.match(row[`${item.id}_${field}`], /^\d+$/);
      assert.ok(Number(row[`${item.id}_rt_first_ms`]) <= Number(row[`${item.id}_active_ms`]));
      assert.ok(Number(row[`${item.id}_visit_n`]) >= 1);
    }
    assert.equal(row[`${displayed[0]}_visit_n`], '2');
    assert.equal(row[`${displayed[0]}_change_n`], '2');
    if (headed) assert.ok(Number(row[`${displayed[0]}_pause_n`]) >= 1);
    assert.match(await page.locator('#progress-text').innerText(), /100%/);
    assert.ok(!Object.keys(row).some(key => key.includes('practice')));
    const retry = await downloadRow(page, '#download', 'retry.csv'); assert.deepEqual(retry.bytes, first.bytes);
    await page.screenshot({ path: path.join(output, 'desktop-complete.png'), fullPage: true });
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(externalRequests, []); assert.deepEqual(errors, []);
    await page.locator('#clear').click();
    // Early refusal needs no eligibility or participation affirmation and asks no questions.
    await page.locator('#prohibit-use-yes').check();
    const early = await downloadRow(page, '#start', 'early-refusal.csv');
    assertRefusal(early.row); assert.equal(early.row.consent, 'no'); assert.ok(early.filename.includes('no_use'));

    const mobile = await context.newPage(); await mobile.setViewportSize({ width: 320, height: 812 });
    await mobile.goto(base); await mobile.screenshot({ path: path.join(output, 'mobile-welcome.png'), fullPage: true });
    await start(mobile);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.screenshot({ path: path.join(output, 'mobile-background.png'), fullPage: true });
    await mobile.locator('#next').click();
    await mobile.locator('[name=exam_types][value=toeic_lr]').check();
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.screenshot({ path: path.join(output, 'mobile-daily.png'), fullPage: true });
    await mobile.locator('#next').click();
    await mobile.screenshot({ path: path.join(output, 'mobile-practice.png'), fullPage: true });
    await mobile.locator('#next').click();
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.screenshot({ path: path.join(output, 'mobile-questions.png'), fullPage: true });
    await mobile.locator('.question input[type=radio]').first().focus();
    await mobile.keyboard.press('ArrowRight');
    assert.equal(await mobile.locator('.question input:checked').inputValue(), '2');
    await mobile.keyboard.press('Tab');
    assert.equal(await mobile.evaluate(() => document.activeElement.id), 'back');
    await mobile.keyboard.press('Tab');
    assert.equal(await mobile.evaluate(() => document.activeElement.id), 'next');
    await mobile.keyboard.press('Enter');
    for (let i = 1; i < data.items.length; i++) {
      await mobile.locator('.question input[value=SKIP]').check(); await mobile.locator('#next').click();
    }
    await mobile.locator('#next').click();
    await mobile.locator('summary').click();
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.locator('summary').click();
    await mobile.screenshot({ path: path.join(output, 'mobile-review.png'), fullPage: true });
    mobile.on('dialog', dialog => dialog.accept()); await mobile.locator('#quit').click();

    const blocked = await context.newPage();
    await blocked.route('**/config.js', async route => { const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()) + '\nglobalThis.SURVEY_CONFIG = {...globalThis.SURVEY_CONFIG, mode: "live", participantInformationMode: "onsite"};' }); });
    await blocked.goto(base); assert.equal(await blocked.locator('#start').count(), 0);

    const preview = await context.newPage();
    await preview.route('**/config.js', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nglobalThis.SURVEY_CONFIG = {...globalThis.SURVEY_CONFIG, mode: "preview"};' });
    });
    await preview.goto(base); await preview.locator('#prohibit-use-yes').check();
    const previewRefusal = await downloadRow(preview, '#start', 'preview-refusal.csv');
    assert.equal(previewRefusal.row.data_mode, 'preview'); assertRefusal(previewRefusal.row);

    const live = await context.newPage();
    await live.route('**/config.js', async route => {
      const response = await route.fetch();
      const override = { mode: 'live', participantInformationMode: 'onsite', researcher: 'テスト責任者', affiliation: 'テスト所属', contact: 'テスト連絡先', ethicsStatement: 'テスト用説明', retentionStatement: 'テスト用保管説明', withdrawalStatement: 'テスト用撤回説明', submissionUrl: 'https://example.org/upload' };
      await route.fulfill({ response, body: (await response.text()) + '\nglobalThis.SURVEY_CONFIG = {...globalThis.SURVEY_CONFIG,...' + JSON.stringify(override) + '};' });
    });
    await live.goto(base); await start(live);
    await live.locator('[name=participant_name]').fill('保存しない氏名');
    await live.locator('[name=student_id]').fill('00REFUSED');
    for (let i = 0; i < 3; i++) await live.locator('#next').click();
    await answerAll(live, '5');
    await live.locator('#free_learning_experience').fill('この回答を保存しないこと');
    await live.locator('#next').click(); await live.locator('#prohibit-use-yes').check();
    await live.locator('#back').click(); await live.locator('#next').click();
    assert.ok(await live.locator('#prohibit-use-yes').isChecked());
    const refusal = await downloadRow(live, '#complete', 'completed-refusal.csv');
    assertRefusal(refusal.row); assert.equal(refusal.row.consent, 'withdrawn');
    assert.equal(await live.getByRole('link', { name: '指定された提出先を開く ↗' }).getAttribute('href'), 'https://example.org/upload');
    await live.locator('#clear').click();
    assert.equal(await live.locator('[name=prohibit-use]:checked').count(), 0);
    await start(live);
    assert.equal(await live.locator('[name=participant_name]').inputValue(), '');
    assert.equal(await live.locator('[name=student_id]').inputValue(), '');
    for (let i = 0; i < 3; i++) await live.locator('#next').click(); await answerAll(live);
    await live.locator('#next').click();
    const allowed = await downloadRow(live, '#complete', 'live-empty-optionals.csv');
    assert.equal(allowed.row.participant_name, ''); assert.equal(allowed.row.student_id, '');
    assert.equal(allowed.row.research_use_allowed, 'yes'); assert.equal(allowed.row.exam_types, 'SKIP');
    assert.equal(allowed.row.free_reading_feelings, ''); assert.ok(allowed.filename.startsWith('reading_live_'));

    const file = await context.newPage(); await file.goto(pathToFileURL(path.resolve(__dirname, '../site/index.html')).href);
    assert.equal(await file.locator('#start').count(), 1);
    console.log(JSON.stringify({ status: 'passed', nativeTabPause: headed, downloadedColumns: Object.keys(row).length, itemCount: 40, dailyQuestions: 6, openQuestions: 2, refusalContent: 'empty', externalRequests: externalRequests.length, consoleErrors: errors.length, screenshots: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
