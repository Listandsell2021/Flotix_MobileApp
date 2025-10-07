import { Platform } from 'react-native';

/**
 * Network configuration helper for different development environments
 */
export const getApiUrl = (): string => {
  // In production, use environment variable
  if (!__DEV__) {
    return process.env.API_URL || 'https://api.flotix.listandsell.de';
  }

  // Development configuration
  const envUrl = process.env.API_URL;
  if (envUrl) {
    return envUrl;
  }

  // Default to production API for mobile development
  // This works for both physical devices and emulators
  return 'https://api.flotix.listandsell.de';
};

/**
 * Get current network IP address instructions
 */
export const getNetworkInstructions = (): string => {
  return `
For testing on physical devices, update .env with your computer's IP:

macOS/Linux: Run 'ifconfig' and look for inet under en0 or wlan0
Windows: Run 'ipconfig' and look for IPv4 Address

Example: API_URL=http://192.168.1.100:3001
  `;
};

export const API_URL = getApiUrl();

// Log configuration for debugging
if (__DEV__) {
  console.log('📡 API Configuration:', {
    platform: Platform.OS,
    apiUrl: API_URL,
    isPhysicalDevice: !__DEV__ || undefined,
  });

  if (!process.env.API_URL) {
    console.log('💡 Network Setup:', getNetworkInstructions());
  }
}