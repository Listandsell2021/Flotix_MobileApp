import { Platform } from "react-native";

const getApiUrl = (): string => {
  if (__DEV__) {
    // For physical devices, use the actual local network IP
    // For emulator, use 10.0.2.2
    const url =
      Platform.OS === "android"
        ? "http://192.168.1.17:3001"
        : "http://localhost:3001";

    console.log("API_URL configured as:", url);
    return url;
  }
  return process.env.API_URL || "https://your-production-api.com";
};

export const API_URL = getApiUrl();
