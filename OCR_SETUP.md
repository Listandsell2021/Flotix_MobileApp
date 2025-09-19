# OCR Setup Guide

## Current Status
The app is configured to use **mock OCR data** for development. Each receipt will get different mock data (Shell, BP, Parking, Toll, etc.) with varied amounts.

## To Enable Real OCR with OpenAI

### Step 1: Get an OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-...`)

### Step 2: Configure the App
1. Open `src/config/ocr.config.ts`
2. Add your API key:
   ```typescript
   openAIApiKey: 'sk-your-api-key-here',
   ```
3. Enable real OCR:
   ```typescript
   useRealOCR: true,
   ```

### Step 3: Restart the App
```bash
# Stop Metro bundler (Ctrl+C)
# Start again
npm start

# Reload the app on your device
```

## Mock Data Behavior
When using mock data (default), the app will:
- Generate different receipt data for each image
- Rotate through: Shell, BP, City Parking, Highway Toll, AutoService Center
- Vary amounts by ±20% for realism
- Use EUR as currency
- Set current date

## Security Notes
⚠️ **NEVER commit your API key to version control!**
- Add `src/config/ocr.config.ts` to `.gitignore` if you add a real key
- For production, use environment variables or a backend service

## Troubleshooting
- If OCR returns mock data: Check that `useRealOCR` is `true` and API key is set
- If OCR fails: Check your API key is valid and has credits
- Network errors: Ensure your device has internet access