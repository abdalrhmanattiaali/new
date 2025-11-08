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

    // OpenWeatherMap API (مجاني حتى 1000 طلب يومياً)
    this.weatherApiKey = process.env.OPENWEATHER_API_KEY;
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
   * Get weather data from OpenWeatherMap API
   */
  async getWeatherData() {
    try {
      // Current weather + forecast
      const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${this.location.lat}&lon=${this.location.lon}&appid=${this.weatherApiKey}&units=metric&lang=ar`;

      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${this.location.lat}&lon=${this.location.lon}&appid=${this.weatherApiKey}&units=metric&lang=ar`;

      const uvUrl = `https://api.openweathermap.org/data/2.5/uvi?lat=${this.location.lat}&lon=${this.location.lon}&appid=${this.weatherApiKey}`;

      const [currentResponse, forecastResponse, uvResponse] = await Promise.all([
        axios.get(currentWeatherUrl),
        axios.get(forecastUrl),
        axios.get(uvUrl)
      ]);

      const current = currentResponse.data;
      const forecast = forecastResponse.data;
      const uv = uvResponse.data;

      // Extract relevant data
      const weatherData = {
        // Current conditions
        temperature: Math.round(current.main.temp),
        feelsLike: Math.round(current.main.feels_like),
        humidity: current.main.humidity,
        pressure: current.main.pressure,

        // Weather description
        description: current.weather[0].description,
        main: current.weather[0].main,
        icon: current.weather[0].icon,

        // Wind
        windSpeed: Math.round(current.wind.speed * 3.6), // m/s to km/h
        windDirection: this.getWindDirection(current.wind.deg),

        // Visibility
        visibility: current.visibility / 1000, // meters to km

        // Clouds & Rain
        clouds: current.clouds.all,
        rain: current.rain ? current.rain['1h'] || 0 : 0,

        // UV Index
        uvIndex: uv.value,

        // Sunrise/Sunset
        sunrise: new Date(current.sys.sunrise * 1000),
        sunset: new Date(current.sys.sunset * 1000),

        // Forecast for rain probability
        rainProbability: this.getRainProbability(forecast.list),

        // Min/Max for today
        tempMin: Math.round(current.main.temp_min),
        tempMax: Math.round(current.main.temp_max)
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
   * Calculate rain probability from forecast
   */
  getRainProbability(forecastList) {
    // Check next 24 hours
    const next24Hours = forecastList.slice(0, 8); // 8 * 3-hour intervals = 24 hours

    let rainCount = 0;
    for (const item of next24Hours) {
      if (item.weather[0].main === 'Rain' || item.pop > 0.3) {
        rainCount++;
      }
    }

    return Math.round((rainCount / next24Hours.length) * 100);
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
