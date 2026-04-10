import { getRecentSignals } from '@/lib/signal-store';

export async function GET() {
  const signals = await getRecentSignals(20);
  return Response.json({ signals });
}
