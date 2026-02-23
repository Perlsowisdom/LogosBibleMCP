#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SERVER_NAME, SERVER_VERSION, LOGOS_DATA_DIR, DB_PATHS } from "./config.js";
import { existsSync } from "fs";

// Service imports
import { getBibleText, searchBible } from "./services/biblia-api.js";
import { navigateToPassage, openWordStudy, openFactbook } from "./services/logos-app.js";
import { expandRange } from "./services/reference-parser.js";
import {
  getUserHighlights,
  getFavorites,
  getWorkflowTemplates,
  getWorkflowInstances,
  getReadingProgress,
  getUserNotes,
  getUserSermons,
  listTables,
  listColumns,
  getTableSample,
} from "./services/sqlite-reader.js";

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

function err(s: string) {
  return { content: [{ type: "text" as const, text: s }], isError: true as const };
}

async function main() {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  // ── 0. diagnose ──────────────────────────────────────
  server.tool(
    "diagnose",
    "Diagnose Logos data directory and database availability",
    {},
    async () => {
      const dbStatus = Object.entries(DB_PATHS).map(([name, path]) => {
        const exists = existsSync(path);
        if (exists) {
          const tables = listTables(path);
          let extra = "";
          // For sermons, show row count and sample
          if (name === "sermons" && tables.includes("Documents")) {
            try {
              const sample = getTableSample(path, "Documents");
              extra = `\n  **Documents table: ${sample.count} rows**`;
              if (sample.sample) {
                const keys = Object.keys(sample.sample).slice(0, 5);
                const preview = keys.map(k => `${k}=${String(sample.sample![k]).substring(0, 30)}`).join(", ");
                extra += `\n  Sample: ${preview}...`;
              }
            } catch (e) {
              extra = `\n  **Error reading Documents table: ${String(e)}**`;
            }
          }
          return `- **${name}**: ✓ Found\n  Path: \`${path}\`\n  Tables: ${tables.join(", ") || "(none)"}${extra}`;
        }
        return `- **${name}**: ✗ Not found\n  Path: \`${path}\``;
      });
      
      const sections = [
        `**Logos Data Directory**: \`${LOGOS_DATA_DIR || "(not found)"}\``,
        "",
        "**Database Status:**",
        ...dbStatus,
      ];
      return text(sections.join("\n"));
    }
  );

  // ── 1. navigate_passage ──────────────────────────────────────────────────
  server.tool(
    "navigate_passage",
    "Open a Bible passage in the Logos Bible Software UI",
    { reference: z.string().describe("Bible reference (e.g., 'Genesis 1:1', 'Romans 8:28-30')") },
    async ({ reference }) => {
      const result = await navigateToPassage(reference);
      return result.success
        ? text(`Opened ${reference} in Logos.`)
        : err(`Failed to open passage: ${result.error}`);
    }
  );

  // ── 2. get_bible_text ────────────────────────────────────────────────────
  server.tool(
    "get_bible_text",
    "Retrieve the text of a Bible passage (LEB default)",
    {
      passage: z.string().describe("Bible reference (e.g., 'Genesis 1:1-5', 'John 3:16')"),
      bible: z.string().optional().describe("Bible version: LEB, KJV, ASV, DARBY, YLT, WEB"),
    },
    async ({ passage, bible }) => {
      const result = await getBibleText(passage, bible);
      return text(`**${result.passage}** (${result.bible})\n\n${result.text}`);
    }
  );

  // ── 3. get_passage_context ───────────────────────────────────────────────
  server.tool(
    "get_passage_context",
    "Get a Bible passage with surrounding verses for context",
    {
      passage: z.string().describe("Bible reference to center on"),
      context_verses: z.number().optional().describe("Verses before/after to include (default: 5)"),
      bible: z.string().optional().describe("Bible version (default: LEB)"),
    },
    async ({ passage, context_verses, bible }) => {
      const expanded = expandRange(passage, context_verses ?? 5);
      const result = await getBibleText(expanded, bible);
      return text(`**${result.passage}** (${result.bible}) — context around ${passage}\n\n${result.text}`);
    }
  );

  // ── 4. search_bible ──────────────────────────────────────────────────────
  server.tool(
    "search_bible",
    "Search the Bible for a word, phrase, or topic",
    {
      query: z.string().describe("Search terms (e.g., 'justification by faith')"),
      limit: z.number().optional().describe("Max results (default: 20)"),
      bible: z.string().optional().describe("Bible version (default: LEB)"),
    },
    async ({ query, limit, bible }) => {
      const result = await searchBible(query, { limit, bible });
      if (result.resultCount === 0) return text(`No results for "${query}".`);
      const lines = result.results.map((r) => `**${r.title}**: ${r.preview}`);
      return text(`Found ${result.resultCount} results for "${query}":\n\n${lines.join("\n\n")}`);
    }
  );

  // ── 5. get_cross_references ──────────────────────────────────────────────
  server.tool(
    "get_cross_references",
    "Find cross-references and parallel passages for a Bible verse",
    {
      passage: z.string().describe("Bible reference (e.g., 'Romans 8:28')"),
      key_terms: z.string().optional().describe("Specific terms to search instead of auto-extracting"),
    },
    async ({ passage, key_terms }) => {
      let searchQuery: string;
      if (key_terms) {
        searchQuery = key_terms;
      } else {
        const passageResult = await getBibleText(passage);
        const stopWords = new Set([
          "the","a","an","and","or","but","in","on","at","to","for","of","with",
          "by","from","is","are","was","were","be","been","have","has","had","do",
          "does","did","will","would","could","should","may","might","shall","that",
          "this","these","those","it","its","he","she","they","them","his","her",
          "their","not","no","nor","as","if","then","than","so","all","who","which",
          "what","when","where","how","i","me","my","we","us","you","your","him",
          "up","out","into","upon",
        ]);
        const words = passageResult.text
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()))
          .slice(0, 5);
        searchQuery = words.join(" ");
      }
      const results = await searchBible(searchQuery, { limit: 15 });
      if (results.resultCount === 0) return text(`No cross-references found for ${passage}.`);
      const lines = results.results.map((r) => `**${r.title}**: ${r.preview}`);
      return text(`Cross-references for **${passage}** (searched: "${searchQuery}"):\n\n${lines.join("\n\n")}`);
    }
  );

  // ── 6. get_user_notes ────────────────────────────────────────────────────
  server.tool(
    "get_user_notes",
    "Read the user's study notes from Logos Bible Software",
    {
      notebook_title: z.string().optional().describe("Filter by notebook title (partial match)"),
      limit: z.number().optional().describe("Max notes to return (default: 20)"),
    },
    async ({ notebook_title, limit }) => {
      const notes = getUserNotes({ notebookTitle: notebook_title, limit: limit ?? 20 });
      if (notes.length === 0) return text("No notes found.");
      const lines = notes.map((n) => {
        const header = n.notebookTitle ? `[${n.notebookTitle}]` : "[No notebook]";
        const date = n.modifiedDate ?? n.createdDate;
        const content = n.content ? n.content.substring(0, 300) : "(no content)";
        return `${header} (${date})\n${content}`;
      });
      return text(`Found ${notes.length} notes:\n\n${lines.join("\n\n---\n\n")}`);
    }
  );

  // ── 7. get_user_highlights ───────────────────────────────────────────────
  server.tool(
    "get_user_highlights",
    "Read the user's highlights and visual markup from Logos",
    {
      resource_id: z.string().optional().describe("Filter by resource ID"),
      style_name: z.string().optional().describe("Filter by highlight style name"),
      limit: z.number().optional().describe("Max highlights to return (default: 50)"),
    },
    async ({ resource_id, style_name, limit }) => {
      const highlights = getUserHighlights({
        resourceId: resource_id,
        styleName: style_name,
        limit: limit ?? 50,
      });
      if (highlights.length === 0) return text("No highlights found.");
      const lines = highlights.map((h) => `- **${h.styleName}**: ${h.textRange} (${h.resourceId})`);
      return text(`Found ${highlights.length} highlights:\n\n${lines.join("\n")}`);
    }
  );

  // ── 8. get_favorites ─────────────────────────────────────────────────────
  server.tool(
    "get_favorites",
    "List the user's saved favorites/bookmarks in Logos",
    {
      limit: z.number().optional().describe("Max favorites to return (default: 30)"),
    },
    async ({ limit }) => {
      const favorites = getFavorites(limit ?? 30);
      if (favorites.length === 0) return text("No favorites found.");
      const lines = favorites.map((f) => `- **${f.title}** → ${f.appCommand}`);
      return text(`Found ${favorites.length} favorites:\n\n${lines.join("\n")}`);
    }
  );

  // ── 9. get_reading_progress ──────────────────────────────────────────────
  server.tool(
    "get_reading_progress",
    "Show the user's reading plan progress from Logos",
    {},
    async () => {
      const progress = getReadingProgress();
      const sections: string[] = [];
      sections.push(`**Overall**: ${progress.completedItems}/${progress.totalItems} items (${progress.percentComplete}%)`);
      if (progress.statuses.length > 0) {
        const statusLines = progress.statuses.map((s) => {
          const label = s.status === 1 ? "Active" : s.status === 2 ? "Completed" : `Status ${s.status}`;
          return `- **${s.title}** by ${s.author} — ${label}`;
        });
        sections.push(`## Reading Plans\n\n${statusLines.join("\n")}`);
      }
      return text(sections.join("\n\n"));
    }
  );

  // ── 10. open_word_study ──────────────────────────────────────────────────
  server.tool(
    "open_word_study",
    "Open a word study in Logos for a Greek, Hebrew, or English word",
    { word: z.string().describe("The word to study (e.g., 'agape', 'hesed', 'justification')") },
    async ({ word }) => {
      const result = await openWordStudy(word);
      return result.success
        ? text(`Opened word study for "${word}" in Logos.`)
        : err(`Failed to open word study: ${result.error}`);
    }
  );

  // ── 11. open_factbook ────────────────────────────────────────────────────
  server.tool(
    "open_factbook",
    "Open the Logos Factbook for a person, place, event, or topic",
    { topic: z.string().describe("The topic to look up (e.g., 'Moses', 'Jerusalem', 'Passover')") },
    async ({ topic }) => {
      const result = await openFactbook(topic);
      return result.success
        ? text(`Opened Factbook entry for "${topic}" in Logos.`)
        : err(`Failed to open Factbook: ${result.error}`);
    }
  );

  // ── 12. get_study_workflows ──────────────────────────────────────────────
  server.tool(
    "get_study_workflows",
    "List available study workflow templates and active instances from Logos",
    {
      include_instances: z.boolean().optional().describe("Also show active workflow instances (default: true)"),
      instance_limit: z.number().optional().describe("Max active instances to return (default: 10)"),
    },
    async ({ include_instances, instance_limit }) => {
      const templates = getWorkflowTemplates();
      const sections: string[] = [];
      if (templates.length > 0) {
        const tLines = templates.map((t) => `- **${t.title}** (${t.externalId})`);
        sections.push(`## Workflow Templates\n\n${tLines.join("\n")}`);
      } else {
        sections.push("No workflow templates found.");
      }
      if (include_instances !== false) {
        const instances = getWorkflowInstances(instance_limit ?? 10);
        if (instances.length > 0) {
          const iLines = instances.map((i) => {
            const status = i.completedDate ? "Completed" : `Step: ${i.currentStep ?? "unknown"}`;
            return `- **${i.title}** (${i.key}) — ${status}, ${i.completedSteps.length} steps done`;
          });
          sections.push(`## Active Instances\n\n${iLines.join("\n")}`);
        }
      }
      return text(sections.join("\n\n"));
    }
  );

  // ── 13. get_user_sermons ────────────────────────────────────────────────────
  server.tool(
    "get_user_sermons",
    "Read the user's sermon documents from Logos Bible Software",
    {
      title: z.string().optional().describe("Filter by sermon title (partial match)"),
      after_date: z.string().optional().describe("Start date (ISO: YYYY-MM-DD)"),
      before_date: z.string().optional().describe("End date (ISO: YYYY-MM-DD)"),
      liturgical_season: z.string().optional().describe("Filter by liturgical season: advent, christmas, epiphany, lent, holy_week, easter, pentecost, ordinary"),
      year: z.number().optional().describe("Year for liturgical season calculation (defaults to current year)"),
      limit: z.number().optional().describe("Max sermons to return (default: 20)"),
    },
    async ({ title, after_date, before_date, liturgical_season, year, limit }) => {
      const sermons = getUserSermons({ title, after_date, before_date, liturgical_season, year, limit: limit ?? 20 });
      if (sermons.length === 0) {
        return text(`No sermons found matching criteria.

**Search parameters:**
- Title filter: ${title || "none"}
- Date range: ${after_date || "any"} to ${before_date || "any"}
- Liturgical season: ${liturgical_season || "none"}
- Limit: ${limit ?? 20}

**Possible reasons:**
1. **Sermons haven't synced** - Open Logos and ensure your sermons are synced to this device
2. **Sermon Builder not used** - This tool reads from Logos Sermon Builder
3. **No matching sermons** - Try adjusting your filters

**Sermon database location:**
${DB_PATHS.sermons}`);
      }
      const lines = sermons.map((s) => {
        const date = s.modifiedDate ?? s.createdDate ?? "Unknown date";
        const author = s.author ? ` by ${s.author}` : "";
        const series = s.series ? ` | **Series:** ${s.series}` : "";
        const content = s.content ? s.content.substring(0, 500) : "(no content)";
        return `### ${s.title}${author}${series}\n*${date}*\n\n${content}...`;
      });
      return text(`Found ${sermons.length} sermons:\n\n${lines.join("\n\n---\n\n")}`);
    }
  );

  // ── Start server ─────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
