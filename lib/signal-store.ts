import type { ForexSignal } from './types';

// In-memory store for signals (in production, use a database)
const signals: ForexSignal[] = [];

export function addSignal(signal: ForexSignal): void {
  signals.unshift(signal);
  // Keep only last 50 signals
  if (signals.length > 50) {
    signals.pop();
  }
}

export function getSignals(): ForexSignal[] {
  return [...signals];
}

export function getRecentSignals(count: number = 10): ForexSignal[] {
  return signals.slice(0, count);
}
