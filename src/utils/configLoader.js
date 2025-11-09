/**
 * Configuration Loader with Hot Reload
 * محمّل الإعدادات مع التحديث التلقائي
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigLoader extends EventEmitter {
  constructor(configPath = null) {
    super();
    this.configPath = configPath || process.env.CONFIG_PATH || path.join(__dirname, '../../config/config.yaml');
    this.config = null;
    this.watcher = null;
  }

  /**
   * Load configuration from file
   */
  load() {
    try {
      const fileContent = fs.readFileSync(this.configPath, 'utf8');
      this.config = YAML.parse(fileContent);
      console.log('✅ Configuration loaded successfully');
      return this.config;
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  get() {
    if (!this.config) {
      this.load();
    }
    return this.config;
  }

  /**
   * Start watching for configuration changes
   */
  startWatching() {
    if (!this.config) {
      this.load();
    }

    const hotReloadEnabled = this.config?.app?.hot_reload !== false;

    if (!hotReloadEnabled) {
      console.log('ℹ️ Hot reload is disabled in configuration');
      return;
    }

    console.log(`👀 Watching configuration file: ${this.configPath}`);

    this.watcher = chokidar.watch(this.configPath, {
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', (filePath) => {
      console.log(`🔄 Configuration file changed: ${filePath}`);
      this.reload();
    });

    this.watcher.on('error', (error) => {
      console.error('❌ Watcher error:', error);
    });
  }

  /**
   * Reload configuration
   */
  reload() {
    try {
      const oldConfig = { ...this.config };
      this.load();

      // Emit reload event with old and new configs
      this.emit('reload', {
        old: oldConfig,
        new: this.config
      });

      console.log('✅ Configuration reloaded successfully');
      this.logChanges(oldConfig, this.config);

    } catch (error) {
      console.error('❌ Error reloading configuration:', error);
      this.emit('error', error);
    }
  }

  /**
   * Log configuration changes
   */
  logChanges(oldConfig, newConfig) {
    console.log('\n📝 Configuration Changes:');
    const changes = this.findChanges(oldConfig, newConfig);

    if (changes.length === 0) {
      console.log('  No changes detected');
    } else {
      changes.forEach(change => {
        console.log(`  ${change.path}: ${JSON.stringify(change.old)} → ${JSON.stringify(change.new)}`);
      });
    }
    console.log('');
  }

  /**
   * Find changes between two config objects
   */
  findChanges(oldObj, newObj, path = '') {
    const changes = [];

    // Check for changes in existing keys
    for (const key in oldObj) {
      const newPath = path ? `${path}.${key}` : key;

      if (!(key in newObj)) {
        changes.push({
          path: newPath,
          type: 'removed',
          old: oldObj[key],
          new: undefined
        });
      } else if (typeof oldObj[key] === 'object' && typeof newObj[key] === 'object' && !Array.isArray(oldObj[key])) {
        changes.push(...this.findChanges(oldObj[key], newObj[key], newPath));
      } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        changes.push({
          path: newPath,
          type: 'modified',
          old: oldObj[key],
          new: newObj[key]
        });
      }
    }

    // Check for new keys
    for (const key in newObj) {
      if (!(key in oldObj)) {
        const newPath = path ? `${path}.${key}` : key;
        changes.push({
          path: newPath,
          type: 'added',
          old: undefined,
          new: newObj[key]
        });
      }
    }

    return changes;
  }

  /**
   * Stop watching for changes
   */
  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      console.log('🛑 Stopped watching configuration file');
    }
  }

  /**
   * Get a nested config value by path
   */
  getByPath(path) {
    const keys = path.split('.');
    let value = this.get();

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(featurePath) {
    const value = this.getByPath(featurePath);
    return value === true || value?.enabled === true;
  }

  /**
   * Validate configuration
   */
  validate() {
    const required = [
      'app.timezone',
      'app.language_default',
      'ai.llm.model',
      'tracks.daily_child'
    ];

    const missing = [];

    for (const path of required) {
      const value = this.getByPath(path);
      if (value === undefined || value === null) {
        missing.push(path);
      }
    }

    if (missing.length > 0) {
      console.warn('⚠️ Missing required configuration keys:');
      missing.forEach(key => console.warn(`  - ${key}`));
      return false;
    }

    console.log('✅ Configuration validation passed');
    return true;
  }
}

// Create singleton instance
let configLoader = null;

export function getConfigLoader(configPath = null) {
  if (!configLoader) {
    configLoader = new ConfigLoader(configPath);
  }
  return configLoader;
}

export default ConfigLoader;
