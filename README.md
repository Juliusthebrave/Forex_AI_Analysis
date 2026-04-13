# Forex AI Analyst - Consensus-Based Strategy

A high-speed Forex analysis API that uses a Consensus-Based Strategy across multiple technical indicators. Designed for MT5 integration with instant responses and professional Telegram notifications.

## Features

- **Instant Response**: Returns `{ status: 'analyzing' }` immediately to MT5
- **Background Processing**: AI analysis runs asynchronously for speed
- **Consensus Analysis**: 6-indicator confluence scoring (EMA, MACD, Patterns, Bollinger Bands, RSI, Volume)
- **High Confidence Signals**: Only signals when 4+ indicators agree
- **Professional Telegram**: Formatted signals with confluence scores and detailed reasoning
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
  "bollingerBands": {
    "upper": 1.08600,
    "middle": 1.08400,
    "lower": 1.08200
  },
  "rsi": {
    "rsi7": 65.5,
    "rsi14": 58.2
  },
  "volume": 1250,
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

Professional signals sent to Telegram include:
- 🔴/🟢 Signal indicators
- **Confluence Score** (e.g., 67% - 4 BUY / 2 SELL indicators)
- **Market Phase** in bold
- Clear **Analysis** and **Reasoning** sections
- Volatility alerts when applicable
- Only high-confidence signals when 4+ indicators agree

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
  -d '{"symbol":"EURUSD","price":1.08450,"ema8":1.08420,"ema20":1.08380,"ema50":1.08250}'
```

## Deployment

Deploy to Vercel for production:

```bash
vercel --prod
```

## Architecture

- **Consensus Analysis**: 6-indicator confluence scoring system
- **Pattern Detection**: Implements Homma candlestick patterns (Hammer, Engulfing, etc.)
- **Market Phase**: Dow Theory-based phase identification
- **AI Enhancement**: Groq Llama 3.1 8B for comprehensive analysis
- **Async Processing**: Non-blocking API responses for MT5 compatibility
