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
  // Optional: switch models quickly
  private readonly model = 'gpt-4o'; // or 'gpt-4o-mini'

  constructor() {
    // ⚠️ For local testing only. In production call your backend (see analyzeReceiptViaBackend).
    //this.apiKey = '';
  }

  /**
   * Direct-to-OpenAI OCR (testing/dev only).
   * Sends a base64 image and asks GPT to return STRICT JSON.
   */
  async analyzeReceipt(imageBase64: string): Promise<OCRResponse> {
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
    try {
      const response = await fetch('http://YOUR_BACKEND_HOST:3001/api/ocr/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, format: 'base64' }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Backend OCR error: ${response.status} ${text}`);
      }

      const result = await response.json();

      if (result?.success && result?.data) {
        const normalized = this.normalizeExpense(result.data);
        return { success: true, data: normalized };
      }

      // If backend failed with a message, surface it
      if (result?.message) throw new Error(result.message);

      // Optional: fallback to direct OpenAI
      return this.analyzeReceipt(imageBase64);
    } catch (error) {
      console.error('Backend OCR error:', error);
      // Optional: fallback to direct OpenAI
      return this.analyzeReceipt(imageBase64);
    }
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
    const date =
  (typeof input?.date === 'string' && input.date.match(/^\d{4}-\d{2}-\d{2}$/)
    ? new Date(input.date).toISOString()
    : new Date().toISOString());


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
