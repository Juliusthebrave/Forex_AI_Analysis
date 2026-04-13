import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { sendTelegramSignal } from '@/lib/telegram';
import type { ForexSignalRequest, SignalType } from '@/lib/types';
import {
  detectPattern,
  determineMarketPhase,
  calculateVolatilityAlert,
  identifyLevels,
  validateTradeConditions,
  performConsensusAnalysis
} from '@/lib/pattern-detection';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Enhanced system prompt for Consensus-Based Strategy
const SYSTEM_PROMPT = `You are an expert Forex analyst using a Consensus-Based Strategy across multiple technical indicators.

Analyze the market data and provide a comprehensive signal based on indicator confluence.

Respond with ONLY valid JSON (no markdown):
{
  "signal": "BUY"|"SELL"|"NEUTRAL",
  "confidence": 0-100,
  "riskLevel": "LOW"|"MEDIUM"|"HIGH",
  "marketPhase": "ACCUMULATION"|"MARKUP"|"DISTRIBUTION"|"MARKDOWN",
  "analysis": "Brief 2-3 sentence analysis based on consensus indicators",
  "reasoning": "Detailed technical reasoning including confluence score and indicator agreements"
}`;

interface AnalysisResponse {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  marketPhase: string;
  analysis: string;
  reasoning: string;
}

export async function POST(req: Request) {
  console.log('[API] POST /api/analyze - START');

  try {
    // ========== STEP 1: PARSE REQUEST ==========
    const receivedData = await req.json();
    console.log('[API] Received data:', {
      symbol: receivedData.symbol,
      price: receivedData.price,
      ema8: receivedData.ema8,
      hasMACD: !!receivedData.macd,
      hasHistory: !!receivedData.history,
    });

    const {
      symbol,
      price,
      ema8,
      ema20,
      ema50,
      macd,
      bollingerBands,
      rsi,
      volume,
      accountBalance = 27,
      history = [],
      atr,
      averageAtr
    } = receivedData;

    // ========== STEP 2: VALIDATE ==========
    if (!symbol || typeof price !== 'number') {
      console.warn('[API] Missing required: symbol or price');
      return Response.json({ status: 'analyzing' });
    }

    // ========== STEP 3: INSTANT RESPONSE TO MT5 ==========
    // Return immediately to MT5 so it doesn't wait
    const instantResponse = Response.json({ status: 'analyzing' });

    // ========== STEP 4: BACKGROUND PROCESSING ==========
    // Process AI analysis and Telegram in background
    processAnalysisInBackground({
      symbol,
      price,
      ema8,
      ema20,
      ema50,
      macd,
      bollingerBands,
      rsi,
      volume,
      accountBalance,
      history,
      atr,
      averageAtr
    });

    console.log('[API] POST /api/analyze - INSTANT RESPONSE SENT');
    return instantResponse;

  } catch (outerError) {
    const errorMsg = outerError instanceof Error ? outerError.message : String(outerError);
    console.error('[API] ‼️ CRITICAL ERROR:', errorMsg);
    // Still return instant response even on error
    return Response.json({ status: 'analyzing' });
  }
}

// Background processing function
async function processAnalysisInBackground(data: {
  symbol: string;
  price: number;
  ema8: number;
  ema20: number;
  ema50: number;
  macd: any;
  bollingerBands?: any;
  rsi?: any;
  volume?: number;
  accountBalance: number;
  history: any[];
  atr?: number;
  averageAtr?: number;
}) {
  const { symbol, price, ema8, ema20, ema50, macd, bollingerBands, rsi, volume, accountBalance, history, atr, averageAtr } = data;

  try {
    console.log('[BACKGROUND] Starting Consensus-Based analysis...');

    // ========== CONSENSUS-BASED ANALYSIS ==========
    const pattern = detectPattern(history);
    const marketPhase = determineMarketPhase(price, ema8, ema20, ema50);
    const volatility = calculateVolatilityAlert(history, atr || 0, averageAtr || 0, price);
    const levels = identifyLevels(history);

    // Perform consensus analysis across all 6 indicators
    const consensus = performConsensusAnalysis({
      price,
      ema8,
      ema20,
      ema50,
      macdHistogram: macd?.histogram || 0,
      pattern,
      bollingerBands,
      rsi,
      volume,
      history
    });

    console.log('[BACKGROUND] Consensus result:', {
      agreeingDirection: consensus.agreeingDirection,
      confluenceScore: consensus.confluenceScore,
      highConfidence: consensus.highConfidence,
      buyIndicators: consensus.buyIndicators,
      sellIndicators: consensus.sellIndicators
    });

    // Determine signal based on consensus
    let signalDirection: 'BUY' | 'SELL' | 'NEUTRAL' = consensus.agreeingDirection;

    // Only give signal if high confidence (4+ indicators agree) OR if it's a strong pattern
    if (!consensus.highConfidence && signalDirection !== 'NEUTRAL') {
      // Check if we have a strong Dow-Homma pattern as backup
      if (pattern === 'HAMMER' || pattern === 'BULLISH_ENGULFING' || pattern === 'FALLING_STAR' || pattern === 'BEARISH_ENGULFING') {
        console.log('[BACKGROUND] Using strong pattern as backup signal');
      } else {
        signalDirection = 'NEUTRAL';
        console.log('[BACKGROUND] Low confidence - neutralizing signal');
      }
    }

    // Validate trade conditions with contextual analysis
    const tradeValid = validateTradeConditions({
      pattern,
      price,
      support: levels.support,
      resistance: levels.resistance,
      macdHistogram: macd?.histogram || 0,
      isBullish: signalDirection === 'BUY'
    });

    // Adjust signal based on validation
    if (!tradeValid && signalDirection !== 'NEUTRAL') {
      signalDirection = 'NEUTRAL';
    }

    // ========== AI ENHANCED ANALYSIS ==========
    console.log('[BACKGROUND] Calling Groq for enhanced analysis...');
    let aiResponse: AnalysisResponse = {
      signal: signalDirection,
      confidence: consensus.highConfidence ? Math.min(95, consensus.confluenceScore + 20) : Math.max(20, consensus.confluenceScore - 10),
      riskLevel: volatility.isHigh ? 'HIGH' : consensus.highConfidence ? 'LOW' : 'MEDIUM',
      marketPhase,
      analysis: 'Market analysis in progress',
      reasoning: 'Technical analysis based on consensus indicators'
    };

    try {
      const userPrompt = `Consensus-Based Analysis for ${symbol}:
Price: ${price}
EMAs: 8=${ema8}, 20=${ema20}, 50=${ema50}
MACD Histogram: ${macd?.histogram ?? 'N/A'}
Pattern: ${pattern}
Bollinger Bands: ${bollingerBands ? `Upper=${bollingerBands.upper}, Lower=${bollingerBands.lower}` : 'N/A'}
RSI: ${rsi ? `7=${rsi.rsi7}, 14=${rsi.rsi14}` : 'N/A'}
Volume: ${volume ?? 'N/A'}
Consensus: ${consensus.buyIndicators} BUY, ${consensus.sellIndicators} SELL indicators agree
Confluence Score: ${consensus.confluenceScore}%
High Confidence: ${consensus.highConfidence}
Market Phase: ${marketPhase}

Provide comprehensive analysis following consensus-based strategy principles.`;

      const result = await generateText({
        model: groq('llama3-8b-8192'),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.3,
      });

      console.log('[BACKGROUND] Groq response received');

      // Parse AI response
      let cleanedText = result.text.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```(?:json)?\n?/g, '').trim();
      }
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.signal && parsed.confidence !== undefined) {
          aiResponse = {
            signal: parsed.signal as SignalType,
            confidence: Math.min(100, Math.max(0, parsed.confidence)),
            riskLevel: parsed.riskLevel || aiResponse.riskLevel,
            marketPhase: parsed.marketPhase || marketPhase,
            analysis: (parsed.analysis || '').substring(0, 200),
            reasoning: (parsed.reasoning || '').substring(0, 300)
          };
        }
      }
    } catch (aiError) {
      console.warn('[BACKGROUND] AI failed, using consensus-based analysis:', aiError instanceof Error ? aiError.message : String(aiError));
    }

    // ========== SEND PROFESSIONAL TELEGRAM MESSAGE ==========
    console.log('[BACKGROUND] Sending Telegram signal...');
    await sendProfessionalTelegramSignal({
      symbol,
      signal: aiResponse.signal,
      price,
      analysis: aiResponse.analysis,
      reasoning: aiResponse.reasoning,
      confidence: aiResponse.confidence,
      riskLevel: aiResponse.riskLevel,
      marketPhase: aiResponse.marketPhase,
      pattern,
      volatilityAlert: volatility.alert,
      confluenceScore: consensus.confluenceScore,
      indicatorBreakdown: `${consensus.buyIndicators} BUY / ${consensus.sellIndicators} SELL indicators`
    });

    console.log('[BACKGROUND] Analysis complete and sent to Telegram');

  } catch (error) {
    console.error('[BACKGROUND] Error in background processing:', error);
    // Send error notification to Telegram
    try {
      await sendTelegramSignal({
        symbol: data.symbol,
        signal: 'NEUTRAL' as SignalType,
        price: data.price,
        analysis: `Error in analysis: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0,
        riskLevel: 'HIGH',
      });
    } catch (telegramError) {
      console.error('[BACKGROUND] Failed to send error notification:', telegramError);
    }
  }
}

// Professional Telegram message formatting
async function sendProfessionalTelegramSignal(message: {
  symbol: string;
  signal: SignalType;
  price: number;
  analysis: string;
  reasoning: string;
  confidence: number;
  riskLevel: string;
  marketPhase: string;
  pattern: string;
  volatilityAlert: string;
  confluenceScore: number;
  indicatorBreakdown: string;
}): Promise<void> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[TELEGRAM] Credentials not configured');
    return;
  }

  const signalEmoji = message.signal === 'BUY' ? '🟢' : message.signal === 'SELL' ? '🔴' : '⚪';
  const riskEmoji = message.riskLevel === 'LOW' ? '🟢' : message.riskLevel === 'MEDIUM' ? '🟡' : '🔴';

  const text = `
${signalEmoji} **FOREX AI SIGNAL** ${signalEmoji}

**📊 Pair:** ${message.symbol}
**🎯 Signal:** ${message.signal}
**💰 Price:** ${message.price.toFixed(5)}
**📈 Confidence:** ${message.confidence}%
**⚠️ Risk Level:** ${riskEmoji} ${message.riskLevel}

**🌊 Market Phase:** **${message.marketPhase}**
**🔍 Pattern:** ${message.pattern}
**📊 Confluence Score:** ${message.confluenceScore}% (${message.indicatorBreakdown})

**📝 Analysis:**
${message.analysis}

**🧠 Reasoning:**
${message.reasoning}

${message.volatilityAlert ? `**🚨 Alert:** ${message.volatilityAlert}\n` : ''}
_Generated: ${new Date().toISOString()}_
  `.trim();

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[TELEGRAM] API error:', error);
    } else {
      console.log('[TELEGRAM] ✓ Professional signal sent successfully');
    }
  } catch (error) {
    console.error('[TELEGRAM] Failed to send message:', error);
  }
}