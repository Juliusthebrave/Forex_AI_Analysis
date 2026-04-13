# Forex AI Analyst - Auto-Trading Sniper Bot (v2.0)

A high-speed **fully automated** Forex trading EA that executes trades directly on MT5 without manual intervention. Evolved from the signal-based bot to a complete auto-trading robot with risk management and position tracking.

## What Changed from v1.0 (Signal-Based)

| Feature | v1.0 Signal Bot | v2.0 Auto-Trading Bot |
|---------|-----|-----|
| Signal Output | Telegram Notification | Auto Order Execution |
| Entry | Manual by trader | Automatic |
| SL/TP | Manual placement | Automatic calculation |
| Position Management | Manual | Automatic (trailing stops) |
| Risk Management | None | Full (daily loss limits, position sizing) |
| Latency | 5-10 seconds | <100ms |
| Best For | H1/H4 Swings | H1/H4 Swings + M15 Scalping |
| Demo Testing | Recommended | **MANDATORY** |

## Auto-Trading Features

## Auto-Trading Features

- **Automatic Order Execution**: <100ms order placement with no manual clicking
- **Position Sizing**: Dynamic lot calculation based on account risk (1-2% per trade)
- **SL/TP Automation**: Automatic stop-loss and take-profit levels using ATR
- **Trailing Stops**: Optional profit-locking as trades move in your favor
- **Risk Management**: Daily loss limits prevent overexposure after bad trades
- **Max Open Positions**: Limits concurrent trades to prevent over-leverage
- **Trade Logging**: All trades logged to CSV for analysis and optimization
- **Signal Detection**: Same sniper pre-filters (RSI, BB, EMA, MACD, Trends)
- **Real-Time Monitoring**: Continuous position tracking and trailing stop updates
- **Zero Telegram Dependency**: Fully autonomous, no notifications required

## Input Parameters (Customize for Your Account)

```mql5
Risk per Trade:        1.0%    // Risk 1% of account per trade
Max Daily Loss:        5.0%    // Stop trading if down 5% per day
Max Open Positions:    1       // Only 1 trade at a time (disable stacking)
Stop Multiplier:       1.5     // SL distance = 1.5 × ATR
TP Multiplier:         3.0     // TP distance = 3 × ATR (3:1 ratio)
Use Trailing Stop:     true    // Enable trailing stops
Trailing Stop ATR:     2.0     // Trail SL at 2 × ATR
Log Trades:            true    // Save trade data to CSV
```

## Sniper Triggers

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

## MT5 Setup (Auto-Trading)

### Step 1: Installation
1. Copy `TelegramAnalyst.mq5` to: `C:\Users\<YourName>\AppData\Roaming\MetaQuotes\Terminal64\MQL5\Experts`
2. Restart MT5 or right-click Experts folder → Refresh

### Step 2: Configuration
1. Open MT5 Strategy Tester (Ctrl+R)
2. Set **Magic Number** to unique value (prevents conflicts with other EAs)
3. Set **Risk Percent** to 1-2% based on your account size
4. Set **Max Daily Loss** to 5-10% (stops bot after X% loss)
5. Set **Max Open Positions** to 1 (if you want only 1 trade at a time)

### Step 3: Testing (ESSENTIAL - 2+ Weeks Demo)
1. Attach EA to H1 chart on demo account
2. **Leave it running for 2-4 weeks** with demo money
3. Monitor:
   - Win rate (target: 55%+)
   - Sharpe ratio (target: 1.0+)
   - Max drawdown (expect: 15-25%)
   - Daily loss limit hits (should be rare)

### Step 4: Live Trading (Only After Demo Success)
1. Move to live account with **1/10th normal lot size** initially
2. Attach to H1 chart
3. Monitor for 1 week to ensure reliable execution
4. Scale up lot size gradually if profitable

### CRITICAL: Enable Automated Trading
- **Tools → Options → Expert Advisors → Allow Automated Trading**
- **Tools → Options → Expert Advisors → Allow DLL Imports** (if needed)
- Run EA on **always-on VPS** for 24/5 consistent trading

## Trade Logging

Auto-trading bot logs all trades to: `MQL5\Files\AutoTrading_EURUSD.csv`

Format:
```
Time, Direction, Entry, SL, TP, Volume, Trigger Reason
2024-04-13 14:30, BUY, 1.08450, 1.08250, 1.08850, 0.01, RSI Extreme
```

Use this data to:
- Identify best trading conditions
- Optimize parameters
- Calculate statistics (win rate, profit factor, Sharpe ratio)

## AI Trend Logic

When the sniper triggers on **Trend Alignment** or **MACD Crossover**:

- The AI recognizes trends as high-conviction setups
- **Strong Bullish Trend** (EMA 8 > 20 > 50) → AI sends **🟢 BUY** even if RSI is neutral (~50)
- **Strong Bearish Trend** (EMA 8 < 20 < 50) → AI sends **🔴 SELL** even if RSI is neutral (~50)
- **MACD Zero-Line Cross** confirms momentum shift → High confidence signal

This captures smooth trend moves that don't reach extreme RSI levels, eliminating missed opportunities.

## ⚠️ CRITICAL WARNINGS - Read Before Live Trading

### Risk Disclosure
- **You can lose money.** Auto-trading bots can lose your entire account if misconfigured.
- **Past performance is not guaranteed.** Backtest results don't equal live results.
- **Market conditions change.** Strategies that worked last year may fail today.
- **Slippage and spreads** will reduce profitability in live trading vs backtests.

### Before Going Live
1. **Test on DEMO for 2+ weeks minimum.** No exceptions.
2. **Start with 1/10th normal position size** on live account.
3. **Run overnight/weekends on VPS only.** Manual supervision required.
4. **Never risk more than 1-2%** of your account per trade.
5. **Set daily loss limits** and stick to them.
6. **Monitor the bot 24/5** for first 2 weeks on live.

### Common Failure Modes
- Going live without demo testing → Blown account
- Ignoring drawdowns (15-25% underwater is normal) → Panic disabling bot mid-drawdown
- Over-leveraging position size → Liquidation on bad streak
- Not using risk limits → Single bad day wipes out account
- Tweaking parameters too frequently → Curve fitting to past data

### Success Requirements
- **Discipline**: Stick to the rules, don't interfere
- **Patience**: Wait for setups, don't force trades
- **Consistency**: Run same settings for 2+ months before changes
- **Monitoring**: Check daily but don't over-manage
- **Capital Management**: Risk only 1-2% per trade

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
