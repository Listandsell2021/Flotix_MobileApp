import { apiClient } from './client';

export interface Company {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  createdAt: string;
  updatedAt?: string;
}

export const companiesApi = {
  getById: async (id: string): Promise<Company> => {
    try {
      console.log('🔄 Fetching company from API:', `/api/companies/${id}`);
      const response = await apiClient.get(`/api/companies/${id}`);
      console.log('📦 Raw company API response:', response.data);
      
      // Handle different response formats
      if (response.data?.success && response.data?.data) {
        console.log('✅ Using nested data format');
        return response.data.data as Company;
      } else if (response.data && typeof response.data === 'object') {
        console.log('✅ Using direct data format');
        return response.data as Company;
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      console.error('❌ Company API error:', error);
      throw error;
    }
  },
};