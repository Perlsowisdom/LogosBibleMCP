#!/usr/bin/env node
import { existsSync } from "fs";
import { LOGOS_DATA_DIR, DB_PATHS } from "./config.js";
import {
  listTables,
  listColumns,
  getTableSample,
} from "./services/sqlite-reader.js";

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

const command = process.argv[2];

if (command === "diagnose") {
  runDiagnose();
} else {
  console.log(`Logos MCP CLI

Usage: logos-mcp-server <command>

Commands:
  diagnose    Check Logos data directory and database availability
`);
  process.exit(1);
}
