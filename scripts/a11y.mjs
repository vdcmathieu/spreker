/** Reduced motion, keyboard focus, and the text equivalents of the canvases. */
import { chromium } from 'playwright';

const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });

// 1. Reduced motion: nothing should move.
const rm = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p1 = await rm.newPage();
await p1.goto('http://localhost:3000', { waitUntil: 'load' });
await p1.waitForTimeout(2000);
const widths = [];
for (let i = 0; i < 10; i++) {
  widths.push(await p1.evaluate(() => Number(getComputedStyle(document.querySelector('h1')).getPropertyValue('--wdth'))));
  await p1.waitForTimeout(120);
}
console.log('reduced motion — wdth values:', [...new Set(widths)].join(', '));
await p1.locator('#room').scrollIntoViewIfNeeded();
await p1.waitForTimeout(800);
await p1.screenshot({ path: '.review/a11y-reduced.png' });

// 2. Keyboard: walk the first controls and confirm a visible focus ring.
const p2 = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p2.goto('http://localhost:3000', { waitUntil: 'load' });
for (let i = 0; i < 4; i++) {
  await p2.keyboard.press('Tab');
  const info = await p2.evaluate(() => {
    const el = document.activeElement;
    const cs = el ? getComputedStyle(el) : null;
    return el ? `${el.tagName}:${(el.textContent || '').trim().slice(0, 28)} outline=${cs.outlineWidth} ${cs.outlineColor}` : 'none';
  });
  console.log(`tab ${i + 1}:`, info);
}

// 3. Every canvas hidden from the tree, and the readout present.
const p3 = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p3.goto('http://localhost:3000', { waitUntil: 'load' });
await p3.waitForTimeout(1500);
console.log('canvases:', await p3.locator('canvas').count(), '| all aria-hidden:',
  await p3.evaluate(() => [...document.querySelectorAll('canvas')].every((c) => c.closest('[aria-hidden="true"]') !== null)));
console.log('room readout:', (await p3.locator('#room [role="status"]').innerText()).replace(/\n+/g, ' | ').slice(0, 120));
await b.close();
