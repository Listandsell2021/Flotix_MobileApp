import { apiClient } from './client';

export interface ExpenseType {
  type: 'Fuel' | 'Misc';
}
type ExpenseTypeUpper = 'FUEL' | 'MISC';
// type CategoryUpper = 'TOLL' | 'PARKING' | 'REPAIR' | 'OTHER';
export interface CreateExpenseRequest {
  type: ExpenseTypeUpper;
  amountFinal: number;
  merchant?: string;
  receiptUrl?: string;
  kilometers?: number;
  notes?: string;
  category?: string;
  date?: string;
  currency?: string;
  odometerReading?: number;
}

export interface OCRData {
  merchant?: string;
  date?: string;
  currency?: string;
  amount?: number;
  confidence?: number;
}
export interface UploadReceiptResponse {
  imageUrl: string;
  ocrResult: {
    merchant?: string;
    amount?: number;
    date?: string;
    currency?: string;
    confidence?: number;
  };
}

export interface Expense {
  _id: string;
  id?: string; // For backward compatibility
  driverId: string | { _id: string; name: string; email: string };
  companyId: string;
  type: 'Fuel' | 'Misc' | 'FUEL' | 'MISC';
  amountExtracted?: number;
  amountFinal: number;
  currency: string;
  receiptUrl?: string;
  merchant?: string;
  ocr?: OCRData;
  date: string;
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  canEdit?: boolean;
}

export interface ExpensesListResponse {
  items: Expense[];
  page: number;
  pageSize: number;
  total: number;
}

export interface GetExpensesParams {
  type?: 'Fuel' | 'Misc' | 'FUEL' | 'MISC';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  driverId?: string;
}

export interface UpdateExpenseRequest {
  type?: 'Fuel' | 'Misc';
  amountFinal?: number;
  currency?: string;
  date?: string;
  category?: string;
  notes?: string;
}

export interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

export const expensesApi = {
create: async (expense: CreateExpenseRequest): Promise<Expense> => {
  try {
    // Create payload matching the backend API format
    const payload = {
      type: expense.type,
      amountFinal: expense.amountFinal,
      ...(expense.merchant && { merchant: expense.merchant }),
      ...(expense.receiptUrl && { receiptUrl: expense.receiptUrl }),
      ...(expense.kilometers !== undefined && { kilometers: expense.odometerReading }),
      ...(expense.notes && { notes: expense.notes }),
      ...(expense.category && { category: expense.category }),
      ...(expense.date && { date: expense.date }),
      ...(expense.currency && { currency: expense.currency }),
      ...(expense.odometerReading !== undefined && { odometerReading: expense.odometerReading }),
    };
    
    console.log('POST /api/expenses payload:', payload);

    const response = await apiClient.post<Expense>('/api/expenses', payload);
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error('Create expense error:', { status, data });
    // Bubble up a meaningful message
    const message = data?.message || data?.error || `HTTP ${status}`;
    const e = new Error(message) as any;
    e.response = error.response;
    throw e;
  }
},
uploadImage: async (imageUri: string): Promise<{ imageUrl: string }> => {
  try {
    const form = new FormData();
    
    // Ensure the URI is properly formatted
    const cleanUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;
    
    form.append('image', {
      uri: cleanUri,
      name: 'receipt.jpg',
      type: 'image/jpeg',
    } as any);

    console.log('🔄 Uploading image from:', cleanUri);
    console.log('📤 Uploading to endpoint:', '/api/expenses/upload-image');
    
    const res = await apiClient.post('/api/expenses/upload-image', form, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json',
      },
      transformRequest: (data) => data, // Important: prevent axios from stringifying FormData
    });

    console.log('✅ Upload response:', res.data);

    // Handle the API response format: { success: true, data: { imageUrl: "..." } }
    if (res.data?.success && res.data?.data?.imageUrl) {
      return {
        imageUrl: res.data.data.imageUrl
      };
    }
    
    // Also handle if backend returns imageUrl directly
    if (res.data?.imageUrl) {
      return {
        imageUrl: res.data.imageUrl
      };
    }

    throw new Error('No image URL returned from upload');
  } catch (error: any) {
    console.error('❌ Image upload failed:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    // Provide more specific error message
    if (error.response?.status === 404) {
      throw new Error('Upload endpoint not found (404)');
    } else if (error.response?.status === 401) {
      throw new Error('Authentication required for upload');
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    
    throw new Error(`Image upload failed: ${error.message}`);
  }
},

  getList: async (params: GetExpensesParams = {}): Promise<ExpensesListResponse> => {
    try {
      console.log('Fetching expenses with params:', params);
      const response = await apiClient.get('/api/expenses', {
        params,
      });
      console.log('Raw expense response:', response.data);
      
      // Handle the specific backend response format
      if (response.data && response.data.success && response.data.data) {
        const { data: responseData } = response.data;
        
        return {
          items: responseData.data || [], // The actual expenses array
          page: responseData.pagination?.page || 1,
          pageSize: responseData.pagination?.limit || 20,
          total: responseData.pagination?.total || 0
        };
      }
      
      // Handle other possible formats
      if (response.data && typeof response.data === 'object') {
        // If backend returns { items: [], ... } directly
        if (Array.isArray(response.data.items)) {
          return response.data;
        }
        // If backend returns array directly
        else if (Array.isArray(response.data)) {
          return {
            items: response.data,
            page: 1,
            pageSize: response.data.length,
            total: response.data.length
          };
        }
      }
      
      // Fallback to empty response
      return {
        items: [],
        page: 1,
        pageSize: 0,
        total: 0
      };
      
    } catch (error: any) {
      console.error('Get expenses error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  },

  getById: async (id: string): Promise<Expense> => {
    const response = await apiClient.get<Expense>(`/expenses/${id}`);
    return response.data;
  },

  update: async (id: string, updates: UpdateExpenseRequest): Promise<Expense> => {
    const response = await apiClient.patch<Expense>(`/expenses/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/expenses/${id}`);
  },

  getSignedUrl: async (filename: string, contentType: string): Promise<SignedUrlResponse> => {
    const response = await apiClient.post<SignedUrlResponse>('/api/expenses/signed-url', {
      filename,
      contentType,
    });
    return response.data;
  },
};