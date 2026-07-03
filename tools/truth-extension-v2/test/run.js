// Harness test: load content.js against a mock Ads Manager page with a
// chrome API shim and a fixture CSV, verify matching, verdicts, and controls.
// Run from this folder: node run.js  (needs playwright installed anywhere reachable)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FIXTURE_CSV = [
  '"","Batch134.v1","","","Batch108.v4","","","Batch101.v3","","","OldOffAd","",""',
  '"Date","Spend","Purchases","CPA","Spend","Purchases","CPA","Spend","Purchases","CPA","Spend","Purchases","CPA"',
  '"3 Days","509.21","0","-","435.88","3","145.29","165.51","1","165.51","","",""',
  '"7 Days","1442.13","2","721.07","1197.53","8","149.69","710.61","1","710.61","","",""',
  '"14 Days","2711.39","22","123.25","1338.26","9","148.70","800.61","1","800.61","","",""',
  '"30 Days","3337.28","22","151.69","1716.49","10","171.65","900.61","2","450.31","95.00","0","-"',
  '"MTD","271.41","0","-","343.16","2","171.58","107.62","1","107.62","","",""'
].join('\n');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.addInitScript((csv) => {
    window.chrome = {
      storage: { local: { get: (k, cb) => cb({}), set: (o, cb) => cb && cb() } },
      runtime: { sendMessage: (msg, cb) => cb({ ok: true, text: csv }) }
    };
  }, FIXTURE_CSV);

  await page.goto('file://' + path.join(__dirname, 'mock.html'));
  await page.addStyleTag({ path: path.join(__dirname, '..', 'panel.css') });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'content.js') });
  await page.waitForTimeout(800);

  const matched = await page.locator('#um-truth-panel tbody tr').count();
  const names = await page.locator('#um-truth-panel td.um-name').allTextContents();
  const verdicts = await page.locator('#um-truth-panel .um-pill').allTextContents();
  const total = await page.locator('#um-truth-panel .um-total').textContent();

  // Window switch to 3D: Batch134.v1 has 0 purchases at $509 spend vs $40 target -> KILL
  await page.locator('[data-win="3d"]').click();
  await page.waitForTimeout(300);
  const verdicts3d = await page.locator('#um-truth-panel .um-pill').allTextContents();

  // Edit columns: turn off 30D CPA
  await page.locator('[data-act="cols"]').click();
  await page.locator('input[data-col="cpa30"]').setChecked(false);
  await page.locator('[data-act="closepop"]').click();
  await page.waitForTimeout(200);
  const headers = await page.locator('#um-truth-panel th').allTextContents();

  // Targets: set Elysium Jet target very high -> everything SCALEs
  await page.locator('[data-act="targets"]').click();
  await page.fill('input[data-target="Elysium Jet"]', '5000');
  await page.locator('input[data-target="Elysium Jet"]').dispatchEvent('change');
  await page.locator('[data-act="closepop"]').click();
  await page.waitForTimeout(200);
  const verdictsHighTarget = await page.locator('#um-truth-panel .um-pill').allTextContents();

  await page.screenshot({ path: path.join(__dirname, 'ext-test.png') });
  console.log(JSON.stringify({ matched, names, verdicts, total: (total || '').trim(), verdicts3d, headers, verdictsHighTarget, errors }, null, 2));
  await browser.close();
})();
