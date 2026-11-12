import type { Ui } from '../ui';
import { achievementsScreen } from './achievements';
import { creelScreen } from './creel';
import { debugScreen } from './debug';
import { dexScreen } from './dex';
import { mapScreen } from './map';
import { cabinScreen, creditsScreen, endingScreen, introScreen, pauseScreen } from './misc';
import { missionsScreen } from './missions';
import { settingsScreen } from './settings';
import { shopScreen } from './shop';

export function registerScreens(ui: Ui): void {
  ui.registerScreen('shop', shopScreen);
  ui.registerScreen('creel', creelScreen);
  ui.registerScreen('dex', dexScreen);
  ui.registerScreen('missions', missionsScreen);
  ui.registerScreen('achievements', achievementsScreen);
  ui.registerScreen('settings', settingsScreen);
  ui.registerScreen('map', mapScreen);
  ui.registerScreen('cabin', cabinScreen);
  ui.registerScreen('pause', pauseScreen);
  ui.registerScreen('credits', creditsScreen);
  ui.registerScreen('intro', introScreen);
  ui.registerScreen('ending', endingScreen);
  ui.registerScreen('debug', debugScreen);
}
