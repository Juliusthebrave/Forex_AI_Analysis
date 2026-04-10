'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { SignalLog } from './signal-log';
import { BalanceCard } from './balance-card';
import type { ForexSignal } from '@/lib/types';
import { Activity, TrendingUp, TrendingDown, Percent } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Dashboard() {
  const { data } = useSWR<{ signals: ForexSignal[] }>('/api/signals', fetcher, {
    refreshInterval: 5000,
  });

  const [accountBalance, setAccountBalance] = useState(27);

  const signals = data?.signals || [];

  // Calculate stats
  const todaySignals = signals.filter(s => {
    const signalDate = new Date(s.timestamp);
    const today = new Date();
    return signalDate.toDateString() === today.toDateString();
  });

  const buySignals = todaySignals.filter(s => s.signal === 'BUY').length;
  const sellSignals = todaySignals.filter(s => s.signal === 'SELL').length;
  const avgConfidence = todaySignals.length > 0
    ? Math.round(todaySignals.reduce((sum, s) => sum + s.confidence, 0) / todaySignals.length)
    : 0;

  // Market phase breakdown
  const marketPhases = {
    MARKUP: todaySignals.filter(s => s.marketPhase === 'MARKUP').length,
    MARKDOWN: todaySignals.filter(s => s.marketPhase === 'MARKDOWN').length,
    ACCUMULATION: todaySignals.filter(s => s.marketPhase === 'ACCUMULATION').length,
    DISTRIBUTION: todaySignals.filter(s => s.marketPhase === 'DISTRIBUTION').length,
  };

  // Pattern detection stats
  const bullishPatterns = todaySignals.filter(s =>
    s.patternDetected === 'HAMMER' || s.patternDetected === 'BULLISH_ENGULFING'
  ).length;
  const bearishPatterns = todaySignals.filter(s =>
    s.patternDetected === 'FALLING_STAR' || s.patternDetected === 'BEARISH_ENGULFING'
  ).length;
  const dojiCount = todaySignals.filter(s => s.patternDetected === 'DOJI').length;

  // Volatility alerts
  const volatilityAlerts = todaySignals.filter(s => s.volatilityAlert).length;
  const highVolatility = todaySignals.filter(s =>
    s.volatilityAlert?.includes('VOLATILE: High Risk')
  ).length;
  
  // Risk per trade (2% of account balance)
  const riskPerTrade = (accountBalance * 0.02).toFixed(2);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Forex AI Analyst</h1>
                <p className="text-xs text-muted-foreground">April 2026 Market Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Balance:</span>
                <span className="font-bold text-foreground">${accountBalance.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm text-muted-foreground">Live</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Overview - Account Balance, Risk/Trade, Avg Confidence */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${accountBalance.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Account Balance</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Percent className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${riskPerTrade}</p>
                <p className="text-xs text-muted-foreground">Risk/Trade (2%)</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{buySignals}</p>
                <p className="text-xs text-muted-foreground">Buy Signals Today</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{sellSignals}</p>
                <p className="text-xs text-muted-foreground">Sell Signals Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Average Confidence Card */}
        <div className="mb-6 p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Confidence</p>
                <p className="text-2xl font-bold text-foreground">{avgConfidence}%</p>
              </div>
            </div>
            <div className="flex-1 max-w-xs ml-6">
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    avgConfidence >= 70 ? 'bg-emerald-500' :
                    avgConfidence >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${avgConfidence}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Market Phase & Pattern Analysis Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-3 rounded-xl border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Markup Phase</p>
            <p className="text-xl font-bold text-emerald-500">{marketPhases.MARKUP}</p>
          </div>
          <div className="p-3 rounded-xl border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Markdown Phase</p>
            <p className="text-xl font-bold text-red-500">{marketPhases.MARKDOWN}</p>
          </div>
          <div className="p-3 rounded-xl border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Bullish Patterns</p>
            <p className="text-xl font-bold text-emerald-500">{bullishPatterns}</p>
          </div>
          <div className="p-3 rounded-xl border border-border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Bearish Patterns</p>
            <p className="text-xl font-bold text-red-500">{bearishPatterns}</p>
          </div>
        </div>

        {/* Volatility & Pattern Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <p className="text-sm font-semibold text-foreground">Volatility Alerts</p>
            </div>
            <p className="text-2xl font-bold text-amber-500">{volatilityAlerts}</p>
            {highVolatility > 0 && (
              <p className="text-xs text-red-500 mt-1">⚠️ {highVolatility} High Risk</p>
            )}
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <p className="text-sm font-semibold text-foreground">Doji Patterns</p>
            </div>
            <p className="text-2xl font-bold text-blue-500">{dojiCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Exhaustion signals</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <p className="text-sm font-semibold text-foreground">Accumulation</p>
            </div>
            <p className="text-2xl font-bold text-purple-500">{marketPhases.ACCUMULATION}</p>
            <p className="text-xs text-muted-foreground mt-1">Setup forming</p>
          </div>
        </div>

        {/* Main Grid - Balance Card & Tabbed Signal Log */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Balance Card */}
          <div className="lg:col-span-1">
            <BalanceCard 
              balance={accountBalance} 
              onBalanceChange={setAccountBalance} 
            />
          </div>
          
          {/* Right Column - Tabbed Signal Log */}
          <div className="lg:col-span-2">
            <SignalLog signals={signals} />
          </div>
        </div>

        {/* API Info */}
        <div className="mt-6 p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-2">API Endpoint & Dow-Homma Implementation</h3>
          <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded block mb-2">
            POST /api/analyze
          </code>
          <p className="text-xs text-muted-foreground mb-2">
            <strong>Required fields:</strong> symbol, price, ema8, ema20, ema50, macd (line, signal, histogram)
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Optional fields:</strong> sl, tp, atr, history (OHLC array), averageAtr, accountBalance
          </p>
          <p className="text-xs text-emerald-600 mt-2 font-medium">
            ✓ Bi-directional Master Scalper enabled with pattern detection, market phase analysis, and volatility alerts
          </p>
        </div>
      </main>
    </div>
  );
}
