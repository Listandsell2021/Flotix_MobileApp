const getApiUrl = (): string => {
  if (__DEV__) {
    // Using your backend server
    const url = "http://192.168.188.45:3001";

    console.log("API_URL configured as:", url);
    return url;
  }
  return process.env.API_URL || "https://your-production-api.com";
};

export const API_URL = getApiUrl();
