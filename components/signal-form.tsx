'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Sparkles } from 'lucide-react';
import type { ForexSignal } from '@/lib/types';

interface SignalFormProps {
  onSignalGenerated: (signal: ForexSignal) => void;
}

const CURRENCY_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 
  'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP'
];

export function SignalForm({ onSignalGenerated }: SignalFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    symbol: 'EUR/USD',
    price: '',
    ema8: '',
    ema20: '',
    ema50: '',
    macdLine: '',
    macdSignal: '',
    macdHistogram: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: formData.symbol,
          price: parseFloat(formData.price),
          ema8: parseFloat(formData.ema8),
          ema20: parseFloat(formData.ema20),
          ema50: parseFloat(formData.ema50),
          macd: {
            line: parseFloat(formData.macdLine),
            signal: parseFloat(formData.macdSignal),
            histogram: parseFloat(formData.macdHistogram),
          },
        }),
      });

      const data = await response.json();
      
      if (data.success && data.signal) {
        onSignalGenerated(data.signal);
      }
    } catch (error) {
      console.error('Failed to generate signal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fillSampleData = () => {
    setFormData({
      symbol: 'EUR/USD',
      price: '1.08542',
      ema8: '1.08520',
      ema20: '1.08480',
      ema50: '1.08390',
      macdLine: '0.00025',
      macdSignal: '0.00018',
      macdHistogram: '0.00007',
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Analyze Signal</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={fillSampleData}
          className="text-xs"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Sample Data
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Currency Pair Selection */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Currency Pair
          </label>
          <select
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CURRENCY_PAIRS.map((pair) => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Current Price
          </label>
          <Input
            type="number"
            step="0.00001"
            placeholder="1.08542"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            required
          />
        </div>

        {/* EMAs */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              EMA 8
            </label>
            <Input
              type="number"
              step="0.00001"
              placeholder="1.08520"
              value={formData.ema8}
              onChange={(e) => setFormData({ ...formData, ema8: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              EMA 20
            </label>
            <Input
              type="number"
              step="0.00001"
              placeholder="1.08480"
              value={formData.ema20}
              onChange={(e) => setFormData({ ...formData, ema20: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              EMA 50
            </label>
            <Input
              type="number"
              step="0.00001"
              placeholder="1.08390"
              value={formData.ema50}
              onChange={(e) => setFormData({ ...formData, ema50: e.target.value })}
              required
            />
          </div>
        </div>

        {/* MACD */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              MACD Line
            </label>
            <Input
              type="number"
              step="0.00001"
              placeholder="0.00025"
              value={formData.macdLine}
              onChange={(e) => setFormData({ ...formData, macdLine: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Signal Line
            </label>
            <Input
              type="number"
              step="0.00001"
              placeholder="0.00018"
              value={formData.macdSignal}
              onChange={(e) => setFormData({ ...formData, macdSignal: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Histogram
            </label>
            <Input
              type="number"
              step="0.00001"
              placeholder="0.00007"
              value={formData.macdHistogram}
              onChange={(e) => setFormData({ ...formData, macdHistogram: e.target.value })}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Generate Signal
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
