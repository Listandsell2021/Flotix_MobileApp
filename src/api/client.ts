import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/env';


class ApiClient {
  private client: AxiosInstance;
  private refreshing = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        const originalRequest = error.config;

        // Skip refresh for login endpoint and requests without auth header
        const isLoginRequest = originalRequest.url?.includes('/auth/login');
        const hasAuthHeader = originalRequest.headers?.Authorization;
        
        if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && hasAuthHeader) {
          if (this.refreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return this.client(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.refreshing = true;

          try {
            const refreshToken = await AsyncStorage.getItem('refreshToken');
            console.log('🔄 Attempting token refresh, has refreshToken:', !!refreshToken);
            
            if (!refreshToken) {
              console.error('❌ No refresh token found in storage');
              // Clear all auth data and reject with specific error
              await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user', 'driverData']);
              const authError = new Error('Session expired. Please login again.');
              (authError as any).code = 'NO_REFRESH_TOKEN';
              throw authError;
            }

            console.log('📤 Sending refresh request to:', `${API_URL}/api/auth/refresh`);
            const response = await axios.post(`${API_URL}/api/auth/refresh`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data;
            console.log('✅ Token refresh successful');
            
            // Store the new tokens
            await AsyncStorage.setItem('accessToken', accessToken);
            // If backend returns a new refresh token, update it
            if (newRefreshToken) {
              await AsyncStorage.setItem('refreshToken', newRefreshToken);
            }

            this.processQueue(null, accessToken);
            this.refreshing = false;

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError: any) {
            console.error('❌ Token refresh failed:', refreshError.message);
            this.processQueue(refreshError, null);
            this.refreshing = false;
            
            // Clear all auth data
            await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user', 'driverData']);
            
            // Add a flag to indicate auth failure
            refreshError.authFailed = true;
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });

    this.failedQueue = [];
  }

  public get instance() {
    return this.client;
  }
}

export const apiClient = new ApiClient().instance;