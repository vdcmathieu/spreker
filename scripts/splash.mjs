/**
 * The splash pass.
 *
 * The opening wave is on screen for about a second and a half — far shorter
 * than any of the other scripts wait, and shorter than a screenshot takes to
 * write — so this one records the load as a CDP screencast and writes the
 * frames out against a real clock. Look at the strip: the wave has to leave the
 * drop as one clean circular front, not as a field of dots.
 *
 *   node scripts/splash.mjs [url]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const URL_ = process.argv[2] ?? 'http://localhost:3000';
const OUT = '.review/splash';
/** Milliseconds after navigation to keep a frame for. */
const MARKS = [120, 300, 520, 760, 1000, 1300, 1600, 1900, 2200, 2600, 3200, 4000];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const log = [];

async function pass(label, width, height, reducedMotion) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    reducedMotion,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') log.push(`[${label}] ${m.text().slice(0, 160)}`);
  });
  page.on('pageerror', (e) => log.push(`[${label}] pageerror: ${e.message}`));

  // Warm the bundler first: a dev-mode cold compile would be timed as splash.
  // `load` rather than `networkidle` everywhere in these scripts: the splash
  // worker's chunk request never settles on the dev server, so idle never
  // comes.
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
    frames.push({ t: metadata.timestamp * 1000, data });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });

  await page.goto(URL_, { waitUntil: 'commit' });
  const t0 = Date.now();
  await page.waitForTimeout(4500);
  await cdp.send('Page.stopScreencast');

  // Keep the frame nearest each mark, and say how near it actually landed.
  for (const m of MARKS) {
    let best = null;
    for (const f of frames) {
      const d = Math.abs(f.t - t0 - m);
      if (!best || d < best.d) best = { d, f };
    }
    if (!best) continue;
    await writeFile(`${OUT}/${label}-t${String(m).padStart(4, '0')}.jpg`, Buffer.from(best.f.data, 'base64'));
  }
  // A loading animation that stalls while the page hydrates is worse than no
  // loading animation, so the frame timeline is part of the check.
  let worst = 0;
  let worstAt = 0;
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].t - t0 > 3000) break;
    if (frames[i - 1].t - t0 < 0) continue;
    const gap = frames[i].t - frames[i - 1].t;
    if (gap > worst) {
      worst = gap;
      worstAt = frames[i - 1].t - t0;
    }
  }
  log.push(
    `[${label}] ${frames.length} frames over 4.5s, longest stall ${Math.round(worst)}ms at ${Math.round(worstAt)}ms`,
  );

  // Whatever happened, the overlay must be gone, and it must never have been
  // able to swallow a click.
  const left = await page.evaluate(() => document.querySelectorAll('.splash').length);
  log.push(`[${label}] splash nodes remaining after 4.5s: ${left}`);
  await ctx.close();
}

await pass('desktop', 1440, 900, 'no-preference');
await pass('mobile', 390, 844, 'no-preference');
await pass('reduced', 1440, 900, 'reduce');

await writeFile(`${OUT}/log.txt`, log.join('\n'));
await browser.close();
console.log(log.join('\n'));
