'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { RiskMeter } from './risk-meter';
import { SignalLog } from './signal-log';
import { SignalForm } from './signal-form';
import type { ForexSignal } from '@/lib/types';
import { Activity, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ACCOUNT_BALANCE = 27;

export function Dashboard() {
  const { data, mutate } = useSWR<{ signals: ForexSignal[] }>('/api/signals', fetcher, {
    refreshInterval: 5000,
  });

  const signals = data?.signals || [];

  const handleSignalGenerated = useCallback((newSignal: ForexSignal) => {
    mutate({ signals: [newSignal, ...signals] }, false);
  }, [signals, mutate]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
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
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{todaySignals.length}</p>
                <p className="text-xs text-muted-foreground">Signals Today</p>
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
                <p className="text-xs text-muted-foreground">Buy Signals</p>
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
                <p className="text-xs text-muted-foreground">Sell Signals</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Activity className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{avgConfidence}%</p>
                <p className="text-xs text-muted-foreground">Avg Confidence</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Signal Form & Risk */}
          <div className="lg:col-span-1 space-y-6">
            <SignalForm onSignalGenerated={handleSignalGenerated} />
            <RiskMeter 
              accountBalance={ACCOUNT_BALANCE} 
              riskPercentage={2}
              activeSignals={buySignals + sellSignals}
            />
          </div>
          
          {/* Right Column - Signal Log */}
          <div className="lg:col-span-2">
            <SignalLog signals={signals} />
          </div>
        </div>

        {/* API Info */}
        <div className="mt-6 p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-2">API Endpoint</h3>
          <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            POST /api/analyze
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Send JSON with: symbol, price, ema8, ema20, ema50, macd (line, signal, histogram)
          </p>
        </div>
      </main>
    </div>
  );
}
