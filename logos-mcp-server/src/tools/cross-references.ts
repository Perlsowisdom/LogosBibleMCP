import { z } from "zod";
import { getBibleText, searchBible } from "../services/biblia-api.js";
import type { ToolResult } from "../types.js";

export const getCrossReferencesTool = {
  name: "get_cross_references",
  description: "Find cross-references and parallel passages for a given Bible verse or passage. Searches for key terms from the passage to find related Scripture.",
  inputSchema: {
    type: "object" as const,
    properties: {
      passage: { type: "string", description: "Bible reference to find cross-references for (e.g., 'Romans 8:28')" },
      key_terms: { type: "string", description: "Optional: specific terms to search for instead of auto-extracting from the passage" },
    },
    required: ["passage"],
  },
  async handler(args: Record<string, unknown>): Promise<ToolResult> {
    const { passage, key_terms } = z.object({
      passage: z.string(),
      key_terms: z.string().optional(),
    }).parse(args);

    // If key terms provided, search directly; otherwise get the passage text and extract key words
    let searchQuery: string;
    if (key_terms) {
      searchQuery = key_terms;
    } else {
      const passageResult = await getBibleText(passage);
      // Extract significant words (skip common words, take distinctive terms)
      const stopWords = new Set([
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "that", "this", "these", "those",
        "it", "its", "he", "she", "they", "them", "his", "her", "their",
        "not", "no", "nor", "as", "if", "then", "than", "so", "all", "who",
        "which", "what", "when", "where", "how", "i", "me", "my", "we", "us",
        "you", "your", "him", "up", "out", "into", "upon",
      ]);
      const words = passageResult.text
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()))
        .slice(0, 5);
      searchQuery = words.join(" ");
    }

    const results = await searchBible(searchQuery, { limit: 15 });

    if (results.resultCount === 0) {
      return { content: [{ type: "text", text: `No cross-references found for ${passage}.` }] };
    }

    const lines = results.results.map((r) => `**${r.title}**: ${r.preview}`);
    const text = `Cross-references for **${passage}** (searched: "${searchQuery}"):\n\n${lines.join("\n\n")}`;
    return { content: [{ type: "text", text }] };
  },
};
