import type { ForexSignal } from './types';

// In-memory store for signals (works on Vercel's read-only file system)
// Note: In production, use a database like Supabase, Firebase, or PostgreSQL
let signals: ForexSignal[] = [];

export async function addSignal(signal: ForexSignal): Promise<void> {
  signals.unshift(signal);
  
  // Keep only last 100 signals
  if (signals.length > 100) {
    signals = signals.slice(0, 100);
  }

  console.log(`[Signal Store] Added signal: ${signal.symbol} ${signal.signal}. Total: ${signals.length}`);
}

export async function getSignals(): Promise<ForexSignal[]> {
  console.log(`[Signal Store] Retrieving ${signals.length} signals`);
  return [...signals];
}

export async function getRecentSignals(count: number = 10): Promise<ForexSignal[]> {
  const recent = signals.slice(0, count);
  console.log(`[Signal Store] Returning ${recent.length} recent signals (requested: ${count})`);
  return recent;
}
