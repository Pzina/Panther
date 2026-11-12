import { app } from '../../app';
import { formatNumber, t } from '../../core/i18n';
import { exportCode, importCode } from '../../core/save';
import { createNewState } from '../../core/state';
import { randomSeed } from '../../core/rng';
import type { Settings } from '../../core/state';
import { button, clear, h, icon } from '../dom';
import type { Screen } from '../ui';
import { screenShell } from '../ui';

function toggle(label: string, iconName: string, key: keyof Settings, hint?: string): HTMLElement {
  const settings = app.game.state.settings;
  const on = Boolean(settings[key]);
  const input = h(
    'button',
    {
      class: `switch${on ? ' is-on' : ''}`,
      type: 'button',
      role: 'switch',
      'aria-checked': String(on),
      'aria-label': label,
      'data-setting': key,
      onclick: () => {
        (settings as unknown as Record<string, boolean>)[key] = !settings[key];
        app.applySettings();
        app.save();
        app.ui.refresh();
      },
    },
    h('span', { class: 'switch-knob' }),
  );
  return h(
    'div',
    { class: 'setting' },
    icon(iconName),
    h(
      'div',
      { class: 'setting-main' },
      h('b', null, label),
      hint ? h('span', { class: 'row-sub' }, hint) : null,
    ),
    input,
  );
}

function slider(label: string, iconName: string, key: 'music' | 'sfx' | 'ambience'): HTMLElement {
  const settings = app.game.state.settings;
  const value = h('span', { class: 'slider-value' }, `${Math.round(settings[key] * 100)} %`);
  const input = h('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(settings[key] * 100),
    'aria-label': label,
    'data-setting': key,
  }) as HTMLInputElement;
  input.addEventListener('input', () => {
    settings[key] = Number(input.value) / 100;
    value.textContent = `${input.value} %`;
    app.applySettings();
  });
  input.addEventListener('change', () => {
    app.save();
    if (key === 'sfx') app.audio.sfx('click');
  });
  return h(
    'div',
    { class: 'setting setting-slider' },
    icon(iconName),
    h('div', { class: 'setting-main' }, h('b', null, label), input),
    value,
  );
}

function exportDialog(): void {
  const code = exportCode(app.game.state);
  const area = h(
    'textarea',
    { class: 'code-area', readonly: true, rows: 6, id: 'export-code' },
    code,
  ) as HTMLTextAreaElement;
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      app.ui.toast(t('settings.copied'), 'good', 'check');
    } catch {
      area.select();
      app.ui.toast(t('settings.copyFail'), 'warn', 'info');
    }
  };
  const close = app.ui.modal(
    h(
      'div',
      { class: 'dialog' },
      h('h2', null, t('settings.export.title')),
      h('p', null, t('settings.export.text')),
      area,
      h(
        'div',
        { class: 'dialog-actions' },
        button(t('common.close'), () => close(), { kind: 'ghost' }),
        button(t('settings.copy'), () => void copy(), { kind: 'primary', icon: 'download' }),
      ),
    ),
  );
  area.addEventListener('focus', () => area.select());
}

function importDialog(): void {
  const area = h('textarea', {
    class: 'code-area',
    rows: 6,
    id: 'import-code',
    placeholder: 'RSC1.…',
  }) as HTMLTextAreaElement;
  const error = h('p', { class: 'error', role: 'alert' });
  const submit = async (): Promise<void> => {
    const result = importCode(area.value);
    if (!result.ok) {
      error.textContent = t('settings.import.bad');
      app.audio.sfx('error');
      return;
    }
    const day = Math.floor(result.state.clockMinutes / 1440) + 1;
    const ok = await app.ui.confirm(
      t('settings.import.title'),
      t('settings.import.confirm', { day, coins: formatNumber(result.state.coins) }),
      t('settings.import.ok'),
      true,
    );
    if (!ok) return;
    close();
    app.loadState(result.state);
    app.ui.toast(t('settings.import.done'), 'good', 'check');
    await app.ui.setMode('home');
  };
  const close = app.ui.modal(
    h(
      'div',
      { class: 'dialog' },
      h('h2', null, t('settings.import.title')),
      h('p', null, t('settings.import.text')),
      area,
      error,
      h(
        'div',
        { class: 'dialog-actions' },
        button(t('common.cancel'), () => close(), { kind: 'ghost' }),
        button(t('settings.import.ok'), () => void submit(), { kind: 'primary', icon: 'upload' }),
      ),
    ),
  );
}

async function resetGame(): Promise<void> {
  const ui = app.ui;
  if (!(await ui.confirm(t('settings.reset.title'), t('settings.reset.text'), t('settings.reset.ok'), true)))
    return;
  if (
    !(await ui.confirm(t('settings.reset.title2'), t('settings.reset.text2'), t('settings.reset.ok2'), true))
  )
    return;
  const settings = { ...app.game.state.settings };
  app.saves.clear();
  const fresh = createNewState(randomSeed());
  fresh.settings = settings;
  app.loadState(fresh);
  ui.toast(t('settings.reset.done'), 'info', 'refresh');
  await ui.setMode('home');
}

export function settingsScreen(): Screen {
  const shell = screenShell(t('settings.title'), 'gear');
  const render = (): void => {
    const s = app.game.state.settings;
    const body = shell.body;
    clear(body);
    const sizes: [number, string][] = [
      [0.9, 's'],
      [1, 'm'],
      [1.15, 'l'],
      [1.3, 'xl'],
    ];
    body.append(
      h('h3', { class: 'section-title' }, t('settings.sound')),
      h(
        'div',
        { class: 'settings-group' },
        slider(t('settings.music'), 'music', 'music'),
        slider(t('settings.sfx'), 'volume', 'sfx'),
        slider(t('settings.ambience'), 'wave', 'ambience'),
        toggle(t('settings.vibration'), 'vibrate', 'vibration'),
      ),
      h('h3', { class: 'section-title' }, t('settings.comfort')),
      h(
        'div',
        { class: 'settings-group' },
        toggle(t('settings.leftHanded'), 'hand', 'leftHanded', t('settings.leftHanded.hint')),
        h(
          'div',
          { class: 'setting setting-wrap' },
          icon('text'),
          h('div', { class: 'setting-main' }, h('b', null, t('settings.textSize'))),
          h(
            'div',
            { class: 'segmented', role: 'group', 'aria-label': t('settings.textSize') },
            ...sizes.map(([value, key]) =>
              h(
                'button',
                {
                  class: `seg${Math.abs(s.textScale - value) < 0.01 ? ' is-active' : ''}`,
                  type: 'button',
                  'aria-pressed': String(Math.abs(s.textScale - value) < 0.01),
                  onclick: () => {
                    s.textScale = value;
                    app.applySettings();
                    app.save();
                    render();
                  },
                },
                t(`settings.text.${key}`),
              ),
            ),
          ),
        ),
        toggle(t('settings.colorblind'), 'contrast', 'colorblind', t('settings.colorblind.hint')),
        toggle(t('settings.reducedMotion'), 'motion', 'reducedMotion'),
        toggle(t('settings.assist'), 'shield', 'assist', t('settings.assist.hint')),
        h(
          'div',
          { class: 'setting' },
          icon('globe'),
          h('div', { class: 'setting-main' }, h('b', null, t('settings.lang'))),
          h(
            'select',
            { class: 'select', 'aria-label': t('settings.lang'), disabled: true },
            h('option', { value: 'fr', selected: true }, t('settings.lang.fr')),
          ),
        ),
      ),
      h('h3', { class: 'section-title' }, t('settings.game')),
      h(
        'div',
        { class: 'settings-actions' },
        button(
          t('settings.tutorial'),
          () => {
            const flags = app.game.state.flags;
            flags.tutorialDone = false;
            flags.tutorialStep = 0;
            app.save();
            app.ui.toast(t('settings.tutorial.done'), 'info', 'anchor');
          },
          { icon: 'anchor', id: 'btn-tutorial' },
        ),
        button(t('settings.intro'), () => app.ui.open('intro', { replay: true }), { icon: 'play' }),
        button(t('settings.export'), exportDialog, { icon: 'download', id: 'btn-export' }),
        button(t('settings.import'), importDialog, { icon: 'upload', id: 'btn-import' }),
        button(t('settings.reset'), () => void resetGame(), {
          icon: 'trash',
          kind: 'danger',
          id: 'btn-reset',
        }),
      ),
    );
  };
  render();
  return { id: 'settings', el: shell.el, refresh: render };
}
