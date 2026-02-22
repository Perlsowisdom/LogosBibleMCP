import { execFile } from "child_process";
import { promisify } from "util";
import { toLogosUrlRef } from "./reference-parser.js";
import type { LogosCommandResult } from "../types.js";

const execFileAsync = promisify(execFile);

async function openUrl(url: string): Promise<LogosCommandResult> {
  try {
    await execFileAsync("open", [url]);
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
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'tell application "System Events" to (name of processes) contains "Logos"',
    ]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}
