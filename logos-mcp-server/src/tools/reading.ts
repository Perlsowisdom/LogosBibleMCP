import { z } from "zod";
import { getReadingProgress } from "../services/sqlite-reader.js";
import type { ToolResult } from "../types.js";

export const getReadingProgressTool = {
  name: "get_reading_progress",
  description: "Show the user's reading plan progress from Logos Bible Software. Displays reading lists, completion percentages, and status.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
  async handler(_args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const progress = getReadingProgress();

      const sections: string[] = [];

      // Overall progress
      sections.push(`**Overall**: ${progress.completedItems}/${progress.totalItems} items read (${progress.percentComplete}%)`);

      // Reading list statuses
      if (progress.statuses.length > 0) {
        const statusLines = progress.statuses.map((s) => {
          const statusLabel = s.status === 1 ? "Active" : s.status === 2 ? "Completed" : `Status ${s.status}`;
          return `- **${s.title}** by ${s.author} — ${statusLabel}`;
        });
        sections.push(`## Reading Plans\n\n${statusLines.join("\n")}`);
      } else {
        sections.push("No reading plans found.");
      }

      return { content: [{ type: "text", text: sections.join("\n\n") }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error reading progress: ${msg}` }], isError: true };
    }
  },
};
