//+------------------------------------------------------------------+
//|                      DowHommaSignalGenerator.mq5                 |
//|                Price Action Signal Generator (No Auto Trading)   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, MetaQuotes Software Corp."
#property link      "https://www.mql5.com"
#property version   "2.01 - Dow-Homma Signal Generator"
#property strict

input bool LOG_SIGNALS = true;                  // Write signals to file
input string SIGNAL_LOG_FILE = "DowHommaSignals.csv"; // Log filename

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=== DOW-HOMMA SIGNAL GENERATOR INITIALIZED ===");
   Print("Signal logging: ", LOG_SIGNALS ? "ENABLED" : "DISABLED");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   MqlRates bars[12];
   int copied = CopyRates(_Symbol, PERIOD_CURRENT, 1, ArraySize(bars), bars);
   if(copied < 5)
      return;

   bool bullish = IsBullishMicroTrend(bars, copied);
   bool bearish = IsBearishMicroTrend(bars, copied);

   string action = "NEUTRAL";
   string reason = "Market structure not clean";

   if(bullish)
   {
      if(IsBullishEngulfing(bars) && IsHigherLow(bars))
      {
         action = "BUY";
         reason = "Bullish engulfing at higher low";
      }
      else if(IsHammer(bars) && IsHigherLow(bars))
      {
         action = "BUY";
         reason = "Hammer at higher low";
      }
      else
      {
         reason = "Bullish structure without clean trigger";
      }
   }
   else if(bearish)
   {
      if(IsBearishEngulfing(bars) && IsLowerHigh(bars))
      {
         action = "SELL";
         reason = "Bearish engulfing at lower high";
      }
      else if(IsShootingStar(bars) && IsLowerHigh(bars))
      {
         action = "SELL";
         reason = "Shooting star at lower high";
      }
      else
      {
         reason = "Bearish structure without clean trigger";
      }
   }
   else
   {
      reason = "Sideways or choppy price action";
   }

   Print("Dow-Homma Signal: ", action, " | ", reason);
   Print("ATR: ", DoubleToString(iATR(_Symbol, PERIOD_CURRENT, 14), _Digits));
   Print("SL Distance (2.0x ATR): ", DoubleToString(iATR(_Symbol, PERIOD_CURRENT, 14) * 2.0, _Digits));
   Print("TP Distance (4.0x ATR): ", DoubleToString(iATR(_Symbol, PERIOD_CURRENT, 14) * 4.0, _Digits));
   Print("R/R Ratio: 1:2");
   if(LOG_SIGNALS)
      LogSignal(action, reason, bars, copied);
}

//+------------------------------------------------------------------+
//| Dow-Homma micro-trend detection                                  |
//+------------------------------------------------------------------+
bool IsBullishMicroTrend(const MqlRates &bars[], int count)
{
   bool bullish = true;
   for(int i = count - 1; i > 0; i--)
   {
      if(bars[i].high >= bars[i - 1].high || bars[i].low >= bars[i - 1].low)
      {
         bullish = false;
         break;
      }
   }
   return(bullish);
}

//+------------------------------------------------------------------+
//| Dow-Homma micro-trend detection                                  |
//+------------------------------------------------------------------+
bool IsBearishMicroTrend(const MqlRates &bars[], int count)
{
   bool bearish = true;
   for(int i = count - 1; i > 0; i--)
   {
      if(bars[i].high <= bars[i - 1].high || bars[i].low <= bars[i - 1].low)
      {
         bearish = false;
         break;
      }
   }
   return(bearish);
}

//+------------------------------------------------------------------+
//| Higher low confirmation                                           |
//+------------------------------------------------------------------+
bool IsHigherLow(const MqlRates &bars[])
{
   return(bars[0].low > bars[1].low);
}

//+------------------------------------------------------------------+
//| Lower high confirmation                                           |
//+------------------------------------------------------------------+
bool IsLowerHigh(const MqlRates &bars[])
{
   return(bars[0].high < bars[1].high);
}

//+------------------------------------------------------------------+
//| Bullish engulfing pattern                                          |
//+------------------------------------------------------------------+
bool IsBullishEngulfing(const MqlRates &bars[])
{
   double body0 = bars[0].close - bars[0].open;
   double body1 = bars[1].open - bars[1].close;

   return(body0 > 0 && body1 > 0 &&
          bars[0].open <= bars[1].close &&
          bars[0].close >= bars[1].open &&
          body0 >= body1);
}

//+------------------------------------------------------------------+
//| Bearish engulfing pattern                                         |
//+------------------------------------------------------------------+
bool IsBearishEngulfing(const MqlRates &bars[])
{
   double body0 = bars[0].open - bars[0].close;
   double body1 = bars[1].close - bars[1].open;

   return(body0 > 0 && body1 > 0 &&
          bars[0].open >= bars[1].close &&
          bars[0].close <= bars[1].open &&
          body0 >= body1);
}

//+------------------------------------------------------------------+
//| Bullish hammer pattern                                             |
//+------------------------------------------------------------------+
bool IsHammer(const MqlRates &bars[])
{
   double body = MathAbs(bars[0].close - bars[0].open);
   double lowerShadow = MathMin(bars[0].open, bars[0].close) - bars[0].low;
   double upperShadow = bars[0].high - MathMax(bars[0].open, bars[0].close);
   double range = bars[0].high - bars[0].low;

   return(bars[0].close > bars[0].open &&
          body <= range * 0.35 &&
          lowerShadow >= body * 2 &&
          upperShadow <= body);
}

//+------------------------------------------------------------------+
//| Shooting star pattern                                              |
//+------------------------------------------------------------------+
bool IsShootingStar(const MqlRates &bars[])
{
   double body = MathAbs(bars[0].close - bars[0].open);
   double upperShadow = bars[0].high - MathMax(bars[0].open, bars[0].close);
   double lowerShadow = MathMin(bars[0].open, bars[0].close) - bars[0].low;
   double range = bars[0].high - bars[0].low;

   return(bars[0].open > bars[0].close &&
          body <= range * 0.35 &&
          upperShadow >= body * 2 &&
          lowerShadow <= body);
}

//+------------------------------------------------------------------+
//| Log signal to file                                                 |
//+------------------------------------------------------------------+
void LogSignal(const string action, const string reason, const MqlRates &bars[], int count)
{
   string filename = SIGNAL_LOG_FILE;
   int fileHandle = FileOpen(filename, FILE_READ | FILE_WRITE | FILE_CSV, ',');
   if(fileHandle == INVALID_HANDLE)
   {
      Print("Failed to open signal log file: ", filename);
      return;
   }

   FileSeek(fileHandle, 0, SEEK_END);
   string line = TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS) + ",";
   line += _Symbol + ",";
   line += action + ",";
   line += reason + ",";
   line += DoubleToString(bars[0].open, _Digits) + ",";
   line += DoubleToString(bars[0].high, _Digits) + ",";
   line += DoubleToString(bars[0].low, _Digits) + ",";
   line += DoubleToString(bars[0].close, _Digits) + ",";
   line += IntegerToString(bars[0].tick_volume) + ",";
   
   // Add volatility-adjusted exits
   double atr = iATR(_Symbol, PERIOD_CURRENT, 14);
   line += DoubleToString(atr, _Digits) + ",";
   line += DoubleToString(atr * 2.0, _Digits) + ",";
   line += DoubleToString(atr * 4.0, _Digits);

   FileWriteString(fileHandle, line + "\n");
   FileClose(fileHandle);
}
