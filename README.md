# Forex AI Analyst - Consensus-Based Strategy

A high-speed Forex analysis API that uses a Consensus-Based Strategy across multiple technical indicators. Designed for MT5 integration with instant responses and professional Telegram notifications.

## Features

- **Instant Response**: Returns `{ status: 'analyzing' }` immediately to MT5
- **Headless Bot**: No frontend dashboard, MT5 -> AI -> Telegram only
- **Background Processing**: AI analysis runs asynchronously for speed
- **Consensus Analysis**: 6-indicator confluence scoring (EMA, MACD, Patterns, Bollinger Bands, RSI, Volume)
- **High Confidence Signals**: Only signals when 4+ indicators agree, with volume-based caution
- **RSI Divergence Detection**: Identifies oversold/overbought conditions for better entry timing
- **Bollinger Band Breakouts**: Detects momentum shifts and volatility expansions
- **Simplified Telegram Output**: Clean, actionable signals with automatic TP/SL levels
- **Market Phase Detection**: Identifies Accumulation, Markup, Distribution, Markdown phases
- **Volatility Alerts**: Warns of high-risk market conditions

## API Endpoint

### POST `/api/analyze`

Receives MT5 data and processes it asynchronously.

**Request Body:**
```json
{
  "symbol": "EURUSD",
  "price": 1.08450,
  "ema8": 1.08420,
  "ema20": 1.08380,
  "ema50": 1.08250,
  "macd": {
    "line": 0.00015,
    "signal": 0.00012,
    "histogram": 0.00003
  },
  "upperBB": 1.08600,
  "lowerBB": 1.08200,
  "rsi": 65.5,
  "vol": 1250,
  "history": [
    {"open": 1.08400, "high": 1.08500, "low": 1.08350, "close": 1.08450, "volume": 1200}
  ],
  "atr": 0.00120,
  "averageAtr": 0.00100,
  "accountBalance": 27
}
```

**Response:**
```json
{
  "status": "analyzing"
}
```

## Environment Variables

```env
GROQ_API_KEY=your_groq_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

## Telegram Message Format

**BUY/SELL Signals:**
```
🟢 BUY EURUSD

🎯 Entry: 1.08450
🛑 Stop Loss: 1.08250
💰 Take Profit: 1.08850

📊 RSI Oversold + Hammer
```

**NEUTRAL Signals:**
```
⚪ EURUSD: NEUTRAL (Waiting for Confluence)
```

Simplified, actionable signals with automatic TP/SL calculation based on ATR and risk level.

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set environment variables in `.env.local`

3. Run development server:
```bash
pnpm dev
```

4. Test the API:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"EURUSD","price":1.08450,"ema8":1.08420,"ema20":1.08380,"ema50":1.08250,"upperBB":1.08600,"lowerBB":1.08200,"rsi":65.5,"vol":1250}'
```

## Deployment

Deploy to Vercel for production:

```bash
vercel --prod
```

## Architecture

- **Consensus Analysis**: 6-indicator confluence scoring system with volume-based confidence adjustment
- **RSI Divergence Detection**: Identifies oversold (<30) and overbought (>70) conditions
- **Bollinger Band Analysis**: Detects breakouts and squeezes for momentum signals
- **Pattern Detection**: Implements Homma candlestick patterns (Hammer, Engulfing, etc.)
- **Market Phase**: Dow Theory-based phase identification
- **AI Enhancement**: Groq Llama 3.1 8B for comprehensive analysis with contextual awareness
- **Async Processing**: Non-blocking API responses for MT5 compatibility
