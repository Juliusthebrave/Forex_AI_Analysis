//+------------------------------------------------------------------+
//|                                                TelegramAnalyst.mq5 |
//|                        Copyright 2024, MetaQuotes Software Corp. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, MetaQuotes Software Corp."
#property link      "https://www.mql5.com"
#property version   "1.00"

//--- Input parameters
input string API_URL = "https://your-vercel-app.vercel.app/api/analyze"; // Your Vercel API URL
input int MAGIC_NUMBER = 123456; // Magic number for orders
input double LOT_SIZE = 0.01; // Lot size for orders

//--- Global variables
int rsi_handle;
int bb_handle;
int ema8_handle;
int ema20_handle;

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

   if(rsi_handle == INVALID_HANDLE || bb_handle == INVALID_HANDLE ||
      ema8_handle == INVALID_HANDLE || ema20_handle == INVALID_HANDLE)
   {
      Print("Error creating indicators");
      return(INIT_FAILED);
   }

   Print("TelegramAnalyst initialized successfully");
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
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   //--- Get current price and indicators
   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double rsi[1], upperBB[1], lowerBB[1], ema8[1], ema20[1];

   //--- Copy indicator values
   if(CopyBuffer(rsi_handle, 0, 0, 1, rsi) != 1) return;
   if(CopyBuffer(bb_handle, 1, 0, 1, upperBB) != 1) return; // Upper band
   if(CopyBuffer(bb_handle, 2, 0, 1, lowerBB) != 1) return; // Lower band
   if(CopyBuffer(ema8_handle, 0, 0, 1, ema8) != 1) return;
   if(CopyBuffer(ema20_handle, 0, 0, 1, ema20) != 1) return;

   //--- Get previous EMA values for crossover detection
   double ema8_prev[1], ema20_prev[1];
   if(CopyBuffer(ema8_handle, 0, 1, 1, ema8_prev) != 1) return;
   if(CopyBuffer(ema20_handle, 0, 1, 1, ema20_prev) != 1) return;

   //--- SNIPER BOT PRE-FILTERS ---
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

   //--- SILENT MODE: If no triggers, just log and exit
   if(!triggerSignal)
   {
      Print("Market Quiet - No Signal");
      return;
   }

   //--- TRIGGER DETECTED: Send to Vercel API
   Print("Sniper Trigger: ", triggerReason, " - Sending to AI Analysis");

   SendToVercel(price, rsi[0], upperBB[0], lowerBB[0], ema8[0], ema20[0]);
}

//+------------------------------------------------------------------+
//| Send data to Vercel API                                          |
//+------------------------------------------------------------------+
void SendToVercel(double price, double rsi, double upperBB, double lowerBB, double ema8, double ema20)
{
   //--- Prepare JSON payload
   string json = "{";
   json += "\"symbol\":\"" + _Symbol + "\",";
   json += "\"price\":" + DoubleToString(price, 5) + ",";
   json += "\"ema8\":" + DoubleToString(ema8, 5) + ",";
   json += "\"ema20\":" + DoubleToString(ema20, 5) + ",";
   json += "\"ema50\":" + DoubleToString(iMA(_Symbol, PERIOD_CURRENT, 50, 0, MODE_EMA, PRICE_CLOSE), 5) + ",";
   json += "\"rsi\":" + DoubleToString(rsi, 2) + ",";
   json += "\"upperBB\":" + DoubleToString(upperBB, 5) + ",";
   json += "\"lowerBB\":" + DoubleToString(lowerBB, 5) + ",";
   json += "\"vol\":" + IntegerToString(iVolume(_Symbol, PERIOD_CURRENT, 0)) + ",";
   json += "\"atr\":" + DoubleToString(iATR(_Symbol, PERIOD_CURRENT, 14), 5) + ",";
   json += "\"averageAtr\":" + DoubleToString(iATR(_Symbol, PERIOD_CURRENT, 14), 5) + ",";
   json += "\"accountBalance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2);

   //--- Add MACD data
   double macd_main[1], macd_signal[1], macd_histogram[1];
   int macd_handle = iMACD(_Symbol, PERIOD_CURRENT, 12, 26, 9, PRICE_CLOSE);
   CopyBuffer(macd_handle, 0, 0, 1, macd_main);
   CopyBuffer(macd_handle, 1, 0, 1, macd_signal);
   CopyBuffer(macd_handle, 2, 0, 1, macd_histogram);

   json += ",\"macd\":{\"line\":" + DoubleToString(macd_main[0], 6) + ",";
   json += "\"signal\":" + DoubleToString(macd_signal[0], 6) + ",";
   json += "\"histogram\":" + DoubleToString(macd_histogram[0], 6) + "}";

   //--- Add price history (last 20 candles)
   json += ",\"history\":[";
   for(int i = 19; i >= 0; i--)
   {
      double open = iOpen(_Symbol, PERIOD_CURRENT, i);
      double high = iHigh(_Symbol, PERIOD_CURRENT, i);
      double low = iLow(_Symbol, PERIOD_CURRENT, i);
      double close = iClose(_Symbol, PERIOD_CURRENT, i);
      long volume = iVolume(_Symbol, PERIOD_CURRENT, i);

      json += "{\"open\":" + DoubleToString(open, 5) + ",";
      json += "\"high\":" + DoubleToString(high, 5) + ",";
      json += "\"low\":" + DoubleToString(low, 5) + ",";
      json += "\"close\":" + DoubleToString(close, 5) + ",";
      json += "\"volume\":" + IntegerToString(volume) + "}";

      if(i > 0) json += ",";
   }
   json += "]";

   json += "}";

   //--- Send HTTP POST request
   string headers = "Content-Type: application/json";
   char data[];
   StringToCharArray(json, data, 0, StringLen(json));

   int timeout = 5000; // 5 seconds timeout

   string result = "";
   int res = WebRequest("POST", API_URL, headers, timeout, data, result, "");

   if(res == 200)
   {
      Print("Successfully sent data to Vercel API");
   }
   else
   {
      Print("Error sending data to Vercel API. Response code: ", res);
   }

   IndicatorRelease(macd_handle);
}
//+------------------------------------------------------------------+