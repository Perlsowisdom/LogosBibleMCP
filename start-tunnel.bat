@echo off
REM LogosBibleMCP Tunnel Startup Script for Windows
REM This script starts the MCP HTTP server with tunneling enabled

echo === LogosBibleMCP HTTP Server with Tunneling ===
echo.

REM Check for required environment variables
if "%BIBLIA_API_KEY%"=="" (
    echo ERROR: BIBLIA_API_KEY environment variable is not set.
    echo Get a free API key at: https://bibliaapi.com
    echo.
    set /p BIBLIA_API_KEY="Enter your Biblia API key: "
)

if "%LOGOS_MCP_API_KEY%"=="" (
    echo.
    echo LOGOS_MCP_API_KEY is not set. 
    echo This key is REQUIRED for tunneling to Zo Computer.
    echo.
    set /p LOGOS_MCP_API_KEY="Enter your secret API key for tunneling: "
)

echo.
echo Configuration:
echo   BIBLIA_API_KEY: [set]
echo   LOGOS_MCP_API_KEY: [set]
echo   Port: 3000
echo.

cd /d "%~dp0logos-mcp-server"

REM Check if dist exists
if not exist "dist" (
    echo Building server...
    call npm run build
)

echo.
echo Starting HTTP server on port 3000...
echo.
echo To tunnel with ngrok:
echo   ngrok http 3000
echo.
echo Then update your mcporter config with the ngrok URL:
echo   mcporter config add logos --url https://your-tunnel.ngrok.io/sse --header "Authorization: Bearer YOUR_API_KEY"
echo.

node dist/sse-server.js

pause
