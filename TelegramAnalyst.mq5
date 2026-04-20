#property strict

const string vercel_url = "https://forex-ai-analysis.vercel.app/api/analyze"; 

// Only 3 EMA handles now
int rsiHandle, atrHandle, ema8Handle, ema20Handle, ema50Handle;

int OnInit() {
   Print("=== DOW-HOMMA AI ANALYST (M5 - AGGRESSIVE) ===");
   
   rsiHandle    = iRSI(_Symbol, _Period, 14, PRICE_CLOSE);
   atrHandle    = iATR(_Symbol, _Period, 14);
   ema8Handle   = iMA(_Symbol, _Period, 8, 0, MODE_EMA, PRICE_CLOSE);
   ema20Handle  = iMA(_Symbol, _Period, 20, 0, MODE_EMA, PRICE_CLOSE);
   ema50Handle  = iMA(_Symbol, _Period, 50, 0, MODE_EMA, PRICE_CLOSE);
   
   return(INIT_SUCCEEDED);
}

void OnTick() {
   if(!IsNewBar()) return;

   MqlRates bars[];
   ArraySetAsSeries(bars, true);
   if(CopyRates(_Symbol, _Period, 0, 10, bars) < 10) return;

   // Local pattern check for context
   string localPattern = "NONE";
   if(IsHammer(bars[1])) localPattern = "HAMMER";
   if(IsShootingStar(bars[1])) localPattern = "SHOOTING_STAR";

   double rsi[], atr[], ema8[], ema20[], ema50[];
   ArraySetAsSeries(rsi, true); ArraySetAsSeries(atr, true);
   ArraySetAsSeries(ema8, true); ArraySetAsSeries(ema20, true); ArraySetAsSeries(ema50, true);

   CopyBuffer(rsiHandle, 0, 0, 1, rsi);
   CopyBuffer(atrHandle, 0, 0, 1, atr);
   CopyBuffer(ema8Handle, 0, 0, 1, ema8);
   CopyBuffer(ema20Handle, 0, 0, 1, ema20);
   CopyBuffer(ema50Handle, 0, 0, 1, ema50);

   string historyJson = "[";
   for(int i=20; i>=1; i--) { // Reduced to 20 for faster processing
      historyJson += StringFormat("{\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"vol\":%.0f}", 
                                  iOpen(_Symbol,_Period,i), iHigh(_Symbol,_Period,i), 
                                  iLow(_Symbol,_Period,i), iClose(_Symbol,_Period,i), iTickVolume(_Symbol,_Period,i));
      if(i > 1) historyJson += ",";
   }
   historyJson += "]";

   // EMA 200 removed from the JSON payload below
   string body = StringFormat("{\"symbol\":\"%s\",\"price\":%.5f,\"rsi\":%.2f,\"atr\":%.6f,\"vol\":%lld,\"ema8\":%.5f,\"ema20\":%.5f,\"ema50\":%.5f,\"localPattern\":\"%s\",\"history\":%s}", 
                              _Symbol, iClose(_Symbol, _Period, 0), rsi[0], atr[0], iTickVolume(_Symbol,_Period,0), 
                              ema8[0], ema20[0], ema50[0], localPattern, historyJson);

   AskVercelAI(body);
}

void AskVercelAI(string jsonPayload) {
   char data[], res[];
   string resultHeaders, requestHeaders = "Content-Type: application/json\r\n";
   StringToCharArray(jsonPayload, data);
   if(ArraySize(data) > 0) ArrayResize(data, ArraySize(data) - 1); 
   int resCode = WebRequest("POST", vercel_url, requestHeaders, 30000, data, res, resultHeaders);
   if(resCode == 200) Print("🧠 AI Action Sent: ", CharArrayToString(res));
}

bool IsNewBar() {
   static datetime last_time = 0;
   datetime current_time = iTime(_Symbol, _Period, 0);
   if(last_time != current_time) { last_time = current_time; return true; }
   return false;
}

bool IsHammer(const MqlRates &bar) {
   double body = MathAbs(bar.close - bar.open);
   double lowerShadow = MathMin(bar.open, bar.close) - bar.low;
   return (bar.close > bar.open && lowerShadow >= body * 2.5);
}

bool IsShootingStar(const MqlRates &bar) {
   double body = MathAbs(bar.close - bar.open);
   double upperShadow = bar.high - MathMax(bar.open, bar.close);
   return (bar.open > bar.close && upperShadow >= body * 2.5);
}