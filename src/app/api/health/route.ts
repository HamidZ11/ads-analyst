import { healthReport } from "@/lib/health";

/** Uptime check: public, uncached, see `healthReport`. */
export function GET() {
  const { status, body } = healthReport();
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
