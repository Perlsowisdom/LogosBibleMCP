import { homedir } from "os";
import { join } from "path";
import { platform } from "os";
import { existsSync } from "fs";
import { readdirSync } from "fs";

// ─── Platform Detection ───────────────────────────────────────────────────────

const isWindows = platform() === "win32";
const isMac = platform() === "darwin";

// ─── Logos Data Paths ────────────────────────────────────────────────────────

function findLogosDataDir(): string {
  // Allow override via environment variable
  if (process.env.LOGOS_DATA_DIR) {
    return process.env.LOGOS_DATA_DIR;
  }

  if (isMac) {
    // macOS: ~/Library/Application Support/Logos4/Documents/[random-id]
    const logos4Path = join(
      homedir(),
      "Library",
      "Application Support",
      "Logos4",
      "Documents"
    );
    if (existsSync(logos4Path)) {
      const dirs = readdirSync(logos4Path, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.match(/^[a-z0-9]+\.[a-z0-9]+$/i));
      if (dirs.length > 0) {
        return join(logos4Path, dirs[0].name);
      }
    }
  }

  if (isWindows) {
    // Windows: Check both possible paths
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    
    // Try: %LOCALAPPDATA%\Logos\Documents\[random-id] (newer/some installs)
    const logosPath1 = join(localAppData, "Logos", "Documents");
    if (existsSync(logosPath1)) {
      const dirs = readdirSync(logosPath1, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.match(/^[a-z0-9]+\.[a-z0-9]+$/i));
      if (dirs.length > 0) {
        return join(logosPath1, dirs[0].name);
      }
    }
    
    // Try: %LOCALAPPDATA%\Logos\Logos\Documents\[random-id] (older installs)
    const logosPath2 = join(localAppData, "Logos", "Logos", "Documents");
    if (existsSync(logosPath2)) {
      const dirs = readdirSync(logosPath2, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.match(/^[a-z0-9]+\.[a-z0-9]+$/i));
      if (dirs.length > 0) {
        return join(logosPath2, dirs[0].name);
      }
    }
  }

  // Fallback - will show error if databases aren't found
  return "";
}

export const LOGOS_DATA_DIR = findLogosDataDir();

export const DB_PATHS = {
  visualMarkup: join(LOGOS_DATA_DIR, "VisualMarkup", "visualmarkup.db"),
  favorites: join(LOGOS_DATA_DIR, "FavoritesManager", "favorites.db"),
  workflows: join(LOGOS_DATA_DIR, "Workflows", "Workflows.db"),
  readingLists: join(LOGOS_DATA_DIR, "ReadingLists", "ReadingLists.db"),
  shortcuts: join(LOGOS_DATA_DIR, "ShortcutsManager", "shortcuts.db"),
  guides: join(LOGOS_DATA_DIR, "Guides", "guides.db"),
  notes: join(LOGOS_DATA_DIR, "NotesToolManager", "notestool.db"),
  clippings: join(LOGOS_DATA_DIR, "Documents", "Clippings", "Clippings.db"),
  passageLists: join(LOGOS_DATA_DIR, "Documents", "PassageList", "PassageList.db"),
  sermons: join(LOGOS_DATA_DIR, "Sermons", "sermons.db"),
} as const;

// ─── Biblia API ──────────────────────────────────────────────────────────────

export const BIBLIA_API_KEY = process.env.BIBLIA_API_KEY ?? "";
export const BIBLIA_API_BASE = "https://api.biblia.com/v1/bible";
export const DEFAULT_BIBLE = "LEB";

// ─── Logos URL Schemes ───────────────────────────────────────────────────────

export const LOGOS_URL_BASE = "logos4:";

// ─── Platform Info ───────────────────────────────────────────────────────────

export const PLATFORM = {
  isWindows,
  isMac,
  isLinux: !isWindows && !isMac,
};

// ─── Server Info ─────────────────────────────────────────────────────────────

export const SERVER_NAME = "logos-bible";
export const SERVER_VERSION = "1.0.0";
