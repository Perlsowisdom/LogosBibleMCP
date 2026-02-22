import { z } from "zod";
import { searchBible } from "../services/biblia-api.js";
import type { ToolResult } from "../types.js";

export const searchBibleTool = {
  name: "search_bible",
  description: "Search the Bible for a word, phrase, or topic. Returns matching verses with previews. Useful for topical studies and finding related passages.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Search terms (e.g., 'justification by faith', 'covenant', 'love one another')" },
      limit: { type: "number", description: "Max results to return (default: 20)" },
      bible: { type: "string", description: "Bible version (default: LEB)" },
    },
    required: ["query"],
  },
  async handler(args: Record<string, unknown>): Promise<ToolResult> {
    const { query, limit, bible } = z.object({
      query: z.string(),
      limit: z.number().optional(),
      bible: z.string().optional(),
    }).parse(args);

    const result = await searchBible(query, { limit, bible });
    if (result.resultCount === 0) {
      return { content: [{ type: "text", text: `No results found for "${query}".` }] };
    }

    const lines = result.results.map((r) => `**${r.title}**: ${r.preview}`);
    const text = `Found ${result.resultCount} results for "${query}":\n\n${lines.join("\n\n")}`;
    return { content: [{ type: "text", text }] };
  },
};
