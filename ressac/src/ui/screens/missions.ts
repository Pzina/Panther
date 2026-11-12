import { app } from '../../app';
import { iconSvg } from '../../art/icons';
import { formatNumber, t } from '../../core/i18n';
import { CHALLENGES, STORY } from '../../data/missions';
import { dailyText } from '../../systems/missions';
import { button, clear, h, icon, progress } from '../dom';
import type { Screen } from '../ui';
import { screenShell } from '../ui';
import { coinTag, rewardLine } from '../widgets';

export function missionsScreen(params: Record<string, unknown>): Screen {
  const game = app.game;
  let tab = (params.tab as string) ?? 'story';
  const dailyReady = (): boolean =>
    game.state.daily.missions.some((m) => !m.claimed && m.progress >= m.target);
  const challengeReady = (): boolean =>
    CHALLENGES.some((c) => {
      const p = game.challengeProgress(c.id);
      return !p.claimed && p.value >= p.target;
    });
  const shell = screenShell(t('missions.title'), 'scroll', {
    tabs: [
      { id: 'story', label: t('missions.tab.story'), icon: 'compass' },
      { id: 'daily', label: t('missions.tab.daily'), icon: 'calendar', badge: dailyReady },
      { id: 'challenges', label: t('missions.tab.challenges'), icon: 'target', badge: challengeReady },
    ],
    tab,
    onTab: (id) => {
      tab = id;
      render();
    },
  });

  const story = (body: HTMLElement): void => {
    const current = game.currentStory();
    if (current) {
      const p = game.storyProgress();
      body.append(
        h(
          'div',
          { class: 'card card-highlight', id: 'story-current' },
          h(
            'div',
            { class: 'card-kicker' },
            `${t('missions.act', { n: current.act })} · ${t('missions.current')}`,
          ),
          h('h2', null, current.title),
          h('p', null, current.description),
          h(
            'div',
            { class: 'progress-line' },
            progress(p.value, p.target),
            h('span', null, `${p.value}/${p.target}`),
          ),
          rewardLine(current.reward),
          button(t('missions.replay'), () => void app.ui.dialogue(current.intro), {
            small: true,
            icon: 'play',
            kind: 'ghost',
          }),
        ),
      );
    } else {
      body.append(h('div', { class: 'card card-highlight' }, h('p', null, t('missions.story.finished'))));
    }
    const done = game.state.story.finished ? STORY : STORY.slice(0, game.state.story.index);
    if (done.length > 0) {
      body.append(h('h3', { class: 'section-title' }, t('missions.done')));
      body.append(
        h(
          'div',
          { class: 'list' },
          ...[...done].reverse().map((m) =>
            h(
              'button',
              {
                class: 'row row-btn is-done',
                type: 'button',
                onclick: () => void app.ui.dialogue([...m.intro, ...m.outro]),
              },
              icon('check'),
              h(
                'div',
                { class: 'row-main' },
                h('b', null, `${t('missions.act', { n: m.act })} — ${m.title}`),
                h('span', { class: 'row-sub' }, m.description),
              ),
            ),
          ),
        ),
      );
    }
  };

  const daily = (body: HTMLElement): void => {
    game.ensureDaily();
    body.append(h('p', { class: 'muted' }, t('missions.daily.info')));
    game.state.daily.missions.forEach((m, index) => {
      const ready = !m.claimed && m.progress >= m.target;
      body.append(
        h(
          'div',
          { class: `card${m.claimed ? ' is-done' : ''}`, 'data-daily': index },
          h('b', null, dailyText(m)),
          h(
            'div',
            { class: 'progress-line' },
            progress(m.progress, m.target),
            h('span', null, `${formatNumber(Math.min(m.progress, m.target))}/${formatNumber(m.target)}`),
          ),
          h(
            'div',
            { class: 'card-foot' },
            coinTag(m.coins),
            m.claimed
              ? h('span', { class: 'pill pill-good' }, icon('check'), t('common.claimed'))
              : button(
                  t('common.claim'),
                  () => {
                    if (game.claimDaily(index)) {
                      app.audio.sfx('coins');
                      app.ui.toast(t('missions.daily.claimed', { n: m.coins }), 'good', 'coin');
                      app.save();
                      render();
                    }
                  },
                  { small: true, kind: 'gold', disabled: !ready },
                ),
          ),
        ),
      );
    });
    if (game.state.login.streak > 0) {
      body.append(
        h(
          'p',
          { class: 'muted center' },
          t('missions.streak', { n: ((game.state.login.streak - 1) % 7) + 1 }),
        ),
      );
    }
  };

  const challenges = (body: HTMLElement): void => {
    body.append(
      h(
        'div',
        { class: 'list' },
        ...CHALLENGES.map((c) => {
          const p = game.challengeProgress(c.id);
          const ready = !p.claimed && p.value >= p.target;
          return h(
            'div',
            { class: `card${p.claimed ? ' is-done' : ''}`, 'data-challenge': c.id },
            h(
              'div',
              { class: 'card-title' },
              h('span', { class: 'portrait-mini', html: iconSvg('anchor') }),
              h('b', null, c.title),
            ),
            h('p', null, c.description),
            h(
              'div',
              { class: 'progress-line' },
              progress(p.value, p.target),
              h('span', null, `${formatNumber(p.value)}/${formatNumber(p.target)}`),
            ),
            h(
              'div',
              { class: 'card-foot' },
              rewardLine(c.reward),
              p.claimed
                ? h('span', { class: 'pill pill-good' }, icon('check'), t('common.claimed'))
                : button(
                    t('common.claim'),
                    () => {
                      if (game.claimChallenge(c.id)) {
                        app.audio.sfx('coins');
                        app.ui.toast(t('missions.challenge.claimed'), 'good', 'trophy');
                        app.save();
                        render();
                      }
                    },
                    { small: true, kind: 'gold', disabled: !ready },
                  ),
            ),
          );
        }),
      ),
    );
  };

  const render = (): void => {
    clear(shell.body);
    if (tab === 'daily') daily(shell.body);
    else if (tab === 'challenges') challenges(shell.body);
    else story(shell.body);
  };
  render();
  return { id: 'missions', el: shell.el, refresh: render };
}
