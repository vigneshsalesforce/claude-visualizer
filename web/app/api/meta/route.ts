import { getTailingState, startPolling } from "@/lib/tailing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  startPolling();
  const state = getTailingState();
  return Response.json({ mainPath: state.mainPath, mainId: state.mainId });
}



