# LogosBibleMCP

MCP server for Logos Bible Software integration. Provides tools for Bible study, sermon research, and accessing your Logos data.

## Features

- **Bible Text Retrieval**: Get passages with the Biblia API
- **Sermon Access**: Read your sermon documents from Logos Sermon Builder
- **Liturgical Filtering**: Filter sermons by season (Advent, Lent, Easter, etc.)
- **Notes & Highlights**: Access your study notes and highlights
- **Logos Integration**: Open passages, word studies, and Factbook in Logos

## Installation

### Prerequisites

- Node.js 18+
- Logos Bible Software (Windows/macOS)
- Biblia API key (free at [bibliaapi.com](https://bibliaapi.com))

### Setup

```bash
cd logos-mcp-server
npm install
npm run build
npm link  # Makes logos-mcp-server available globally
```

### Configure MCP Client

Add to your MCP client config (Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "logos": {
      "command": "logos-mcp-server",
      "env": {
        "BIBLIA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Tools

### Bible Study

| Tool | Description |
|------|-------------|
| `get_bible_text` | Retrieve Bible passage text |
| `get_passage_context` | Get passage with surrounding verses |
| `search_bible` | Search Bible for terms |
| `get_cross_references` | Find related verses |
| `navigate_passage` | Open passage in Logos UI |

### Sermon Research

| Tool | Description |
|------|-------------|
| `get_user_sermons` | Read sermon documents from Logos |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Partial title match |
| `after_date` | string | Start date (ISO: `YYYY-MM-DD`) |
| `before_date` | string | End date (ISO: `YYYY-MM-DD`) |
| `liturgical_season` | string | `advent` `christmas` `epiphany` `lent` `holy_week` `easter` `pentecost` `ordinary` |
| `year` | number | Year for liturgical season calculation |
| `limit` | number | Max results (default: 20) |

### User Data

| Tool | Description |
|------|-------------|
| `get_user_notes` | Read study notes |
| `get_user_highlights` | Read highlights |
| `get_favorites` | List bookmarks |
| `get_reading_progress` | Show reading plan progress |

### Logos Integration

| Tool | Description |
|------|-------------|
| `open_word_study` | Open word study in Logos |
| `open_factbook` | Open Factbook entry |
| `get_study_workflows` | List workflow templates |

## Documentation

- **[Development Guide](dev/README.md)** - CLI tools, HTTP tunneling, troubleshooting

## License

MIT
