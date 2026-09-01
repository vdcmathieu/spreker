/**
 * Interaction pass: drive the controls the way a visitor would and assert the
 * page actually responds. Audio autoplay is unblocked so the analyser can be
 * checked without a real click gesture.
 */
import { chromium } from 'playwright';

const b = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader'],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

await p.goto('http://localhost:3000', { waitUntil: 'load' });
await p.waitForTimeout(1500);

// 1. Sound on.
await p.getByRole('button', { name: /turn the sound on/i }).click();
await p.waitForTimeout(2000);
const meter = await p.evaluate(() => {
  const el = document.querySelector('nav [style*="scaleY"]');
  return el ? getComputedStyle(el).transform : 'none';
});
console.log('meter transform after sound on:', meter);
console.log('aria-pressed:', await p.locator('nav button[aria-pressed]').first().getAttribute('aria-pressed'));
await p.locator('#source').screenshot({ path: '.review/int-hero-sound-on.png' });

// 2. Room controls.
await p.locator('#room').scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
for (const name of ['Flat', 'Barn', 'Warehouse']) {
  await p.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await p.waitForTimeout(500);
  const verdict = await p.locator('#room [role="status"] p').first().innerText();
  console.log(`${name}: ${verdict.slice(0, 96)}`);
}
await p.locator('#heads').fill('400');
await p.waitForTimeout(700);
console.log('warehouse @400:', (await p.locator('#room [role="status"] p').first().innerText()).slice(0, 110));
await p.locator('#room .grid.gap-px').first().screenshot({ path: '.review/int-room-warehouse.png' });

// 3. Rig tabs.
await p.locator('#rig').scrollIntoViewIfNeeded();
for (const name of ['Keuken', 'Schuur']) {
  await p.getByRole('tab', { name: new RegExp(name) }).click();
  await p.waitForTimeout(1400);
  await p.locator('#rig .grid.gap-px').first().screenshot({ path: `.review/int-rig-${name.toLowerCase()}.png` });
}

// 4. Booking form.
await p.locator('#book').scrollIntoViewIfNeeded();
await p.locator('input[type="date"]').fill('2026-09-19');
await p.locator('input[type="text"]').fill('1000');
await p.locator('input[type="email"]').fill('someone@example.com');
await p.getByRole('button', { name: /hold this night/i }).click();
await p.waitForTimeout(600);
console.log('confirmation:', (await p.locator('#book [role="status"]').innerText()).replace(/\n+/g, ' | ').slice(0, 150));
await p.locator('#book .grid.gap-px').first().screenshot({ path: '.review/int-book-done.png' });

// 5. Keyboard focus visibility on the first few controls.
await p.keyboard.press('Tab');
console.log('errors:', errs.length ? errs : 'none');
await b.close();
