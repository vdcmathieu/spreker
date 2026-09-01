/**
 * The room pass.
 *
 * The instrument is the page's functional centre and the answer it gives is
 * visual — where the light stops, and how many people are standing still past
 * that — so it needs looking at in every state it can be in, not just the one
 * it loads in. This drives the controls and writes one PNG per combination that
 * says something different.
 *
 * Software WebGL is asked for explicitly: headless Chromium will otherwise fall
 * back to a context that renders the shaders as black.
 *
 *   node scripts/room.mjs [url]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const URL_ = process.argv[2] ?? 'http://localhost:3000';
const OUT = '.review/room';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const log = [];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && log.push(m.text().slice(0, 200)));

await page.goto(URL_, { waitUntil: 'load' });
await page.waitForTimeout(2600);
await page.locator('#room').scrollIntoViewIfNeeded();
await page.waitForTimeout(1400);

const panel = page.locator('#room .grid.gap-px').first();
const verdict = () => page.locator('#room [role="status"] p').first().innerText();

const standing = () => page.locator('#room fieldset [role="status"]').first().innerText();

async function shot(name) {
  await page.waitForTimeout(900);
  await panel.screenshot({ path: `${OUT}/${name}.png` });
  log.push(
    `${name}: ${(await verdict()).replace(/\s+/g, ' ').slice(0, 96)}` +
      `\n${' '.repeat(name.length + 2)}standing: ${(await standing()).replace(/\s+/g, ' ')}`,
  );
}

async function space(name) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}
async function rig(name) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

// The room it loads in, and every other room at the same headcount.
await shot('garden-suggested');
for (const s of ['Flat', 'Barn', 'Warehouse']) {
  await space(s);
  await shot(s.toLowerCase());
}

// A room that eats systems, packed: the smallest rig cannot reach the back and
// the far corner should be visibly under water.
await space('Warehouse');
await page.locator('#heads').fill('400');
await rig('Keuken');
await shot('warehouse-400-keuken');
await rig('Schuur');
await shot('warehouse-400-schuur');

// Standing somewhere else. The readout and the light have to agree, and the
// far corner of a room a rig cannot fill has to look like somewhere nobody is
// dancing.
await space('Garden');
await page.locator('#heads').fill('70');
for (const spot of ['By the box', 'In the middle', 'At the far corner']) {
  await page.getByRole('button', { name: spot }).click();
  await shot(`standing-${spot.split(' ').pop().toLowerCase()}`);
}

// Dragging yourself. The one interaction here that no control duplicates, so
// it is the one most worth asserting rather than eyeballing.
await page.getByRole('button', { name: 'By the box' }).click();
await page.waitForTimeout(500);
const before = await standing();
const canvas = page.locator('#room canvas');
const box = await canvas.boundingBox();
await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.55);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.42, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(600);
const after = await standing();
log.push(`drag: ${before.replace(/\s+/g, ' ')}\n   ->  ${after.replace(/\s+/g, ' ')}`);
if (before === after) log.push('pageerror: dragging did not move the listener');
await panel.screenshot({ path: `${OUT}/dragged.png` });

// Sound on — it started itself, autoplay being unblocked above — at the back:
// the seat gain and the crowd bed should both be set.
const playing = await page.locator('nav button[aria-pressed]').first().getAttribute('aria-pressed');
if (playing !== 'true') log.push('pageerror: the sound did not start on its own');
await page.locator('#room').scrollIntoViewIfNeeded();
await page.waitForTimeout(1600);
await panel.screenshot({ path: `${OUT}/sound-on.png` });

log.push(`errors: ${log.some((l) => l.startsWith('pageerror')) ? 'see above' : 'none'}`);
await writeFile(`${OUT}/log.txt`, log.join('\n'));
await browser.close();
console.log(log.join('\n'));
