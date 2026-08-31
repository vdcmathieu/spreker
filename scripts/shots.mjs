/**
 * Screenshot pass. Design work needs looking at, so this drives a headed-size
 * Chromium over the running dev server and writes one PNG per section, plus a
 * console log, into .review/.
 *
 *   node scripts/shots.mjs [url]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const URL_ = process.argv[2] ?? 'http://localhost:3000';
const OUT = '.review';

const SECTIONS = ['source', 'room', 'rig', 'delivery', 'book'];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const log = [];

async function pass(label, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => log.push(`[${label}] ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => log.push(`[${label}] pageerror: ${e.message}`));

  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // let the canvases settle

  await page.screenshot({ path: `${OUT}/${label}-00-top.png` });

  for (const id of SECTIONS) {
    await page.evaluate((sid) => {
      document.getElementById(sid)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }, id);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${label}-${id}.png` });
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${label}-footer.png` });

  // Horizontal overflow is the classic failure at narrow widths.
  const overflow = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
        bad.push(
          `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 60)} → ${Math.round(r.left)}..${Math.round(r.right)} (vw ${window.innerWidth})`,
        );
      }
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      offenders: bad.slice(0, 12),
    };
  });
  log.push(`[${label}] overflow ${JSON.stringify(overflow, null, 2)}`);

  await ctx.close();
}

await pass('desktop', 1440, 900);
await pass('mobile', 390, 844);
await pass('tablet', 834, 1112);

await writeFile(`${OUT}/console.txt`, log.join('\n'));
await browser.close();
console.log(log.join('\n'));
