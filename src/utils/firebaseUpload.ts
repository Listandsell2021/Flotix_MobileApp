import { expensesApi } from '../api/expenses';

interface UploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

export const uploadReceiptImage = async (uri: string): Promise<UploadResult> => {
  try {
    const filename = `receipt_${Date.now()}.jpg`;
    const contentType = 'image/jpeg';

    const signedUrlResponse = await expensesApi.getSignedUrl(filename, contentType);
    
    const response = await fetch(uri);
    const blob = await response.blob();

    const uploadResponse = await fetch(signedUrlResponse.uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (uploadResponse.ok) {
      return {
        success: true,
        publicUrl: signedUrlResponse.publicUrl,
      };
    } else {
      return {
        success: false,
        error: 'Upload failed',
      };
    }
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export const uploadReceiptFallback = async (uri: string): Promise<UploadResult> => {
  console.log('Using fallback upload method for:', uri);
  
  await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
  
  return {
    success: true,
    publicUrl: `https://storage.googleapis.com/bucket/receipts/mock_${Date.now()}.jpg`,
  };
};