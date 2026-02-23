#!/usr/bin/env node
import { existsSync } from "fs";
import { LOGOS_DATA_DIR, DB_PATHS } from "./config.js";
import {
  listTables,
  listColumns,
  getTableSample,
} from "./services/sqlite-reader.js";
import { getUserSermons } from "./services/sqlite-reader.js";
import Database from "better-sqlite3";

function runDiagnose() {
  const sections: string[] = [];

  sections.push(`**Logos Data Directory**: \`${LOGOS_DATA_DIR || "(not found)"}\``);
  sections.push("");

  sections.push("**Database Status:**");

  for (const [name, path] of Object.entries(DB_PATHS)) {
    if (!existsSync(path)) {
      sections.push(`- **${name}**: ✗ Not found`);
      sections.push(`  Path: \`${path}\``);
      continue;
    }

    sections.push(`- **${name}**: ✓ Found`);
    sections.push(`  Path: \`${path}\``);

    const tables = listTables(path);
    sections.push(`  Tables: ${tables.join(", ") || "(none)"}`);

    // For sermons, show row count and sample
    if (name === "sermons" && tables.includes("Documents")) {
      try {
        const sample = getTableSample(path, "Documents");
        sections.push(`  **Documents table: ${sample.count} rows**`);
        if (sample.sample) {
          const keys = Object.keys(sample.sample).slice(0, 5);
          const preview = keys
            .map((k) => `${k}=${String(sample.sample![k]).substring(0, 30)}`)
            .join(", ");
          sections.push(`  Sample: ${preview}...`);
        }
      } catch (e) {
        sections.push(`  **Error reading Documents table: ${String(e)}**`);
      }
    }
  }

  console.log(sections.join("\n"));
}

function runDiagnoseRaw() {
  console.log(`**Logos Data Directory**: \`${LOGOS_DATA_DIR || "(not found)"}\``);
  console.log("");
  
  const sermonsPath = DB_PATHS.sermons;
  if (!existsSync(sermonsPath)) {
    console.log("**sermons**: ✗ Not found");
    return;
  }
  
  console.log("**Sermon.db Analysis**\n");
  console.log(`Path: \`${sermonsPath}\`\n`);
  
  const tables = listTables(sermonsPath);
  console.log(`Tables: ${tables.join(", ")}\n`);
  
  if (!tables.includes("Documents")) {
    console.log("No Documents table found.");
    return;
  }
  
  const columns = listColumns(sermonsPath, "Documents");
  console.log(`**Documents table columns (${columns.length}):**`);
  columns.forEach(c => console.log(`  - ${c}`));
  console.log("");
  
  // Query sample row with all columns
  const db = new Database(sermonsPath, { readonly: true });
  try {
    const count = db.prepare("SELECT COUNT(*) as count FROM Documents WHERE IsDeleted = 0").get() as { count: number };
    console.log(`**Row count (IsDeleted=0):** ${count.count}\n`);
    
    if (count.count > 0) {
      const sample = db.prepare("SELECT * FROM Documents WHERE IsDeleted = 0 LIMIT 1").get() as Record<string, unknown>;
      console.log("**Sample row (all columns):**\n");
      for (const [key, value] of Object.entries(sample)) {
        const displayValue = value === null ? "NULL" : 
          typeof value === "string" && value.length > 200 ? value.substring(0, 200) + "..." : 
          String(value);
        console.log(`  ${key}: ${displayValue}`);
      }
      
      // Check what columns getUserSermons expects
      console.log("\n**getUserSermons expects these columns:**");
      const expectedCols = ["Id", "ExternalId", "Title", "Notes", "Date", "ModifiedDate", "AuthorName", "Series", "TagsJson", "IsDeleted"];
      expectedCols.forEach(c => {
        const exists = columns.includes(c);
        console.log(`  ${c}: ${exists ? "✓" : "✗ MISSING"}`);
      });
      
      // Show what title-like columns exist
      console.log("\n**Columns that might contain title:**");
      const titleLike = columns.filter(c => c.toLowerCase().includes("title") || c.toLowerCase().includes("name"));
      titleLike.forEach(c => console.log(`  - ${c}`));
      
      // Show what content-like columns exist
      console.log("\n**Columns that might contain content:**");
      const contentLike = columns.filter(c => c.toLowerCase().includes("note") || c.toLowerCase().includes("content") || c.toLowerCase().includes("text") || c.toLowerCase().includes("body"));
      contentLike.forEach(c => console.log(`  - ${c}`));
    }
  } finally {
    db.close();
  }
}

function runDiagnoseBlocks() {
  console.log(`**Logos Data Directory**: \`${LOGOS_DATA_DIR || "(not found)"}\``);
  console.log("");
  
  const sermonsPath = DB_PATHS.sermons;
  if (!existsSync(sermonsPath)) {
    console.log("**sermons**: ✗ Not found");
    return;
  }
  
  console.log("**Blocks Table Analysis**\n");
  console.log(`Path: \`${sermonsPath}\`\n`);
  
  const db = new Database(sermonsPath, { readonly: true });
  try {
    // Check Blocks table exists
    const tables = listTables(sermonsPath);
    if (!tables.includes("Blocks")) {
      console.log("No Blocks table found.");
      return;
    }
    
    const columns = listColumns(sermonsPath, "Blocks");
    console.log(`**Blocks table columns (${columns.length}):**`);
    columns.forEach(c => console.log(`  - ${c}`));
    console.log("");
    
    // Count blocks
    const count = db.prepare("SELECT COUNT(*) as count FROM Blocks").get() as { count: number };
    console.log(`**Total blocks:** ${count.count}\n`);
    
    // Show block kinds (not Type)
    const kinds = db.prepare("SELECT DISTINCT Kind FROM Blocks LIMIT 20").all() as Array<{ Kind: string }>;
    console.log(`**Block kinds:** ${kinds.map(k => k.Kind).join(", ")}\n`);
    
    // Get a sample block with content
    const sample = db.prepare(`
      SELECT * FROM Blocks 
      WHERE Content IS NOT NULL AND Content != '' 
      LIMIT 1
    `).get() as Record<string, unknown> | undefined;
    
    if (sample) {
      console.log("**Sample block with content:**\n");
      for (const [key, value] of Object.entries(sample)) {
        const displayValue = value === null ? "NULL" : 
          typeof value === "string" && value.length > 300 ? value.substring(0, 300) + "..." : 
          String(value);
        console.log(`  ${key}: ${displayValue}`);
      }
    }
    
    // Show blocks for first sermon
    const firstSermon = db.prepare("SELECT Id, Title, ExternalId FROM Documents WHERE IsDeleted = 0 LIMIT 1").get() as { Id: number; Title: string; ExternalId: string } | undefined;
    if (firstSermon) {
      console.log(`\n**Blocks for sermon "${firstSermon.Title}" (Id=${firstSermon.Id}):**\n`);
      const sermonBlocks = db.prepare(`
        SELECT Id, Kind, Rank, LENGTH(Content) as ContentLength 
        FROM Blocks 
        WHERE DocumentId = ? 
        ORDER BY Rank
      `).all(firstSermon.Id) as Array<{ Id: number; Kind: string; Rank: number; ContentLength: number }>;
      
      sermonBlocks.forEach(b => {
        console.log(`  Block ${b.Id}: Kind="${b.Kind}", Rank=${b.Rank}, ContentLength=${b.ContentLength}`);
      });
    }
    
  } finally {
    db.close();
  }
}

function runTestSermons() {
  console.log("**Testing getUserSermons**\n");
  
  const sermons = getUserSermons({ limit: 3 });
  
  if (sermons.length === 0) {
    console.log("No sermons found.");
    return;
  }
  
  console.log(`Found ${sermons.length} sermons:\n`);
  
  for (const s of sermons) {
    console.log(`### ${s.title}`);
    console.log(`Author: ${s.author || "Unknown"}`);
    console.log(`Date: ${s.modifiedDate || s.createdDate || "Unknown"}`);
    console.log(`Series: ${s.series || "None"}`);
    console.log(`Content length: ${s.content?.length || 0} chars`);
    console.log(`Content preview: ${s.content?.substring(0, 200) || "(no content)"}...`);
    console.log("");
  }
}

const command = process.argv[2];

if (command === "diagnose") {
  runDiagnose();
} else if (command === "diagnose-raw") {
  runDiagnoseRaw();
} else if (command === "diagnose-blocks") {
  runDiagnoseBlocks();
} else if (command === "test-sermons") {
  runTestSermons();
} else {
  console.log(`Logos MCP CLI

Usage: logos-mcp-server <command>

Commands:
  diagnose        Check Logos data directory and database availability
  diagnose-raw    Show detailed Documents table structure for debugging
  diagnose-blocks Show Blocks table structure (where actual content lives)
  test-sermons    Test getUserSermons function and show sample output
`);
  process.exit(1);
}
