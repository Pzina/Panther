import { expect, type Page } from '@playwright/test';

export async function boot(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30_000 });
}

export async function hudState(page: Page): Promise<string> {
  return (await page.getAttribute('#fishing-hud', 'data-state')) ?? '';
}

/** Holds the finger on the water, releases near the sweet spot of the power gauge. */
export async function cast(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !document.querySelector('.curtain.is-in, .curtain.is-out, .modal-backdrop'),
  );
  await page.mouse.move(195, 520);
  await page.mouse.down();
  await page.waitForFunction(
    () => {
      const v = Number(document.getElementById('fishing-hud')?.dataset.power ?? 0);
      return v > 0.7 && v < 0.88;
    },
    null,
    { timeout: 10_000, polling: 16 },
  );
  await page.mouse.up();
}

/** Plays the tension mini-game by reading the gauge exposed on the HUD. */
export async function fight(page: Page): Promise<void> {
  let reeling = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const d = await page.evaluate(() => {
      const ds = document.getElementById('fishing-hud')?.dataset ?? {};
      return {
        state: ds.state,
        t: Number(ds.tension),
        lo: Number(ds.low),
        hi: Number(ds.high),
        jump: ds.jump === '1',
      };
    });
    if (d.state !== 'fight') break;
    const want = !d.jump && d.t < (d.lo + d.hi) / 2;
    if (want !== reeling) {
      if (want) await page.mouse.down();
      else await page.mouse.up();
      reeling = want;
    }
    await page.waitForTimeout(20);
  }
  if (reeling) await page.mouse.up();
}

/** Casts until a fish is landed and its card is shown. */
export async function catchOne(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await expect.poll(() => hudState(page), { timeout: 10_000 }).toBe('idle');
    await cast(page);
    await expect.poll(() => hudState(page), { timeout: 20_000 }).toMatch(/bite|idle/);
    if ((await hudState(page)) !== 'bite') continue;
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => hudState(page), { timeout: 5_000 }).toMatch(/fight|idle/);
    if ((await hudState(page)) !== 'fight') continue;
    await fight(page);
    const card = page.locator('#catch-card');
    try {
      await card.waitFor({ timeout: 6_000 });
      return;
    } catch {
      /* lost the fish: try again */
    }
  }
  throw new Error('No fish caught after several attempts');
}

/** Closes every queued notification / dialogue until none shows up for a while. */
export async function dismissDialogs(page: Page): Promise<void> {
  let quiet = 0;
  while (quiet < 4) {
    const button = page.locator('#notice-ok, #dialogue-next, #corrupt-fresh');
    if ((await button.count()) > 0) {
      await button.first().click();
      quiet = 0;
    } else {
      quiet += 1;
    }
    await page.waitForTimeout(250);
  }
}
