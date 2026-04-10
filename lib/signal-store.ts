import type { ForexSignal } from './types';
import { promises as fs } from 'fs';
import path from 'path';

// File-based persistent storage for signals
const SIGNALS_FILE = path.join(process.cwd(), 'data', 'signals.json');

// In-memory cache for faster access
let signals: ForexSignal[] = [];
let isLoaded = false;

async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(SIGNALS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function loadSignals(): Promise<void> {
  if (isLoaded) return;

  try {
    await ensureDataDirectory();
    const data = await fs.readFile(SIGNALS_FILE, 'utf-8');
    const parsed = JSON.parse(data);

    // Convert timestamp strings back to Date objects
    signals = parsed.map((signal: any) => ({
      ...signal,
      timestamp: new Date(signal.timestamp),
    }));

    console.log(`[Signal Store] Loaded ${signals.length} signals from disk`);
  } catch (error) {
    // File doesn't exist or is corrupted, start with empty array
    console.log('[Signal Store] No existing signals file, starting fresh');
    signals = [];
  }

  isLoaded = true;
}

async function saveSignals(): Promise<void> {
  try {
    await ensureDataDirectory();
    await fs.writeFile(SIGNALS_FILE, JSON.stringify(signals, null, 2));
  } catch (error) {
    console.error('[Signal Store] Failed to save signals:', error);
  }
}

export async function addSignal(signal: ForexSignal): Promise<void> {
  await loadSignals();

  signals.unshift(signal);

  // Keep only last 100 signals to prevent file from growing too large
  if (signals.length > 100) {
    signals = signals.slice(0, 100);
  }

  // Save to disk asynchronously (don't block the response)
  saveSignals().catch(error => {
    console.error('[Signal Store] Failed to persist signal:', error);
  });
}

export async function getSignals(): Promise<ForexSignal[]> {
  await loadSignals();
  return [...signals];
}

export async function getRecentSignals(count: number = 10): Promise<ForexSignal[]> {
  await loadSignals();
  return signals.slice(0, count);
}
