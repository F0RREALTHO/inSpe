const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin to configure react-native-get-sms-android
 */
const withSmsAndroid = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (!manifest.application) {
      manifest.application = [{}];
    }

    const application = manifest.application[0];
    
    // Ensure permissions are present
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = manifest['uses-permission'];
    
    // Add READ_SMS permission if not present
    if (!permissions.some(p => p.$['android:name'] === 'android.permission.READ_SMS')) {
      permissions.push({
        $: { 'android:name': 'android.permission.READ_SMS' }
      });
    }

    // Add RECEIVE_SMS permission if not present
    if (!permissions.some(p => p.$['android:name'] === 'android.permission.RECEIVE_SMS')) {
      permissions.push({
        $: { 'android:name': 'android.permission.RECEIVE_SMS' }
      });
    }

    return config;
  });
};

module.exports = withSmsAndroid;

