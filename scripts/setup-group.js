#!/usr/bin/env node

/**
 * Group Setup Helper - مساعد إعداد الجروب
 * سكريبت تفاعلي لإعداد الجروب العائلي
 */

import Database from 'better-sqlite3';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('👨‍👩‍👧 مساعد إعداد الجروب العائلي');
  console.log('   Family Group Setup Helper');
  console.log('='.repeat(60) + '\n');

  try {
    // فتح قاعدة البيانات
    const dbPath = join(__dirname, '..', 'data', 'family_assistant.db');
    const db = new Database(dbPath);

    // عرض العائلات المتاحة
    console.log('📋 العائلات المسجلة:\n');
    const families = db.prepare('SELECT id, family_name, family_group_id, send_to_group FROM families').all();

    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة!');
      console.log('💡 قم بتشغيل البوت أولاً وأكمل عملية التسجيل.\n');
      process.exit(1);
    }

    families.forEach((family, index) => {
      const groupStatus = family.send_to_group ? '✅ مفعّل' : '❌ معطّل';
      const groupId = family.family_group_id || 'غير محدد';
      console.log(`${index + 1}. ${family.family_name}`);
      console.log(`   معرف الجروب: ${groupId}`);
      console.log(`   الإرسال للجروب: ${groupStatus}\n`);
    });

    // اختيار العائلة
    const familyChoice = await question('اختر رقم العائلة: ');
    const familyIndex = parseInt(familyChoice) - 1;

    if (familyIndex < 0 || familyIndex >= families.length) {
      console.log('❌ اختيار خاطئ!');
      process.exit(1);
    }

    const selectedFamily = families[familyIndex];
    console.log(`\n✅ تم اختيار: ${selectedFamily.family_name}\n`);

    // الحصول على معرف الجروب
    console.log('📱 كيفية الحصول على معرف الجروب:\n');
    console.log('الطريقة 1️⃣: أرسل رسالة في الجروب، ستجد المعرف في السجلات');
    console.log('الطريقة 2️⃣: استخدم واتساب ويب وانظر للرابط');
    console.log('الطريقة 3️⃣: شغل البوت وسيعرض قائمة الجروبات\n');
    console.log('⚠️ شكل المعرف الصحيح: 123456789-123456789@g.us\n');

    const groupId = await question('أدخل معرف الجروب (أو اضغط Enter للتخطي): ');

    if (!groupId.trim()) {
      console.log('\n⏭️  تم التخطي. يمكنك إعداد الجروب لاحقاً.\n');
      process.exit(0);
    }

    // التحقق من صحة معرف الجروب
    if (!groupId.includes('@g.us')) {
      console.log('\n❌ معرف الجروب غير صحيح!');
      console.log('💡 يجب أن ينتهي بـ @g.us\n');
      console.log('مثال صحيح: 123456789-123456789@g.us\n');
      process.exit(1);
    }

    // تفعيل الإرسال للجروب
    const enableGroup = await question('\nهل تريد تفعيل الإرسال للجروب؟ (نعم/لا): ');
    const sendToGroup = enableGroup.toLowerCase().startsWith('ن') || enableGroup.toLowerCase() === 'yes' ? 1 : 0;

    // تحديث قاعدة البيانات
    console.log('\n🔄 جاري تحديث قاعدة البيانات...');

    const stmt = db.prepare(`
      UPDATE families
      SET family_group_id = ?,
          send_to_group = ?
      WHERE id = ?
    `);

    const result = stmt.run(groupId, sendToGroup, selectedFamily.id);

    if (result.changes > 0) {
      console.log('✅ تم التحديث بنجاح!\n');

      // عرض الإعدادات الجديدة
      const updated = db.prepare('SELECT * FROM families WHERE id = ?').get(selectedFamily.id);
      console.log('📊 الإعدادات الجديدة:');
      console.log(`   العائلة: ${updated.family_name}`);
      console.log(`   معرف الجروب: ${updated.family_group_id}`);
      console.log(`   الإرسال للجروب: ${updated.send_to_group ? '✅ مفعّل' : '❌ معطّل'}\n`);

      if (sendToGroup) {
        console.log('✨ الخطوات التالية:\n');
        console.log('1. تأكد أن البوت عضو في الجروب');
        console.log('2. شغّل: npm run test:group');
        console.log('3. يجب أن تصل رسالة للجروب!\n');
      }
    } else {
      console.log('❌ فشل التحديث!\n');
    }

    db.close();

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    rl.close();
  }
}

main();
