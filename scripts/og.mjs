/**
 * The social card is a real frame of the page, not a mock-up of it: the hero,
 * shot at 1200×630 with the sound running so the rig is mid-excursion.
 */
import { chromium } from 'playwright';

const b = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader'],
});
const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(process.argv[2] ?? 'http://localhost:3000', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /turn the sound on/i }).click().catch(() => {});
await p.waitForTimeout(3000);
// The rail and the scroll cue are chrome; the card is the hero, squared off to
// the social aspect so nothing important falls outside the crop.
await p.evaluate(() => {
  document
    .querySelectorAll('nav, [data-hero-support], [data-hero-footnote]')
    .forEach((el) => {
      el.style.display = 'none';
    });
  const hero = document.getElementById('source');
  if (hero) {
    hero.style.minHeight = '630px';
    hero.style.height = '630px';
  }
  document.documentElement.style.setProperty('--rail', '2.5rem');
  window.scrollTo(0, 0);
});
await p.waitForTimeout(1200);
await p.screenshot({ path: 'public/og.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
await b.close();
console.log('wrote public/og.png');
