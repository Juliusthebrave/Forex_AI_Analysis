'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ForexSignal } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Send, Clock } from 'lucide-react';

// Fixed symbols for tab navigation
const TRACKED_SYMBOLS = ['XAUUSD', 'BTCUSD', 'EURUSD'];

interface SignalLogProps {
  signals: ForexSignal[];
}

export function SignalLog({ signals }: SignalLogProps) {
  // Group signals by symbol
  const signalsBySymbol = useMemo(() => {
    const grouped: Record<string, ForexSignal[]> = {};
    TRACKED_SYMBOLS.forEach(symbol => {
      grouped[symbol] = signals.filter(s => s.symbol === symbol);
    });
    return grouped;
  }, [signals]);

  const getSignalIcon = (signal: ForexSignal['signal']) => {
    switch (signal) {
      case 'BUY':
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'SELL':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSignalBadgeClass = (signal: ForexSignal['signal']) => {
    switch (signal) {
      case 'BUY':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
      case 'SELL':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getRiskBadgeClass = (risk: ForexSignal['riskLevel']) => {
    switch (risk) {
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-500';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-500';
      default:
        return 'bg-red-500/10 text-red-500';
    }
  };

  const getConfidenceBarColor = (confidence: number) => {
    if (confidence >= 70) return 'bg-emerald-500';
    if (confidence >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const renderSignalCard = (signal: ForexSignal) => (
    <div 
      key={signal.id}
      className="p-4 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            {getSignalIcon(signal.signal)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{signal.symbol}</span>
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full border',
                getSignalBadgeClass(signal.signal)
              )}>
                {signal.signal}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Entry @ {signal.price.toFixed(5)}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-0.5 text-xs font-medium rounded',
              getRiskBadgeClass(signal.riskLevel)
            )}>
              {signal.riskLevel}
            </span>
            {signal.telegramSent && (
              <Send className="h-3.5 w-3.5 text-blue-500" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDate(signal.timestamp)} {formatTime(signal.timestamp)}
          </span>
        </div>
      </div>
      
      {/* Confidence Bar */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Confidence Level</span>
          <span className="text-xs font-medium text-foreground">{signal.confidence}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all',
              getConfidenceBarColor(signal.confidence)
            )}
            style={{ width: `${signal.confidence}%` }}
          />
        </div>
        
        {/* Full AI Technical Reasoning */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1 font-medium">AI Technical Reasoning</p>
          <p className="text-sm text-foreground leading-relaxed">
            {signal.analysis}
          </p>
        </div>
      </div>
    </div>
  );

  const renderEmptyState = (symbol: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
        <Clock className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">
        Waiting for first {symbol} data from MT5...
      </p>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Recent Signals</h2>
      
      <Tabs defaultValue={TRACKED_SYMBOLS[0]} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          {TRACKED_SYMBOLS.map(symbol => (
            <TabsTrigger key={symbol} value={symbol} className="text-sm">
              {symbol}
              {signalsBySymbol[symbol].length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                  {signalsBySymbol[symbol].length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {TRACKED_SYMBOLS.map(symbol => (
          <TabsContent key={symbol} value={symbol}>
            {signalsBySymbol[symbol].length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {signalsBySymbol[symbol].map(renderSignalCard)}
              </div>
            ) : (
              renderEmptyState(symbol)
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
