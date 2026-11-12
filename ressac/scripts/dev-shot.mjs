import { chromium } from 'playwright';
const [,, url, out, w='1200', h='1500'] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await p.goto(url);
await p.waitForTimeout(400);
await p.screenshot({ path: out, fullPage: true });
await b.close();
