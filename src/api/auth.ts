import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  companyId?: string;
  assignedVehicleId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastActive: string;
}

export interface Vehicle {
  _id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  type: string;
  status: string;
  currentOdometer: number;
  fuelType: string;
  color: string;
}

export interface Company {
  _id: string;
  name: string;
  plan: string;
  status: string;
}

export interface ExpenseStats {
  totalThisMonth: number;
  totalExpenses: number;
  avgExpenseAmount: number;
}

export interface DriverData {
  assignedVehicle: Vehicle;
  company: Company;
  recentExpenses: any[];
  expenseStats: ExpenseStats;
}

export interface LoginResponse {
  success: true;
  data: {
    user: User;
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
    driverData?: DriverData;
  };
  message: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      console.log('Attempting login to:', '/api/auth/login');
      console.log('With credentials:', { email: credentials.email, password: '[HIDDEN]' });
      
      const response = await apiClient.post<LoginResponse>('/api/auth/login', credentials);
      console.log('Login response:', response.status, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Login error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      });
      throw error;
    }
  },

  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    try {
      console.log('Attempting token refresh to:', '/api/auth/refresh');
      
      const response = await apiClient.post<RefreshResponse>('/api/auth/refresh', {
        refreshToken,
      });
      console.log('Refresh response:', response.status);
      return response.data;
    } catch (error: any) {
      console.error('Refresh error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  },

  getMe: async (): Promise<User> => {
    try {
      console.log('Attempting getMe to:', '/api/me');
      
      const response = await apiClient.get<User>('/api/me');
      console.log('GetMe response:', response.status);
      return response.data;
    } catch (error: any) {
      console.error('GetMe error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  },
};