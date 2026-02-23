# Development Guide

## CLI Tools

```bash
# Diagnose Logos data directory
logos-diagnose diagnose

# Show detailed database info
logos-diagnose diagnose-raw

# Show Blocks table (sermon content)
logos-diagnose diagnose-blocks

# Test sermon retrieval
logos-diagnose test-sermons liturgical_season:"lent" year:2025
```

---

## Development

```bash
npm run dev        # Run with hot reload
npm test           # Run tests
npm run build      # Build to dist/
```

---

## Troubleshooting

### "No sermons found"

1. Ensure Logos is installed and has been run
2. Check that sermons are synced locally (open Logos, go to Documents → Sermons)
3. Run `logos-diagnose diagnose` to verify database location

### "Database not found"

Set the `LOGOS_DATA_DIR` environment variable to your Logos data folder:

```bash
# Windows
set LOGOS_DATA_DIR=C:\Users\YourName\AppData\Local\Logos\Documents\abc123.efg

# macOS
export LOGOS_DATA_DIR=~/Library/Application Support/Logos4/Data/abc123.efg
```

### MCP client shows old tool definitions

1. Pull latest changes: `git pull`
2. Rebuild: `npm run build`
3. Restart your MCP client
