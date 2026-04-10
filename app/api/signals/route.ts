import { getRecentSignals } from '@/lib/signal-store';

export async function GET() {
  try {
    console.log('[API] /api/signals GET request received');
    const signals = await getRecentSignals(20);
    console.log(`[API] Returning ${signals.length} signals`);
    return Response.json({ signals });
  } catch (error) {
    console.error('[API] /api/signals error:', error);
    return Response.json(
      { error: 'Failed to fetch signals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
