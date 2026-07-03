// Frame + fuzzy-matching test: grid lives in an iframe, names are split
// across spans, cased differently, and carry zero-width chars.
const { chromium } = require('playwright');
const path = require('path');

const FIXTURE_CSV = [
  '"","Batch134.v1","","","Batch108.v4","","","Batch101.v3","",""',
  '"Date","Spend","Purchases","CPA","Spend","Purchases","CPA","Spend","Purchases","CPA"',
  '"3 Days","509.21","0","-","435.88","3","145.29","165.51","1","165.51"',
  '"7 Days","1442.13","2","721.07","1197.53","8","149.69","710.61","1","710.61"',
  '"14 Days","2711.39","22","123.25","1338.26","9","148.70","800.61","1","800.61"',
  '"30 Days","3337.28","22","151.69","1716.49","10","171.65","900.61","2","450.31"',
  '"MTD","271.41","0","-","343.16","2","171.58","107.62","1","107.62"'
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

  await page.goto('file://' + path.join(__dirname, 'mock-frame.html'));
  await page.waitForTimeout(300);
  for (const frame of page.frames()) {
    await frame.addStyleTag({ path: path.join(__dirname, '..', 'panel.css') });
    await frame.addScriptTag({ path: path.join(__dirname, '..', 'content.js') });
  }
  await page.waitForTimeout(2500); // wait for the 2s sync interval in the child frame

  const gridFrame = page.frames().find((f) => f.url().includes('mock2'));
  const childPanel = await gridFrame.locator('#um-truth-panel').count();
  const childRows = await gridFrame.locator('#um-truth-panel tbody tr').count();
  const childNames = await gridFrame.locator('#um-truth-panel td.um-name').allTextContents();
  const topPanelHidden = await page.evaluate(() => {
    const p = document.getElementById('um-truth-panel');
    return p ? p.style.display === 'none' : 'missing';
  });

  await page.screenshot({ path: path.join(__dirname, 'ext-frame-test.png') });
  console.log(JSON.stringify({ childPanel, childRows, childNames, topPanelHidden, errors }, null, 2));
  await browser.close();
})();
