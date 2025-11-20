/**
 * Knowledge Base helper for lightweight RAG retrieval
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '../database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class KnowledgeBase {
  constructor(config) {
    this.config = config;
    this.dbEntries = null;
    this.fileEntries = null;
    this.knowledgeDir = path.join(__dirname, '..', '..', 'knowledge');
  }

  /**
   * Search knowledge sources and return the most relevant snippets
   */
  search(query, { keywords = [], limit = 3 } = {}) {
    const normalizedKeywords = this.normalizeKeywords([query, ...keywords]);

    const entries = [
      ...this.loadDatabaseEntries(),
      ...this.loadFileEntries()
    ];

    if (entries.length === 0 || normalizedKeywords.length === 0) {
      return [];
    }

    const scored = entries
      .map((entry) => ({
        entry,
        score: this.calculateScore(entry, normalizedKeywords)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => entry);

    return scored;
  }

  /**
   * Load entries from SQLite knowledge table (content_items)
   */
  loadDatabaseEntries() {
    if (this.dbEntries !== null) {
      return this.dbEntries;
    }

    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT id, title, content, tags, category
        FROM content_items
        WHERE content IS NOT NULL AND TRIM(content) <> ''
        LIMIT 200
      `).all();

      db.close();

      this.dbEntries = rows.map((row) => ({
        id: `db-${row.id}`,
        source: 'database',
        title: row.title,
        content: row.content,
        tags: this.parseTags(row.tags),
        category: row.category
      }));
    } catch (error) {
      console.warn('KnowledgeBase: unable to load database content_items table:', error.message);
      this.dbEntries = [];
    }

    return this.dbEntries;
  }

  /**
   * Load entries from knowledge folder (Markdown/JSON)
   */
  loadFileEntries() {
    if (this.fileEntries !== null) {
      return this.fileEntries;
    }

    const entries = [];

    const visitDirectory = (dirPath) => {
      if (!fs.existsSync(dirPath)) return;
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          visitDirectory(fullPath);
        } else if (stat.isFile()) {
          if (item.endsWith('.json')) {
            try {
              const raw = fs.readFileSync(fullPath, 'utf8');
              const parsed = JSON.parse(raw);
              entries.push({
                id: `file-${fullPath}`,
                source: 'file',
                title: parsed.title || path.basename(fullPath),
                content: parsed.content || raw,
                tags: parsed.tags || [],
                category: parsed.category || path.basename(path.dirname(fullPath))
              });
            } catch (error) {
              console.warn(`KnowledgeBase: failed to parse JSON file ${fullPath}:`, error.message);
            }
          } else if (item.endsWith('.md') || item.endsWith('.txt')) {
            try {
              const raw = fs.readFileSync(fullPath, 'utf8');
              const [firstLine] = raw.trim().split('\n');
              const title = firstLine.replace(/^#\s*/, '').trim();
              entries.push({
                id: `file-${fullPath}`,
                source: 'file',
                title: title || path.basename(fullPath),
                content: raw,
                tags: [],
                category: path.basename(path.dirname(fullPath))
              });
            } catch (error) {
              console.warn(`KnowledgeBase: failed to read file ${fullPath}:`, error.message);
            }
          }
        }
      }
    };

    visitDirectory(this.knowledgeDir);
    this.fileEntries = entries;
    return this.fileEntries;
  }

  /**
   * Calculate a lightweight relevance score based on keyword frequency
   */
  calculateScore(entry, keywords) {
    const haystack = `${entry.title}\n${entry.content}\n${(entry.tags || []).join(' ')}`.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      if (!keyword) continue;
      const regex = new RegExp(`\\b${this.escapeRegex(keyword)}[\\w\u0621-\u064A]*`, 'gi');
      const matches = haystack.match(regex);
      if (matches) {
        score += matches.length * (keyword.length > 4 ? 2 : 1);
      }
    }
    return score;
  }

  normalizeKeywords(words) {
    return Array.from(
      new Set(
        words
          .filter(Boolean)
          .flatMap((word) =>
            word
              .toString()
              .toLowerCase()
              .replace(/[\u064B-\u0652]/g, '')
              .split(/[^\w\u0621-\u064A]+/)
              .filter(Boolean)
          )
      )
    );
  }

  parseTags(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // ignore
    }
    return typeof raw === 'string' ? raw.split(',').map((tag) => tag.trim()) : [];
  }

  escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default KnowledgeBase;
