import { expect, test } from '@playwright/test';
import { boot, catchOne, dismissDialogs, hudState } from './helpers';

test('new game: intro, tutorial and first fish in under two minutes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await boot(page);
  await page.click('#tap-start');
  await page.click('#btn-play');

  // Introduction comic (4 panels).
  for (let i = 0; i < 4; i++) await page.click('#intro-next');

  // Tutorial: guided by Capitaine Hervé.
  await expect(page.locator('#tutorial')).toContainText('Maintiens le doigt');
  await expect.poll(() => hudState(page)).toBe('idle');
  await catchOne(page);
  await expect(page.locator('#catch-card')).toContainText('Gobie des galets');
  await page.click('#catch-later');
  await expect.poll(() => page.evaluate(() => (window as any).ressac.game.state.creel.length)).toBe(1);
  // Software rendering in CI is far slower than a phone: the 2-minute target is checked on game time.
  expect(await page.evaluate(() => (window as any).ressac.game.state.stats.playSeconds)).toBeLessThan(120);

  // Back to the port, sell to Jo, buy a bait: the tutorial ends.
  await page.click('#btn-port');
  await page.waitForSelector('#port-hud');
  await expect(page.locator('#tutorial')).toContainText('Jo');
  await page.click('#spot-shop');
  await page.click('#sell-all');
  await expect(page.locator('#tutorial')).toContainText('Appâts');
  await page.click('.tab[data-tab="bait"]');
  await page.click('[data-item="ver"] .btn-price');
  await expect
    .poll(() => page.evaluate(() => (window as any).ressac.game.state.flags.tutorialDone))
    .toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).ressac.game.state.baits.ver)).toBe(10);

  // The save survives a reload.
  await page.evaluate(() => (window as any).ressac.save());
  await page.reload();
  await page.waitForSelector('body[data-ready="1"]');
  await page.click('#tap-start');
  await expect(page.locator('#home-save')).toContainText('Jour 1');
  expect(await page.evaluate(() => (window as any).ressac.game.state.stats.catches)).toBe(1);
  expect(errors).toEqual([]);
});

test('a corrupted save never crashes the game and the backup is offered', async ({ page }) => {
  await boot(page);
  await page.click('#tap-start');
  await page.evaluate(() => {
    const r = (window as any).ressac;
    r.game.state.flags.introSeen = true;
    r.game.state.coins = 4321;
    r.save();
  });
  // Reload once so that the good save becomes the backup, then break the main save.
  await page.reload();
  await page.waitForSelector('body[data-ready="1"]');
  await page.evaluate(() => {
    // Stop the game from saving again before the reload, then break the main save on purpose.
    (window as any).ressac.save = () => undefined;
    localStorage.setItem('ressac.save', '{"v":2,"data":{oops');
  });
  await page.reload();
  await page.waitForSelector('body[data-ready="1"]');
  await page.click('#corrupt-restore');
  expect(await page.evaluate(() => (window as any).ressac.game.state.coins)).toBe(4321);
});

test('the story can be completed with the debug mode', async ({ page }) => {
  test.setTimeout(900_000);
  await boot(page, '/?debug=1');
  await page.click('#tap-start');
  await page.evaluate(() => {
    const r = (window as any).ressac;
    Object.assign(r.game.state.flags, { introSeen: true, tutorialDone: true, tutorialStep: 7 });
    r.save();
  });
  await page.click('#btn-play');
  await page.waitForSelector('#port-hud');
  await dismissDialogs(page);
  await page.click('#btn-debug');
  await page.click('#dbg-story');
  await dismissDialogs(page);
  await page.click('.screen-back');
  await dismissDialogs(page);
  // Travel to the Fosse with Maëlle's lure and catch the legend.
  await page.evaluate(() => (window as any).ressac.ui.open('map'));
  await page.click('.map-node[data-zone="fosse"]');
  await page.click('#go-fosse');
  await page.waitForSelector('#fishing-hud');
  await page.evaluate(() => (window as any).ressac.game.equip('leurre'));
  await page.evaluate(() => ((window as any).ressac.game.state.settings.assist = true));
  await catchOne(page);
  await expect(page.locator('#catch-card')).toContainText('La Veilleuse');
  await page.click('#catch-later');
  for (let i = 0; i < 20 && !(await page.locator('#ending-continue').count()); i++) {
    const next = page.locator('#notice-ok, #dialogue-next');
    if (await next.count()) await next.first().click();
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('#ending-continue', { timeout: 10_000 });
  expect(await page.evaluate(() => (window as any).ressac.game.state.story.finished)).toBe(true);
  await page.click('#ending-continue');
});

test('works offline once loaded (PWA)', async ({ page, context }) => {
  await boot(page);
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.active);
    },
    null,
    { timeout: 30_000 },
  );
  // Make sure the page is controlled, then cut the network.
  await page.reload();
  await page.waitForSelector('body[data-ready="1"]');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30_000 });
  await page.click('#tap-start');
  await expect(page.locator('#btn-play')).toBeVisible();
  const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  expect(manifest.display).toBe('standalone');
  await context.setOffline(false);
});

test.describe('desktop layout', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('landscape window: keyboard walking, E to enter, space to cast', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate(() => document.body.classList.contains('desktop'))).toBe(true);
    await page.click('#tap-start');
    await page.evaluate(() => {
      const r = (window as any).ressac;
      Object.assign(r.game.state.flags, { introSeen: true, tutorialDone: true, tutorialStep: 7 });
      r.game.state.story.introSeen = true;
      r.game.state.login.lastDate = '2099-01-01';
      r.save();
    });
    await page.click('#btn-play');
    await page.waitForSelector('#port-hud');
    await dismissDialogs(page);
    await expect(page.locator('.kbd-hint')).toContainText('ZQSD');
    // Walk left along the quay to Jo's stall, then enter with E.
    await page.keyboard.down('ArrowLeft');
    await expect(page.locator('#spot-shop')).toHaveClass(/is-near/, { timeout: 60_000 });
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => (window as any).ressac.ui.topScreen)).toBe('shop');
    await page.keyboard.press('Escape');
    await page.click('#btn-fish');
    await page.waitForSelector('#fishing-hud');
    await expect.poll(() => hudState(page)).toBe('idle');
    await page.waitForFunction(
      () => !document.querySelector('.curtain.is-in, .curtain.is-out, .modal-backdrop'),
    );
    await page.keyboard.down('Space');
    await expect.poll(() => hudState(page)).toBe('charging');
    await page.waitForFunction(
      () => Number(document.getElementById('fishing-hud')?.dataset.power ?? 0) > 0.5,
    );
    await page.keyboard.up('Space');
    await expect.poll(() => hudState(page)).toMatch(/casting|waiting/);
  });
});
