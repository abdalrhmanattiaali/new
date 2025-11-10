/**
 * Group Sync Service
 * خدمة مزامنة الجروبات - تحفظ جلسة الجروبات والعائلات المسجلة
 */

import { getDatabase } from '../database/init.js';

export class GroupSyncService {
  constructor(whatsappBot) {
    this.bot = whatsappBot;
    this.db = null;
    this.syncInterval = null;
  }

  /**
   * Initialize the service
   */
  initialize() {
    this.db = getDatabase();
    console.log('✅ GroupSyncService initialized');
  }

  /**
   * Sync all WhatsApp groups with database
   * تزامن جميع الجروبات من واتساب إلى قاعدة البيانات
   */
  async syncGroupsFromWhatsApp() {
    try {
      console.log('\n🔄 Syncing WhatsApp groups to database...');

      // Get all groups from WhatsApp
      const groups = await this.bot.getGroups();

      if (groups.length === 0) {
        console.log('⚠️ No groups found in WhatsApp');
        return { synced: 0, updated: 0, new: 0 };
      }

      let newGroups = 0;
      let updatedGroups = 0;

      // Sync each group
      for (const group of groups) {
        try {
          const existing = this.db.prepare(`
            SELECT id, family_name FROM families
            WHERE family_group_id = ?
          `).get(group.id);

          if (existing) {
            // Update existing group
            this.db.prepare(`
              UPDATE families
              SET family_name = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE family_group_id = ?
            `).run(group.name, group.id);

            updatedGroups++;
            console.log(`   ↻ Updated group: ${group.name} (${group.participantsCount} members)`);
          } else {
            // Insert new group (not onboarded yet)
            this.db.prepare(`
              INSERT INTO families (
                family_name,
                family_group_id,
                send_to_group,
                onboarding_completed,
                onboarding_source
              ) VALUES (?, ?, 1, 0, 'group')
            `).run(group.name, group.id);

            newGroups++;
            console.log(`   ✨ New group discovered: ${group.name} (${group.participantsCount} members)`);
          }
        } catch (error) {
          console.error(`   ❌ Error syncing group ${group.name}:`, error.message);
        }
      }

      console.log(`✅ Sync completed: ${newGroups} new, ${updatedGroups} updated\n`);

      return {
        synced: groups.length,
        new: newGroups,
        updated: updatedGroups
      };

    } catch (error) {
      console.error('❌ Error syncing groups:', error);
      throw error;
    }
  }

  /**
   * Get all registered families from database
   * جلب جميع العائلات المسجلة من قاعدة البيانات
   */
  getRegisteredFamilies() {
    try {
      const families = this.db.prepare(`
        SELECT
          f.id,
          f.family_name,
          f.family_group_id,
          f.send_to_group,
          f.onboarding_completed,
          f.created_at,
          COUNT(DISTINCT g.id) as guardians_count,
          COUNT(DISTINCT c.id) as children_count
        FROM families f
        LEFT JOIN guardians g ON f.id = g.family_id
        LEFT JOIN children c ON f.id = c.family_id
        GROUP BY f.id
        ORDER BY f.created_at DESC
      `).all();

      return families;
    } catch (error) {
      console.error('❌ Error getting registered families:', error);
      return [];
    }
  }

  /**
   * Get families that need onboarding
   * جلب العائلات التي تحتاج إلى onboarding
   */
  getFamiliesNeedingOnboarding() {
    try {
      const families = this.db.prepare(`
        SELECT
          id,
          family_name,
          family_group_id,
          created_at
        FROM families
        WHERE onboarding_completed = 0
        ORDER BY created_at DESC
      `).all();

      return families;
    } catch (error) {
      console.error('❌ Error getting families needing onboarding:', error);
      return [];
    }
  }

  /**
   * Restore groups to WhatsApp (verify they still exist)
   * التحقق من أن الجروبات المسجلة ما زالت موجودة
   */
  async verifyRegisteredGroups() {
    try {
      console.log('\n🔍 Verifying registered groups...');

      const families = this.db.prepare(`
        SELECT id, family_name, family_group_id
        FROM families
        WHERE family_group_id IS NOT NULL
      `).all();

      let verified = 0;
      let missing = 0;

      for (const family of families) {
        try {
          const groupInfo = await this.bot.getGroupInfo(family.family_group_id);

          if (groupInfo) {
            verified++;
            console.log(`   ✅ ${family.family_name} - Active`);
          } else {
            missing++;
            console.log(`   ⚠️ ${family.family_name} - Not found (may have been removed)`);
          }
        } catch (error) {
          missing++;
          console.log(`   ⚠️ ${family.family_name} - Error: ${error.message}`);
        }
      }

      console.log(`\n✅ Verification complete: ${verified} active, ${missing} missing\n`);

      return { verified, missing, total: families.length };

    } catch (error) {
      console.error('❌ Error verifying groups:', error);
      throw error;
    }
  }

  /**
   * Start auto-sync (runs every interval)
   * بدء المزامنة التلقائية
   */
  startAutoSync(intervalMinutes = 30) {
    console.log(`🔄 Starting auto-sync every ${intervalMinutes} minutes...`);

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncGroupsFromWhatsApp();
      } catch (error) {
        console.error('❌ Auto-sync error:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 Auto-sync stopped');
    }
  }

  /**
   * Get database statistics
   * إحصائيات قاعدة البيانات
   */
  getDatabaseStats() {
    try {
      const stats = {
        totalFamilies: this.db.prepare('SELECT COUNT(*) as count FROM families').get().count,
        completedOnboarding: this.db.prepare('SELECT COUNT(*) as count FROM families WHERE onboarding_completed = 1').get().count,
        pendingOnboarding: this.db.prepare('SELECT COUNT(*) as count FROM families WHERE onboarding_completed = 0').get().count,
        totalGuardians: this.db.prepare('SELECT COUNT(*) as count FROM guardians').get().count,
        totalChildren: this.db.prepare('SELECT COUNT(*) as count FROM children').get().count,
        totalInteractions: this.db.prepare('SELECT COUNT(*) as count FROM interactions').get().count,
        groupFamilies: this.db.prepare('SELECT COUNT(*) as count FROM families WHERE family_group_id IS NOT NULL').get().count,
        individualFamilies: this.db.prepare('SELECT COUNT(*) as count FROM families WHERE family_group_id IS NULL').get().count
      };

      return stats;
    } catch (error) {
      console.error('❌ Error getting database stats:', error);
      return null;
    }
  }

  /**
   * Print database summary
   * طباعة ملخص قاعدة البيانات
   */
  printDatabaseSummary() {
    const stats = this.getDatabaseStats();

    if (!stats) return;

    console.log('\n' + '='.repeat(60));
    console.log('📊 Database Summary / ملخص قاعدة البيانات');
    console.log('='.repeat(60));
    console.log(`📝 Total Families: ${stats.totalFamilies}`);
    console.log(`   ├─ Completed Onboarding: ${stats.completedOnboarding}`);
    console.log(`   └─ Pending Onboarding: ${stats.pendingOnboarding}`);
    console.log(`👥 Guardians: ${stats.totalGuardians}`);
    console.log(`👶 Children: ${stats.totalChildren}`);
    console.log(`💬 Total Interactions: ${stats.totalInteractions}`);
    console.log(`📱 Group Families: ${stats.groupFamilies}`);
    console.log(`👤 Individual Families: ${stats.individualFamilies}`);
    console.log(`💾 Database Capacity: 20,000 families`);
    console.log(`📈 Current Usage: ${((stats.totalFamilies / 20000) * 100).toFixed(2)}%`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Optimize database for large scale (20,000 families)
   * تحسين قاعدة البيانات للدعم حجم كبير
   */
  optimizeDatabase() {
    try {
      console.log('⚡ Optimizing database for large scale...');

      // Analyze tables for query optimization
      this.db.exec('ANALYZE');

      // Set cache size (in pages, -10000 = ~40MB)
      this.db.pragma('cache_size = -10000');

      // Set temp_store to memory for faster operations
      this.db.pragma('temp_store = MEMORY');

      // Enable memory-mapped I/O for better performance
      this.db.pragma('mmap_size = 30000000000'); // 30GB

      // Increase page size for better performance with large data
      // Note: This only works on new databases
      // this.db.pragma('page_size = 4096');

      console.log('✅ Database optimized for 20,000+ families');

      return true;
    } catch (error) {
      console.error('❌ Error optimizing database:', error);
      return false;
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('📚 Database connection closed');
    }
  }
}

export default GroupSyncService;
