import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.ressac.jeu',
  appName: 'RESSAC',
  webDir: 'dist',
  backgroundColor: '#0f2a3d',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
};

export default config;
