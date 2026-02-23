import Database from "better-sqlite3";
import { existsSync } from "fs";
import { DB_PATHS } from "../config.js";
import type {
  HighlightResult,
  FavoriteResult,
  WorkflowTemplate,
  WorkflowInstance,
  ReadingListStatus,
  ReadingListItem,
  ReadingProgress,
  SermonResult,
} from "../types.js";

function openDb(path: string): Database.Database {
  if (!existsSync(path)) {
    throw new Error(`Database not found: ${path}

To fix this:
1. Make sure Logos Bible Software is installed and has been run at least once
2. Set LOGOS_DATA_DIR environment variable to your Logos data folder, e.g.:
   LOGOS_DATA_DIR=C:\\Users\\YourName\\AppData\\Local\\Logos\\Documents\\abc123.efg`);
  }
  return new Database(path, { readonly: true, fileMustExist: true });
}

export function listTables(dbPath: string): string[] {
  if (!existsSync(dbPath)) {
    return [];
  }
  const db = openDb(dbPath);
  try {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
    return rows.map(r => r.name);
  } finally {
    db.close();
  }
}

export function listColumns(dbPath: string, tableName: string): string[] {
  if (!existsSync(dbPath)) {
    return [];
  }
  const db = openDb(dbPath);
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    return rows.map(r => r.name);
  } finally {
    db.close();
  }
}

export function getTableSample(dbPath: string, tableName: string): { count: number; sample: Record<string, unknown> | null } {
  if (!existsSync(dbPath)) {
    return { count: 0, sample: null };
  }
  const db = openDb(dbPath);
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
    if (count.count === 0) {
      return { count: 0, sample: null };
    }
    const sample = db.prepare(`SELECT * FROM ${tableName} LIMIT 1`).get() as Record<string, unknown>;
    return { count: count.count, sample };
  } finally {
    db.close();
  }
}

// ─── Highlights ──────────────────────────────────────────────────────────────

export function getUserHighlights(options: {
  resourceId?: string;
  styleName?: string;
  limit?: number;
} = {}): HighlightResult[] {
  const db = openDb(DB_PATHS.visualMarkup);
  try {
    let sql = "SELECT ResourceId, SavedTextRange, MarkupStyleName, SyncDate FROM Markup WHERE IsDeleted = 0";
    const params: unknown[] = [];

    if (options.resourceId) {
      sql += " AND ResourceId = ?";
      params.push(options.resourceId);
    }
    if (options.styleName) {
      sql += " AND MarkupStyleName = ?";
      params.push(options.styleName);
    }
    sql += " ORDER BY SyncDate DESC";
    if (options.limit) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      ResourceId: string;
      SavedTextRange: string;
      MarkupStyleName: string;
      SyncDate: string | null;
    }>;

    return rows.map((r) => ({
      resourceId: r.ResourceId,
      textRange: r.SavedTextRange,
      styleName: r.MarkupStyleName,
      syncDate: r.SyncDate,
    }));
  } finally {
    db.close();
  }
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export function getFavorites(limit?: number): FavoriteResult[] {
  const db = openDb(DB_PATHS.favorites);
  try {
    let sql = `
      SELECT f.Id, f.Title, f.Rank, i.AppCommand, i.ResourceId
      FROM Favorites f
      JOIN Items i ON f.Id = i.FavoriteId
      WHERE f.IsDeleted = 0
      ORDER BY f.Rank ASC
    `;
    const params: unknown[] = [];
    if (limit) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      Id: string;
      Title: string;
      Rank: number;
      AppCommand: string;
      ResourceId: string | null;
    }>;

    return rows.map((r) => ({
      id: r.Id,
      title: r.Title,
      appCommand: r.AppCommand,
      resourceId: r.ResourceId,
      rank: r.Rank,
    }));
  } finally {
    db.close();
  }
}

// ─── Workflows ───────────────────────────────────────────────────────────────

export function getWorkflowTemplates(): WorkflowTemplate[] {
  const db = openDb(DB_PATHS.workflows);
  try {
    const rows = db.prepare(`
      SELECT TemplateId, ExternalId, TemplateJson, Author, CreatedDate
      FROM Templates WHERE IsDeleted = 0
    `).all() as Array<{
      TemplateId: number;
      ExternalId: string;
      TemplateJson: string | null;
      Author: string | null;
      CreatedDate: string;
    }>;

    return rows.map((r) => {
      let parsed: Record<string, unknown> | null = null;
      if (r.TemplateJson) {
        try {
          parsed = JSON.parse(r.TemplateJson);
        } catch { /* ignore parse errors */ }
      }
      return {
        templateId: r.TemplateId,
        externalId: r.ExternalId,
        title: (parsed as Record<string, string>)?.title ?? r.ExternalId,
        author: r.Author,
        templateJson: parsed,
        createdDate: r.CreatedDate,
      };
    });
  } finally {
    db.close();
  }
}

export function getWorkflowInstances(limit: number = 20): WorkflowInstance[] {
  const db = openDb(DB_PATHS.workflows);
  try {
    const rows = db.prepare(`
      SELECT InstanceId, ExternalId, TemplateId, Key, Title,
             CurrentStep, CompletedStepsJson, SkippedStepsJson,
             CreatedDate, CompletedDate, ModifiedDate
      FROM Instances WHERE IsDeleted = 0
      ORDER BY ModifiedDate DESC LIMIT ?
    `).all(limit) as Array<{
      InstanceId: number;
      ExternalId: string;
      TemplateId: string;
      Key: string;
      Title: string;
      CurrentStep: string | null;
      CompletedStepsJson: string | null;
      SkippedStepsJson: string | null;
      CreatedDate: string;
      CompletedDate: string | null;
      ModifiedDate: string | null;
    }>;

    return rows.map((r) => ({
      instanceId: r.InstanceId,
      externalId: r.ExternalId,
      templateId: r.TemplateId,
      key: r.Key,
      title: r.Title,
      currentStep: r.CurrentStep,
      completedSteps: safeParseArray(r.CompletedStepsJson),
      skippedSteps: safeParseArray(r.SkippedStepsJson),
      createdDate: r.CreatedDate,
      completedDate: r.CompletedDate,
      modifiedDate: r.ModifiedDate,
    }));
  } finally {
    db.close();
  }
}

// ─── Reading Progress ────────────────────────────────────────────────────────

export function getReadingProgress(): ReadingProgress {
  const db = openDb(DB_PATHS.readingLists);
  try {
    const statuses = db.prepare(`
      SELECT Title, Author, Path, Status, ModifiedDate
      FROM ReadingListStatuses WHERE IsDeleted = 0
    `).all() as Array<{
      Title: string;
      Author: string;
      Path: string;
      Status: number;
      ModifiedDate: string | null;
    }>;

    const items = db.prepare(`
      SELECT ItemId, ReadingListPathNormalized, IsRead, ModifiedDate
      FROM Items
    `).all() as Array<{
      ItemId: string;
      ReadingListPathNormalized: string;
      IsRead: number;
      ModifiedDate: string | null;
    }>;

    const totalItems = items.length;
    const completedItems = items.filter((i) => i.IsRead === 1).length;

    return {
      statuses: statuses.map((s) => ({
        title: s.Title,
        author: s.Author,
        path: s.Path,
        status: s.Status,
        modifiedDate: s.ModifiedDate,
      })),
      items: items.map((i) => ({
        itemId: i.ItemId,
        readingListPath: i.ReadingListPathNormalized,
        isRead: i.IsRead === 1,
        modifiedDate: i.ModifiedDate,
      })),
      totalItems,
      completedItems,
      percentComplete: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    };
  } finally {
    db.close();
  }
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export interface NoteResult {
  noteId: number;
  externalId: string;
  content: string | null;
  createdDate: string;
  modifiedDate: string | null;
  notebookTitle: string | null;
  anchorsJson: string | null;
  tagsJson: string | null;
}

export function getUserNotes(options: {
  notebookTitle?: string;
  limit?: number;
} = {}): NoteResult[] {
  const db = openDb(DB_PATHS.notes);
  try {
    let sql = `
      SELECT n.NoteId, n.ExternalId, n.ContentRichText, n.CreatedDate,
             n.ModifiedDate, nb.Title as NotebookTitle,
             n.AnchorsJson, n.TagsJson
      FROM Notes n
      LEFT JOIN Notebooks nb ON n.NotebookExternalId = nb.ExternalId AND nb.IsDeleted = 0
      WHERE n.IsDeleted = 0 AND n.IsTrashed = 0
    `;
    const params: unknown[] = [];

    if (options.notebookTitle) {
      sql += " AND nb.Title LIKE ?";
      params.push(`%${options.notebookTitle}%`);
    }

    sql += " ORDER BY n.ModifiedDate DESC";

    if (options.limit) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      NoteId: number;
      ExternalId: string;
      ContentRichText: string | null;
      CreatedDate: string;
      ModifiedDate: string | null;
      NotebookTitle: string | null;
      AnchorsJson: string | null;
      TagsJson: string | null;
    }>;

    return rows.map((r) => ({
      noteId: r.NoteId,
      externalId: r.ExternalId,
      content: r.ContentRichText,
      createdDate: r.CreatedDate,
      modifiedDate: r.ModifiedDate,
      notebookTitle: r.NotebookTitle,
      anchorsJson: r.AnchorsJson,
      tagsJson: r.TagsJson,
    }));
  } finally {
    db.close();
  }
}

// ─── Sermons ────────────────────────────────────────────────────────────────

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#xA;': '\n',
  };
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#xA;/g, (match) => entities[match] || match);
}

/**
 * Strip HTML tags from Logos sermon content
 * Handles <Span><Run Text="..." /></Span> format
 */
function stripLogosHtml(html: string): string {
  // Extract text from Run Text attributes
  let text = html.replace(/<Run Text="([^"]*)"\s*\/>/g, '$1');
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = decodeHtmlEntities(text);
  return text.trim();
}

export function getUserSermons(options: {
  title?: string;
  after_date?: string; // Start date string (ISO format: YYYY-MM-DD)
  before_date?: string; // End date string (ISO format: YYYY-MM-DD)
  liturgical_season?: string; // advent, christmas, epiphany, lent, holy_week, easter, pentecost, ordinary
  year?: number; // Year for liturgical season calculation (defaults to current year)
  limit?: number;
} = {}): SermonResult[] {
  const dbPath = DB_PATHS.sermons;
  if (!existsSync(dbPath)) {
    return []; // Sermons database may not exist on all systems
  }
  
  const db = openDb(dbPath);
  try {
    // Check if Blocks table exists for content
    const tables = listTables(dbPath);
    const hasBlocks = tables.includes("Blocks");
    
    let sql: string;
    const params: unknown[] = [];

    // Calculate date range if liturgical_season is specified
    let afterDate = options.after_date;
    let beforeDate = options.before_date;
    
    if (options.liturgical_season) {
      const year = options.year ?? new Date().getFullYear();
      const seasonDates = getLiturgicalSeasonDates(year, options.liturgical_season);
      if (seasonDates) {
        afterDate = seasonDates.start;
        beforeDate = seasonDates.end;
      }
    }
    
    if (hasBlocks) {
      // Join with Blocks to get actual content, use separator for block concatenation
      sql = `
        SELECT 
          d.Id, d.ExternalId, d.Title, d.Date, d.ModifiedDate, 
          d.AuthorName, d.Series, d.TagsJson,
          GROUP_CONCAT(b.Content, x'0A0A') as Content
        FROM Documents d
        LEFT JOIN Blocks b ON d.Id = b.DocumentId AND b.IsDeleted = 0
        WHERE d.IsDeleted = 0
      `;
    } else {
      // Fallback to just Documents table (Notes column is usually NULL)
      sql = `
        SELECT 
          Id, ExternalId, Title, Notes as Content, Date, ModifiedDate, 
          AuthorName, Series, TagsJson
        FROM Documents
        WHERE IsDeleted = 0
      `;
    }

    if (options.title) {
      if (hasBlocks) {
        sql += " AND d.Title LIKE ?";
      } else {
        sql += " AND Title LIKE ?";
      }
      params.push(`%${options.title}%`);
    }

    // Add date filters
    if (afterDate) {
      if (hasBlocks) {
        sql += " AND DATE(d.Date) >= ?";
      } else {
        sql += " AND DATE(Date) >= ?";
      }
      params.push(afterDate);
    }

    if (beforeDate) {
      if (hasBlocks) {
        sql += " AND DATE(d.Date) <= ?";
      } else {
        sql += " AND DATE(Date) <= ?";
      }
      params.push(beforeDate);
    }

    if (hasBlocks) {
      sql += " GROUP BY d.Id";
      sql += " ORDER BY d.Date DESC";
    } else {
      sql += " ORDER BY Date DESC";
    }

    const limit = options.limit ?? 20;
    sql += " LIMIT ?";
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as Array<{
      Id: number;
      ExternalId: string;
      Title: string;
      Content: string | null;
      Date: string | null;
      ModifiedDate: string | null;
      AuthorName: string | null;
      Series: string | null;
      TagsJson: string | null;
    }>;

    return rows.map((r) => ({
      sermonId: r.Id,
      externalId: r.ExternalId,
      title: r.Title,
      content: r.Content ? stripLogosHtml(r.Content) : null,
      createdDate: r.Date,
      modifiedDate: r.ModifiedDate,
      author: r.AuthorName,
      series: r.Series,
      tagsJson: r.TagsJson,
    }));
  } catch (e) {
    console.error("Error querying sermons:", e);
    return []; // Return empty if table doesn't exist
  } finally {
    db.close();
  }
}

/**
 * Calculate liturgical season date ranges for a given year.
 * Note: Many seasons depend on Easter, which varies each year.
 */
function getLiturgicalSeasonDates(year: number, season: string): { start: string; end: string } | null {
  // Calculate Easter date using the Anonymous Gregorian algorithm
  const easter = getEasterDate(year);
  const easterISO = easter.toISOString().split('T')[0];
  
  switch (season.toLowerCase()) {
    case 'advent':
      // Advent starts 4 Sundays before Christmas
      const christmas = new Date(year, 11, 25);
      const adventStart = new Date(christmas);
      adventStart.setDate(christmas.getDate() - 21 - christmas.getDay());
      return {
        start: adventStart.toISOString().split('T')[0],
        end: `${year}-12-24`
      };
    case 'christmas':
      return {
        start: `${year}-12-25`,
        end: `${year + 1}-01-05`
      };
    case 'epiphany':
      return {
        start: `${year}-01-06`,
        end: `${year}-02-02` // Presentation/Candlemas
      };
    case 'lent':
      // Lent starts Ash Wednesday (46 days before Easter)
      const ashWednesday = new Date(easter);
      ashWednesday.setDate(easter.getDate() - 46);
      const palmSunday = new Date(easter);
      palmSunday.setDate(easter.getDate() - 7);
      return {
        start: ashWednesday.toISOString().split('T')[0],
        end: palmSunday.toISOString().split('T')[0]
      };
    case 'holy_week':
      const palmSundayHW = new Date(easter);
      palmSundayHW.setDate(easter.getDate() - 7);
      const holySaturday = new Date(easter);
      holySaturday.setDate(easter.getDate() - 1);
      return {
        start: palmSundayHW.toISOString().split('T')[0],
        end: holySaturday.toISOString().split('T')[0]
      };
    case 'easter':
      const pentecost = new Date(easter);
      pentecost.setDate(easter.getDate() + 49);
      return {
        start: easterISO,
        end: pentecost.toISOString().split('T')[0]
      };
    case 'pentecost':
      const pentecostStart = new Date(easter);
      pentecostStart.setDate(easter.getDate() + 49);
      const pentecostEnd = new Date(easter);
      pentecostEnd.setDate(easter.getDate() + 56);
      return {
        start: pentecostStart.toISOString().split('T')[0],
        end: pentecostEnd.toISOString().split('T')[0]
      };
    case 'ordinary':
    case 'ordinary_time':
      // Ordinary Time: Jan 7 until Ash Wednesday, and Monday after Pentecost until Advent
      const ashWednesdayOT = new Date(easter);
      ashWednesdayOT.setDate(easter.getDate() - 46);
      const pentecostOT = new Date(easter);
      pentecostOT.setDate(easter.getDate() + 50);
      const adventNext = new Date(year, 11, 25);
      adventNext.setDate(adventNext.getDate() - 21 - adventNext.getDay());
      // Return the longer period (after Pentecost)
      return {
        start: pentecostOT.toISOString().split('T')[0],
        end: adventNext.toISOString().split('T')[0]
      };
    default:
      return null;
  }
}

/**
 * Calculate Easter date using Anonymous Gregorian algorithm
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
