# Logos Bible Software MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that connects AI assistants to [Logos Bible Software](https://www.logos.com/), with cross-platform support for Windows and macOS.

## What This Does

- **12 MCP tools** that let AI assistants read Bible text, search Scripture, navigate Logos, access your notes/highlights/favorites, check reading plans, and explore word studies and factbook entries
- **Cross-platform support** - Works on Windows and macOS
- **Biblia API integration** - Fetch Bible text and search via free REST API

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Windows or macOS** | Windows 10/11 or macOS 10.15+ |
| **Logos Bible Software** | Installed (tested with v48+) |
| **Node.js** | v18+ (v20+ recommended) |
| **Biblia API Key** | Free key from [bibliaapi.com](https://bibliaapi.com/) |

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Perlsowisdom/LogosBibleMCP.git
cd LogosBibleMCP
```

### 2. Install dependencies and build

```bash
cd logos-mcp-server
npm install
npm run build
cd ..
```

### 3. Get a Biblia API key

1. Go to [bibliaapi.com](https://bibliaapi.com/)
2. Sign up for a free account
3. Copy your API key

### 4. Configure environment variables

Create a `.env` file in the project root:

```
BIBLIA_API_KEY=your_api_key_here
```

Or set the `BIBLIA_API_KEY` environment variable in your MCP client configuration.

### 5. Configure MCP client

Add to your MCP client configuration (e.g., Claude Desktop, Cline, etc.):

**Windows:**
```json
{
  "mcpServers": {
    "logos": {
      "command": "node",
      "args": ["C:/path/to/LogosBibleMCP/logos-mcp-server/dist/index.js"],
      "env": {
        "BIBLIA_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**macOS:**
```json
{
  "mcpServers": {
    "logos": {
      "command": "node",
      "args": ["/path/to/LogosBibleMCP/logos-mcp-server/dist/index.js"],
      "env": {
        "BIBLIA_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

| Tool | What it does |
|------|-------------|
| `navigate_passage` | Opens a passage in the Logos UI |
| `get_bible_text` | Retrieves passage text (LEB default; also KJV, ASV, DARBY, YLT, WEB) |
| `get_passage_context` | Gets a passage with surrounding verses for context |
| `search_bible` | Searches Bible text for words, phrases, or topics |
| `get_cross_references` | Finds related passages by extracting key terms |
| `get_user_notes` | Reads your study notes from Logos |
| `get_user_highlights` | Reads your highlights and visual markup |
| `get_user_sermons` | Reads your sermon documents from Logos |
| `get_favorites` | Lists your saved favorites/bookmarks |
| `get_reading_progress` | Shows your reading plan status |
| `open_word_study` | Opens a word study in Logos (Greek/Hebrew/English) |
| `open_factbook` | Opens a Factbook entry for a person, place, or topic |
| `get_study_workflows` | Lists available study workflow templates and active instances |

## Project Structure

```
LogosBibleMCP/
├── logos-mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                   # MCP server entry point (12 tools)
│   │   ├── config.ts                  # Cross-platform paths, API config
│   │   ├── types.ts                   # Shared TypeScript types
│   │   └── services/
│   │       ├── reference-parser.ts    # Bible reference normalization
│   │       ├── biblia-api.ts          # Biblia.com REST API client
│   │       ├── logos-app.ts           # Cross-platform URL scheme handling
│   │       └── sqlite-reader.ts       # Read-only Logos SQLite access
│   └── dist/                          # Built output (after npm run build)
```

## How It Works

The MCP server integrates with Logos through three channels:

- **Biblia API** - Retrieves Bible text and search results via the free REST API from Faithlife
- **URL schemes** - Opens passages, word studies, and factbook entries directly in Logos using `logos4:///` URLs
- **SQLite databases** - Reads your personal data (notes, highlights, favorites, workflows, reading plans) directly from Logos local database files (read-only, never modifies your data)

## Logos Data Paths

The server auto-detects your Logos data directory:

**Windows:**
```
%LOCALAPPDATA%\Logos\Logos\Documents\[random-id]\
```

**macOS:**
```
~/Library/Application Support/Logos4/Documents/[random-id]/
```

If auto-detection fails, set the `LOGOS_DATA_DIR` environment variable:

```json
{
  "mcpServers": {
    "logos": {
      "env": {
        "BIBLIA_API_KEY": "your_key",
        "LOGOS_DATA_DIR": "C:/Users/YourName/AppData/Local/Logos/Logos/Documents/xxxxx"
      }
    }
  }
}
```

## Finding Your Logos Data Directory

**Windows:**
```powershell
dir "%LOCALAPPDATA%\Logos\Logos\Documents" /b
```

**macOS:**
```bash
find ~/Library/Application\ Support/Logos4/Documents -maxdepth 1 -type d
```

## Platform-Specific Features

| Feature | Windows | macOS |
|---------|---------|-------|
| Bible text via Biblia API | ✅ | ✅ |
| Search via Biblia API | ✅ | ✅ |
| Open passages in Logos | ✅ | ✅ |
| Open word studies | ✅ | ✅ |
| Open Factbook | ✅ | ✅ |
| Read notes/highlights | ✅ | ✅ |
| Read favorites | ✅ | ✅ |
| Read workflows | ✅ | ✅ |
| Check if Logos running | ✅ | ✅ |

## Troubleshooting

**"BIBLIA_API_KEY is not set"** - Make sure your environment includes the API key.

**"Database not found"** - Your Logos data path differs from the expected location. Set `LOGOS_DATA_DIR` manually.

**Logos doesn't open passages** - Make sure Logos Bible Software is running before using navigation tools.

**Windows: "start command failed"** - Ensure Logos is properly installed and the `logos4:` URL scheme is registered.

## License

MIT

## Remote Access (Tunnel)

To access your local Logos MCP from Zo or other remote clients:

### 1. Start the SSE Server

```powershell
cd LogosBibleMCP\logos-mcp-server
$env:BIBLIA_API_KEY="1fb84969450248a49fe2812d3c60b182"
npm run build
npm run start:sse
```

This starts an HTTP server at `http://localhost:3000` with endpoints:
- `/sse` - SSE endpoint for MCP connections
- `/health` - Health check

### 2. Create a Tunnel with ngrok

1. Install ngrok: `winget install ngrok.ngrok`
2. Sign up at [ngrok.com](https://ngrok.com) and get your auth token
3. Configure: `ngrok config add-authtoken YOUR_TOKEN`
4. Create tunnel: `ngrok http 3000`

ngrok will display a URL like `https://abc123.ngrok.io`.

### 3. Connect from Zo

Once you have the tunnel URL, configure mcporter:

```bash
mcporter config add logos --url https://your-tunnel.ngrok.io/sse
```

Or use the tunnel URL directly with any MCP client that supports SSE.

**Note:** The tunnel URL changes each time you restart ngrok (unless you have a paid plan). You'll need to update the configuration with the new URL.
