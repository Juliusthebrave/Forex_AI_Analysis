'use client';

import { cn } from '@/lib/utils';

interface RiskMeterProps {
  accountBalance: number;
  riskPercentage: number;
  activeSignals: number;
}

export function RiskMeter({ accountBalance, riskPercentage, activeSignals }: RiskMeterProps) {
  const maxRisk = 2; // 2% max risk per trade
  const riskPerTrade = accountBalance * (maxRisk / 100);
  const currentExposure = riskPerTrade * activeSignals;
  const exposurePercentage = (currentExposure / accountBalance) * 100;
  
  const getRiskColor = (percentage: number) => {
    if (percentage <= 2) return 'bg-emerald-500';
    if (percentage <= 5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getRiskLabel = (percentage: number) => {
    if (percentage <= 2) return 'Safe';
    if (percentage <= 5) return 'Moderate';
    return 'High Risk';
  };

  const recommendedLotSize = (accountBalance * 0.01) / 100; // 1% risk with 100 pip stop loss

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Risk Management</h2>
      
      <div className="space-y-6">
        {/* Account Balance */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Account Balance</span>
          <span className="text-2xl font-bold text-foreground">${accountBalance.toFixed(2)}</span>
        </div>

        {/* Risk Meter Gauge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Exposure</span>
            <span className={cn(
              'font-medium',
              exposurePercentage <= 2 ? 'text-emerald-500' : 
              exposurePercentage <= 5 ? 'text-amber-500' : 'text-red-500'
            )}>
              {exposurePercentage.toFixed(1)}%
            </span>
          </div>
          
          {/* Gauge Bar */}
          <div className="relative h-4 w-full rounded-full bg-muted overflow-hidden">
            <div 
              className={cn(
                'h-full rounded-full transition-all duration-500',
                getRiskColor(exposurePercentage)
              )}
              style={{ width: `${Math.min(exposurePercentage * 10, 100)}%` }}
            />
            {/* Risk zones */}
            <div className="absolute inset-0 flex">
              <div className="w-[20%] border-r border-background/30" />
              <div className="w-[30%] border-r border-background/30" />
              <div className="w-[50%]" />
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>2%</span>
            <span>5%</span>
            <span>10%+</span>
          </div>
        </div>

        {/* Risk Status */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className={cn(
            'h-3 w-3 rounded-full',
            getRiskColor(exposurePercentage)
          )} />
          <span className="text-sm font-medium text-foreground">
            {getRiskLabel(exposurePercentage)}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Max Risk/Trade</p>
            <p className="text-lg font-semibold text-foreground">${riskPerTrade.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{maxRisk}% of account</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Active Positions</p>
            <p className="text-lg font-semibold text-foreground">{activeSignals}</p>
            <p className="text-xs text-muted-foreground">signals today</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Current Exposure</p>
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
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-500 font-medium">
              Warning: High exposure detected. Consider reducing position sizes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
