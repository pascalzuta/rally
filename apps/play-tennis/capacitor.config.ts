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
      launchAutoHide: false, // hide manually after auth state resolves
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
