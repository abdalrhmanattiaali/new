import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REGISTRY_PATH = process.env.ALLOWED_GROUPS_PATH || path.join(__dirname, '../../config/allowed_groups.json');

let cachedGroups = [];
let cachedRawEntries = [];
let lastMtime = 0;

function readRegistryFile() {
  try {
    const stats = fs.statSync(DEFAULT_REGISTRY_PATH);
    if (!stats.isFile()) {
      return [];
    }

    if (!lastMtime || stats.mtimeMs !== lastMtime) {
      const content = fs.readFileSync(DEFAULT_REGISTRY_PATH, 'utf8');
      const parsed = content.trim() ? JSON.parse(content) : {};
      const entries = Array.isArray(parsed) ? parsed : parsed.groups || [];

      cachedRawEntries = entries;
      cachedGroups = entries
        .map((entry) => {
          if (!entry) return null;
          if (typeof entry === 'string') {
            return { id: entry.trim(), label: '' };
          }
          if (typeof entry === 'object' && entry.id) {
            return { id: String(entry.id).trim(), label: entry.label ? String(entry.label).trim() : '' };
          }
          return null;
        })
        .filter((entry) => entry && entry.id.endsWith('@g.us'));

      lastMtime = stats.mtimeMs;
    }

    return cachedGroups;
  } catch (error) {
    if (cachedGroups.length === 0) {
      console.warn(`⚠️  Allowed group registry not found at ${DEFAULT_REGISTRY_PATH}. No groups are whitelisted yet.`);
    } else {
      console.warn('⚠️  Unable to refresh allowed group registry. Using last cached values.');
    }
    return cachedGroups;
  }
}

export function getAllowedGroups() {
  return readRegistryFile().map((entry) => ({ ...entry }));
}

export function isGroupAllowed(groupId) {
  if (!groupId) {
    return false;
  }
  const normalized = String(groupId).trim();
  const allowed = readRegistryFile();
  return allowed.some((entry) => entry.id === normalized);
}

export function reloadAllowedGroups() {
  lastMtime = 0;
  readRegistryFile();
}

export function describeRegistrySource() {
  return {
    path: DEFAULT_REGISTRY_PATH,
    entries: cachedRawEntries
  };
}
