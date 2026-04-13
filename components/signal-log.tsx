'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ForexSignal } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Send, Clock, Plus, X } from 'lucide-react';

// Default symbols for tab navigation
const DEFAULT_SYMBOLS = ['XAUUSD', 'BTCUSD', 'EURUSD'];

interface SignalLogProps {
  signals?: ForexSignal[];
}

export function SignalLog({ signals = [] }: SignalLogProps) {
  const [trackedSymbols, setTrackedSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [activeTab, setActiveTab] = useState(DEFAULT_SYMBOLS[0]);
  const [newSymbol, setNewSymbol] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Group signals by symbol with safe access
  const signalsBySymbol = useMemo(() => {
    const grouped: Record<string, ForexSignal[]> = {};
    trackedSymbols.forEach(symbol => {
      grouped[symbol] = (signals || []).filter(s => s.symbol === symbol);
    });
    return grouped;
  }, [signals, trackedSymbols]);

  const handleAddSymbol = () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (symbol && !trackedSymbols.includes(symbol)) {
      setTrackedSymbols(prev => [...prev, symbol]);
      setActiveTab(symbol);
      setNewSymbol('');
      setPopoverOpen(false);
    }
  };

  const handleRemoveSymbol = (symbolToRemove: string) => {
    if (trackedSymbols.length <= 1) return; // Keep at least one tab
    
    setTrackedSymbols(prev => prev.filter(s => s !== symbolToRemove));
    
    // If we're removing the active tab, switch to the first remaining tab
    if (activeTab === symbolToRemove) {
      const remaining = trackedSymbols.filter(s => s !== symbolToRemove);
      setActiveTab(remaining[0]);
    }
  };

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

  const getRiskBadgeText = (risk: ForexSignal['riskLevel'], confidence: number) => {
    if (risk === 'HIGH' && confidence < 20) {
      return 'HIGH (Uncertainty)';
    }
    return risk === 'LOW' ? 'Low Risk' : risk === 'MEDIUM' ? 'Medium Risk' : 'High Risk';
  };

  const getVolatilityInfo = (volatility?: ForexSignal['volatility']) => {
    switch (volatility) {
      case 'LOW':
        return { label: 'Low Volatility', className: 'bg-blue-500/10 text-blue-500' };
      case 'HIGH':
        return { label: 'High Volatility', className: 'bg-orange-500/10 text-orange-500' };
      default:
        return { label: 'Medium Volatility', className: 'bg-purple-500/10 text-purple-500' };
    }
  };

  const getRiskBadgeClass = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-500';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-500';
      case 'HIGH':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getConfidenceBarColor = (confidence: number) => {
    if (confidence >= 70) return 'bg-emerald-500';
    if (confidence >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getPatternColor = (pattern?: string) => {
    if (!pattern || pattern === 'NONE') return 'bg-gray-500/10 text-gray-500';
    // Bullish patterns
    if (pattern === 'HAMMER' || pattern === 'BULLISH_ENGULFING') {
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    }
    // Bearish patterns
    if (pattern === 'FALLING_STAR' || pattern === 'BEARISH_ENGULFING') {
      return 'bg-red-500/10 text-red-500 border-red-500/30';
    }
    // Neutral patterns (Doji)
    return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
  };

  const getMarketPhaseLabel = (phase?: string) => {
    const labels: Record<string, string> = {
      MARKUP: '📈 Markup',
      MARKDOWN: '📉 Markdown',
      ACCUMULATION: '📊 Accumulation',
      DISTRIBUTION: '⚠️ Distribution',
    };
    return labels[phase || ''] || '—';
  };

  const formatPatternName = (pattern?: string) => {
    if (!pattern || pattern === 'NONE') return 'No Pattern';
    return pattern.replace(/_/g, ' ');
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
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            {getSignalIcon(signal.signal)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{signal.symbol}</span>
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full border',
                getSignalBadgeClass(signal.signal)
              )}>
                {signal.signal}
              </span>
              {signal.patternDetected && signal.patternDetected !== 'NONE' && (
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded border',
                  getPatternColor(signal.patternDetected)
                )}>
                  🔍 {formatPatternName(signal.patternDetected)}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Entry @ {signal.price.toFixed(signal.symbol.includes('JPY') ? 3 : 5)}
            </p>
            {signal.marketPhase && (
              <p className="text-xs text-muted-foreground mt-1">
                {getMarketPhaseLabel(signal.marketPhase)}
              </p>
            )}
            {(signal.sl || signal.tp) && (
              <div className="flex items-center gap-3 mt-1">
                {signal.sl && (
                  <span className="text-xs text-red-400">
                    SL: {signal.sl.toFixed(signal.symbol.includes('JPY') ? 3 : 5)}
                  </span>
                )}
                {signal.tp && (
                  <span className="text-xs text-emerald-400">
                    TP: {signal.tp.toFixed(signal.symbol.includes('JPY') ? 3 : 5)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className={cn(
              'px-2 py-0.5 text-xs font-medium rounded',
              getRiskBadgeClass(signal.riskLevel)
            )}>
              {getRiskBadgeText(signal.riskLevel, signal.confidence)}
            </span>
            {signal.volatility && (
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded',
                getVolatilityInfo(signal.volatility).className
              )}>
                {getVolatilityInfo(signal.volatility).label}
              </span>
            )}
            {signal.telegramSent && (
              <Send className="h-3.5 w-3.5 text-blue-500" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDate(signal.timestamp)} {formatTime(signal.timestamp)}
          </span>
          {signal.atr && (
            <span className="text-xs text-muted-foreground">
              ATR: {signal.atr.toFixed(signal.symbol.includes('JPY') ? 3 : 5)}
            </span>
          )}
        </div>
      </div>
      
      {/* Volatility Alert Banner */}
      {signal.volatilityAlert && (
        <div className="mt-3 p-2 rounded bg-orange-500/10 border border-orange-500/30">
          <p className="text-xs text-orange-500 font-medium">{signal.volatilityAlert}</p>
        </div>
      )}
      
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
        
        {/* Technical Reasoning for SELL Signal */}
        {signal.signal === 'SELL' && signal.technicalReasoning && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Technical Reasoning</p>
            <p className="text-sm text-foreground leading-relaxed">
              {signal.technicalReasoning}
            </p>
          </div>
        )}
        
        {/* Full AI Technical Reasoning */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1 font-medium">AI Analysis</p>
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Signals</h2>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Market
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Add New Market</p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. GBPUSD"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleAddSymbol} disabled={!newSymbol.trim()}>
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the symbol exactly as it appears in MT5
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex flex-wrap gap-1 h-auto p-1 mb-4">
          {trackedSymbols.map(symbol => (
            <TabsTrigger 
              key={symbol} 
              value={symbol} 
              className="text-sm flex-1 min-w-fit relative group pr-7"
            >
              {symbol}
              {signalsBySymbol[symbol]?.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                  {signalsBySymbol[symbol].length}
                </span>
              )}
              {trackedSymbols.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRemoveSymbol(symbol);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      e.preventDefault();
                      handleRemoveSymbol(symbol);
                    }
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  aria-label={`Remove ${symbol}`}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {trackedSymbols.map(symbol => (
          <TabsContent key={symbol} value={symbol}>
            {signalsBySymbol[symbol]?.length > 0 ? (
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
