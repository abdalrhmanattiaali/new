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
      family_group_id TEXT UNIQUE, -- WhatsApp Group ID (e.g., 201234567890-1234567890@g.us)
      send_to_group INTEGER DEFAULT 1, -- 1 = send to group, 0 = send individually
      marriage_date DATE, -- تاريخ الزواج
      onboarding_completed INTEGER DEFAULT 0,
      onboarding_source TEXT DEFAULT 'group', -- 'group' or 'individual'
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
      phone_number TEXT, -- encrypted (optional when onboarding from group)
      birth_date DATE, -- تاريخ الميلاد
      age INTEGER, -- العمر
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
      preview_sent INTEGER DEFAULT 0,
      feedback TEXT, -- JSON: which were selected/done
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `,

  // سجل ترشيحات الموارد للوالدين
  parent_resource_logs: `
    CREATE TABLE IF NOT EXISTS parent_resource_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      resource_type TEXT NOT NULL, -- book, course_father, course_mother
      title TEXT,
      metadata TEXT, -- JSON
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
  `,

  // جدول تتبع رسائل الروتين الروحاني
  spiritual_routine_logs: `
    CREATE TABLE IF NOT EXISTS spiritual_routine_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      guardian_id INTEGER,
      routine_id TEXT NOT NULL,
      scheduled_for DATE NOT NULL,
      scheduled_message_id INTEGER,
      delivered INTEGER DEFAULT 0,
      delivered_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE SET NULL,
      FOREIGN KEY (scheduled_message_id) REFERENCES scheduled_messages(id) ON DELETE SET NULL,
      UNIQUE(family_id, routine_id, scheduled_for)
    )
  `,

  // جدول الطلبات الروحانية المخصصة (ذكاء اصطناعي)
  spiritual_custom_requests: `
    CREATE TABLE IF NOT EXISTS spiritual_custom_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      guardian_id INTEGER NOT NULL,
      child_id INTEGER,
      request_text TEXT NOT NULL,
      ai_response TEXT,
      audio_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL
    )
  `,

  // جدول أهداف الوالدين
  parent_goals: `
    CREATE TABLE IF NOT EXISTS parent_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guardian_id INTEGER NOT NULL,
      goal_type TEXT NOT NULL, -- 'course', 'book', 'skill', 'habit'
      title TEXT NOT NULL,
      description TEXT,
      category TEXT, -- 'parenting', 'self_development', 'health', 'relationship'
      target_date DATE,
      progress INTEGER DEFAULT 0, -- 0-100
      status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused', 'cancelled'
      milestones TEXT, -- JSON array of sub-goals
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    )
  `,

  // جدول معالم تطور الطفل
  child_milestones: `
    CREATE TABLE IF NOT EXISTS child_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      milestone_type TEXT NOT NULL, -- 'physical', 'cognitive', 'social', 'language'
      title TEXT NOT NULL,
      description TEXT,
      expected_age_months INTEGER, -- العمر المتوقع بالأشهر
      achieved INTEGER DEFAULT 0,
      achieved_date DATE,
      age_at_achievement_months INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    )
  `,

  // جدول اقتراحات الألعاب
  toy_recommendations: `
    CREATE TABLE IF NOT EXISTS toy_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      toy_name TEXT NOT NULL,
      toy_category TEXT, -- 'educational', 'creative', 'physical', 'sensory'
      age_range_min_months INTEGER,
      age_range_max_months INTEGER,
      benefits TEXT, -- JSON array of benefits
      price_range TEXT, -- 'budget', 'moderate', 'premium'
      purchase_link TEXT,
      recommended_by_ai INTEGER DEFAULT 1,
      parent_rating INTEGER, -- 1-5
      purchased INTEGER DEFAULT 0,
      purchased_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    )
  `,

  // جدول النصائح التربوية
  parenting_tips: `
    CREATE TABLE IF NOT EXISTS parenting_tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      child_age_months INTEGER,
      category TEXT, -- 'discipline', 'communication', 'education', 'health'
      tip_content TEXT NOT NULL,
      source TEXT, -- 'ai', 'expert', 'research'
      relevance_score REAL, -- 0-1
      shown INTEGER DEFAULT 0,
      shown_date DATE,
      parent_feedback TEXT, -- 'helpful', 'not_helpful', 'applied'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `,

  // جدول الرسائل التحفيزية
  motivational_messages: `
    CREATE TABLE IF NOT EXISTS motivational_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guardian_id INTEGER NOT NULL,
      message_type TEXT, -- 'encouragement', 'appreciation', 'milestone_celebration'
      message_content TEXT NOT NULL,
      context TEXT, -- JSON: what triggered this message
      sent_date DATE,
      parent_reaction TEXT, -- 'loved', 'liked', 'neutral'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    )
  `,

  // جدول رحلة التطور الزمنية
  development_journey: `
    CREATE TABLE IF NOT EXISTS development_journey (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      journey_date DATE NOT NULL,
      child_age_months INTEGER,
      event_type TEXT, -- 'milestone', 'goal_achieved', 'learning_completed', 'challenge'
      event_title TEXT NOT NULL,
      event_description TEXT,
      participants TEXT, -- JSON: who was involved (father, mother, child)
      media_attachments TEXT, -- JSON array of photo/video references
      emotional_tone TEXT, -- 'joyful', 'proud', 'challenging', 'growth'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `,

  // جدول التذكيرات بالمناسبات
  anniversary_reminders: `
    CREATE TABLE IF NOT EXISTS anniversary_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER,
      guardian_id INTEGER,
      reminder_type TEXT NOT NULL, -- 'birthday_father', 'birthday_mother', 'birthday_child', 'marriage_anniversary'
      anniversary_date DATE NOT NULL, -- تاريخ المناسبة (شهر ويوم فقط)
      reminder_days_before INTEGER DEFAULT 1, -- عدد الأيام قبل التذكير
      last_reminded_year INTEGER, -- آخر سنة تم التذكير فيها
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    )
  `,

  // جدول متابعة المشاكل الصحية للأطفال
  child_issues: `
    CREATE TABLE IF NOT EXISTS child_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      family_id INTEGER NOT NULL,
      issue_type TEXT NOT NULL, -- 'nutrition', 'sleep', 'health', 'behavior', 'development'
      issue_title TEXT NOT NULL, -- مثال: "تسطح في الرأس"
      issue_description TEXT NOT NULL, -- وصف تفصيلي من الأهل
      severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
      status TEXT DEFAULT 'active', -- 'active', 'monitoring', 'improving', 'resolved'

      -- AI Generated Treatment Plan
      ai_diagnosis TEXT, -- تحليل AI للمشكلة
      treatment_plan TEXT NOT NULL, -- خطة العلاج (JSON)
      daily_actions TEXT, -- إجراءات يومية مقترحة (JSON array)
      expected_duration_days INTEGER, -- المدة المتوقعة للحل

      -- Progress Tracking
      progress_percentage INTEGER DEFAULT 0, -- نسبة التحسن (0-100)
      progress_notes TEXT, -- ملاحظات التطور (JSON array)
      last_reminder_sent DATETIME, -- آخر تذكير تم إرساله
      reminders_per_day INTEGER DEFAULT 3, -- عدد التذكيرات اليومية

      -- Dates
      reported_date DATE NOT NULL, -- تاريخ الإبلاغ عن المشكلة
      expected_resolution_date DATE, -- التاريخ المتوقع للحل
      actual_resolution_date DATE, -- التاريخ الفعلي للحل

      -- Follow-up
      next_followup_date DATE, -- تاريخ المتابعة القادمة
      followup_frequency_days INTEGER DEFAULT 7, -- كل كم يوم متابعة

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `,

  // جدول القصص الصوتية للأطفال
  child_audio_stories: `
    CREATE TABLE IF NOT EXISTS child_audio_stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      family_id INTEGER NOT NULL,
      story_title TEXT NOT NULL,
      story_summary TEXT,
      story_text TEXT NOT NULL,
      story_hash TEXT NOT NULL,
      duration_seconds INTEGER,
      voice_id TEXT,
      model_id TEXT,
      generated_for DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      UNIQUE(child_id, generated_for)
    )
  `,

  // جدول ملاحظات العلاقة الزوجية
  couple_feedback_logs: `
    CREATE TABLE IF NOT EXISTS couple_feedback_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      guardian_id INTEGER NOT NULL,
      partner_role TEXT,
      sentiment TEXT DEFAULT 'neutral', -- positive, challenge, mixed, neutral
      positives_text TEXT,
      challenges_text TEXT,
      gratitude_text TEXT,
      source TEXT DEFAULT 'manual',
      ai_summary TEXT,
      followup_needed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
    )
  `,

  // جلسات المحادثة التفاعلية
  conversation_sessions: `
    CREATE TABLE IF NOT EXISTS conversation_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      topic TEXT,
      status TEXT DEFAULT 'open',
      participants TEXT, -- JSON array of guardian ids
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `,

  conversation_messages: `
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      author_type TEXT NOT NULL, -- guardian, assistant, system
      guardian_id INTEGER,
      message_content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE SET NULL
    )
  `,

  interactive_notifications: `
    CREATE TABLE IF NOT EXISTS interactive_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      guardian_id INTEGER,
      topic TEXT,
      ai_reason TEXT,
      message_text TEXT,
      decision_payload TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE SET NULL
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
  'CREATE INDEX IF NOT EXISTS idx_weekend_week ON weekend_plans(week_start_date)',
  'CREATE INDEX IF NOT EXISTS idx_resource_family_type ON parent_resource_logs(family_id, resource_type)',
  'CREATE INDEX IF NOT EXISTS idx_learning_guardian ON learning_track(guardian_id)',
  'CREATE INDEX IF NOT EXISTS idx_vaccines_child ON vaccines(child_id)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_child ON daily_tracking(child_id)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_date ON daily_tracking(tracking_date)',
  'CREATE INDEX IF NOT EXISTS idx_scheduled_time ON scheduled_messages(scheduled_time)',
  'CREATE INDEX IF NOT EXISTS idx_content_category ON content_items(category)',

  // New indexes for journey features
  'CREATE INDEX IF NOT EXISTS idx_parent_goals_guardian ON parent_goals(guardian_id)',
  'CREATE INDEX IF NOT EXISTS idx_parent_goals_status ON parent_goals(status)',
  'CREATE INDEX IF NOT EXISTS idx_milestones_child ON child_milestones(child_id)',
  'CREATE INDEX IF NOT EXISTS idx_milestones_achieved ON child_milestones(achieved)',
  'CREATE INDEX IF NOT EXISTS idx_toys_child ON toy_recommendations(child_id)',
  'CREATE INDEX IF NOT EXISTS idx_toys_purchased ON toy_recommendations(purchased)',
  'CREATE INDEX IF NOT EXISTS idx_tips_family ON parenting_tips(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_tips_shown ON parenting_tips(shown)',
  'CREATE INDEX IF NOT EXISTS idx_motivational_guardian ON motivational_messages(guardian_id)',
  'CREATE INDEX IF NOT EXISTS idx_journey_family ON development_journey(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_journey_date ON development_journey(journey_date)',

  // New indexes for anniversary reminders
  'CREATE INDEX IF NOT EXISTS idx_anniversary_family ON anniversary_reminders(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_anniversary_type ON anniversary_reminders(reminder_type)',
  'CREATE INDEX IF NOT EXISTS idx_anniversary_date ON anniversary_reminders(anniversary_date)',
  'CREATE INDEX IF NOT EXISTS idx_family_group ON families(family_group_id)',

  // New indexes for child issues tracking
  'CREATE INDEX IF NOT EXISTS idx_child_issues_child ON child_issues(child_id)',
  'CREATE INDEX IF NOT EXISTS idx_child_issues_family ON child_issues(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_child_issues_status ON child_issues(status)',
  'CREATE INDEX IF NOT EXISTS idx_child_issues_type ON child_issues(issue_type)',
  'CREATE INDEX IF NOT EXISTS idx_child_issues_next_followup ON child_issues(next_followup_date)',

  // New indexes for audio stories
  'CREATE INDEX IF NOT EXISTS idx_audio_stories_child ON child_audio_stories(child_id)',
  'CREATE INDEX IF NOT EXISTS idx_audio_stories_family ON child_audio_stories(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_audio_stories_date ON child_audio_stories(generated_for)',

  // فهارس سجل العلاقة الزوجية
  'CREATE INDEX IF NOT EXISTS idx_couple_feedback_family ON couple_feedback_logs(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_couple_feedback_guardian ON couple_feedback_logs(guardian_id)',
  'CREATE INDEX IF NOT EXISTS idx_couple_feedback_sentiment ON couple_feedback_logs(sentiment)',

  // فهارس الروتين الروحاني
  'CREATE INDEX IF NOT EXISTS idx_spiritual_logs_family ON spiritual_routine_logs(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_spiritual_logs_routine ON spiritual_routine_logs(routine_id)',
  'CREATE INDEX IF NOT EXISTS idx_spiritual_logs_date ON spiritual_routine_logs(scheduled_for)',
  'CREATE INDEX IF NOT EXISTS idx_spiritual_requests_guardian ON spiritual_custom_requests(guardian_id)',
  'CREATE INDEX IF NOT EXISTS idx_spiritual_requests_family ON spiritual_custom_requests(family_id)',

  // فهارس المحادثات والإشعارات التفاعلية
  'CREATE INDEX IF NOT EXISTS idx_conversations_family ON conversation_sessions(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversation_sessions(status)',
  'CREATE INDEX IF NOT EXISTS idx_conversation_messages_session ON conversation_messages(session_id)',
  'CREATE INDEX IF NOT EXISTS idx_interactive_notifications_family ON interactive_notifications(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_interactive_notifications_sent_at ON interactive_notifications(sent_at)'
];
