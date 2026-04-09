import type { SignalType } from './types';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramMessage {
  symbol: string;
  signal: SignalType;
  price: number;
  analysis: string;
  confidence: number;
  riskLevel: string;
}

export async function sendTelegramSignal(message: TelegramMessage): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[v0] Telegram credentials not configured');
    return false;
  }

  const signalEmoji = message.signal === 'BUY' ? '🟢' : message.signal === 'SELL' ? '🔴' : '⚪';
  const riskEmoji = message.riskLevel === 'LOW' ? '🟢' : message.riskLevel === 'MEDIUM' ? '🟡' : '🔴';

  const text = `
${signalEmoji} *FOREX AI SIGNAL* ${signalEmoji}

*Pair:* ${message.symbol}
*Signal:* ${message.signal}
*Price:* ${message.price.toFixed(5)}
*Confidence:* ${message.confidence}%
*Risk Level:* ${riskEmoji} ${message.riskLevel}

*Analysis:*
${message.analysis}

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
      console.error('[v0] Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[v0] Failed to send Telegram message:', error);
    return false;
  }
}
