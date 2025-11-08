# 🚀 دليل تشغيل التطبيق بشكل دائم (24/7)

هذا الدليل يشرح كيفية تشغيل مساعد الواتساب العائلي بشكل مستمر بدون الاعتماد على الترمينال باستخدام **PM2**.

## 📋 المتطلبات

- Node.js >= 18.0.0
- npm

## 🔧 خطوات الإعداد

### 1️⃣ تثبيت PM2

قم بتثبيت PM2 عالمياً (Global):

```bash
npm install -g pm2
```

أو قم بتثبيت المكتبات المحلية فقط:

```bash
npm install
```

### 2️⃣ تشغيل التطبيق بـ PM2

بعد التثبيت، قم بتشغيل التطبيق:

```bash
npm run pm2:start
```

أو مباشرة:

```bash
pm2 start ecosystem.config.js
```

### 3️⃣ التأكد من التشغيل

تحقق من حالة التطبيق:

```bash
npm run pm2:status
```

أو:

```bash
pm2 status
```

يجب أن ترى شيئاً مثل:

```
┌────┬────────────────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id │ name                   │ mode        │ ↺       │ status  │ cpu      │
├────┼────────────────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0  │ whatsapp-family-ai     │ fork        │ 0       │ online  │ 0%       │
└────┴────────────────────────┴─────────────┴─────────┴─────────┴──────────┘
```

## 📊 مراقبة التطبيق

### مشاهدة اللوجات مباشرة:

```bash
npm run pm2:logs
```

أو:

```bash
pm2 logs whatsapp-family-ai
```

### واجهة المراقبة التفاعلية:

```bash
npm run pm2:monit
```

أو:

```bash
pm2 monit
```

## 🎮 التحكم بالتطبيق

### إيقاف التطبيق:

```bash
npm run pm2:stop
```

### إعادة تشغيل التطبيق:

```bash
npm run pm2:restart
```

### حذف التطبيق من PM2:

```bash
npm run pm2:delete
```

## 🔄 التشغيل التلقائي عند إعادة تشغيل السيرفر

لضمان أن التطبيق يعمل تلقائياً عند إعادة تشغيل الجهاز/السيرفر:

### 1. إعداد Startup Script:

```bash
npm run pm2:startup
```

أو:

```bash
pm2 startup
```

**سينتج الأمر السابق أمراً يجب تنفيذه.** قم بنسخ الأمر وتنفيذه (قد يحتاج sudo).

مثال على الأمر الناتج:

```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u your_user --hp /home/your_user
```

### 2. حفظ قائمة التطبيقات الحالية:

بعد تشغيل التطبيق بـ PM2، احفظ الحالة:

```bash
npm run pm2:save
```

أو:

```bash
pm2 save
```

**الآن التطبيق سيعمل تلقائياً عند إعادة تشغيل الجهاز! 🎉**

## 🗂️ ملفات اللوجات

يتم حفظ اللوجات في:

- `./logs/pm2-error.log` - أخطاء التطبيق
- `./logs/pm2-out.log` - مخرجات التطبيق (console.log)
- `./logs/pm2-combined.log` - كل اللوجات مجمعة

## ⚙️ إعدادات PM2 (ecosystem.config.js)

الإعدادات الحالية:

- ✅ **إعادة تشغيل تلقائية**: عند توقف التطبيق أو حدوث خطأ
- ✅ **حد الذاكرة**: 1GB (يعيد التشغيل عند الوصول للحد)
- ✅ **إعادة تشغيل يومية**: كل يوم الساعة 4 صباحاً (لتحرير الذاكرة)
- ✅ **لوجات موحدة**: كل اللوجات في مكان واحد
- ✅ **حد إعادة التشغيل**: 10 مرات كحد أقصى

## 🔍 أوامر إضافية مفيدة

### مشاهدة معلومات مفصلة:

```bash
pm2 show whatsapp-family-ai
```

### حذف جميع اللوجات:

```bash
pm2 flush
```

### إعادة تحميل التطبيق بدون downtime:

```bash
pm2 reload whatsapp-family-ai
```

### إيقاف جميع التطبيقات:

```bash
pm2 stop all
```

### حذف جميع التطبيقات من PM2:

```bash
pm2 delete all
```

## 🖥️ تشغيل على VPS / Cloud Server

### خيارات الاستضافة المقترحة:

1. **DigitalOcean** - Droplet بـ $6/شهر
2. **AWS EC2** - Free tier أول سنة
3. **Heroku** - لكن قد لا يدعم WhatsApp Web بشكل جيد
4. **Contabo** - VPS رخيص بـ €4/شهر
5. **Vultr** - VPS بـ $6/شهر

### متطلبات VPS:

- **RAM**: 1GB على الأقل (مفضل 2GB)
- **CPU**: 1 vCPU
- **Storage**: 20GB على الأقل
- **نظام التشغيل**: Ubuntu 20.04+ أو Debian 11+

### خطوات التشغيل على VPS:

1. **رفع الكود للسيرفر**:

```bash
# من جهازك المحلي
git clone your-repo
cd your-repo
```

2. **تثبيت Node.js على VPS**:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **تثبيت المكتبات**:

```bash
npm install
npm install -g pm2
```

4. **إعداد ملف .env**:

```bash
cp .env.example .env
nano .env  # أضف API Keys الخاصة بك
```

5. **تشغيل التطبيق**:

```bash
npm run pm2:start
npm run pm2:startup
# اتبع التعليمات الناتجة
npm run pm2:save
```

6. **التأكد من عمل التطبيق**:

```bash
pm2 status
pm2 logs
```

## 🚨 حل المشاكل الشائعة

### المشكلة: WhatsApp لا يتصل

**الحل**: تأكد من أن ملف `wwebjs_auth` محفوظ بشكل صحيح وأن لديك صلاحيات القراءة/الكتابة.

```bash
ls -la .wwebjs_auth/
```

### المشكلة: التطبيق يتوقف بشكل متكرر

**الحل**: راجع اللوجات:

```bash
pm2 logs whatsapp-family-ai --lines 100
```

### المشكلة: الذاكرة تزداد بشكل مستمر

**الحل**: تم إعداد PM2 لإعادة التشغيل عند 1GB، ولكن يمكنك تقليل الحد:

```javascript
// في ecosystem.config.js
max_memory_restart: '512M'
```

### المشكلة: عدم وصول الرسائل المجدولة

**الحل**: تحقق من timezone السيرفر:

```bash
timedatectl  # Linux
date         # عرض التاريخ والوقت الحالي
```

إذا كانت المنطقة الزمنية خاطئة:

```bash
sudo timedatectl set-timezone Africa/Cairo
```

## 📱 الخطوة التالية: مسح QR Code

عند أول تشغيل، ستحتاج لمسح QR Code من WhatsApp:

1. قم بتشغيل `pm2 logs` لرؤية اللوجات
2. سيظهر QR Code في الترمينال
3. افتح WhatsApp على هاتفك
4. اذهب لـ: الإعدادات > الأجهزة المرتبطة > ربط جهاز
5. امسح الـ QR Code

**بعد المسح، يمكنك إغلاق الترمينال والتطبيق سيستمر في العمل!** 🎉

## 🔐 نصائح الأمان

1. **لا تشارك ملف `.env`** - يحتوي على API Keys
2. **استخدم Firewall** على VPS
3. **احتفظ بنسخة احتياطية** من `data/family_assistant.db`
4. **راجع اللوجات بانتظام** للتحقق من عدم وجود أخطاء

## 📞 الدعم

إذا واجهت أي مشاكل:

1. راجع اللوجات: `pm2 logs`
2. راجع حالة التطبيق: `pm2 status`
3. راجع ملف `ecosystem.config.js`
4. تأكد من أن جميع environment variables في `.env` صحيحة

---

**تم بنجاح! 🚀 التطبيق الآن يعمل 24/7 بدون الحاجة للترمينال!**
