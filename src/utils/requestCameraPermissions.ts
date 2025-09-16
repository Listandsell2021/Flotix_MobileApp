import { PermissionsAndroid, Platform } from 'react-native';

export async function requestCameraPermissions() {
  if (Platform.OS === 'android') {
    try {
      // Request Camera
      const cam = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'FleetFlow needs access to your camera to take receipt photos.',
          buttonPositive: 'OK',
        }
      );

      if (cam !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }

      // Request Photos / Media
      const readMedia =
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES ||
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const storage = await PermissionsAndroid.request(readMedia, {
        title: 'Photos Permission',
        message: 'FleetFlow needs access to your photos to pick receipts.',
        buttonPositive: 'OK',
      });

      return storage === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Permission error:', err);
      return false;
    }
  }

  // iOS permissions are handled via Info.plist
  return true;
}
