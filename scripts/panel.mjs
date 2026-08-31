/** Screenshot one element, optionally after driving some controls. */
import { chromium } from 'playwright';
const [sel, out, width = '1440', height = '1000'] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +width, height: +height }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForTimeout(2200);
await p.locator(sel).first().screenshot({ path: out });
await b.close();
