/**
 * Adapted "discovery card" mechanic: upstream shows ephemeral cards when an
 * autonomous agent finds a new file/directory - a live event our transcript
 * data has no direct equivalent for. The closest analog available here is a
 * Grep/Glob result surfacing a file path we haven't seen mentioned before,
 * so that's what this synthesizes discoveries from.
 */
import type { SceneToolCall } from "@/lib/canvas-scene";
import { extractText } from "@/lib/transcript-parser";
import { DISCOVERY_FADE_MS, DISCOVERY_HOLD_MS } from "./animation-constants";

export interface Discovery {
  id: string;
  ownerAgentId: string;
  path: string;
  timestamp: number;
}

const PATH_LINE_RE = /^[\w./\\-]{3,120}\.[A-Za-z0-9]{1,8}$/;
const DISCOVERY_TOOL_NAMES = new Set(["Grep", "Glob"]);

export class DiscoveryTracker {
  private seenPaths = new Set<string>();
  private processedToolCallIds = new Set<string>();
  private discoveries: Discovery[] = [];

  sync(toolCalls: SceneToolCall[]): Discovery[] {
    for (const tc of toolCalls) {
      if (this.processedToolCallIds.has(tc.id)) continue;
      if (!DISCOVERY_TOOL_NAMES.has(tc.raw.name)) continue;
      if (!tc.raw.result || tc.raw.result.isError) continue;
      this.processedToolCallIds.add(tc.id);

      const text = extractText(tc.raw.result.content);
      for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (!line || this.seenPaths.has(line) || !PATH_LINE_RE.test(line)) continue;
        this.seenPaths.add(line);
        this.discoveries.push({
          id: `disc-${this.discoveries.length}-${line}`,
          ownerAgentId: tc.ownerAgentId,
          path: line,
          timestamp: Date.now(),
        });
      }
    }

    const now = Date.now();
    this.discoveries = this.discoveries.filter((d) => now - d.timestamp < DISCOVERY_HOLD_MS + DISCOVERY_FADE_MS);
    return this.discoveries;
  }
}



