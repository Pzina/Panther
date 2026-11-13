// Captures every main screen in a 390×844 mobile viewport (and a few at 360×640) into docs/screenshots.
// Usage: npm run build && npm run preview (in another terminal), then npm run screenshots.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.RESSAC_URL ?? 'http://localhost:4173';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function open(width, height, url = '/') {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(BASE + url);
  return page;
}
const ready = (page) => page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
const settle = (page, ms = 500) => page.waitForTimeout(ms);
const idle = (page) => page.waitForFunction(() => !document.querySelector('.curtain.is-in, .curtain.is-out'));
async function shot(page, name) {
  await idle(page);
  await settle(page, 1500);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('✓', name);
}
async function dismiss(page) {
  for (let quiet = 0; quiet < 4;) {
    const b = page.locator('#notice-ok, #dialogue-next');
    if (await b.count()) {
      await b.first().click();
      quiet = 0;
    } else quiet++;
    await page.waitForTimeout(200);
  }
}

/** Builds a mid-game save: three acts in, a well-filled notebook, some variants. */
async function midGame(page, hour = 10) {
  await page.evaluate((hour) => {
    const r = window.ressac;
    const g = r.game;
    const s = g.state;
    Object.assign(s.flags, { introSeen: true, tutorialDone: true, tutorialStep: 7 });
    const ids = [
      'gobie',
      'eperlan',
      'anchois',
      'mulet',
      'vieille',
      'bar',
      'sole',
      'congre',
      'gardon',
      'ablette',
      'perche-soleil',
      'tanche',
      'carpe',
      'perche',
      'brochet',
      'anguille',
      'vairon',
      'goujon',
      'chevesne',
      'truite',
      'barbeau',
      'ombre',
      'demoiselle',
      'girelle',
      'sergent',
      'papillon',
      'perroquet',
      'baliste',
      'dorade',
      'carpe-lune',
    ];
    const variants = { mulet: 'golden', carpe: 'albino', truite: 'shimmer', perche: 'melanic' };
    for (const id of ids) {
      const plan = g.planBite(0.6, false, { force: id });
      if (variants[id]) plan.fish.variant = variants[id];
      g.startFight(plan);
      g.completeCatch(plan.fish);
      if (s.creel.length < 9) g.keepFish(plan.fish);
    }
    s.creel[1].locked = true;
    let guard = 0;
    while (g.currentStory() && g.currentStory().id !== 's11' && guard++ < 20) g.debugSkipMission();
    s.coins = 3480;
    for (const id of ['rod-noisetier', 'rod-bambou', 'reel-laiton', 'line-lin', 'hook-simple'])
      if (!s.owned.includes(id)) s.owned.push(id);
    Object.assign(s.equipment, {
      rod: 'rod-bambou',
      reel: 'reel-laiton',
      line: 'line-lin',
      hook: 'hook-simple',
      boat: 'boat-2',
    });
    if (!s.owned.includes('boat-2')) s.owned.push('boat-2');
    s.baits.ver = 14;
    s.baits.crevette = 6;
    s.baits.strouille = 3;
    s.level = 9;
    s.reputation = 42;
    s.clockMinutes = Math.floor(s.clockMinutes / 1440) * 1440 + 1440 * 3 + hour * 60;
    s.story.introSeen = true;
    s.login.lastDate = '2099-01-01';
    s.lastSeen = Date.now();
    g.ensureDaily();
    s.daily.missions[0].progress = s.daily.missions[0].target;
    r.save();
  }, hour);
}

async function castAndFight(page) {
  await page.mouse.move(195, 500);
  await page.mouse.down();
  await page.waitForFunction(
    () => Number(document.getElementById('fishing-hud')?.dataset.power ?? 0) > 0.55,
    null,
    { polling: 16 },
  );
  return page;
}

// ───────── 390 × 844 ─────────
{
  const page = await open(390, 844);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}01-chargement.png` });
  console.log('✓ 01-chargement');
  await ready(page);
  await page.click('#tap-start');
  await shot(page, '02-accueil');
  await page.click('#btn-play');
  await page.waitForSelector('#intro-next');
  await page.click('#intro-next');
  await shot(page, '03-introduction');
  await page.click('#intro-skip');
  await page.waitForSelector('#tutorial');
  await shot(page, '04-tutoriel');
  await castAndFight(page);
  await shot(page, '05-lancer');
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('fishing-hud')?.dataset.state === 'bite', null, {
    timeout: 20000,
  });
  await page.screenshot({ path: `${OUT}06-touche.png` });
  console.log('✓ 06-touche');
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}07-combat.png` });
  console.log('✓ 07-combat');
  // Finish the forgiving tutorial fight.
  for (let i = 0; i < 400; i++) {
    const d = await page.evaluate(() => document.getElementById('fishing-hud')?.dataset ?? {});
    if (d.state !== 'fight') break;
    if (Number(d.tension) < (Number(d.low) + Number(d.high)) / 2) await page.mouse.down();
    else await page.mouse.up();
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.waitForSelector('#catch-card', { timeout: 15000 });
  await shot(page, '08-prise');
  await page.context().close();
}

{
  const page = await open(390, 844, '/?debug=1');
  await ready(page);
  await midGame(page, 11);
  await page.reload();
  await ready(page);
  await page.click('#tap-start');
  await page.click('#btn-play');
  await page.waitForSelector('#port-hud');
  await dismiss(page);
  await shot(page, '09-port');
  await page.click('#spot-shop');
  await shot(page, '10-boutique-vente');
  await page.click('.tab[data-tab="rod"]');
  await shot(page, '11-boutique-cannes');
  await page.click('.tab[data-tab="cosmetic"]');
  await shot(page, '12-boutique-style');
  await page.click('.screen-back');
  await page.click('#btn-creel');
  await shot(page, '13-vivier');
  await page.click('.screen-back');
  await page.click('#btn-journal');
  await shot(page, '14-carnet');
  await page.click('.tab[data-tab="etang"]');
  await shot(page, '15-encyclopedie');
  await page.click('.dex-card[data-species="carpe"]');
  await shot(page, '16-fiche-espece');
  await page.keyboard.press('Escape');
  await page.click('.tab[data-tab="large"]');
  await shot(page, '17-encyclopedie-silhouettes');
  await page.click('.screen-back');
  await page.click('#spot-missions');
  await shot(page, '18-missions');
  await page.click('.tab[data-tab="daily"]');
  await shot(page, '19-missions-du-jour');
  await page.click('.screen-back');
  await page.click('#btn-ach');
  await shot(page, '20-succes');
  await page.click('.screen-back');
  await page.click('#spot-map');
  await shot(page, '21-carte');
  await page.click('.map-node[data-zone="large"]');
  await shot(page, '22-carte-zone-fermee');
  await page.click('.screen-back');
  await page.click('#spot-cabin');
  await page.evaluate(() => {
    const g = window.ressac.game;
    for (const f of [...g.state.creel].slice(0, 4)) g.toAquarium(f.uid);
    window.ressac.ui.refresh();
  });
  await page.click('.screen-back');
  await page.click('#spot-cabin');
  await shot(page, '23-cabane');
  await page.click('.screen-back');
  await page.click('.chip-btn[aria-label="Paramètres"]');
  await shot(page, '24-parametres');
  await page.click('.screen-back');
  await page.click('#btn-debug');
  await shot(page, '25-debug');
  await page.click('.screen-back');
  // Reef by day.
  await page.evaluate(() => window.ressac.game.travel('recif'));
  await page.click('#btn-fish');
  await page.waitForSelector('#fishing-hud');
  await shot(page, '26-recif');
  await page.click('.chip-btn[aria-label="Pause"]');
  await shot(page, '27-pause');
  await page.click('#pause-port');
  await page.waitForSelector('#port-hud');
  // Night at the port.
  await page.evaluate(() => {
    window.ressac.game.debugAdvanceHours(12);
  });
  await page.waitForTimeout(1300);
  await shot(page, '28-port-nuit');
  await page.evaluate(() => {
    const r = window.ressac;
    r.game.debugUnlockAll();
    r.game.travel('fosse');
  });
  await page.click('#btn-fish');
  await page.waitForSelector('#fishing-hud');
  await shot(page, '29-fosse');
  await page.evaluate(() => {
    const r = window.ressac;
    r.game.travel('riviere');
    r.game.debugWeather = 'storm';
  });
  await page.click('#btn-port');
  await page.waitForSelector('#port-hud');
  await page.click('#btn-fish');
  await page.waitForSelector('#fishing-hud');
  await shot(page, '30-riviere-orage');
  await page.evaluate(() => window.ressac.ui.open('ending', {}));
  await shot(page, '31-fin');
  await page.evaluate(() => window.ressac.ui.closeAllScreens());
  await page.evaluate(() => window.ressac.ui.setMode('home'));
  await page.waitForSelector('#home-hud');
  await page.click('#btn-credits');
  await shot(page, '32-credits');
  await page.context().close();
}

// ───────── 360 × 640 (smallest supported screen) ─────────
{
  const page = await open(360, 640, '/?debug=1');
  await ready(page);
  await midGame(page, 15);
  await page.reload();
  await ready(page);
  await page.click('#tap-start');
  await shot(page, 'petit-01-accueil');
  await page.click('#btn-play');
  await page.waitForSelector('#port-hud');
  await dismiss(page);
  await shot(page, 'petit-02-port');
  await page.click('#spot-shop');
  await page.click('.tab[data-tab="rod"]');
  await shot(page, 'petit-03-boutique');
  await page.click('.screen-back');
  await page.click('#btn-fish');
  await page.waitForSelector('#fishing-hud');
  await shot(page, 'petit-04-peche');
  await page.click('#btn-creel');
  await shot(page, 'petit-05-vivier');
  await page.context().close();
}

await browser.close();
