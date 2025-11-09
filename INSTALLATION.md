# 📦 دليل التثبيت الكامل - Complete Installation Guide

## 🎯 المتطلبات الأساسية

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- اتصال بالإنترنت لتثبيت المكتبات

---

## 🚀 خطوات التثبيت السريع

### 1️⃣ تثبيت المكتبات

```bash
npm install
```

### 2️⃣ إنشاء ملف .env (اختياري)

الكود يعمل بدون ملف .env لأن API Keys مضمنة، ولكن يمكنك إنشاؤه للإعدادات الأخرى:

```bash
cp .env.example .env
```

### 3️⃣ تهيئة قاعدة البيانات

```bash
npm run db:init
```

### 4️⃣ تشغيل الاختبار الشامل للذكاء الاصطناعي

```bash
npm run test:ai
```

يجب أن ترى:
```
✅ [1/6] ClaudeClient ✓
✅ [2/6] LLMService ✓
✅ [3/6] WeatherService ✓
✅ [4/6] ChildDevelopment ✓
✅ [5/6] MonthlyMilestone ✓
✅ [6/6] Performance ✓

🎉 تهانينا! جميع الاختبارات نجحت!
```

### 5️⃣ تشغيل التطبيق

```bash
# للتشغيل العادي
npm start

# أو للتشغيل المستمر بـ PM2
npm run pm2:start
```

---

## 🔧 حل المشاكل الشائعة

### ❌ مشكلة: npm error 403 Forbidden

إذا واجهت خطأ `403 Forbidden` عند تثبيت `@anthropic-ai/sdk`:

**الحل 1: استخدام npm بدون cache**
```bash
npm cache clean --force
npm install --no-cache
```

**الحل 2: تثبيت المكتبات واحدة واحدة**
```bash
npm install whatsapp-web.js@^1.23.0
npm install qrcode-terminal@^0.12.0
npm install better-sqlite3@^9.2.2
npm install node-cron@^3.0.3
npm install yaml@^2.3.4
npm install dotenv@^16.3.1
npm install openai@^4.20.1
npm install @anthropic-ai/sdk@^0.32.1
npm install axios@^1.7.9
npm install pm2@^5.4.2
npm install chromadb@^1.7.3
npm install date-fns@^3.0.6
npm install date-fns-tz@^2.0.0
npm install crypto-js@^4.2.0
npm install chokidar@^3.5.3
```

**الحل 3: استخدام yarn بدلاً من npm**
```bash
npm install -g yarn
yarn install
```

**الحل 4: تثبيت من GitHub مباشرة (Anthropic SDK فقط)**
```bash
npm install anthropics/anthropic-sdk-typescript
```

---

### ❌ مشكلة: Cannot find module '@anthropic-ai/sdk'

**الحل:**
```bash
npm install @anthropic-ai/sdk@latest
```

---

### ❌ مشكلة: Database locked

**الحل:**
```bash
# أغلق جميع التطبيقات التي تستخدم قاعدة البيانات
pm2 stop all

# امسح ملفات القفل
rm -f data/*.db-shm data/*.db-wal

# أعد تهيئة قاعدة البيانات
npm run db:init
```

---

### ❌ مشكلة: WhatsApp QR Code لا يظهر

**الحل:**
```bash
# احذف الجلسة القديمة
rm -rf .wwebjs_auth/

# أعد تشغيل التطبيق
npm start
```

---

## 🧪 اختبار التثبيت

### اختبار الذكاء الاصطناعي (موصى به)

```bash
npm run test:ai
```

هذا الاختبار يتحقق من:
- ✅ اتصال Claude API
- ✅ توليد الرسائل بالذكاء الاصطناعي
- ✅ خدمة الطقس (Open-Meteo)
- ✅ خدمة تطوير الطفل
- ✅ خدمة المعالم الشهرية
- ✅ أداء الـ API

### اختبارات أخرى

```bash
# اختبار الطقس
npm run test:weather

# اختبار رسالة محددة
npm run test:message child_play

# اختبار خطة نهاية الأسبوع
npm run test:weekend

# اختبار التقرير الأسبوعي
npm run test:report
```

---

## 📊 التحقق من تثبيت المكتبات

```bash
# عرض جميع المكتبات المثبتة
npm list --depth=0

# التحقق من مكتبات محددة
npm list @anthropic-ai/sdk
npm list whatsapp-web.js
npm list better-sqlite3
```

يجب أن ترى:
```
├── @anthropic-ai/sdk@0.32.1
├── axios@1.7.9
├── better-sqlite3@9.2.2
├── chokidar@3.5.3
├── chromadb@1.7.3
├── crypto-js@4.2.0
├── date-fns@3.0.6
├── date-fns-tz@2.0.0
├── dotenv@16.3.1
├── node-cron@3.0.3
├── openai@4.20.1
├── pm2@5.4.2
├── qrcode-terminal@0.12.0
├── whatsapp-web.js@1.23.0
└── yaml@2.3.4
```

---

## 🔑 التحقق من API Keys

API Keys مضمنة مشفرة في الكود ولا تحتاج لإعداد، ولكن يمكنك التحقق:

```bash
# التحقق من أن الملفات تحتوي على API Keys مشفرة
grep -q "ENCODED_KEY" src/utils/claudeClient.js && echo "✅ API Key موجود"
grep -q "ENCODED_KEY" src/ai/llm.js && echo "✅ API Key موجود"
```

---

## 🌐 التحقق من اتصال الإنترنت

```bash
# اختبار Open-Meteo API (خدمة الطقس)
curl "https://api.open-meteo.com/v1/forecast?latitude=30.18&longitude=31.37&current=temperature_2m"

# اختبار Anthropic API (يتطلب API Key)
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

---

## 📝 متطلبات النظام

### الحد الأدنى:
- **RAM**: 512 MB
- **CPU**: 1 core
- **Storage**: 500 MB
- **OS**: Linux, macOS, Windows (مع WSL2)

### الموصى به:
- **RAM**: 1 GB+
- **CPU**: 2 cores
- **Storage**: 2 GB
- **OS**: Ubuntu 20.04+ / macOS 12+ / Windows 11 (WSL2)

---

## 🎯 التحقق النهائي

بعد إكمال التثبيت، قم بتشغيل هذه الأوامر للتحقق:

```bash
# 1. التحقق من Node.js
node --version
# يجب أن يكون >= v18.0.0

# 2. التحقق من npm
npm --version
# يجب أن يكون >= 8.0.0

# 3. التحقق من المكتبات
npm list --depth=0 | grep -E '@anthropic|whatsapp|better-sqlite'

# 4. تشغيل اختبار الذكاء الاصطناعي
npm run test:ai

# 5. التحقق من قاعدة البيانات
ls -lh data/family_assistant.db
```

إذا نجحت جميع الخطوات:
```
🎉 التثبيت مكتمل بنجاح!
✅ جميع المكتبات مثبتة
✅ قاعدة البيانات جاهزة
✅ الذكاء الاصطناعي يعمل
✅ خدمة الطقس تعمل
```

---

## 🚀 الخطوات التالية

1. **مسح QR Code للاتصال بـ WhatsApp**:
   ```bash
   npm start
   # امسح الـ QR Code من هاتفك
   ```

2. **إعداد عائلة تجريبية**:
   - أرسل "ابدأ" للبوت على WhatsApp
   - أكمل عملية Onboarding

3. **تشغيل بشكل دائم**:
   ```bash
   npm run pm2:start
   npm run pm2:startup
   npm run pm2:save
   ```

4. **مراقبة التطبيق**:
   ```bash
   npm run pm2:logs
   npm run pm2:monit
   ```

---

## 📞 المساعدة

إذا واجهت أي مشاكل:

1. راجع هذا الدليل
2. راجع ملف `PM2_GUIDE.md` للتشغيل المستمر
3. راجع اللوجات: `npm run pm2:logs`
4. شغّل الاختبار الشامل: `npm run test:ai`

---

**تم بنجاح! التطبيق جاهز للعمل 🎉**
