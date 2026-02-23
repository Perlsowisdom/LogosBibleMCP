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

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

function err(s: string) {
  return { content: [{ type: "text" as const, text: s }], isError: true as const };
}

async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  // Register all tools (same as index.ts)
  server.tool("navigate_passage", "Open a Bible passage in Logos", 
    { reference: z.string().describe("Bible reference") },
    async ({ reference }) => {
      const result = await navigateToPassage(reference);
      return result.success ? text(`Opened ${reference} in Logos.`) : err(`Failed: ${result.error}`);
    }
  );

  server.tool("get_bible_text", "Retrieve Bible passage text",
    { passage: z.string().describe("Bible reference"), bible: z.string().optional() },
    async ({ passage, bible }) => {
      const result = await getBibleText(passage, bible);
      return text(`**${result.passage}** (${result.bible})\n\n${result.text}`);
    }
  );

  server.tool("get_passage_context", "Get passage with surrounding verses",
    { passage: z.string(), context_verses: z.number().optional(), bible: z.string().optional() },
    async ({ passage, context_verses, bible }) => {
      const expanded = expandRange(passage, context_verses ?? 5);
      const result = await getBibleText(expanded, bible);
      return text(`**${result.passage}** (${result.bible})\n\n${result.text}`);
    }
  );

  server.tool("search_bible", "Search Bible text",
    { query: z.string(), limit: z.number().optional(), bible: z.string().optional() },
    async ({ query, limit, bible }) => {
      const result = await searchBible(query, { limit, bible });
      if (result.resultCount === 0) return text(`No results for "${query}".`);
      const lines = result.results.map((r) => `**${r.title}**: ${r.preview}`);
      return text(`Found ${result.resultCount} results:\n\n${lines.join("\n\n")}`);
    }
  );

  server.tool("get_cross_references", "Find cross-references",
    { passage: z.string(), key_terms: z.string().optional() },
    async ({ passage, key_terms }) => {
      let searchQuery = key_terms;
      if (!searchQuery) {
        const passageResult = await getBibleText(passage);
        const stopWords = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","shall","that","this","these","those","it","its","he","she","they","them","his","her","their","not","no","nor","as","if","then","than","so","all","who","which","what","when","where","how","i","me","my","we","us","you","your","him","up","out","into","upon"]);
        const words = passageResult.text.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase())).slice(0, 5);
        searchQuery = words.join(" ");
      }
      const results = await searchBible(searchQuery!, { limit: 15 });
      if (results.resultCount === 0) return text(`No cross-references for ${passage}.`);
      const lines = results.results.map((r) => `**${r.title}**: ${r.preview}`);
      return text(`Cross-references for **${passage}**:\n\n${lines.join("\n\n")}`);
    }
  );

  server.tool("get_user_notes", "Read study notes from Logos",
    { notebook_title: z.string().optional(), limit: z.number().optional() },
    async ({ notebook_title, limit }) => {
      const notes = getUserNotes({ notebookTitle: notebook_title, limit: limit ?? 20 });
      if (notes.length === 0) return text("No notes found.");
      const lines = notes.map((n) => {
        const header = n.notebookTitle ? `[${n.notebookTitle}]` : "[No notebook]";
        const content = n.content ? n.content.substring(0, 300) : "(no content)";
        return `${header}\n${content}`;
      });
      return text(`Found ${notes.length} notes:\n\n${lines.join("\n\n---\n\n")}`);
    }
  );

  server.tool("get_user_highlights", "Read highlights from Logos",
    { resource_id: z.string().optional(), style_name: z.string().optional(), limit: z.number().optional() },
    async ({ resource_id, style_name, limit }) => {
      const highlights = getUserHighlights({ resourceId: resource_id, styleName: style_name, limit: limit ?? 50 });
      if (highlights.length === 0) return text("No highlights found.");
      const lines = highlights.map((h) => `- **${h.styleName}**: ${h.textRange}`);
      return text(`Found ${highlights.length} highlights:\n\n${lines.join("\n")}`);
    }
  );

  server.tool("get_user_sermons", "Read sermon documents from Logos",
    { title: z.string().optional(), limit: z.number().optional() },
    async ({ title, limit }) => {
      const sermons = getUserSermons({ title, limit: limit ?? 20 });
      if (sermons.length === 0) return text("No sermons found.");
      const lines = sermons.map((s) => {
        const content = s.content ? s.content.substring(0, 500) : "(no content)";
        return `**${s.title}**\n${content}`;
      });
      return text(`Found ${sermons.length} sermons:\n\n${lines.join("\n\n---\n\n")}`);
    }
  );

  server.tool("get_favorites", "List favorites from Logos",
    { limit: z.number().optional() },
    async ({ limit }) => {
      const favorites = getFavorites(limit ?? 30);
      if (favorites.length === 0) return text("No favorites found.");
      const lines = favorites.map((f) => `- **${f.title}**`);
      return text(`Found ${favorites.length} favorites:\n\n${lines.join("\n")}`);
    }
  );

  server.tool("get_reading_progress", "Show reading plan progress",
    {},
    async () => {
      const progress = getReadingProgress();
      return text(`**Overall**: ${progress.completedItems}/${progress.totalItems} (${progress.percentComplete}%)`);
    }
  );

  server.tool("open_word_study", "Open word study in Logos",
    { word: z.string() },
    async ({ word }) => {
      const result = await openWordStudy(word);
      return result.success ? text(`Opened word study for "${word}".`) : err(`Failed: ${result.error}`);
    }
  );

  server.tool("open_factbook", "Open Factbook in Logos",
    { topic: z.string() },
    async ({ topic }) => {
      const result = await openFactbook(topic);
      return result.success ? text(`Opened Factbook for "${topic}".`) : err(`Failed: ${result.error}`);
    }
  );

  server.tool("get_study_workflows", "List workflow templates",
    { include_instances: z.boolean().optional(), instance_limit: z.number().optional() },
    async ({ include_instances, instance_limit }) => {
      const templates = getWorkflowTemplates();
      const lines = templates.map((t) => `- **${t.title}**`);
      return text(`## Workflow Templates\n\n${lines.join("\n") || "None found."}`);
    }
  );

  server.tool("open_logos_app", "Open Logos Bible Software",
    {},
    async () => {
      const result = await openLogosApp();
      return result.success ? text("Opened Logos Bible Software.") : err(`Failed: ${result.error}`);
    }
  );

  return server;
}

async function main() {
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  if (!BIBLIA_API_KEY) {
    console.error("ERROR: BIBLIA_API_KEY environment variable is required");
    console.error("Set it with: set BIBLIA_API_KEY=your_key_here");
    process.exit(1);
  }

  console.error(`\n=== LogosBibleMCP SSE Server ===`);
  console.error(`Platform: ${PLATFORM}`);
  console.error(`Port: ${port}`);
  console.error(`\nEndpoints:`);
  console.error(`  SSE:      http://localhost:${port}/sse`);
  console.error(`  Health:   http://localhost:${port}/health`);
  console.error(`\nTo tunnel with ngrok:`);
  console.error(`  ngrok http ${port}`);
  console.error(`\nTo connect from mcporter:`);
  console.error(`  mcporter config add logos --url https://your-tunnel.ngrok.io/sse`);
  console.error("");

  const server = await createMcpServer();
  let transport: SSEServerTransport | null = null;

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

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
    } else if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", name: SERVER_NAME, version: SERVER_VERSION }));
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
