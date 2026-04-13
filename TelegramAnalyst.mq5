//+------------------------------------------------------------------+
//|                          AutoTradingSniper.mq5 - Full Auto Trading |
//|                        Copyright 2024, MetaQuotes Software Corp. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, MetaQuotes Software Corp."
#property link      "https://www.mql5.com"
#property version   "2.00 - Auto Trading"

//--- Input parameters
input int MAGIC_NUMBER = 123456;              // Magic number for orders
input double RISK_PERCENT = 1.0;              // Risk per trade (%)
input double MAX_DAILY_LOSS_PERCENT = 5.0;    // Max daily loss (%)
input int MAX_OPEN_POSITIONS = 1;             // Max concurrent trades
input double STOP_MULTIPLIER = 1.5;           // ATR multiplier for SL
input double TP_MULTIPLIER = 3.0;             // ATR multiplier for TP (3:1 ratio)
input bool USE_TRAILING_STOP = true;          // Enable trailing stops
input double TRAILING_STOP_ATR = 2.0;         // Trailing stop ATR multiplier
input bool LOG_TRADES = true;                 // Log trades to file

//--- Global variables
int rsi_handle;
int bb_handle;
int ema8_handle;
int ema20_handle;
int ema50_handle;
int macd_handle;

//--- Account tracking
double daily_started_balance = 0;
int trades_opened_today = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- Create technical indicators
   rsi_handle = iRSI(_Symbol, PERIOD_CURRENT, 14, PRICE_CLOSE);
   bb_handle = iBands(_Symbol, PERIOD_CURRENT, 20, 0, 2, PRICE_CLOSE);
   ema8_handle = iMA(_Symbol, PERIOD_CURRENT, 8, 0, MODE_EMA, PRICE_CLOSE);
   ema20_handle = iMA(_Symbol, PERIOD_CURRENT, 20, 0, MODE_EMA, PRICE_CLOSE);
   ema50_handle = iMA(_Symbol, PERIOD_CURRENT, 50, 0, MODE_EMA, PRICE_CLOSE);
   macd_handle = iMACD(_Symbol, PERIOD_CURRENT, 12, 26, 9, PRICE_CLOSE);

   if(rsi_handle == INVALID_HANDLE || bb_handle == INVALID_HANDLE ||
      ema8_handle == INVALID_HANDLE || ema20_handle == INVALID_HANDLE ||
      ema50_handle == INVALID_HANDLE || macd_handle == INVALID_HANDLE)
   {
      Print("Error creating indicators");
      return(INIT_FAILED);
   }

   //--- Initialize daily balance tracking
   daily_started_balance = AccountInfoDouble(ACCOUNT_BALANCE);
   trades_opened_today = 0;

   Print("=== AUTO TRADING SNIPER BOT INITIALIZED ===");
   Print("Magic Number: ", MAGIC_NUMBER);
   Print("Risk Per Trade: ", RISK_PERCENT, "%");
   Print("Max Daily Loss: ", MAX_DAILY_LOSS_PERCENT, "%");
   Print("Max Open Positions: ", MAX_OPEN_POSITIONS);
   Print("Starting Balance: $", DoubleToString(daily_started_balance, 2));
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   //--- Release indicator handles
   IndicatorRelease(rsi_handle);
   IndicatorRelease(bb_handle);
   IndicatorRelease(ema8_handle);
   IndicatorRelease(ema20_handle);
   IndicatorRelease(ema50_handle);
   IndicatorRelease(macd_handle);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   //--- Get current price and indicators
   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double rsi[1], upperBB[1], lowerBB[1], ema8[1], ema20[1], ema50[1];
   double macd_main[1], macd_signal[1], macd_histogram[1];
   double macd_histogram_prev[1];

   //--- Copy indicator values
   if(CopyBuffer(rsi_handle, 0, 0, 1, rsi) != 1) return;
   if(CopyBuffer(bb_handle, 1, 0, 1, upperBB) != 1) return; // Upper band
   if(CopyBuffer(bb_handle, 2, 0, 1, lowerBB) != 1) return; // Lower band
   if(CopyBuffer(ema8_handle, 0, 0, 1, ema8) != 1) return;
   if(CopyBuffer(ema20_handle, 0, 0, 1, ema20) != 1) return;
   if(CopyBuffer(ema50_handle, 0, 0, 1, ema50) != 1) return;
   if(CopyBuffer(macd_handle, 2, 0, 1, macd_histogram) != 1) return; // Histogram
   if(CopyBuffer(macd_handle, 2, 1, 1, macd_histogram_prev) != 1) return; // Previous histogram

   //--- Get previous EMA values for crossover detection
   double ema8_prev[1], ema20_prev[1];
   if(CopyBuffer(ema8_handle, 0, 1, 1, ema8_prev) != 1) return;
   if(CopyBuffer(ema20_handle, 0, 1, 1, ema20_prev) != 1) return;

   //--- SNIPER BOT WITH TREND DETECTION ---
   bool triggerSignal = false;
   string triggerReason = "";

   // 1. RSI Extreme: RSI < 35 (Buy Zone) or RSI > 65 (Sell Zone)
   if(rsi[0] < 35.0 || rsi[0] > 65.0)
   {
      triggerSignal = true;
      triggerReason = "RSI Extreme";
   }

   // 2. BB Breakout: Price above Upper Band or below Lower Band
   if(price > upperBB[0] || price < lowerBB[0])
   {
      triggerSignal = true;
      triggerReason = triggerReason == "" ? "BB Breakout" : triggerReason + " + BB Breakout";
   }

   // 3. EMA Cross: 8 EMA crossed 20 EMA
   bool ema8_was_above = ema8_prev[0] > ema20_prev[0];
   bool ema8_is_above = ema8[0] > ema20[0];

   if(ema8_was_above != ema8_is_above)
   {
      triggerSignal = true;
      triggerReason = triggerReason == "" ? "EMA Cross" : triggerReason + " + EMA Cross";
   }

   // 4. TREND TRIGGER: EMA Alignment (8 > 20 > 50 for Buy, 8 < 20 < 50 for Sell)
   bool bullish_alignment = (ema8[0] > ema20[0]) && (ema20[0] > ema50[0]);
   bool bearish_alignment = (ema8[0] < ema20[0]) && (ema20[0] < ema50[0]);

   if(bullish_alignment || bearish_alignment)
   {
      triggerSignal = true;
      string trend_type = bullish_alignment ? "Bullish" : "Bearish";
      triggerReason = triggerReason == "" ? "Trend " + trend_type : triggerReason + " + Trend " + trend_type;
   }

   // 5. MACD ZERO-LINE CROSSOVER
   bool macd_was_positive = macd_histogram_prev[0] > 0;
   bool macd_is_positive = macd_histogram[0] > 0;
   bool macd_was_negative = macd_histogram_prev[0] < 0;
   bool macd_is_negative = macd_histogram[0] < 0;

   // Bullish cross: MACD goes from negative to positive
   if(macd_was_negative && macd_is_positive)
   {
      triggerSignal = true;
      triggerReason = triggerReason == "" ? "MACD Bullish Cross" : triggerReason + " + MACD Bullish Cross";
   }

   // Bearish cross: MACD goes from positive to negative
   if(macd_was_positive && macd_is_negative)
   {
      triggerSignal = true;
      triggerReason = triggerReason == "" ? "MACD Bearish Cross" : triggerReason + " + MACD Bearish Cross";
   }

   //--- SILENT MODE: If no triggers, just log and exit
   if(!triggerSignal)
   {
      Print("Market Quiet - No Signal");
      
      // Monitor existing positions for trailing stops
      if(USE_TRAILING_STOP)
         UpdateTrailingStops();
      
      return;
   }

   //--- RISK MANAGEMENT CHECKS ---
   
   // Check daily loss limit
   double current_balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double daily_loss = daily_started_balance - current_balance;
   double max_daily_loss = daily_started_balance * (MAX_DAILY_LOSS_PERCENT / 100.0);
   
   if(daily_loss > max_daily_loss)
   {
      Print("⛔ DAILY LOSS LIMIT EXCEEDED ($", DoubleToString(daily_loss, 2), "). No more trades today.");
      return;
   }
   
   // Check max open positions
   int open_positions = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      if(PositionSelect(i) && PositionGetInteger(POSITION_MAGIC) == MAGIC_NUMBER)
         open_positions++;
   }
   
   if(open_positions >= MAX_OPEN_POSITIONS)
   {
      Print("⛔ MAX OPEN POSITIONS (", MAX_OPEN_POSITIONS, ") REACHED. Waiting for exit.");
      return;
   }

   //--- TRIGGER DETECTED: Execute Trade ---
   double atr = iATR(_Symbol, PERIOD_CURRENT, 14);
   
   // Determine direction
   bool is_buy = (rsi[0] < 35.0) || (bullish_alignment) || (macd_was_negative && macd_is_positive);
   
   Print("🎯 SNIPER TRIGGER: ", triggerReason);
   PlaceAutoTrade(is_buy, price, atr, triggerReason);
   
   // Update trailing stops on existing positions
   if(USE_TRAILING_STOP)
      UpdateTrailingStops();
}

//+------------------------------------------------------------------+
//| Auto Trade Execution - Places order with SL/TP automatically     |
//+------------------------------------------------------------------+
void PlaceAutoTrade(bool is_buy, double entry_price, double atr, string trigger_reason)
{
   //--- Calculate position size based on risk
   double account_balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double risk_amount = account_balance * (RISK_PERCENT / 100.0);
   double stop_distance = atr * STOP_MULTIPLIER;
   double lot_size = risk_amount / (stop_distance * SymbolInfoDouble(_Symbol, SYMBOL_POINT));
   
   //--- Normalize lot size to broker constraints
   double min_lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double max_lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   lot_size = MathMax(min_lot, MathMin(max_lot, lot_size));

   //--- Calculate SL/TP levels
   double stop_loss, take_profit;
   
   if(is_buy)
   {
      stop_loss = entry_price - stop_distance;
      take_profit = entry_price + (atr * TP_MULTIPLIER);
   }
   else
   {
      stop_loss = entry_price + stop_distance;
      take_profit = entry_price - (atr * TP_MULTIPLIER);
   }

   //--- Prepare order
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = _Symbol;
   request.volume = lot_size;
   request.type = is_buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   request.price = is_buy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   request.sl = stop_loss;
   request.tp = take_profit;
   request.deviation = 20;  // Max slippage
   request.magic = MAGIC_NUMBER;
   request.comment = trigger_reason;

   //--- Send order
   if(OrderSend(request, result))
   {
      Print("✅ AUTO TRADE EXECUTED!");
      Print("Type: ", is_buy ? "BUY" : "SELL");
      Print("Entry: ", DoubleToString(entry_price, _Digits));
      Print("SL: ", DoubleToString(stop_loss, _Digits));
      Print("TP: ", DoubleToString(take_profit, _Digits));
      Print("Volume: ", DoubleToString(lot_size, 2));
      Print("Ticket: ", result.order);
      
      //--- Log the trade
      if(LOG_TRADES)
         LogTrade(result.order, is_buy, entry_price, stop_loss, take_profit, lot_size, trigger_reason);
      
      trades_opened_today++;
   }
   else
   {
      Print("❌ Order Failed!");
      Print("Error Code: ", result.retcode);
      Print("Error Description: ", result.comment);
   }
}

//+------------------------------------------------------------------+
//| Update Trailing Stops - Move SL closer if trade is profitable    |
//+------------------------------------------------------------------+
void UpdateTrailingStops()
{
   for(int i = 0; i < PositionsTotal(); i++)
   {
      if(!PositionSelect(i))
         continue;
      
      if(PositionGetInteger(POSITION_MAGIC) != MAGIC_NUMBER)
         continue;
      
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;

      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      double current_sl = PositionGetDouble(POSITION_SL);
      double current = SymbolInfoDouble(_Symbol, PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? SYMBOL_BID : SYMBOL_ASK);
      double atr = iATR(_Symbol, PERIOD_CURRENT, 14);
      double trailing_distance = atr * TRAILING_STOP_ATR;

      MqlTradeRequest request = {};
      MqlTradeResult result = {};
      
      bool should_modify = false;

      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
      {
         // For BUY: If price moved up, trail the stop
         if(current > entry + trailing_distance)
         {
            double new_sl = current - trailing_distance;
            if(new_sl > current_sl)
            {
               request.sl = new_sl;
               should_modify = true;
            }
         }
      }
      else
      {
         // For SELL: If price moved down, trail the stop
         if(current < entry - trailing_distance)
         {
            double new_sl = current + trailing_distance;
            if(new_sl < current_sl || current_sl == 0)
            {
               request.sl = new_sl;
               should_modify = true;
            }
         }
      }

      if(should_modify)
      {
         request.action = TRADE_ACTION_SLTP;
         request.position = PositionGetInteger(POSITION_TICKET);
         request.tp = PositionGetDouble(POSITION_TP);
         
         if(OrderSend(request, result))
         {
            Print("📊 Trailing Stop Updated - Ticket: ", result.order);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Log Trade - Save trade data to file for analysis                 |
//+------------------------------------------------------------------+
void LogTrade(ulong ticket, bool is_buy, double entry, double sl, double tp, double volume, string reason)
{
   string filename = "AutoTrading_" + _Symbol + ".csv";
   
   int file_handle = FileOpen(filename, FILE_READ | FILE_WRITE | FILE_CSV, ",");
   if(file_handle == INVALID_HANDLE)
      return;

   FileSeek(file_handle, 0, SEEK_END);  // Go to end of file
   
   //--- Write trade data
   string line = TimeToString(TimeCurrent(), TIME_DATE | TIME_MINUTES) + ",";
   line += (is_buy ? "BUY" : "SELL") + ",";
   line += DoubleToString(entry, _Digits) + ",";
   line += DoubleToString(sl, _Digits) + ",";
   line += DoubleToString(tp, _Digits) + ",";
   line += DoubleToString(volume, 2) + ",";
   line += reason;
   
   FileWriteString(file_handle, line + "\n");
   FileClose(file_handle);
}
//+------------------------------------------------------------------+