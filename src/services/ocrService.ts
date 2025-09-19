import { OCR_CONFIG, generateMockOCRData } from '../config/ocr.config';

export interface ExpenseDetails {
  amount?: number;
  currency?: string;
  date?: string;
  merchant?: string;
  category?: string;
  type?: 'FUEL' | 'MISC';
  imageUri?: string;
  odometerReading?: number;
}
export interface OCRResponse {
  success: boolean;
  data?: ExpenseDetails;
  error?: string;
}

class OCRService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model: string;
  private processedReceiptCount: number = 0;

  constructor() {
    // Use configuration from config file
    this.apiKey = OCR_CONFIG.openAIApiKey;
    this.model = OCR_CONFIG.model;

    console.log('🔑 OCR Service initialized:');
    console.log('   - Has API Key:', !!this.apiKey);
    console.log('   - API Key length:', this.apiKey ? this.apiKey.length : 0);
    console.log('   - Use Real OCR:', OCR_CONFIG.useRealOCR);
    console.log('   - Model:', this.model);

    if (!this.apiKey && OCR_CONFIG.useRealOCR) {
      console.warn('⚠️ OpenAI API key not configured in src/config/ocr.config.ts');
      console.warn('⚠️ OCR will use mock data. To enable real OCR:');
      console.warn('   1. Add your OpenAI API key to src/config/ocr.config.ts');
      console.warn('   2. Set useRealOCR to true');
    }
  }

  /**
   * Direct-to-OpenAI OCR (testing/dev only).
   * Sends a base64 image and asks GPT to return STRICT JSON.
   */
  async analyzeReceipt(imageBase64: string): Promise<OCRResponse> {
    console.log('🔍 OCR Analysis Started');
    console.log('   useRealOCR:', OCR_CONFIG.useRealOCR);
    console.log('   hasApiKey:', !!this.apiKey);

    if (!OCR_CONFIG.useRealOCR || !this.apiKey) {
      console.log('⚠️ Falling back to mock data');
      // Use mock backend with varied data
      return this.analyzeReceiptViaBackend(imageBase64);
    }

    console.log('✅ Using real OpenAI OCR with model:', this.model);
    try {
      const body = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  `You are a receipt extraction engine. Extract this JSON:\n` +
                  `{\n` +
                  `  "amount": number (total amount),\n` +
                  `  "currency": string (ISO 4217 like EUR, USD),\n` +
                  `  "date": string (YYYY-MM-DD),\n` +
                  `  "merchant": string,\n` +
                  `  "category": string (fuel, parking, toll, repair, food, etc.),\n` +
                  `  "type": string ("FUEL" or "MISC")\n` +
                  `}\n` +
                  `Rules:\n` +
                  `- Respond with VALID JSON ONLY. No prose. No markdown fences.\n` +
                  `- If a field is unknown, set it to null.`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        // 🔒 Forces JSON-only response so JSON.parse won't break
        response_format: { type: 'json_object' as const },
        max_tokens: 500,
        temperature: 0.1,
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${text}`);
      }

      const result = await response.json();
      let content: string | undefined = result?.choices?.[0]?.message?.content;

      if (!content) throw new Error('No content in OpenAI response');

      // Safety: if the model ignored response_format and sent markdown,
      // strip triple backticks ```json ... ```
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```(json)?/g, '').trim();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        // Log what we got for debugging
        console.log('Raw content that failed to parse:', cleaned);
        throw new Error('Invalid JSON returned from OpenAI');
      }

      const normalized = this.normalizeExpense(parsed);

      return { success: true, data: normalized };
    } catch (error) {
      console.error('OCR Service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OCR error',
      };
    }
  }

  /**
   * Preferred for production: send base64 to your backend,
   * let the server call OpenAI with your secret key.
   */
  async analyzeReceiptViaBackend(imageBase64: string): Promise<OCRResponse> {
    // For development: return varied mock data for each receipt
    console.warn('Using mock OCR data. Configure OpenAI API key in src/config/ocr.config.ts for real OCR.');

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Get varied mock data based on receipt count
    const mockData = generateMockOCRData(this.processedReceiptCount++);

    // Add some randomness to amounts
    const variance = 0.8 + Math.random() * 0.4; // 80% to 120%
    mockData.amount = parseFloat((mockData.amount * variance).toFixed(2));

    return {
      success: true,
      data: mockData as ExpenseDetails,
    };

    /* Production implementation:
    try {
      const response = await fetch('YOUR_ACTUAL_BACKEND_URL/api/ocr/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, format: 'base64' }),
      });

      if (!response.ok) {
        throw new Error(`Backend OCR error: ${response.status}`);
      }

      const result = await response.json();
      if (result?.success && result?.data) {
        const normalized = this.normalizeExpense(result.data);
        return { success: true, data: normalized };
      }

      throw new Error(result?.message || 'OCR processing failed');
    } catch (error) {
      console.error('Backend OCR error:', error);
      return {
        success: false,
        error: 'OCR service temporarily unavailable',
      };
    }
    */
  }

  private normalizeExpense(input: any): ExpenseDetails {
    // amount can be number or string — coerce to number if possible
    let amountNum: number | undefined;
    if (typeof input?.amount === 'number') amountNum = input.amount;
    else if (typeof input?.amount === 'string') {
      const n = parseFloat(input.amount.replace(/[^\d.,-]/g, '').replace(',', '.'));
      amountNum = isNaN(n) ? undefined : n;
    }

    const currency = (input?.currency || 'EUR') as string;

    // Ensure date is in YYYY-MM-DD format and not in the future
    let date: string;
    if (typeof input?.date === 'string') {
      // If already in YYYY-MM-DD format
      if (input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = input.date;
      } else if (input.date.includes('T')) {
        // If in ISO format, extract date part
        date = input.date.split('T')[0];
      } else {
        // Try to parse various date formats
        const parsedDate = new Date(input.date);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString().split('T')[0];
        } else {
          date = new Date().toISOString().split('T')[0];
        }
      }
    } else {
      date = new Date().toISOString().split('T')[0];
    }

    // Ensure date is not in the future
    const inputDate = new Date(date);
    const today = new Date();
    if (inputDate > today) {
      date = today.toISOString().split('T')[0];
    }


    const merchant =
      typeof input?.merchant === 'string' && input.merchant.trim().length > 0
        ? input.merchant.trim()
        : undefined;

    const category =
      typeof input?.category === 'string' && input.category.trim().length > 0
        ? input.category.trim()
        : undefined;

    const type = this.determineExpenseType(category, merchant);

    return {
      amount: amountNum,
      currency,
      date,
      merchant,
      category,
      type,
    };
    }

  private determineExpenseType(category?: string, merchant?: string): 'FUEL' | 'MISC' {
    if (!category && !merchant) return 'MISC';
    const fuelKeywords = [
      'fuel',
      'gas',
      'gasoline',
      'petrol',
      'diesel',
      'shell',
      'bp',
      'chevron',
      'exxon',
      'mobil',
      'esso',
      'aral',
      'total',
    ];
    const text = `${category || ''} ${merchant || ''}`.toLowerCase();
    return fuelKeywords.some(k => text.includes(k)) ? 'FUEL' : 'MISC';
  }
}

export const ocrService = new OCRService();
