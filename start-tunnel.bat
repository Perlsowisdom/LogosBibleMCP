@echo off
REM LogosBibleMCP Tunnel Startup Script for Windows
REM This script starts the MCP server with tunneling enabled

SET BIBLIA_API_KEY=1fb84969450248a49fe2812d3c60b182

echo Starting LogosBibleMCP with tunnel...
echo.
echo Your Biblia API key is set.
echo.
echo Running: npx @anthropic-ai/mcp-tunnel node dist/index.js
echo.

cd /d "%~dp0logos-mcp-server"
npx @anthropic-ai/mcp-tunnel node dist/index.js

pause