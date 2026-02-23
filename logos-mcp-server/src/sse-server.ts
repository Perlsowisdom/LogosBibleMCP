#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import http from "http";
import { SERVER_NAME, SERVER_VERSION, BIBLIA_API_KEY, PLATFORM } from "./config.js";

import { getBibleText, searchBible } from "./services/biblia-api.js";
import { navigateToPassage, openWordStudy, openFactbook, openLogosApp } from "./services/logos-app.js";
import { expandRange } from "./services/reference-parser.js";
import {
  getUserHighlights,
  getFavorites,
  getWorkflowTemplates,
  getWorkflowInstances,
  getReadingProgress,
  getUserNotes,
  getUserSermons,
} from "./services/sqlite-reader.js";

// API Key authentication
const API_KEY = process.env.LOGOS_MCP_API_KEY;
const REQUIRE_API_KEY = process.env.LOGOS_MCP_REQUIRE_API_KEY !== "false";

function checkAuth(req: http.IncomingMessage): boolean {
  if (!REQUIRE_API_KEY || !API_KEY) return true;
  
  const authHeader = req.headers.authorization || "";
  const providedKey = authHeader.startsWith("Bearer ") 
    ? authHeader.slice(7) 
    : authHeader;
  
  return providedKey === API_KEY;
}

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

function err(s: string) {
  return { content: [{ type: "text" as const, text: s }], isError: true as const };
}

async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  // ── 1. navigate_passage ──────────────────────────────────────────────────
  server.tool("navigate_passage", "Open a Bible passage in Logos Bible Software UI",
    { reference: z.string().describe("Bible reference (e.g., 'Genesis 1:1', 'Romans 8:28-30')") },
    async ({ reference }) => {
      const result = await navigateToPassage(reference);
      return result.success ? text(`Opened ${reference} in Logos.`) : err(`Failed to open passage: ${result.error}`);
    }
  );

  // ── 2. get_bible_text ────────────────────────────────────────────────────
  server.tool("get_bible_text", "Retrieve the text of a Bible passage (LEB default)",
    { passage: z.string().describe("Bible reference (e.g., 'Genesis 1:1-5', 'John 3:16')"), bible: z.string().optional().describe("Bible version: LEB, KJV, ASV, DARBY, YLT, WEB") },
    async ({ passage, bible }) => {
      const result = await getBibleText(passage, bible);
      return text(`**${result.passage}** (${result.bible})\n\n${result.text}`);
    }
  );

  // ── 3. get_passage_context ───────────────────────────────────────────────
  server.tool("get_passage_context", "Get a Bible passage with surrounding verses for context",
    { passage: z.string().describe("Bible reference to center on"), context_verses: z.number().optional().describe("Verses before/after to include (default: 5)"), bible: z.string().optional().describe("Bible version (default: LEB)") },
    async ({ passage, context_verses, bible }) => {
      const expanded = expandRange(passage, context_verses ?? 5);
      const result = await getBibleText(expanded, bible);
      return text(`**${result.passage}** (${result.bible}) — context around ${passage}\n\n${result.text}`);
    }
  );

  // ── 4. search_bible ──────────────────────────────────────────────────────
  server.tool("search_bible", "Search the Bible for a word, phrase, or topic",
    { query: z.string().describe("Search terms (e.g., 'justification by faith')"), limit: z.number().optional().describe("Max results (default: 20)"), bible: z.string().optional().describe("Bible version (default: LEB)") },
    async ({ query, limit, bible }) => {
      const result = await searchBible(query, { limit, bible });
      if (result.resultCount === 0) return text(`No results for "${query}".`);
      const lines = result.results.map((r) => `**${r.title}**: ${r.preview}`);
      return text(`Found ${result.resultCount} results for "${query}":\n\n${lines.join("\n\n")}`);
    }
  );

  // ── 5. get_cross_references ──────────────────────────────────────────────
  server.tool("get_cross_references", "Find cross-references and parallel passages for a Bible verse",
    { passage: z.string().describe("Bible reference (e.g., 'Romans 8:28')"), key_terms: z.string().optional().describe("Specific terms to search instead of auto-extracting") },
    async ({ passage, key_terms }) => {
      let searchQuery: string;
      if (key_terms) {
        searchQuery = key_terms;
      } else {
        const passageResult = await getBibleText(passage);
        const stopWords = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","shall","that","this","these","those","it","its","he","she","they","them","his","her","their","not","no","nor","as","if","then","than","so","all","who","which","what","when","where","how","i","me","my","we","us","you","your","him","up","out","into","upon"]);
        const words = passageResult.text.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase())).slice(0, 5);
        searchQuery = words.join(" ");
      }
      const results = await searchBible(searchQuery, { limit: 15 });
      if (results.resultCount === 0) return text(`No cross-references found for ${passage}.`);
      const lines = results.results.map((r) => `**${r.title}**: ${r.preview}`);
      return text(`Cross-references for **${passage}** (searched: "${searchQuery}"):\n\n${lines.join("\n\n")}`);
    }
  );

  // ── 6. get_user_notes ────────────────────────────────────────────────────
  server.tool("get_user_notes", "Read the user's study notes from Logos Bible Software",
    { notebook_title: z.string().optional().describe("Filter by notebook title (partial match)"), limit: z.number().optional().describe("Max notes to return (default: 20)") },
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
  server.tool("get_user_highlights", "Read the user's highlights and visual markup from Logos",
    { resource_id: z.string().optional().describe("Filter by resource ID"), style_name: z.string().optional().describe("Filter by highlight style name"), limit: z.number().optional().describe("Max highlights to return (default: 50)") },
    async ({ resource_id, style_name, limit }) => {
      const highlights = getUserHighlights({ resourceId: resource_id, styleName: style_name, limit: limit ?? 50 });
      if (highlights.length === 0) return text("No highlights found.");
      const lines = highlights.map((h) => `- **${h.styleName}**: ${h.textRange} (${h.resourceId})`);
      return text(`Found ${highlights.length} highlights:\n\n${lines.join("\n")}`);
    }
  );

  // ── 8. get_favorites ─────────────────────────────────────────────────────
  server.tool("get_favorites", "List the user's saved favorites/bookmarks in Logos",
    { limit: z.number().optional().describe("Max favorites to return (default: 30)") },
    async ({ limit }) => {
      const favorites = getFavorites(limit ?? 30);
      if (favorites.length === 0) return text("No favorites found.");
      const lines = favorites.map((f) => `- **${f.title}** → ${f.appCommand}`);
      return text(`Found ${favorites.length} favorites:\n\n${lines.join("\n")}`);
    }
  );

  // ── 9. get_reading_progress ──────────────────────────────────────────────
  server.tool("get_reading_progress", "Show the user's reading plan progress from Logos",
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
  server.tool("open_word_study", "Open a word study in Logos for a Greek, Hebrew, or English word",
    { word: z.string().describe("The word to study (e.g., 'agape', 'hesed', 'justification')") },
    async ({ word }) => {
      const result = await openWordStudy(word);
      return result.success ? text(`Opened word study for "${word}" in Logos.`) : err(`Failed to open word study: ${result.error}`);
    }
  );

  // ── 11. open_factbook ────────────────────────────────────────────────────
  server.tool("open_factbook", "Open the Logos Factbook for a person, place, event, or topic",
    { topic: z.string().describe("The topic to look up (e.g., 'Moses', 'Jerusalem', 'Passover')") },
    async ({ topic }) => {
      const result = await openFactbook(topic);
      return result.success ? text(`Opened Factbook entry for "${topic}" in Logos.`) : err(`Failed to open Factbook: ${result.error}`);
    }
  );

  // ── 12. get_study_workflows ──────────────────────────────────────────────
  server.tool("get_study_workflows", "List available study workflow templates and active instances from Logos",
    { include_instances: z.boolean().optional().describe("Also show active workflow instances (default: true)"), instance_limit: z.number().optional().describe("Max active instances to return (default: 10)") },
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
  server.tool("get_user_sermons", "Read the user's sermon documents from Logos Bible Software",
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
        return text(`No sermons found matching criteria.\n\n**Search parameters:**\n- Title filter: ${title || "none"}\n- Date range: ${after_date || "any"} to ${before_date || "any"}\n- Liturgical season: ${liturgical_season || "none"}\n- Limit: ${limit ?? 20}`);
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

  return server;
}

async function main() {
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  if (!BIBLIA_API_KEY) {
    console.error("ERROR: BIBLIA_API_KEY environment variable is required");
    console.error("Get a free key at: https://bibliaapi.com");
    process.exit(1);
  }

  console.error(`\n=== LogosBibleMCP HTTP Server ===`);
  console.error(`Platform: ${PLATFORM}`);
  console.error(`Port: ${port}`);
  console.error(`API Key Required: ${REQUIRE_API_KEY && API_KEY ? "Yes" : "No"}`);
  console.error(`\nEndpoints:`);
  console.error(`  SSE:      http://localhost:${port}/sse`);
  console.error(`  Health:   http://localhost:${port}/health`);
  console.error(`\nAuthentication:`);
  if (REQUIRE_API_KEY && API_KEY) {
    console.error(`  Set LOGOS_MCP_API_KEY environment variable to enable auth`);
    console.error(`  Clients must include: Authorization: Bearer <your-key>`);
  } else {
    console.error(`  No authentication required (set LOGOS_MCP_API_KEY to enable)`);
  }
  console.error(`\nTo tunnel with ngrok:`);
  console.error(`  ngrok http ${port}`);
  console.error(`\nTo connect from mcporter:`);
  console.error(`  mcporter config add logos --url https://your-tunnel.ngrok.io/sse --header "Authorization: Bearer <your-key>"`);
  console.error("");

  const server = await createMcpServer();
  let transport: SSEServerTransport | null = null;

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Health check - no auth required
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", name: SERVER_NAME, version: SERVER_VERSION }));
      return;
    }

    // Check authentication for all other endpoints
    if (!checkAuth(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized. Include Authorization: Bearer <your-api-key>" }));
      return;
    }

    if (url.pathname === "/sse" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      transport = new SSEServerTransport("/message", res);
      await server.connect(transport);
      req.on("close", () => { transport = null; });
    } else if (url.pathname === "/message" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        if (transport) {
          await transport.handlePostMessage(req, res, body);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No active SSE connection" }));
        }
      });
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  httpServer.listen(port, host, () => {
    console.error(`Server listening on http://${host}:${port}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});