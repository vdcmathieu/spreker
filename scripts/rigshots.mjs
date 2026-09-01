/**
 * Every rig, close. The three cabinets are the point of the section, so each
 * one gets its own PNG at 1440 and one at 390.
 *
 *   node scripts/rigshots.mjs [url]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const URL_ = process.argv[2] ?? 'http://localhost:3000';
const OUT = '.review';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  // No swiftshader here, unlike the room pass: the default headless GL draws
  // meshStandardMaterial perfectly well, and software rendering starves the
  // main thread badly enough that page.evaluate never gets a turn.
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const log = [];

// One throwaway load first. The dev server compiles the edited chunk *while*
// serving the request that triggered it, so the first page load after a change
// gets the previous build - and every screenshot in this pass would then be one
// edit behind, which is a very slow way to review a change you already made.
{
  const warm = await browser.newContext();
  const page = await warm.newPage();
  await page.goto(URL_, { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(4000);
  await warm.close();
}

for (const [label, width, height] of [
  ['rig-1440', 1440, 900],
  ['rig-390', 390, 844],
]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('console', (m) => log.push(`[${label}] ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => log.push(`[${label}] pageerror: ${e.message}`));
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(3200);
  await page.evaluate(() =>
    document.getElementById('rig')?.scrollIntoView({ block: 'start', behavior: 'instant' }),
  );
  await page.waitForTimeout(900);

  for (const name of ['Keuken', 'Tuin', 'Schuur']) {
    console.log(`${label} ${name}`);
    await page.getByRole('tab', { name, exact: false }).click();
    await page.waitForTimeout(1800);
    const stage = page.locator('[data-rig-stage]').first();
    await stage.screenshot({ path: `${OUT}/${label}-${name.toLowerCase()}.png` });
  }
  await page.screenshot({ path: `${OUT}/${label}-section.png` });
  await ctx.close();
}

await browser.close();
await writeFile(`${OUT}/rigshots.log`, log.join('\n') || 'clean');
console.log(log.join('\n') || 'clean');
