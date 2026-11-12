import { app } from '../../app';
import { formatNumber, t } from '../../core/i18n';
import { ACHIEVEMENTS } from '../../data/achievements';
import { clear, h, icon, progress } from '../dom';
import type { Screen } from '../ui';
import { screenShell } from '../ui';

export function achievementsScreen(): Screen {
  const shell = screenShell(t('ach.title'), 'trophy');
  const render = (): void => {
    const state = app.game.state;
    clear(shell.body);
    const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
    shell.body.append(
      h('div', { class: 'dex-total' }, h('span', null, t('ach.count', { n: unlocked, max: ACHIEVEMENTS.length })), progress(unlocked, ACHIEVEMENTS.length)),
      h(
        'div',
        { class: 'list' },
        ...[...ACHIEVEMENTS]
          .sort((a, b) => Number(Boolean(state.achievements[b.id])) - Number(Boolean(state.achievements[a.id])))
          .map((a) => {
            const when = state.achievements[a.id];
            const value = Math.min(a.target, a.value(state));
            return h(
              'div',
              { class: `row ach-row${when ? ' is-unlocked' : ''}`, 'data-achievement': a.id },
              h('div', { class: 'ach-icon' }, icon(when ? a.icon : 'lock')),
              h(
                'div',
                { class: 'row-main' },
                h('b', null, a.name),
                h('span', { class: 'row-sub' }, a.description),
                when
                  ? h('span', { class: 'row-sub good' }, t('ach.unlocked', { date: new Date(when).toLocaleDateString('fr-FR') }))
                  : h('div', { class: 'progress-line' }, progress(value, a.target), h('span', null, `${formatNumber(value)}/${formatNumber(a.target)}`)),
              ),
            );
          }),
      ),
    );
  };
  render();
  return { id: 'achievements', el: shell.el, refresh: render };
}
