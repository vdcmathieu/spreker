/** Sample the width axis every frame, in page, to see the real envelope. */
import { chromium } from 'playwright';
// Autoplay is deliberately *not* unblocked here: the page now turns itself on
// where the browser allows it, and this pass needs the quiet state first.
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:3000', { waitUntil: 'load' });
await p.waitForTimeout(1200);

const sample = async (label) => {
  const vals = await p.evaluate(() => new Promise((res) => {
    const h = document.querySelector('h1');
    const out = [];
    const t0 = performance.now();
    const loop = () => {
      out.push(Number(getComputedStyle(h).getPropertyValue('--wdth')));
      if (performance.now() - t0 < 2500) requestAnimationFrame(loop);
      else res(out);
    };
    loop();
  }));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  console.log(`${label}: ${vals.length} frames, wdth ${lo.toFixed(1)} … ${hi.toFixed(1)} (travel ${(hi - lo).toFixed(1)})`);
};

await sample('sound off');
await p.getByRole('button', { name: /turn it on/i }).click();
await p.waitForTimeout(2500);
await sample('sound on ');
await b.close();
