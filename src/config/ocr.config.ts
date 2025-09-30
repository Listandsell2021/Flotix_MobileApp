// OCR Configuration
// For development, you can set your OpenAI API key here
// In production, this should come from secure environment variables

// Import API key from environment
import { API_KEY } from '@env';

export const OCR_CONFIG = {
  // Set to true to enable real OCR with OpenAI
  useRealOCR: true,

  // Add your OpenAI API key here for development testing
  // Get your key from: https://platform.openai.com/api-keys
  // IMPORTANT: Never commit real API keys to version control!
  openAIApiKey: API_KEY || '',

  // Model to use for OCR (gpt-4o or gpt-4o-mini)
  model: 'gpt-4o-mini',

  // Backend OCR endpoint (when available)
  backendOCRUrl: '/api/ocr/analyze',

  // Use backend instead of direct OpenAI calls
  preferBackend: false, // Set to false to use direct OpenAI API
};

// Mock data generator for development
export const generateMockOCRData = (index: number = 0) => {
  const mockData = [
    {
      amount: 45.50,
      currency: 'EUR',
      date: (() => {
        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear();
        return `${day}.${month}.${year}`;
      })(),
      merchant: 'Shell Gas Station',
      category: 'fuel',
      type: 'FUEL' as const,
    },
    {
      amount: 32.80,
      currency: 'EUR',
      date: (() => {
        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear();
        return `${day}.${month}.${year}`;
      })(),
      merchant: 'BP Service Station',
      category: 'fuel',
      type: 'FUEL' as const,
    },
    {
      amount: 15.00,
      currency: 'EUR',
      date: (() => {
        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear();
        return `${day}.${month}.${year}`;
      })(),
      merchant: 'City Parking',
      category: 'parking',
      type: 'MISC' as const,
    },
    {
      amount: 8.50,
      currency: 'EUR',
      date: (() => {
        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear();
        return `${day}.${month}.${year}`;
      })(),
      merchant: 'Highway Toll',
      category: 'toll',
      type: 'MISC' as const,
    },
    {
      amount: 125.00,
      currency: 'EUR',
      date: (() => {
        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear();
        return `${day}.${month}.${year}`;
      })(),
      merchant: 'AutoService Center',
      category: 'repair',
      type: 'MISC' as const,
    },
  ];

  // Return different mock data for each receipt
  return mockData[index % mockData.length];
};