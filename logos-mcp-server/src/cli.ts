#!/usr/bin/env node
import { existsSync } from "fs";
import { LOGOS_DATA_DIR, DB_PATHS } from "./config.js";
import {
  listTables,
  listColumns,
  getTableSample,
} from "./services/sqlite-reader.js";
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

const command = process.argv[2];

if (command === "diagnose") {
  runDiagnose();
} else if (command === "diagnose-raw") {
  runDiagnoseRaw();
} else {
  console.log(`Logos MCP CLI

Usage: logos-mcp-server <command>

Commands:
  diagnose       Check Logos data directory and database availability
  diagnose-raw   Show detailed Documents table structure for debugging
`);
  process.exit(1);
}
