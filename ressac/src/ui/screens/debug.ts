import { app } from '../../app';
import { t } from '../../core/i18n';
import type { Weather } from '../../data/types';
import { WEATHERS } from '../../data/types';
import { addXp, xpToNext } from '../../systems/progression';
import { button, clear, h } from '../dom';
import type { Screen } from '../ui';
import { screenShell } from '../ui';

export function debugScreen(): Screen {
  const game = app.game;
  const shell = screenShell(t('debug.title'), 'gear');
  const act = (fn: () => void) => () => {
    fn();
    app.save();
    app.ui.refresh();
    render();
  };
  const render = (): void => {
    clear(shell.body);
    const story = game.currentStory();
    shell.body.append(
      h('p', { class: 'muted' }, t('debug.info')),
      h(
        'div',
        { class: 'settings-actions' },
        button(
          t('debug.coins'),
          act(() => game.debugCoins(10000)),
          { icon: 'coin', id: 'dbg-coins' },
        ),
        button(
          t('debug.unlock'),
          act(() => game.debugUnlockAll()),
          { icon: 'unlock', id: 'dbg-unlock' },
        ),
        button(
          `${t('debug.skip')}${story ? ` (${story.id})` : ''}`,
          act(() => game.debugSkipMission()),
          { icon: 'next', id: 'dbg-skip', disabled: !story },
        ),
        button(
          t('debug.story'),
          act(() => {
            let guard = 0;
            while (game.currentStory() && game.currentStory()!.id !== 's18' && guard++ < 30)
              game.debugSkipMission();
            game.debugUnlockAll();
          }),
          { icon: 'compass', id: 'dbg-story' },
        ),
        button(
          t('debug.level'),
          act(() => {
            for (let i = 0; i < 5; i++) addXp(game.state, xpToNext(game.state.level));
          }),
          { icon: 'level' },
        ),
        button(
          t('debug.hours'),
          act(() => game.debugAdvanceHours(3)),
          { icon: 'clock', id: 'dbg-hours' },
        ),
      ),
      h('h3', { class: 'section-title' }, t('debug.weather')),
      h(
        'div',
        { class: 'segmented wrap' },
        h(
          'button',
          {
            class: `seg${game.debugWeather === null ? ' is-active' : ''}`,
            type: 'button',
            onclick: act(() => (game.debugWeather = null)),
          },
          t('debug.weather.auto'),
        ),
        ...WEATHERS.map((w: Weather) =>
          h(
            'button',
            {
              class: `seg${game.debugWeather === w ? ' is-active' : ''}`,
              type: 'button',
              'data-weather': w,
              onclick: act(() => (game.debugWeather = w)),
            },
            t(`weather.${w}`),
          ),
        ),
      ),
    );
  };
  render();
  return { id: 'debug', el: shell.el, refresh: render };
}
