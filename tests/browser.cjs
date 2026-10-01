/* Dev-only: requires Playwright and an installed Chrome. No dependency is shipped to respondents. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const data = require('../site/items.js');
const base = process.env.SURVEY_TEST_URL || 'http://127.0.0.1:8000/';
const output = path.resolve(__dirname, '../test-results');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (!request.url().startsWith(new URL(base).origin) && !request.url().startsWith('blob:')) externalRequests.push(request.url()); });
    await page.goto(base);
    await page.screenshot({ path: path.join(output, 'desktop-welcome.png'), fullPage: true });
    await page.locator('#start').click();
    assert.equal(await page.locator('#consent-form').count(), 1);
    for (const checkbox of await page.locator('#consent-form input').all()) await checkbox.check();
    await page.locator('#start').click();
    await page.locator('[name=age_group]').selectOption('20_24');
    await page.locator('[name=reading_frequency]').selectOption('weekly_3_4');
    await page.locator('[name=toeic_lr_reading]').fill('500');
    await page.locator('#next').click();
    assert.equal(await page.locator('#background-form').count(), 1);
    await page.locator('[name=toeic_lr_reading]').fill('350');
    await page.locator('[name=toeic_test_month]').fill('2025-06');
    await page.locator('#next').click();
    await page.locator('#next').click();
    assert.ok(await page.locator('#error').isVisible());
    const initialOrder = await page.locator('.question').evaluateAll(nodes => nodes.map(n => n.id));
    const expected = {};
    const displayed = [];
    for (let p = 0; p < 6; p++) {
      const names = await page.locator('.question').evaluateAll(nodes => nodes.map(n => n.id.slice(9)));
      displayed.push(...names);
      for (const id of names) {
        const value = id === 'AC01' ? '2' : id === 'A13' ? 'NA' : id === 'B01' ? 'SKIP' : String((Number(id.slice(1)) % 5) + 1);
        expected[id] = value;
        await page.locator(`input[name="${id}"][value="${value}"]`).check();
      }
      if (p === 0) {
        await page.screenshot({ path: path.join(output, 'desktop-questions.png'), fullPage: true });
        await page.locator('#back').click();
        assert.equal(await page.locator('[name=reading_frequency]').inputValue(), 'weekly_3_4');
        await page.locator('#next').click();
        assert.deepEqual(await page.locator('.question').evaluateAll(nodes => nodes.map(n => n.id)), initialOrder);
        for (const id of names) assert.ok(await page.locator(`input[name="${id}"][value="${expected[id]}"]`).isChecked());
      }
      await page.locator('#next').click();
    }
    assert.equal(new Set(displayed).size, 33);
    assert.match(await page.locator('#progress-text').innerText(), /33 \/ 33/);
    await page.locator('#feedback').fill('=日本語,"引用"\n改行テスト');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#complete').click()]);
    const csvPath = path.join(output, download.suggestedFilename());
    await download.saveAs(csvPath);
    const bytes = fs.readFileSync(csvPath);
    assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
    const parsed = JSON.parse(execFileSync('python3', ['-c', 'import csv,json,sys; print(json.dumps(list(csv.DictReader(open(sys.argv[1],encoding="utf-8-sig",newline=""))),ensure_ascii=False))', csvPath], { encoding: 'utf8' }));
    assert.equal(parsed.length, 1);
    const row = parsed[0];
    for (const item of data.items) assert.equal(row[item.id], expected[item.id]);
    assert.equal(row.data_mode, 'preview');
    assert.equal(row.metacognitive_mean_complete, '');
    assert.equal(row.enjoyment_pleasure_candidate_mean_complete, '');
    assert.equal(row.attention_check, 'pass');
    assert.equal(row.toeic_lr_reading, '350');
    assert.equal(row.reading_frequency, 'weekly_3_4');
    assert.equal(row.feedback, '\'=日本語,"引用"\n改行テスト');
    assert.equal(row.presentation_order, displayed.join('|'));
    const [retry] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
    await retry.saveAs(path.join(output, 'retry.csv'));
    assert.equal(fs.readFileSync(path.join(output, 'retry.csv'), 'utf8'), bytes.toString('utf8'));
    await page.screenshot({ path: path.join(output, 'desktop-complete.png'), fullPage: true });
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(errors, []);
    await page.locator('#clear').click();
    assert.equal(await page.locator('#consent-form').count(), 1);

    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 375, height: 812 });
    await mobile.goto(base);
    await mobile.screenshot({ path: path.join(output, 'mobile-welcome.png'), fullPage: true });
    for (const checkbox of await mobile.locator('#consent-form input').all()) await checkbox.check();
    await mobile.locator('#start').click();
    await mobile.locator('#next').click();
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.screenshot({ path: path.join(output, 'mobile-questions.png'), fullPage: true });
    await mobile.screenshot({ path: path.join(output, 'mobile-viewport.png') });
    mobile.on('dialog', dialog => dialog.accept());
    await mobile.locator('#quit').click();
    assert.equal(await mobile.locator('#consent-form').count(), 1);

    const blocked = await context.newPage();
    await blocked.route('**/config.js', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('mode: "preview"', 'mode: "live"') });
    });
    await blocked.goto(base);
    assert.equal(await blocked.locator('#start').count(), 0);
    assert.match(await blocked.locator('#app').innerText(), /調査の準備中/);

    const live = await context.newPage();
    await live.route('**/config.js', async route => {
      const response = await route.fetch();
      const override = { mode: 'live', researcher: 'テスト責任者', affiliation: 'テスト所属', contact: 'テスト連絡先', ethicsStatement: 'テスト用の説明', retentionStatement: 'テスト用の保管説明', withdrawalStatement: 'テスト用の撤回説明', submissionUrl: 'https://example.org/upload' };
      await route.fulfill({ response, body: (await response.text()) + '\nglobalThis.SURVEY_CONFIG = {...globalThis.SURVEY_CONFIG,...' + JSON.stringify(override) + '};' });
    });
    await live.goto(base);
    assert.equal(await live.locator('#mode-banner').isVisible(), false);
    for (const checkbox of await live.locator('#consent-form input').all()) await checkbox.check();
    await live.locator('#start').click(); await live.locator('#next').click();
    for (let p = 0; p < 6; p++) {
      for (const input of await live.locator('.question input[value=SKIP]').all()) await input.check();
      await live.locator('#next').click();
    }
    const [liveDownload] = await Promise.all([live.waitForEvent('download'), live.locator('#complete').click()]);
    assert.ok(liveDownload.suggestedFilename().startsWith('reading_live_'));
    assert.equal(await live.getByRole('link', { name: '指定された提出先を開く ↗' }).getAttribute('href'), 'https://example.org/upload');

    const file = await context.newPage();
    await file.goto(pathToFileURL(path.resolve(__dirname, '../site/index.html')).href);
    assert.equal(await file.locator('#start').count(), 1);
    console.log(JSON.stringify({ status: 'passed', downloadedColumns: Object.keys(row).length, itemCount: 33, externalRequests: externalRequests.length, consoleErrors: errors.length, screenshots: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
