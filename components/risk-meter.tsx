'use client';

import { cn } from '@/lib/utils';
import type { ForexSignal, MarketCard } from '@/lib/types';
import { AlertTriangle, Shield, Target } from 'lucide-react';

interface RiskMeterProps {
  accountBalance: number;
  selectedMarket: MarketCard | null;
  allMarkets: MarketCard[];
}

export function RiskMeter({ accountBalance, selectedMarket, allMarkets }: RiskMeterProps) {
  const maxRiskPercent = 2; // 2% max risk per trade
  const riskPerTrade = accountBalance * (maxRiskPercent / 100);
  
  // Count active signals across all markets
  const activeSignals = allMarkets.filter(m => m.signal && m.signal.signal !== 'NEUTRAL').length;
  const currentExposure = riskPerTrade * activeSignals;
  const exposurePercentage = (currentExposure / accountBalance) * 100;
  
  // Selected market specific risk
  const selectedSignal = selectedMarket?.signal;
  const selectedRiskLevel = selectedSignal?.riskLevel || 'N/A';
  
  const getRiskColor = (percentage: number) => {
    if (percentage <= 2) return 'bg-emerald-500';
    if (percentage <= 5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getRiskTextColor = (percentage: number) => {
    if (percentage <= 2) return 'text-emerald-500';
    if (percentage <= 5) return 'text-amber-500';
    return 'text-red-500';
  };

  const getRiskLabel = (percentage: number) => {
    if (percentage <= 2) return 'Safe';
    if (percentage <= 5) return 'Moderate';
    return 'High Risk';
  };

  const getRiskBadgeText = (risk: string, confidence: number) => {
    if (risk === 'HIGH' && confidence < 20) {
      return 'HIGH (Uncertainty)';
    }
    return risk === 'LOW' ? 'Low Risk' : risk === 'MEDIUM' ? 'Medium Risk' : 'High Risk';
  };
  };

  const recommendedLotSize = (accountBalance * 0.01) / 100; // 1% risk with 100 pip stop loss

  // Calculate gauge rotation (0-180 degrees)
  const gaugeRotation = Math.min(exposurePercentage * 18, 180); // Max at 10%

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Risk Management</h2>
          {selectedMarket ? (
            <p className="text-xs text-muted-foreground">
              Viewing: <span className="font-medium text-foreground">{selectedMarket.symbol}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Select a market to view details</p>
          )}
        </div>
      </div>
      
      <div className="space-y-5">
        {/* Account Balance */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <span className="text-sm text-muted-foreground">Account Balance</span>
          <span className="text-2xl font-bold text-foreground">${accountBalance.toFixed(2)}</span>
        </div>

        {/* Visual Gauge */}
        <div className="relative flex items-center justify-center py-4">
          <div className="relative w-40 h-20 overflow-hidden">
            {/* Gauge background */}
            <div className="absolute inset-0 rounded-t-full border-8 border-muted" />
            {/* Gauge zones */}
            <div className="absolute inset-0 rounded-t-full overflow-hidden">
              <div className="absolute bottom-0 left-0 w-1/3 h-full bg-emerald-500/20" />
              <div className="absolute bottom-0 left-1/3 w-1/3 h-full bg-amber-500/20" />
              <div className="absolute bottom-0 right-0 w-1/3 h-full bg-red-500/20" />
            </div>
            {/* Needle */}
            <div 
              className="absolute bottom-0 left-1/2 w-1 h-16 origin-bottom transition-transform duration-500"
              style={{ transform: `translateX(-50%) rotate(${gaugeRotation - 90}deg)` }}
            >
              <div className={cn(
                'w-1 h-full rounded-full',
                getRiskColor(exposurePercentage)
              )} />
              <div className={cn(
                'absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full',
                getRiskColor(exposurePercentage)
              )} />
            </div>
          </div>
          {/* Center label */}
          <div className="absolute bottom-0 text-center">
            <p className={cn('text-2xl font-bold', getRiskTextColor(exposurePercentage))}>
              {exposurePercentage.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">Exposure</p>
          </div>
        </div>

        {/* Risk Status */}
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-lg',
          exposurePercentage <= 2 ? 'bg-emerald-500/10' : 
          exposurePercentage <= 5 ? 'bg-amber-500/10' : 'bg-red-500/10'
        )}>
          <div className={cn('h-3 w-3 rounded-full', getRiskColor(exposurePercentage))} />
          <span className={cn('text-sm font-medium', getRiskTextColor(exposurePercentage))}>
            Portfolio Status: {getRiskLabel(exposurePercentage)}
          </span>
        </div>

        {/* Selected Market Risk */}
        {selectedMarket && selectedSignal && (
          <div className="p-4 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">{selectedMarket.symbol} Risk</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs font-bold',
                getLevelColor(selectedRiskLevel)
              )}>
                {getRiskBadgeText(selectedRiskLevel, selectedSignal.confidence)}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Signal:</span>
              <span className={cn(
                'font-bold',
                selectedSignal.signal === 'BUY' ? 'text-emerald-500' :
                selectedSignal.signal === 'SELL' ? 'text-red-500' : 'text-amber-500'
              )}>
                {selectedSignal.signal}
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="text-sm text-foreground">{selectedSignal.confidence}% confident</span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Max Risk/Trade</p>
            <p className="text-lg font-semibold text-foreground">${riskPerTrade.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{maxRiskPercent}% of account</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Active Signals</p>
            <p className="text-lg font-semibold text-foreground">{activeSignals}</p>
            <p className="text-xs text-muted-foreground">across markets</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Total Exposure</p>
            <p className="text-lg font-semibold text-foreground">${currentExposure.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">at risk</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Rec. Lot Size</p>
            <p className="text-lg font-semibold text-foreground">{recommendedLotSize.toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">micro lots</p>
          </div>
        </div>

        {/* Warning */}
        {exposurePercentage > 5 && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-500">
              High exposure detected. Consider reducing position sizes or closing some trades.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
