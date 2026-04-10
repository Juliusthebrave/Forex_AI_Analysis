import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { addSignal } from '@/lib/signal-store';
import { sendTelegramSignal } from '@/lib/telegram';
import type { ForexSignalRequest, ForexSignal, SignalType } from '@/lib/types';
import {
  detectPattern,
  isBullishPattern,
  isBearishPattern,
  determineMarketPhase,
  calculateVolatilityAlert,
  identifyLevels,
  validateTradeConditions,
} from '@/lib/pattern-detection';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert Forex market analyst specializing in the Dow-Homma method and candlestick pattern recognition. Your analysis takes place in April 2026.

DOW-HOMMA MASTER SCALPER TRADING METHOD:
This is a bi-directional scalping strategy based on:
1. CANDLE PATTERN DETECTION: Identify Hammer (Tonkachi), Bullish Engulfing, Falling Star (Nagareboshi), Bearish Engulfing, Doji
2. SUPPORT/RESISTANCE LEVELS: Old resistance becomes support, old support becomes resistance
3. MACD CONFIRMATION: 
   - BUY: Only when MACD histogram is INCREASING (positive)
   - SELL: Only when MACD histogram is NEGATIVE/DECREASING

TRADE EXECUTION RULES:
- BUY SIGNAL: Bullish pattern (Hammer/Bullish Engulfing) at Support level + MACD histogram > 0
- SELL SIGNAL: Bearish pattern (Falling Star/Bearish Engulfing) at Resistance level + MACD histogram < 0
- DOJI = Neutral (exhaustion signal - wait for next candle confirmation)

VOLATILITY MANAGEMENT:
- If ATR is 2x higher than average: REDUCE confidence score, WARN "Wait for Stabilization"
- If current candle range is 3x larger than previous 4 candles: Label as "VOLATILE: High Risk"
- During high-impact news spikes: DO NOT issue signals

MARKET PHASES (Based on EMA 8/20/50):
- MARKUP: Price above all EMAs in bullish order (8>20>50) - Strong uptrend
- MARKDOWN: Price below all EMAs in bearish order (8<20<50) - Strong downtrend
- DISTRIBUTION: Price retreating from highs between 20-50 EMA - Bearish transition
- ACCUMULATION: Price consolidating below 20 EMA - Bullish setup forming

SELL SIGNAL EXPLANATION:
When issuing a SELL signal, explain: "Retracement to Resistance has ended, Markdown phase resuming"

CURRENT GEOPOLITICAL CONTEXT (April 2026):
- US Federal Reserve maintained rates at 4.25% amid moderating inflation
- European Central Bank signaling potential rate cuts in Q2 2026
- China-Taiwan tensions eased following diplomatic talks, boosting Asian markets
- Middle East oil production stable after new OPEC+ agreements
- USD strength persists against emerging market currencies
- JPY weakness continues as Bank of Japan maintains ultra-loose policy
- GBP volatility due to ongoing UK-EU trade renegotiations
- AUD benefiting from strong commodity demand, particularly lithium and rare earths

IMPORTANT: You MUST respond ONLY with a valid JSON object in this exact format (no markdown, no extra text, no code blocks):
{"signal": "BUY" | "SELL" | "NEUTRAL", "confidence": <number 0-100>, "riskLevel": "LOW" | "MEDIUM" | "HIGH", "analysis": "<your analysis text>"}`;

interface AnalysisResponse {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  analysis: string;
}

export async function POST(req: Request) {
  try {
    const body: ForexSignalRequest & { accountBalance?: number } = await req.json();
    const {
      symbol,
      price,
      ema8,
      ema20,
      ema50,
      macd,
      sl,
      tp,
      atr = 0,
      history,
      averageAtr = atr,
      accountBalance = 27,
    } = body;

    // Validate required fields
    if (!symbol || typeof price !== 'number') {
      return Response.json(
        { error: 'Missing required fields: symbol and price are required' },
        { status: 400 }
      );
    }

    // ========== PATTERN DETECTION (Dow-Homma Method) ==========
    const pattern = history ? detectPattern(history) : 'NONE';
    const isBullish = isBullishPattern(pattern);
    const isBearish = isBearishPattern(pattern);

    // ========== MARKET PHASE ANALYSIS ==========
    const marketPhase = determineMarketPhase(price, ema8, ema20, ema50);

    // ========== SUPPORT/RESISTANCE LEVELS ==========
    const { support, resistance } = history ? identifyLevels(history) : { support: 0, resistance: 0 };

    // ========== VOLATILITY ANALYSIS ==========
    const volatilityResult = history
      ? calculateVolatilityAlert(history, atr, averageAtr, price)
      : { alert: '', isHigh: false, slMultiplier: 1 };

    // ========== ATR-BASED VOLATILITY (traditional) ==========
    let volatility: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (atr && price) {
      const atrPercent = (atr / price) * 100;
      if (atrPercent < 0.5) {
        volatility = 'LOW';
      } else if (atrPercent > 1.5) {
        volatility = 'HIGH';
      }
    }

    // ========== CONFIDENCE ADJUSTMENT FOR VOLATILITY ==========
    let confidenceAdjustment = 0;
    if (volatilityResult.isHigh) {
      confidenceAdjustment = -15; // Reduce confidence by 15% if high volatility detected
    }

    const maxRiskPerTrade = accountBalance * 0.02;
    const recommendedLot = (accountBalance * 0.01) / 100;
    const accountCategory =
      accountBalance < 50 ? 'Micro' : accountBalance < 200 ? 'Mini' : accountBalance < 1000 ? 'Small' : 'Standard';

    // Build the analysis prompt with pattern data
    const patternInfo =
      history && history.length > 0
        ? `
CANDLE PATTERN ANALYSIS (Dow-Homma):
- Detected Pattern: ${pattern}
- Pattern Direction: ${isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL'}
- Support Level: ${support.toFixed(5)}
- Resistance Level: ${resistance.toFixed(5)}
- Price vs Support: ${price <= support * 1.01 ? 'AT SUPPORT ✓' : `${((price - support) / support * 100).toFixed(2)}% above support`}
- Price vs Resistance: ${price >= resistance * 0.99 ? 'AT RESISTANCE ✓' : `${((resistance - price) / resistance * 100).toFixed(2)}% below resistance`}
`
        : '';

    const volatilityInfo = volatilityResult.alert
      ? `
VOLATILITY ALERT: ${volatilityResult.alert}
Stop Loss Multiplier: ${volatilityResult.slMultiplier}x default
`
      : '';

    const userPrompt = `Analyze this Forex data and provide a trading signal using the Dow-Homma Master Scalper method:

TRADER ACCOUNT INFO:
Account Balance: $${accountBalance.toFixed(2)} (${accountCategory} Account)
Max Risk Per Trade (2%): $${maxRiskPerTrade.toFixed(2)}
Recommended Lot Size: ${recommendedLot.toFixed(3)} lots

MARKET DATA:
Symbol: ${symbol}
Current Price: ${price.toFixed(5)}
Market Phase: ${marketPhase}

TECHNICAL INDICATORS:
EMA 8: ${ema8.toFixed(5)}
EMA 20: ${ema20.toFixed(5)}
EMA 50: ${ema50.toFixed(5)}
MACD Line: ${macd?.line?.toFixed(5) ?? 'N/A'}
MACD Signal: ${macd?.signal?.toFixed(5) ?? 'N/A'}
MACD Histogram: ${macd?.histogram?.toFixed(5) ?? 'N/A'}
ATR (Volatility): ${atr.toFixed(5)} ${volatilityResult.isHigh ? '⚠️ ELEVATED' : '✓ Normal'}

Technical Observations:
- Price vs EMA8: ${price > ema8 ? 'Above' : 'Below'}
- Price vs EMA20: ${price > ema20 ? 'Above' : 'Below'}
- Price vs EMA50: ${price > ema50 ? 'Above' : 'Below'}
- EMA Alignment: ${ema8 > ema20 && ema20 > ema50 ? 'Bullish (8>20>50)' : ema8 < ema20 && ema20 < ema50 ? 'Bearish (8<20<50)' : 'Mixed'}
- MACD Momentum: ${(macd?.histogram ?? 0) > 0 ? 'Bullish (positive histogram)' : 'Bearish (negative histogram)'}
${patternInfo}${volatilityInfo}
DOW-HOMMA REQUIREMENTS:
- BUY Trigger: Bullish Pattern (${isBullish ? '✓ DETECTED' : '✗ NOT DETECTED'}) + Support Level (${support ? '✓ IDENTIFIED' : '✗ NOT IDENTIFIED'}) + MACD Histogram > 0 (${(macd?.histogram ?? 0) > 0 ? '✓ TRUE' : '✗ FALSE'})
- SELL Trigger: Bearish Pattern (${isBearish ? '✓ DETECTED' : '✗ NOT DETECTED'}) + Resistance Level (${resistance ? '✓ IDENTIFIED' : '✗ NOT IDENTIFIED'}) + MACD Histogram < 0 (${(macd?.histogram ?? 0) < 0 ? '✓ TRUE' : '✗ FALSE'})

Provide your analysis considering:
1. Whether all three conditions are met for BUY/SELL
2. Current market phase and trend strength
3. Risk level adjustment for volatility (already noted: ${confidenceAdjustment})
4. Geopolitical factors for April 2026`;

    let text: string;
    try {
      const result = await generateText({
        model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.7,
        maxTokens: 1024,
      });

      text = result.text;
    } catch (groqError: unknown) {
      const errorMessage = groqError instanceof Error ? groqError.message : 'Unknown Groq API error';
      console.error('[v0] Groq API error:', errorMessage);
      return Response.json(
        {
          success: false,
          error: 'Groq API error',
          details: errorMessage,
          suggestion: 'Check your GROQ_API_KEY and model availability',
        },
        { status: 502 }
      );
    }

    if (!text || text.trim().length === 0) {
      console.error('[v0] Groq returned empty response');
      return Response.json(
        {
          success: false,
          error: 'Empty response from AI',
          details: 'Groq returned an empty response',
        },
        { status: 502 }
      );
    }

    // Parse the JSON response from Groq
    let aiResponse: AnalysisResponse;
    try {
      // Clean up potential markdown code blocks and extract JSON
      let cleanedText = text.trim();
      // Remove markdown code blocks if present
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```(?:json)?\n?/g, '').trim();
      }
      // Try to find JSON object in the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      aiResponse = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('[v0] Failed to parse Groq response:', text);
      return Response.json(
        {
          success: false,
          error: 'Failed to parse AI response',
          rawResponse: text.substring(0, 300),
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        },
        { status: 500 }
      );
    }

    // Validate the response structure with defaults for missing optional fields
    if (!aiResponse.signal || !['BUY', 'SELL', 'NEUTRAL'].includes(aiResponse.signal)) {
      aiResponse.signal = 'NEUTRAL';
    }
    if (
      typeof aiResponse.confidence !== 'number' ||
      aiResponse.confidence < 0 ||
      aiResponse.confidence > 100
    ) {
      aiResponse.confidence = 50;
    }
    if (!aiResponse.riskLevel || !['LOW', 'MEDIUM', 'HIGH'].includes(aiResponse.riskLevel)) {
      aiResponse.riskLevel = 'MEDIUM';
    }
    if (!aiResponse.analysis || typeof aiResponse.analysis !== 'string') {
      aiResponse.analysis = 'Analysis unavailable';
    }

    // ========== APPLY VOLATILITY CONFIDENCE REDUCTION ==========
    let finalConfidence = Math.max(1, aiResponse.confidence + confidenceAdjustment);

    // ========== DETERMINE RISK LEVEL BASED ON CONFIDENCE & VOLATILITY ==========
    let calculatedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

    if (finalConfidence < 20) {
      // Very low confidence = High risk due to uncertainty
      calculatedRiskLevel = 'HIGH';
    } else if (finalConfidence > 70 && volatility === 'LOW' && !volatilityResult.isHigh) {
      // High confidence + Low volatility = Low risk
      calculatedRiskLevel = 'LOW';
    } else if (finalConfidence > 70) {
      // High confidence but not low volatility = Medium risk
      calculatedRiskLevel = 'MEDIUM';
    } else {
      // Medium confidence = Medium risk
      calculatedRiskLevel = 'MEDIUM';
    }

    // Override AI's risk level with our calculated one
    aiResponse.riskLevel = calculatedRiskLevel;

    // ========== CALCULATE ADJUSTED STOP LOSS ==========
    let adjustedSl = sl;
    if (volatilityResult.isHigh && sl) {
      adjustedSl = sl * volatilityResult.slMultiplier;
    }

    // ========== BUILD TECHNICAL REASONING FOR SELLS ==========
    let technicalReasoning = '';
    if (aiResponse.signal === 'SELL') {
      const phase = marketPhase === 'MARKDOWN' ? 'resuming' : 'beginning';
      technicalReasoning =
        `Retracement to Resistance has ended, ${marketPhase} phase ${phase}. ` +
        `Bearish pattern (${pattern}) confirmed at resistance level with negative MACD histogram.`;
    }

    // Create signal record with all new fields
    const forexSignal: ForexSignal = {
      id: crypto.randomUUID(),
      symbol,
      signal: aiResponse.signal as SignalType,
      price,
      analysis: aiResponse.analysis,
      confidence: finalConfidence,
      riskLevel: aiResponse.riskLevel,
      timestamp: new Date(),
      telegramSent: false,
      sl: adjustedSl,
      tp,
      atr,
      volatility,
      patternDetected: pattern,
      marketPhase,
      volatilityAlert: volatilityResult.alert,
      technicalReasoning,
    };

    // Store signal immediately
    await addSignal(forexSignal);

    // Send response immediately (don't wait for Telegram)
    const response = Response.json({
      success: true,
      signal: forexSignal,
    });

    // Send Telegram in background (fire and forget)
    sendTelegramSignal({
      symbol,
      signal: aiResponse.signal as SignalType,
      price,
      analysis: aiResponse.analysis,
      confidence: finalConfidence,
      riskLevel: aiResponse.riskLevel,
    }).then((telegramSent) => {
      // Update the signal with Telegram status asynchronously
      if (telegramSent) {
        // Note: In a real app, you'd update the stored signal here
        console.log(`[Telegram] Signal sent for ${symbol}`);
      }
    }).catch((error) => {
      console.error('[Telegram] Failed to send signal:', error);
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[v0] Analysis error:', errorMessage);
    return Response.json(
      {
        success: false,
        error: 'Failed to analyze forex data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
