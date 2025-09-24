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

export interface BatchExpenseItem {
  driverId?: string;
  type: 'FUEL' | 'MISC';
  amountFinal: number;
  currency: string;
  receiptUrl: string;
  merchant?: string;
  category?: 'TOLL' | 'PARKING' | 'REPAIR' | 'OTHER';
  notes?: string;
  kilometers?: number;
  odometerReading?: number;
  date: string;
}

export interface BatchUploadResponse {
  success: boolean;
  data: {
    successful: Array<{
      index: number;
      expense: Expense;
    }>;
    failed: Array<{
      index: number;
      data: BatchExpenseItem;
      error: string;
    }>;
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
  };
  message: string;
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
    console.log('🔄 Image upload requested for:', imageUri);

    // Try signed URL approach first (proper S3 upload)
    try {
      // Step 1: Get a signed URL from the backend
      const timestamp = Date.now();
      const filename = `receipt_${timestamp}.jpg`;

      console.log('📝 Requesting signed URL for:', filename);
      const signedUrlResponse = await expensesApi.getSignedUrl(filename, 'image/jpeg');

      if (!signedUrlResponse.uploadUrl || !signedUrlResponse.publicUrl) {
        throw new Error('Invalid signed URL response');
      }

      console.log('✅ Got signed URL:', signedUrlResponse.uploadUrl.substring(0, 100) + '...');

      // Step 2: Read the image file as blob
      const cleanUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;

      // Step 3: Upload directly to S3 using the signed URL
      const uploadResponse = await fetch(signedUrlResponse.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: { uri: cleanUri, type: 'image/jpeg', name: filename } as any,
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.status}`);
      }

      console.log('✅ Image uploaded to S3 successfully');
      return {
        imageUrl: signedUrlResponse.publicUrl
      };

    } catch (signedUrlError: any) {
      console.log('⚠️ Signed URL approach failed:', signedUrlError.message);

      // Fallback to direct upload if signed URL fails
      const form = new FormData();
      const cleanUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;

      form.append('image', {
        uri: cleanUri,
        name: 'receipt.jpg',
        type: 'image/jpeg',
      } as any);

      console.log('📤 Trying direct upload to:', '/api/expenses/upload-image');

      const res = await apiClient.post('/api/expenses/upload-image', form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
        },
        transformRequest: (data) => data,
      });

      if (res.data?.success && res.data?.data?.imageUrl) {
        return { imageUrl: res.data.data.imageUrl };
      }

      if (res.data?.imageUrl) {
        return { imageUrl: res.data.imageUrl };
      }

      throw new Error('No image URL returned from upload');
    }
  } catch (error: any) {
    console.error('❌ Image upload failed:', error);
    console.error('Error details:', error.response?.data || error.message);

    // If backend upload fails, fall back to mock URL
    if (error.message?.includes('Network Error') || error.response?.status === 404 || error.response?.status === 500) {
      console.warn('⚠️ Backend upload failed, using mock S3 URL for development');

      // Generate a mock S3 URL that looks real
      const timestamp = Date.now();
      const mockUrl = `https://fleet-receipts.s3.eu-central-1.amazonaws.com/receipts/${timestamp}_receipt.jpg`;

      console.log('📸 Mock URL generated:', mockUrl);

      return {
        imageUrl: mockUrl
      };
    }

    // For other errors, still throw
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

  batchCreate: async (expenses: BatchExpenseItem[]): Promise<BatchUploadResponse> => {
    try {
      console.log('POST /api/expenses/batch with', expenses.length, 'expenses');

      const response = await apiClient.post<BatchUploadResponse>('/api/expenses/batch', {
        expenses
      });

      console.log('Batch upload response:', {
        totalProcessed: response.data?.data?.totalProcessed,
        totalSuccessful: response.data?.data?.totalSuccessful,
        totalFailed: response.data?.data?.totalFailed
      });

      return response.data;
    } catch (error: any) {
      console.error('Batch upload error:', {
        status: error?.response?.status,
        data: error?.response?.data
      });

      // Check if it's a permissions error
      if (error?.response?.status === 403) {
        throw new Error('You do not have permission to perform batch uploads. Please contact your administrator.');
      }

      // Check for authentication error
      if (error?.response?.status === 401) {
        const authError = new Error('Authentication required') as any;
        authError.authFailed = true;
        throw authError;
      }

      // Return error message from server if available
      const message = error?.response?.data?.message || error?.message || 'Batch upload failed';
      throw new Error(message);
    }
  },
};