/**
 * Daily Weather Service
 * خدمة الطقس اليومية - تذكير يومي بحالة الطقس ونصائح
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ClaudeClient } from '../utils/claudeClient.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DailyWeatherService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.dbPath = join(__dirname, '..', '..', 'data', 'family_assistant.db');
    this.claude = new ClaudeClient();

    // Default location: مدينة السلام، القاهرة
    this.location = {
      city: 'Madinat as Salam',
      country: 'EG',
      lat: 30.1833,
      lon: 31.3667
    };

    // استخدام Open-Meteo API - مجانية 100% بدون API Key
    // https://open-meteo.com/
  }

  /**
   * Send daily weather updates to all families
   */
  async sendDailyWeatherUpdates() {
    console.log('🌤️ Sending daily weather updates...');

    try {
      // Get weather data
      const weatherData = await this.getWeatherData();

      if (!weatherData) {
        console.error('❌ Failed to fetch weather data');
        return;
      }

      // Get all families
      const db = new Database(this.dbPath);
      const families = db.prepare(`
        SELECT DISTINCT f.id, f.family_name, f.family_group_id, f.send_to_group
        FROM families f
        WHERE f.onboarding_completed = 1
      `).all();
      db.close();

      // Generate weather message with AI
      const message = await this.generateWeatherMessage(weatherData);

      // Send to all families
      for (const family of families) {
        await this.sendToFamily(
          family.family_group_id,
          family.send_to_group,
          message
        );
        console.log(`✅ Sent weather update to ${family.family_name}`);
      }

      console.log('✅ Daily weather updates sent');

    } catch (error) {
      console.error('❌ Error sending weather updates:', error);
    }
  }

  /**
   * Get weather data from Open-Meteo API (مجانية 100%)
   */
  async getWeatherData() {
    try {
      // Open-Meteo API - مجانية بدون API Key
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${this.location.lat}&longitude=${this.location.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=precipitation_probability,uv_index&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Africa/Cairo&forecast_days=1`;

      const response = await axios.get(weatherUrl);
      const data = response.data;

      // Current conditions
      const current = data.current;
      const daily = data.daily;
      const hourly = data.hourly;

      // Get current UV index from hourly data
      const currentHour = new Date().getHours();
      const uvIndex = hourly.uv_index[currentHour] || 0;

      // Calculate rain probability for next 24 hours
      const rainProb = hourly.precipitation_probability.slice(0, 24);
      const avgRainProb = Math.round(
        rainProb.reduce((a, b) => a + (b || 0), 0) / rainProb.length
      );

      // Get weather description in Arabic
      const description = this.getWeatherDescription(current.weather_code);

      // Extract relevant data
      const weatherData = {
        // Current conditions
        temperature: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        pressure: 1013, // Not provided by Open-Meteo free tier

        // Weather description
        description: description,
        main: this.getWeatherMain(current.weather_code),
        icon: current.weather_code,

        // Wind
        windSpeed: Math.round(current.wind_speed_10m), // already in km/h
        windDirection: this.getWindDirection(current.wind_direction_10m),

        // Visibility (estimated based on weather code)
        visibility: this.getVisibility(current.weather_code),

        // Clouds & Rain
        clouds: current.cloud_cover,
        rain: current.rain || 0,

        // UV Index
        uvIndex: Math.round(uvIndex),

        // Sunrise/Sunset
        sunrise: new Date(daily.sunrise[0]),
        sunset: new Date(daily.sunset[0]),

        // Forecast for rain probability
        rainProbability: avgRainProb,

        // Min/Max for today
        tempMin: Math.round(daily.temperature_2m_min[0]),
        tempMax: Math.round(daily.temperature_2m_max[0])
      };

      return weatherData;

    } catch (error) {
      console.error('Error fetching weather data:', error.message);
      return null;
    }
  }

  /**
   * Get wind direction in Arabic
   */
  getWindDirection(degrees) {
    const directions = [
      'شمالي', 'شمالي شرقي', 'شرقي', 'جنوبي شرقي',
      'جنوبي', 'جنوبي غربي', 'غربي', 'شمالي غربي'
    ];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }

  /**
   * Get weather description in Arabic based on WMO code
   * https://open-meteo.com/en/docs
   */
  getWeatherDescription(code) {
    const descriptions = {
      0: 'صافٍ تماماً',
      1: 'صافٍ في الغالب',
      2: 'غائم جزئياً',
      3: 'غائم',
      45: 'ضباب',
      48: 'ضباب متجمد',
      51: 'رذاذ خفيف',
      53: 'رذاذ متوسط',
      55: 'رذاذ كثيف',
      61: 'مطر خفيف',
      63: 'مطر متوسط',
      65: 'مطر غزير',
      71: 'ثلج خفيف',
      73: 'ثلج متوسط',
      75: 'ثلج كثيف',
      80: 'زخات مطر خفيفة',
      81: 'زخات مطر متوسطة',
      82: 'زخات مطر غزيرة',
      95: 'عاصفة رعدية',
      96: 'عاصفة رعدية مع برَد خفيف',
      99: 'عاصفة رعدية مع برَد كثيف'
    };
    return descriptions[code] || 'غير معروف';
  }

  /**
   * Get main weather condition
   */
  getWeatherMain(code) {
    if (code === 0 || code === 1) return 'Clear';
    if (code === 2 || code === 3) return 'Clouds';
    if (code >= 45 && code <= 48) return 'Fog';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 61 && code <= 65) return 'Rain';
    if (code >= 71 && code <= 75) return 'Snow';
    if (code >= 80 && code <= 82) return 'Rain';
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Unknown';
  }

  /**
   * Estimate visibility based on weather code
   */
  getVisibility(code) {
    if (code >= 45 && code <= 48) return 1; // Fog: 1 km
    if (code >= 51 && code <= 65) return 5; // Rain/Drizzle: 5 km
    if (code >= 95 && code <= 99) return 3; // Thunderstorm: 3 km
    return 10; // Clear/Cloudy: 10 km
  }

  /**
   * Generate weather message with AI-powered advice
   */
  async generateWeatherMessage(weather) {
    const timeOfDay = this.getTimeOfDay();

    const systemPrompt = `أنت خبير طقس متخصص في تقديم نصائح عملية للعائلات المصرية بناءً على حالة الطقس.
تقدم نصائح صحية وعملية بلغة دافئة ومفيدة.`;

    const userPrompt = `اكتب تذكير يومي بحالة الطقس اليوم في مدينة السلام، القاهرة مع نصائح عملية.

**بيانات الطقس الحالية:**
🌡️ درجة الحرارة: ${weather.temperature}°م (تبدو كـ ${weather.feelsLike}°م)
📊 النطاق: ${weather.tempMin}°م - ${weather.tempMax}°م
💧 الرطوبة: ${weather.humidity}%
☁️ الغيوم: ${weather.clouds}%
🌧️ احتمال مطر خلال 24 ساعة: ${weather.rainProbability}%
${weather.rain > 0 ? `💧 كمية المطر: ${weather.rain} مم` : ''}
🌬️ الرياح: ${weather.windSpeed} كم/س (${weather.windDirection})
👁️ الرؤية: ${weather.visibility} كم
☀️ الأشعة فوق البنفسجية: ${weather.uvIndex} ${this.getUVCategory(weather.uvIndex)}
🌅 شروق: ${weather.sunrise.toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})}
🌇 غروب: ${weather.sunset.toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})}
📝 الوصف: ${weather.description}

**المطلوب:**
1. عنوان جذاب (🌤️ حالة الطقس اليوم - ${timeOfDay})
2. ملخص سريع لحالة الطقس (سطرين)
3. **نصائح عملية ذكية** حسب الحالة:

   **للحرارة:**
   - إذا > 35°: تحذير من الحر، تجنب الخروج وقت الذروة، شرب ماء كثير
   - إذا < 15°: ملابس دافئة، حماية الأطفال

   **للرطوبة:**
   - إذا > 70%: تشغيل مكيف/مروحة، تجنب المجهود، عدم تجفيف ملابس داخل
   - إذا < 30%: تشغيل مرطب، شرب ماء، ترطيب بشرة الأطفال

   **للرياح:**
   - إذا > 30 كم/س: تحذير من الغبار، غلق النوافذ، عدم نشر غسيل

   **للرؤية:**
   - إذا < 5 كم: تحذير شبورة، قيادة حذرة، إنارة مبكرة
   - إذا < 1 كم: تجنب القيادة تماماً

   **للأشعة UV:**
   - إذا > 6: واقي شمس ضروري، قبعة، تجنب الشمس 11ص-3م
   - للأطفال: حماية إضافية

   **للمطر:**
   - إذا > 50%: خذ مظلة، أحذية مناسبة، تأخير غسيل

   **لتهوية المنزل:**
   - أفضل وقت للتهوية (حسب الحرارة والرطوبة)
   - كم دقيقة مناسبة

4. **نصائح للأطفال الصغار** (ملابس، حماية، أنشطة)
5. دعوة للاستمتاع باليوم بأمان

**المواصفات:**
- الطول: 220-280 كلمة
- لغة عملية ودافئة
- إيموجي مناسب
- نصائح قابلة للتنفيذ فوراً
- تنظيم واضح

اجعل الرسالة مفيدة وعملية للعائلات!`;

    try {
      const message = await this.claude.generateText(systemPrompt, userPrompt, {
        temperature: 0.7,
        maxTokens: 1200
      });

      return message.trim();

    } catch (error) {
      console.error('Error generating weather message:', error);
      // Fallback message
      return this.generateFallbackWeatherMessage(weather);
    }
  }

  /**
   * Get UV category in Arabic
   */
  getUVCategory(uvIndex) {
    if (uvIndex < 3) return '(منخفض)';
    if (uvIndex < 6) return '(متوسط)';
    if (uvIndex < 8) return '(مرتفع)';
    if (uvIndex < 11) return '(مرتفع جداً)';
    return '(خطير)';
  }

  /**
   * Get time of day in Arabic
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباحاً';
    if (hour < 17) return 'ظهراً';
    if (hour < 20) return 'مساءً';
    return 'ليلاً';
  }

  /**
   * Generate fallback weather message
   */
  generateFallbackWeatherMessage(weather) {
    return `
🌤️ *حالة الطقس اليوم - مدينة السلام، القاهرة*

🌡️ **درجة الحرارة**: ${weather.temperature}°م (${weather.tempMin}° - ${weather.tempMax}°)
💧 **الرطوبة**: ${weather.humidity}%
🌬️ **الرياح**: ${weather.windSpeed} كم/س
☀️ **الأشعة UV**: ${weather.uvIndex} ${this.getUVCategory(weather.uvIndex)}
🌧️ **احتمال مطر**: ${weather.rainProbability}%

📝 *${weather.description}*

**نصائح اليوم:**
${weather.temperature > 35 ? '🔥 حر شديد - اشربوا ماء كثير وتجنبوا الشمس!' : ''}
${weather.humidity > 70 ? '💧 رطوبة عالية - شغّلوا المكيف أو المروحة!' : ''}
${weather.humidity < 30 ? '🌵 جفاف - شغّلوا المرطب واشربوا ماء!' : ''}
${weather.uvIndex > 6 ? '☀️ أشعة قوية - استخدموا واقي شمس!' : ''}
${weather.rainProbability > 50 ? '☔ احتمال مطر - خذوا مظلة!' : ''}
${weather.visibility < 5 ? '🌫️ شبورة - قيادة حذرة!' : ''}

اعتنوا بأنفسكم وبأطفالكم! 💙
    `.trim();
  }

  /**
   * Send message to family
   */
  async sendToFamily(groupId, sendToGroup, message) {
    try {
      if (sendToGroup && groupId) {
        await this.bot.sendMessage(groupId, message);
      }
    } catch (error) {
      console.error('Error sending weather message:', error);
    }
  }
}

export default DailyWeatherService;
