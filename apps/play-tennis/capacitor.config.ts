import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.playrally.app',
  appName: 'Rally',
  webDir: 'dist',
  server: {
    // Capacitor serves from capacitor:// (iOS) or https://localhost (Android)
    // No server URL for production — serves from local files
    // For dev: npx cap run ios --livereload --external
    androidScheme: 'https', // makes cookies/fetch work like HTTPS
  },
  plugins: {
    SplashScreen: {
      // Auto-hide from native code so the splash can never stick (was `false`,
      // which relied on JS calling SplashScreen.hide() and silently hung when
      // that call never fired). JS can still hide it sooner via .hide().
      launchAutoHide: true,
      launchShowDuration: 2000,
      launchFadeOutDuration: 300,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
