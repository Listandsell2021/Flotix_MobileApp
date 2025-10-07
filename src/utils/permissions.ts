import { Platform, Alert, Linking } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  request,
  check,
  requestMultiple,
  openSettings,
} from 'react-native-permissions';

export type PermissionType = 'camera' | 'location';

export interface PermissionResult {
  granted: boolean;
  message?: string;
  shouldShowSettings?: boolean;
}

class PermissionManager {
  private getPermissionByType(type: PermissionType) {
    const permissions = {
      camera: Platform.select({
        ios: PERMISSIONS.IOS.CAMERA,
        android: PERMISSIONS.ANDROID.CAMERA,
      }),
      location: Platform.select({
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      }),
    };

    return permissions[type];
  }

  private getPermissionMessages(type: PermissionType) {
    const messages = {
      camera: {
        title: 'Camera Permission Required',
        message: 'Flotix needs camera access to capture receipt photos for expense tracking.',
        blockedTitle: 'Camera Access Blocked',
        blockedMessage: 'Camera access is required to take photos. Please enable it in Settings.',
      },
      location: {
        title: 'Location Permission Required',
        message: 'Flotix can use location to add context to your expense reports.',
        blockedTitle: 'Location Access Blocked',
        blockedMessage: 'Location access is blocked. Please enable it in Settings if desired.',
      },
    };

    return messages[type];
  }

  async checkPermission(type: PermissionType): Promise<PermissionResult> {
    try {
      const permission = this.getPermissionByType(type);
      if (!permission) {
        return { granted: false, message: 'Permission not supported on this platform' };
      }

      const result = await check(permission);

      switch (result) {
        case RESULTS.GRANTED:
          return { granted: true };
        case RESULTS.DENIED:
          return { granted: false, message: 'Permission not yet requested' };
        case RESULTS.BLOCKED:
        case RESULTS.LIMITED:
          return {
            granted: false,
            message: 'Permission blocked',
            shouldShowSettings: true
          };
        case RESULTS.UNAVAILABLE:
          return { granted: false, message: 'Permission not available on this device' };
        default:
          return { granted: false, message: 'Unknown permission status' };
      }
    } catch (error) {
      console.error(`Error checking ${type} permission:`, error);
      return { granted: false, message: 'Error checking permission' };
    }
  }

  async requestPermission(type: PermissionType): Promise<PermissionResult> {
    try {
      // First check current status
      const currentStatus = await this.checkPermission(type);

      if (currentStatus.granted) {
        return { granted: true };
      }

      if (currentStatus.shouldShowSettings) {
        // Permission is blocked, show settings alert
        return this.showSettingsAlert(type);
      }

      // Request permission
      const permission = this.getPermissionByType(type);
      if (!permission) {
        return { granted: false, message: 'Permission not supported' };
      }

      const result = await request(permission);

      switch (result) {
        case RESULTS.GRANTED:
          return { granted: true };
        case RESULTS.DENIED:
          return {
            granted: false,
            message: this.getPermissionMessages(type).message
          };
        case RESULTS.BLOCKED:
        case RESULTS.LIMITED:
          return this.showSettingsAlert(type);
        case RESULTS.UNAVAILABLE:
          return { granted: false, message: 'Permission not available on this device' };
        default:
          return { granted: false, message: 'Permission request failed' };
      }
    } catch (error) {
      console.error(`Error requesting ${type} permission:`, error);
      return { granted: false, message: 'Error requesting permission' };
    }
  }

  private async showSettingsAlert(type: PermissionType): Promise<PermissionResult> {
    const messages = this.getPermissionMessages(type);

    return new Promise((resolve) => {
      Alert.alert(
        messages.blockedTitle,
        messages.blockedMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ granted: false, message: 'User cancelled' }),
          },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                await openSettings();
                resolve({ granted: false, message: 'Redirected to settings' });
              } catch (error) {
                console.error('Error opening settings:', error);
                // Fallback to Linking.openSettings
                try {
                  await Linking.openSettings();
                  resolve({ granted: false, message: 'Redirected to settings' });
                } catch (linkingError) {
                  console.error('Error with Linking.openSettings:', linkingError);
                  resolve({ granted: false, message: 'Unable to open settings' });
                }
              }
            },
          },
        ]
      );
    });
  }

  async requestMultiplePermissions(types: PermissionType[]): Promise<{ [key in PermissionType]?: PermissionResult }> {
    const results: { [key in PermissionType]?: PermissionResult } = {};

    for (const type of types) {
      results[type] = await this.requestPermission(type);
    }

    return results;
  }

  // Utility method to check if any critical permissions are missing
  async checkCriticalPermissions(): Promise<{
    camera: PermissionResult;
    allGranted: boolean;
  }> {
    const camera = await this.checkPermission('camera');

    return {
      camera,
      allGranted: camera.granted,
    };
  }
}

export const permissionManager = new PermissionManager();
export default permissionManager;