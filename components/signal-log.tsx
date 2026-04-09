'use client';

import { cn } from '@/lib/utils';
import type { ForexSignal } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Send, AlertCircle } from 'lucide-react';

interface SignalLogProps {
  signals: ForexSignal[];
}

export function SignalLog({ signals }: SignalLogProps) {
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

  if (signals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Signals</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No signals yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Send forex data to the API to generate signals
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Signals</h2>
        <span className="text-sm text-muted-foreground">{signals.length} signals</span>
      </div>
      
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {signals.map((signal) => (
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
                    @ {signal.price.toFixed(5)}
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
            
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <span className="text-xs font-medium text-foreground">{signal.confidence}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full',
                    signal.confidence >= 70 ? 'bg-emerald-500' : 
                    signal.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${signal.confidence}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                {signal.analysis}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
