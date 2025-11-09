# 🔑 كيفية إضافة API Key

## ⚠️ مهم جداً: API Key غير صحيح حالياً!

يجب استبدال `PLACEHOLDER` بـ API Key الحقيقي من Anthropic.

---

## 📝 الخطوات:

### 1️⃣ احصل على API Key من Anthropic

1. اذهب إلى: https://console.anthropic.com/settings/keys
2. سجّل دخول أو أنشئ حساب جديد
3. اضغط على "Create Key"
4. انسخ الـ API Key (يبدأ بـ `sk-ant-api03-...`)

### 2️⃣ ضع API Key في الملف

افتح ملف **`src/index.js`** وابحث عن السطر التالي:

```javascript
global.ANTHROPIC_API_KEY = 'sk-ant-api03-PLACEHOLDER-REPLACE-WITH-YOUR-REAL-KEY';
```

استبدله بـ:

```javascript
global.ANTHROPIC_API_KEY = 'sk-ant-api03-YOUR-ACTUAL-API-KEY-HERE';
```

### 3️⃣ (اختياري) إذا كنت تريد اختبار بدون تشغيل التطبيق كامل

افتح ملف **`src/test-ai.js`** وعدّل نفس السطر:

```javascript
global.ANTHROPIC_API_KEY = 'sk-ant-api03-YOUR-ACTUAL-API-KEY-HERE';
```

---

## 🧪 اختبر أن API Key يعمل

بعد وضع API Key الصحيح:

```bash
npm run test:ai
```

يجب أن ترى:

```
✅ [1/6] ClaudeClient ✓ (500-1000ms)
✅ [2/6] LLMService ✓ (1000-2000ms)
✅ [3/6] WeatherService ✓ (500ms)
✅ [4/6] ChildDevelopment ✓ (1000-2000ms)
✅ [5/6] MonthlyMilestone ✓ (1000-2000ms)
✅ [6/6] Performance ✓ (3000-5000ms)

🎉 تهانينا! جميع الاختبارات نجحت!
```

---

## ❌ إذا ظهر خطأ 401

```
AuthenticationError: 401 invalid x-api-key
```

معنى الخطأ: API Key غير صحيح أو منتهي

**الحل:**
1. تأكد أنك نسخت API Key كاملاً
2. تأكد أنه لا يوجد مسافات قبل أو بعد الـ Key
3. تأكد أن API Key ما زال صالح في لوحة Anthropic
4. جرّب إنشاء API Key جديد

---

## 📁 أين يوجد API Key؟

API Key موجود في **سطرين فقط** في المشروع:

1. **`src/index.js`** - السطر 10 (للتطبيق الرئيسي)
2. **`src/test-ai.js`** - السطر 10 (لاختبار الذكاء الاصطناعي)

يمكنك البحث عن:
```
global.ANTHROPIC_API_KEY
```

---

## 🔒 الأمان

⚠️ **لا ترفع API Key إلى GitHub!**

الملفات التالية **لن** ترفع إلى GitHub (موجودة في `.gitignore`):
- لا يوجد - API Key في الكود نفسه

❌ **تحذير:** هذا الحل سهل للتطوير لكنه **غير آمن** للإنتاج!

**للإنتاج:** استخدم متغيرات البيئة:
```bash
# في ملف .env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

ثم عدّل الكود ليقرأ من `.env` فقط.

---

## ✅ بعد وضع API Key

1. شغّل الاختبار: `npm run test:ai`
2. إذا نجحت الاختبارات ← API Key صحيح ✅
3. شغّل التطبيق: `npm start`
4. امسح QR Code من WhatsApp
5. ابدأ الاستخدام!

---

**الدعم:** إذا واجهت مشاكل، راجع [INSTALLATION.md](INSTALLATION.md)
