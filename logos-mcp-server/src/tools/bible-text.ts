import { z } from "zod";
import { getBibleText } from "../services/biblia-api.js";
import { expandRange } from "../services/reference-parser.js";
import type { ToolResult } from "../types.js";

export const getBibleTextTool = {
  name: "get_bible_text",
  description: "Retrieve the text of a Bible passage. Defaults to the Lexham English Bible (LEB). Provide a reference like 'Genesis 1:1-5' or 'Romans 8:28-30'.",
  inputSchema: {
    type: "object" as const,
    properties: {
      passage: { type: "string", description: "Bible reference (e.g., 'Genesis 1:1-5', 'John 3:16')" },
      bible: { type: "string", description: "Bible version (default: LEB). Options: LEB, KJV, ASV, DARBY, YLT, WEB" },
    },
    required: ["passage"],
  },
  async handler(args: Record<string, unknown>): Promise<ToolResult> {
    const { passage, bible } = z.object({
      passage: z.string(),
      bible: z.string().optional(),
    }).parse(args);

    const result = await getBibleText(passage, bible);
    const text = `**${result.passage}** (${result.bible})\n\n${result.text}`;
    return { content: [{ type: "text", text }] };
  },
};

export const getPassageContextTool = {
  name: "get_passage_context",
  description: "Get a Bible passage along with surrounding verses for context. Useful when examining a verse that might be taken out of context.",
  inputSchema: {
    type: "object" as const,
    properties: {
      passage: { type: "string", description: "Bible reference to center on" },
      context_verses: { type: "number", description: "Number of verses before/after to include (default: 5)" },
      bible: { type: "string", description: "Bible version (default: LEB)" },
    },
    required: ["passage"],
  },
  async handler(args: Record<string, unknown>): Promise<ToolResult> {
    const { passage, context_verses, bible } = z.object({
      passage: z.string(),
      context_verses: z.number().optional(),
      bible: z.string().optional(),
    }).parse(args);

    const expanded = expandRange(passage, context_verses ?? 5);
    const result = await getBibleText(expanded, bible);
    const text = `**${result.passage}** (${result.bible}) — showing context around ${passage}\n\n${result.text}`;
    return { content: [{ type: "text", text }] };
  },
};
