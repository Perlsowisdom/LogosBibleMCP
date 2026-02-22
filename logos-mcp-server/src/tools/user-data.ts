import { z } from "zod";
import { getUserNotes, getUserHighlights, getFavorites } from "../services/sqlite-reader.js";
import type { ToolResult } from "../types.js";

export const getUserNotesTool = {
  name: "get_user_notes",
  description: "Read the user's study notes from Logos Bible Software. Can filter by notebook title. Returns note content, dates, and anchors.",
  inputSchema: {
    type: "object" as const,
    properties: {
      notebook_title: { type: "string", description: "Filter notes by notebook title (partial match)" },
      limit: { type: "number", description: "Max notes to return (default: 20)" },
    },
    required: [],
  },
  async handler(args: Record<string, unknown>): Promise<ToolResult> {
    const { notebook_title, limit } = z.object({
      notebook_title: z.string().optional(),
      limit: z.number().optional(),
    }).parse(args);

    try {
      const notes = getUserNotes({ notebookTitle: notebook_title, limit: limit ?? 20 });
      if (notes.length === 0) {
        return { content: [{ type: "text", text: "No notes found." }] };
      }

      const lines = notes.map((n) => {
        const header = n.notebookTitle ? `[${n.notebookTitle}]` : "[No notebook]";
        const date = n.modifiedDate ?? n.createdDate;
        const content = n.content ? n.content.substring(0, 300) : "(no content)";
        return `${header} (${date})\n${content}`;
      });

      return { content: [{ type: "text", text: `Found ${notes.length} notes:\n\n${lines.join("\n\n---\n\n")}` }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error reading notes: ${msg}` }], isError: true };
    }
  },
};

export const getUserHighlightsTool = {
  name: "get_user_highlights",
  description: "Read the user's highlights and visual markup from Logos Bible Software. Shows which passages have been highlighted and with what styles.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resource_id: { type: "string", description: "Filter by resource ID" },
      style_name: { type: "string", description: "Filter by highlight style name" },
      limit: { type: "number", description: "Max highlights to return (default: 50)" },
    },
    required: [],
  },
  async handler(args: Record<string, unknown>): Promise<ToolResult> {
    const { resource_id, style_name, limit } = z.object({
      resource_id: z.string().optional(),
      style_name: z.string().optional(),
      limit: z.number().optional(),
    }).parse(args);

    try {
      const highlights = getUserHighlights({
        resourceId: resource_id,
        styleName: style_name,
        limit: limit ?? 50,
      });

      if (highlights.length === 0) {
        return { content: [{ type: "text", text: "No highlights found." }] };
      }

      const lines = highlights.map((h) =>
        `- **${h.styleName}**: ${h.textRange} (${h.resourceId})`
      );

      return { content: [{ type: "text", text: `Found ${highlights.length} highlights:\n\n${lines.join("\n")}` }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error reading highlights: ${msg}` }], isError: true };
    }
  },
};

export const getFavoritesTool = {
  name: "get_favorites",
  description: "List the user's saved favorites/bookmarks in Logos Bible Software.",
  inputSchema: {
    type: "object" as const,
    properties: {
      limit: { type: "number", description: "Max favorites to return (default: 30)" },
    },
    required: [],
  },
  async handler(args: Record<string, unknown>): Promise<ToolResult> {
    const { limit } = z.object({
      limit: z.number().optional(),
    }).parse(args);

    try {
      const favorites = getFavorites(limit ?? 30);
      if (favorites.length === 0) {
        return { content: [{ type: "text", text: "No favorites found." }] };
      }

      const lines = favorites.map((f) =>
        `- **${f.title}** → ${f.appCommand}`
      );

      return { content: [{ type: "text", text: `Found ${favorites.length} favorites:\n\n${lines.join("\n")}` }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error reading favorites: ${msg}` }], isError: true };
    }
  },
};
