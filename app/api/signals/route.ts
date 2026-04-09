import { getRecentSignals } from '@/lib/signal-store';

export async function GET() {
  const signals = getRecentSignals(20);
  return Response.json({ signals });
}
