import { PermissionsAndroid, Platform } from 'react-native';

export async function requestCameraPermissions() {
  if (Platform.OS === 'android') {
    try {
      // Only request Camera permission - photo picker handles media access
      const cam = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'Flotix needs access to your camera to take receipt photos.',
          buttonPositive: 'OK',
        }
      );

      return cam === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Permission error:', err);
      return false;
    }
  }

  // iOS permissions are handled via Info.plist
  return true;
}
