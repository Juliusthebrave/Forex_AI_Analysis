'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { MarketCard as MarketCardType, ForexSignal } from '@/lib/types';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Loader2, 
  RefreshCw, 
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Target
} from 'lucide-react';

interface MarketCardProps {
  card: MarketCardType;
  isSelected: boolean;
  accountBalance: number;
  onSelect: () => void;
  onRemove: () => void;
  onAnalyze: (data: MarketCardType) => Promise<ForexSignal | null>;
  onUpdate: (card: MarketCardType) => void;
}

export function MarketCard({ 
  card, 
  isSelected,
  accountBalance,
  onSelect, 
  onRemove, 
  onAnalyze,
  onUpdate 
}: MarketCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const getRiskBadgeText = (risk: string, confidence: number) => {
    if (risk === 'HIGH' && confidence < 20) {
      return 'HIGH (Uncertainty)';
    }
    return risk === 'LOW' ? 'Low Risk' : risk === 'MEDIUM' ? 'Medium Risk' : 'High Risk';
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const signal = await onAnalyze(card);
      if (signal) {
        onUpdate({ ...card, signal, lastUpdated: new Date() });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateField = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    if (field.startsWith('macd.')) {
      const macdField = field.replace('macd.', '') as 'line' | 'signal' | 'histogram';
      onUpdate({
        ...card,
        macd: { ...card.macd, [macdField]: numValue }
      });
    } else {
      onUpdate({ ...card, [field]: numValue });
    }
  };

  const getSignalIcon = () => {
    if (!card.signal) return <Target className="h-5 w-5 text-muted-foreground" />;
    switch (card.signal.signal) {
      case 'BUY': return <TrendingUp className="h-5 w-5 text-emerald-500" />;
      case 'SELL': return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return <Minus className="h-5 w-5 text-amber-500" />;
    }
  };

  const getSignalColor = () => {
    if (!card.signal) return 'border-border';
    switch (card.signal.signal) {
      case 'BUY': return 'border-emerald-500/50 bg-emerald-500/5';
      case 'SELL': return 'border-red-500/50 bg-red-500/5';
      default: return 'border-amber-500/50 bg-amber-500/5';
    }
  };

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'LOW': return 'text-emerald-500 bg-emerald-500/10';
      case 'MEDIUM': return 'text-amber-500 bg-amber-500/10';
      case 'HIGH': return 'text-red-500 bg-red-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  // Calculate risk based on account balance
  const calculateRisk = () => {
    if (!card.signal) return null;
    const maxRiskPerTrade = accountBalance * 0.02; // 2% risk
    const recommendedLot = (accountBalance * 0.01) / 100;
    return {
      maxRisk: maxRiskPerTrade,
      lotSize: recommendedLot,
      exposure: maxRiskPerTrade
    };
  };

  const risk = calculateRisk();

  return (
    <div 
      className={cn(
        'rounded-xl border-2 bg-card transition-all duration-200 cursor-pointer overflow-hidden',
        isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
        getSignalColor()
      )}
      onClick={onSelect}
    >
      {/* Card Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            card.signal ? getRiskColor(card.signal.riskLevel) : 'bg-muted'
          )}>
            {isAnalyzing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              getSignalIcon()
            )}
          </div>
          <div>
            <h3 className="font-bold text-foreground">{card.symbol}</h3>
            <p className="text-sm text-muted-foreground">
              {card.price > 0 ? card.price.toFixed(5) : 'No price data'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {card.signal && (
            <span className={cn(
              'px-2 py-1 rounded-md text-xs font-bold',
              card.signal.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-500' :
              card.signal.signal === 'SELL' ? 'bg-red-500/20 text-red-500' :
              'bg-amber-500/20 text-amber-500'
            )}>
              {card.signal.signal}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Signal Info (Always visible if signal exists) */}
      {card.signal && (
        <div className="px-4 pb-4">
          {/* Confidence Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-medium text-foreground">{card.signal.confidence}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div 
                className={cn(
                  'h-full rounded-full transition-all',
                  card.signal.confidence >= 70 ? 'bg-emerald-500' :
                  card.signal.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${card.signal.confidence}%` }}
              />
            </div>
          </div>

          {/* Risk for $27 Account */}
          {risk && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Max Risk</p>
                <p className="text-sm font-bold text-foreground">${risk.maxRisk.toFixed(2)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Lot Size</p>
                <p className="text-sm font-bold text-foreground">{risk.lotSize.toFixed(3)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Risk Level</p>
                <p className={cn(
                  'text-sm font-bold',
                  card.signal.riskLevel === 'LOW' ? 'text-emerald-500' :
                  card.signal.riskLevel === 'MEDIUM' ? 'text-amber-500' : 'text-red-500'
                )}>
                  {getRiskBadgeText(card.signal.riskLevel, card.signal.confidence)}
                </p>
              </div>
            </div>
          )}

          {/* Analysis */}
          <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
            {card.signal.analysis}
          </div>

          {/* Telegram Status */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            {card.signal.telegramSent ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-500">Sent to Telegram</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-amber-500">Telegram pending</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Expanded Input Form */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border pt-4" onClick={e => e.stopPropagation()}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Current Price</label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.08542"
                value={card.price || ''}
                onChange={(e) => updateField('price', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMA 8</label>
                <Input
                  type="number"
                  step="0.00001"
                  value={card.ema8 || ''}
                  onChange={(e) => updateField('ema8', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMA 20</label>
                <Input
                  type="number"
                  step="0.00001"
                  value={card.ema20 || ''}
                  onChange={(e) => updateField('ema20', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EMA 50</label>
                <Input
                  type="number"
                  step="0.00001"
                  value={card.ema50 || ''}
                  onChange={(e) => updateField('ema50', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">MACD</label>
                <Input
                  type="number"
                  step="0.00001"
                  value={card.macd.line || ''}
                  onChange={(e) => updateField('macd.line', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Signal</label>
                <Input
                  type="number"
                  step="0.00001"
                  value={card.macd.signal || ''}
                  onChange={(e) => updateField('macd.signal', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Histogram</label>
                <Input
                  type="number"
                  step="0.00001"
                  value={card.macd.histogram || ''}
                  onChange={(e) => updateField('macd.histogram', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <Button 
              onClick={handleAnalyze}
              disabled={isAnalyzing || !card.price}
              className="w-full"
              size="sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Analyze Market
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
