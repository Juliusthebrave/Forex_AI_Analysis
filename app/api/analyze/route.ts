import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { sendTelegramSignal } from '@/lib/telegram';
import type { ForexSignalRequest, SignalType } from '@/lib/types';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Minimal system prompt for fast response
const SYSTEM_PROMPT = `You are a Forex analyst. Respond with ONLY valid JSON (no markdown):
{"signal":"BUY"|"SELL"|"NEUTRAL","confidence":0-100,"riskLevel":"LOW"|"MEDIUM"|"HIGH","analysis":"<brief 1-2 sentence analysis>"}`;

interface AnalysisResponse {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  analysis: string;
}

export async function POST(req: Request) {
  console.log('[API] POST /api/analyze - START');
  let receivedData: any = null;

  try {
    // ========== STEP 1: PARSE REQUEST ==========
    console.log('[API] Headers:', Object.fromEntries(req.headers));
    
    receivedData = await req.json();
    console.log('[API] Received data:', {
      symbol: receivedData.symbol,
      price: receivedData.price,
      ema8: receivedData.ema8,
      hasMACD: !!receivedData.macd,
      hasHistory: !!receivedData.history,
    });

    const { symbol, price, ema8, ema20, ema50, macd, accountBalance = 27 } = receivedData;

    // ========== STEP 2: VALIDATE ==========
    if (!symbol || typeof price !== 'number') {
      console.warn('[API] Missing required: symbol or price');
      return Response.json({
        success: false,
        signal: 'NEUTRAL',
        confidence: 0,
        riskLevel: 'HIGH',
        analysis: 'Invalid request: missing symbol or price',
      });
    }

    // ========== STEP 3: SEND TELEGRAM FIRST (TEST CONNECTION) ==========
    console.log('[API] Sending Telegram notification...');
    try {
      await sendTelegramSignal({
        symbol,
        signal: 'NEUTRAL' as SignalType,
        price,
        analysis: `📊 Analysis started for ${symbol} at ${price}`,
        confidence: 0,
        riskLevel: 'MEDIUM',
      });
      console.log('[Telegram] ✓ Message sent successfully');
    } catch (telegramError) {
      console.warn('[Telegram] ⚠️ Failed to send:', telegramError instanceof Error ? telegramError.message : String(telegramError));
      // Continue anyway - don't fail the API
    }

    // ========== STEP 4: QUICK AI ANALYSIS (MINIMAL) ==========
    console.log('[API] Calling Groq API with llama3-8b-8192...');
    let aiResponse: AnalysisResponse = {
      signal: 'NEUTRAL',
      confidence: 50,
      riskLevel: 'MEDIUM',
      analysis: 'Market analysis in progress',
    };

    try {
      const userPrompt = `Quick analysis for ${symbol} at ${price}:
EMA 8: ${ema8}, EMA 20: ${ema20}, EMA 50: ${ema50}
MACD: ${macd?.histogram ?? 'N/A'}
Account: $${accountBalance}
Provide signal: BUY/SELL/NEUTRAL with 1-sentence reason.`;

      const result = await generateText({
        model: groq('llama3-8b-8192'), // FASTEST model
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.5,
        maxTokens: 200, // MINIMAL tokens
      });

      console.log('[API] Groq response:', result.text?.substring(0, 100));

      // Parse response
      let cleanedText = result.text.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```(?:json)?\n?/g, '').trim();
      }
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.signal && parsed.confidence !== undefined && parsed.riskLevel) {
          aiResponse = {
            signal: parsed.signal as SignalType,
            confidence: Math.min(100, Math.max(0, parsed.confidence)),
            riskLevel: parsed.riskLevel,
            analysis: (parsed.analysis || '').substring(0, 100),
          };
        }
      }
    } catch (aiError) {
      console.warn('[AI] ⚠️ Groq failed:', aiError instanceof Error ? aiError.message : String(aiError));
      // Use default response
    }

    console.log('[API] Final signal:', aiResponse.signal, 'Confidence:', aiResponse.confidence);

    // ========== STEP 5: SEND TELEGRAM WITH RESULT ==========
    console.log('[API] Sending final Telegram...');
    try {
      await sendTelegramSignal({
        symbol,
        signal: aiResponse.signal as SignalType,
        price,
        analysis: aiResponse.analysis,
        confidence: aiResponse.confidence,
        riskLevel: aiResponse.riskLevel,
      });
      console.log('[Telegram] ✓ Result sent to Telegram');
    } catch (telegramError) {
      console.warn('[Telegram] ⚠️ Result notification failed:', telegramError instanceof Error ? telegramError.message : String(telegramError));
    }

    // ========== STEP 6: RETURN RESPONSE ==========
    const response = {
      success: true,
      signal: aiResponse.signal,
      confidence: aiResponse.confidence,
      riskLevel: aiResponse.riskLevel,
      analysis: aiResponse.analysis,
      timestamp: new Date().toISOString(),
      symbol,
      price,
    };

    console.log('[API] POST /api/analyze - SUCCESS');
    return Response.json(response);

  } catch (outerError) {
    // ========== CATCH-ALL ERROR HANDLER - ALWAYS RETURN 200 ==========
    const errorMsg = outerError instanceof Error ? outerError.message : String(outerError);
    console.error('[API] ‼️ CRITICAL ERROR:', errorMsg);
    console.error('[API] Stack:', outerError instanceof Error ? outerError.stack : 'N/A');

    // Always return 200 so MT5 doesn't get 502/500 and retry
    return Response.json({
      success: false,
      signal: 'NEUTRAL',
      confidence: 1,
      riskLevel: 'HIGH',
      analysis: `Error: ${errorMsg.substring(0, 50)}`,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }, { status: 200 }); // CRITICAL: Always 200 even on error
  }
}
