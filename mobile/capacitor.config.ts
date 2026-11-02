import type { CapacitorConfig } from '@capacitor/cli';

// The app loads the live site so the normal first-party session cookie works
// (same origin as the website, so no CORS or third-party-cookie issues).
// FC_SERVER_URL overrides it for local/emulator testing only.
const serverUrl = process.env.FC_SERVER_URL || 'https://fitness-coach-xamg.onrender.com';
const host = new URL(serverUrl).hostname;

const config: CapacitorConfig = {
  appId: 'com.nathrasher.fitnesscoach',
  appName: 'Fitness Coach',
  webDir: 'www',
  server: {
    url: serverUrl,
    androidScheme: 'https',
    cleartext: serverUrl.startsWith('http://'),
    allowNavigation: [host],
    errorPath: 'offline.html'
  },
  backgroundColor: '#203227',
  ios: { contentInset: 'never', backgroundColor: '#203227', scheme: 'Fitness Coach' },
  android: { backgroundColor: '#203227' },
  plugins: {
    SplashScreen: { launchAutoHide: true, launchShowDuration: 2500, backgroundColor: '#203227', showSpinner: true, spinnerColor: '#e3a873', androidScaleType: 'CENTER_CROP' },
    StatusBar: { style: 'DARK', backgroundColor: '#203227', overlaysWebView: false },
    LocalNotifications: { smallIcon: 'ic_stat_fc', iconColor: '#e3a873' }
  }
};

export default config;
