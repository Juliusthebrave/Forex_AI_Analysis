import type { ForexSignal } from './types';

// Ultra-minimal in-memory storage (no file I/O - Vercel compatible)
let signals: ForexSignal[] = [];

export async function addSignal(signal: ForexSignal): Promise<void> {
  signals.unshift(signal);
  if (signals.length > 100) signals = signals.slice(0, 100);
  console.log(`[Store] Signal added: ${signal.symbol}. Total: ${signals.length}`);
}

export async function getSignals(): Promise<ForexSignal[]> {
  console.log(`[Store] Returning ${signals.length} signals`);
  return [...signals];
}

export async function getRecentSignals(count: number = 10): Promise<ForexSignal[]> {
  return signals.slice(0, count);
}
