# Development Guide

## HTTP Server & Tunneling

For remote access (e.g., tunneling to Zo Computer), use the HTTP server:

### 1. Set Environment Variables

```bash
# Required
export BIBLIA_API_KEY="your-biblia-api-key"

# Required for tunneling (prevents unauthorized access)
export LOGOS_MCP_API_KEY="your-secret-key-here"
```

### 2. Start HTTP Server

```bash
npm run start:http
# or
logos-http
```

The server runs on port 3000 by default:
- SSE endpoint: `http://localhost:3000/sse`
- Health check: `http://localhost:3000/health`

### 3. Create Tunnel

Using ngrok:

```bash
ngrok http 3000
```

### 4. Configure mcporter

On Zo Computer, update your mcporter config (`/home/workspace/config/mcporter.json`):

```json
{
  "mcpServers": {
    "logos": {
      "description": "Logos Bible Software (tunneled)",
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-tunnel.ngrok.io/sse"],
      "env": {
        "LOGOS_MCP_API_KEY": "${LOGOS_MCP_API_KEY}"
      }
    }
  }
}
```

Set the API key in Zo's Settings > Advanced > Secrets:
- `LOGOS_MCP_API_KEY`: The same secret key you set on your Windows machine

### Windows Quick Start

Run `start-tunnel.bat` which will:
1. Prompt for required API keys
2. Build the server if needed
3. Start the HTTP server
4. Display tunneling instructions

---

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
