import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gotaagota.security',
  appName: 'Gota a Gota Control',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    BackgroundRunner: {
      label: 'com.gotaagota.security.check',
      src: 'background.js',
      event: 'checkIn',
      repeat: true,
      interval: 15,
      autoStart: true
    }
  }
};

export default config;
