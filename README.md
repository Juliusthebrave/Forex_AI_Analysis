# Forex AI Analyst - Sniper Bot

A high-speed Forex analysis API that uses a Consensus-Based Strategy across multiple technical indicators. Designed for MT5 integration with instant responses and professional Telegram notifications. Now operates as a **Sniper Bot** that only triggers on high-probability setups.

## Features

- **Instant Response**: Returns `{ status: 'analyzing' }` immediately to MT5
- **Headless Bot**: No frontend dashboard, MT5 -> AI -> Telegram only
- **Sniper Mode**: Only triggers on extreme RSI, BB breakouts, or EMA crosses
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

Receives MT5 data and processes it asynchronously. **Sniper Bot Mode**: Only sends Telegram notifications for BUY/SELL signals. NEUTRAL signals are logged but don't trigger notifications.

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

## Sniper Bot Triggers

The bot only activates when **any** of these high-probability conditions are met:

### 1. RSI Extreme Zones
- **Buy Zone**: RSI < 35 (Oversold)
- **Sell Zone**: RSI > 65 (Overbought)

### 2. Bollinger Band Breakouts
- **Bullish**: Price breaks above Upper Bollinger Band
- **Bearish**: Price breaks below Lower Bollinger Band

### 3. EMA Crossover
- **Golden Cross**: 8 EMA crosses above 20 EMA
- **Death Cross**: 8 EMA crosses below 20 EMA

### 4. Trend Alignment (NEW)
- **Bullish Trend**: EMA 8 > EMA 20 > EMA 50 (smooth uptrend)
- **Bearish Trend**: EMA 8 < EMA 20 < EMA 50 (smooth downtrend)

### 5. MACD Zero-Line Crossover (NEW)
- **Bullish Cross**: MACD Histogram crosses from negative to positive
- **Bearish Cross**: MACD Histogram crosses from positive to negative

### Silent Mode
When none of these conditions are met, MT5 prints: `Market Quiet - No Signal` and doesn't send data to the API.

## MT5 Setup

1. Copy `TelegramAnalyst.mq5` to your MT5 `Experts` folder
2. Update the `API_URL` input parameter with your Vercel deployment URL
3. Enable automated trading and WebRequest access for your domain
4. Attach the EA to any chart (EURUSD recommended for testing)

### MT5 WebRequest URLs
Add these URLs to MT5's allowed WebRequest list:
- `https://your-vercel-app.vercel.app`
- `https://api.telegram.org`

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

## AI Trend Logic

When the sniper triggers on **Trend Alignment** or **MACD Crossover**:

- The AI recognizes trends as high-conviction setups
- **Strong Bullish Trend** (EMA 8 > 20 > 50) → AI sends **🟢 BUY** even if RSI is neutral (~50)
- **Strong Bearish Trend** (EMA 8 < 20 < 50) → AI sends **🔴 SELL** even if RSI is neutral (~50)
- **MACD Zero-Line Cross** confirms momentum shift → High confidence signal

This captures smooth trend moves that don't reach extreme RSI levels, eliminating missed opportunities.

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
