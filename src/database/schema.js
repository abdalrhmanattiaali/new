/**
 * Database Schema Definition
 * بنية قاعدة البيانات
 */

export const schema = {
  // جدول العائلات
  families: `
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_name TEXT NOT NULL,
      timezone TEXT DEFAULT 'Africa/Cairo',
      language TEXT DEFAULT 'ar',
      family_group_id TEXT, -- WhatsApp Group ID (e.g., 201234567890-1234567890@g.us)
      send_to_group INTEGER DEFAULT 1, -- 1 = send to group, 0 = send individually
      onboarding_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // جدول الأولياء (الأب والأم)
  guardians: `
    CREATE TABLE IF NOT EXISTS guardians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'father' or 'mother'
      phone_number TEXT NOT NULL UNIQUE, -- encrypted
      preferred_time TEXT, -- 'morning', 'noon', 'evening'
      notification_enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `,

  // جدول الأطفال
  children: `
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      birth_date DATE NOT NULL,
      allergies TEXT, -- encrypted, JSON array
      health_notes TEXT, -- encrypted
      development_stage TEXT, -- 'infant', 'toddler', 'preschool', 'school'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `,

  // جدول التفضيلات
  preferences: `
    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      guardian_id INTEGER,
      category TEXT NOT NULL, -- 'tracks', 'content_type', 'timing', etc.
      key TEXT NOT NULL,
      value TEXT NOT NULL, -- JSON value
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE,
      UNIQUE(family_id, guardian_id, category, key)
    )
  `,

  // جدول الأحداث والتذكيرات
  events: `
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      child_id INTEGER,
      event_type TEXT NOT NULL, -- 'vaccine', 'doctor', 'medication', 'prayer'
      title TEXT NOT NULL,
      description TEXT,
      event_date DATETIME NOT NULL,
      reminder_sent INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    )
  `,

  // جدول التفاعلات
  interactions: `
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      guardian_id INTEGER NOT NULL,
      message_type TEXT NOT NULL, -- 'daily', 'reminder', 'weekend', 'learning'
      message_content TEXT NOT NULL,
      button_clicked TEXT, -- 'done', 'remind_later', 'skip', etc.
      clicked_at DATETIME,
      response_time_seconds INTEGER,
      sentiment TEXT, -- 'positive', 'neutral', 'negative'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    )
  `,

  // جدول ملفات AI للمستخدمين
  ai_profiles: `
    CREATE TABLE IF NOT EXISTS ai_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guardian_id INTEGER NOT NULL UNIQUE,
      best_send_time TEXT, -- HH:MM format
      content_affinity TEXT, -- JSON: {category: score}
      interaction_rate REAL DEFAULT 0.0,
      avg_response_time_seconds INTEGER,
      preferred_format TEXT, -- 'text', 'audio', 'checklist'
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    )
  `,

  // جدول محتوى المعرفة (مع embeddings للـ RAG)
  content_items: `
    CREATE TABLE IF NOT EXISTS content_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL, -- 'parenting', 'nutrition', 'mental_health', 'values'
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT, -- JSON array
      embedding BLOB, -- Vector embedding for RAG
      source TEXT,
      language TEXT DEFAULT 'ar',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // جدول خطط نهاية الأسبوع
  weekend_plans: `
    CREATE TABLE IF NOT EXISTS weekend_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      week_start_date DATE NOT NULL,
      movies TEXT, -- JSON array of movie suggestions
      outings TEXT, -- JSON array of outing suggestions
      checklist TEXT, -- JSON array of checklist items
      home_alternative TEXT, -- JSON object
      sent INTEGER DEFAULT 0,
      feedback TEXT, -- JSON: which were selected/done
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `,

  // جدول مسار التعلم
  learning_track: `
    CREATE TABLE IF NOT EXISTS learning_track (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guardian_id INTEGER NOT NULL,
      content_type TEXT NOT NULL, -- 'book', 'course', 'article'
      title TEXT NOT NULL,
      description TEXT,
      source_url TEXT,
      tags TEXT, -- JSON array
      duration_minutes INTEGER,
      sent_at DATETIME,
      interaction TEXT, -- 'read', 'saved', 'skipped', 'audio_listened'
      completed INTEGER DEFAULT 0,
      rating INTEGER, -- 1-5
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    )
  `,

  // جدول التطعيمات
  vaccines: `
    CREATE TABLE IF NOT EXISTS vaccines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      vaccine_name TEXT NOT NULL,
      scheduled_date DATE NOT NULL,
      administered INTEGER DEFAULT 0,
      administered_date DATE,
      reminder_sent INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    )
  `,

  // جدول تتبع اليوميات (النوم، الأكل، المزاج)
  daily_tracking: `
    CREATE TABLE IF NOT EXISTS daily_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      tracking_date DATE NOT NULL,
      sleep_quality TEXT, -- 'good', 'moderate', 'poor'
      sleep_hours REAL,
      nutrition_quality TEXT, -- 'good', 'moderate', 'poor'
      meals_eaten INTEGER,
      mood TEXT, -- 'happy', 'neutral', 'upset'
      play_minutes INTEGER,
      language_activities INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      UNIQUE(child_id, tracking_date)
    )
  `,

  // جدول التقارير الأسبوعية
  weekly_reports: `
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      week_start_date DATE NOT NULL,
      week_end_date DATE NOT NULL,
      summary TEXT NOT NULL, -- JSON object with stats
      achievements TEXT, -- JSON array
      improvements_needed TEXT, -- JSON array
      next_week_goal TEXT,
      sent INTEGER DEFAULT 0,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      UNIQUE(family_id, week_start_date)
    )
  `,

  // جدول الرسائل المجدولة
  scheduled_messages: `
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      guardian_id INTEGER NOT NULL,
      message_type TEXT NOT NULL,
      message_content TEXT NOT NULL,
      scheduled_time DATETIME NOT NULL,
      sent INTEGER DEFAULT 0,
      sent_at DATETIME,
      buttons TEXT, -- JSON array
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    )
  `
};

// Indexes for better performance
export const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_guardians_family ON guardians(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_guardians_phone ON guardians(phone_number)',
  'CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_events_family ON events(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date)',
  'CREATE INDEX IF NOT EXISTS idx_interactions_family ON interactions(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_interactions_guardian ON interactions(guardian_id)',
  'CREATE INDEX IF NOT EXISTS idx_weekend_family ON weekend_plans(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_learning_guardian ON learning_track(guardian_id)',
  'CREATE INDEX IF NOT EXISTS idx_vaccines_child ON vaccines(child_id)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_child ON daily_tracking(child_id)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_date ON daily_tracking(tracking_date)',
  'CREATE INDEX IF NOT EXISTS idx_scheduled_time ON scheduled_messages(scheduled_time)',
  'CREATE INDEX IF NOT EXISTS idx_content_category ON content_items(category)'
];
