import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import { toLogosUrlRef } from "./reference-parser.js";
import type { LogosCommandResult } from "../types.js";

const execFileAsync = promisify(execFile);
const isWindows = platform() === "win32";
const isMac = platform() === "darwin";

async function openUrl(url: string): Promise<LogosCommandResult> {
  try {
    if (isWindows) {
      // Windows: use 'start' command
      // The empty string argument is required for the title parameter
      await execFileAsync("cmd", ["/c", "start", '""', url]);
    } else if (isMac) {
      // macOS: use 'open' command
      await execFileAsync("open", [url]);
    } else {
      // Linux: try xdg-open
      await execFileAsync("xdg-open", [url]);
    }
    return { success: true, command: url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, command: url, error: msg };
  }
}

export async function navigateToPassage(reference: string): Promise<LogosCommandResult> {
  const logosRef = toLogosUrlRef(reference);
  return openUrl(`logos4:///Bible/${logosRef}`);
}

export async function searchBibleInLogos(query: string): Promise<LogosCommandResult> {
  const encoded = encodeURIComponent(query);
  return openUrl(`logos4:///Search?type=Bible&q=${encoded}`);
}

export async function openWordStudy(word: string): Promise<LogosCommandResult> {
  const encoded = encodeURIComponent(word);
  return openUrl(`logos4:///WordStudy?word=${encoded}`);
}

export async function openFactbook(topic: string): Promise<LogosCommandResult> {
  const encoded = encodeURIComponent(topic);
  return openUrl(`logos4:///Factbook?ref=${encoded}`);
}

export async function isLogosRunning(): Promise<boolean> {
  try {
    if (isWindows) {
      // Windows: use tasklist to check for Logos process
      const { stdout } = await execFileAsync("tasklist", ["/FI", "IMAGENAME eq Logos.exe", "/NH"]);
      return stdout.toLowerCase().includes("logos.exe");
    } else if (isMac) {
      // macOS: use AppleScript
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        'tell application "System Events" to (name of processes) contains "Logos"',
      ]);
      return stdout.trim() === "true";
    } else {
      // Linux: check for Logos process (if running via Wine)
      const { stdout } = await execFileAsync("pgrep", ["-x", "Logos"]);
      return stdout.trim().length > 0;
    }
  } catch {
    return false;
  }
}

export async function openLogosApp(): Promise<LogosCommandResult> {
  try {
    if (isWindows) {
      await execFileAsync("cmd", ["/c", "start", '""', "logos4:"]);
      return { success: true, command: "openLogosApp" };
    } else if (isMac) {
      await execFileAsync("open", ["-a", "Logos"]);
      return { success: true, command: "openLogosApp" };
    } else {
      // Linux: try opening the URL scheme
      return openUrl("logos4:");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, command: "openLogosApp", error: msg };
  }
}
