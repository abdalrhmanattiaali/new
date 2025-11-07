/**
 * Weather Service
 * خدمة حالة الطقس
 */

import dotenv from 'dotenv';

dotenv.config();

export class WeatherService {
  constructor(config) {
    this.config = config;
    this.apiKey = process.env.WEATHER_API_KEY;
    this.provider = config.weather?.provider || 'openweather';
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get weather for a city
   */
  async getWeather(city = 'Cairo') {
    // Check cache
    const cached = this.getCached(city);
    if (cached) {
      return cached;
    }

    try {
      let weather;

      if (this.provider === 'openweather' && this.apiKey) {
        weather = await this.getOpenWeatherData(city);
      } else {
        // Fallback to estimation based on month
        weather = this.getEstimatedWeather(city);
      }

      // Cache the result
      this.setCache(city, weather);

      return weather;

    } catch (error) {
      console.error('Error fetching weather:', error);
      return this.getEstimatedWeather(city);
    }
  }

  /**
   * Get weather from OpenWeather API
   */
  async getOpenWeatherData(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric&lang=ar`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      description: data.weather[0].description,
      condition: this.mapCondition(data.weather[0].main),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
      icon: data.weather[0].icon,
      city: data.name,
      timestamp: Date.now()
    };
  }

  /**
   * Get estimated weather based on month (fallback)
   */
  getEstimatedWeather(city = 'Cairo') {
    const month = new Date().getMonth() + 1; // 1-12
    const hour = new Date().getHours();

    // Cairo temperature estimation by month
    const tempEstimates = {
      1: { day: 18, night: 10 },  // January
      2: { day: 20, night: 11 },  // February
      3: { day: 23, night: 13 },  // March
      4: { day: 28, night: 16 },  // April
      5: { day: 32, night: 20 },  // May
      6: { day: 34, night: 23 },  // June
      7: { day: 35, night: 24 },  // July
      8: { day: 35, night: 24 },  // August
      9: { day: 32, night: 22 },  // September
      10: { day: 28, night: 19 }, // October
      11: { day: 24, night: 15 }, // November
      12: { day: 19, night: 11 }  // December
    };

    const isDay = hour >= 6 && hour < 18;
    const temp = isDay ? tempEstimates[month].day : tempEstimates[month].night;

    // Determine condition based on season
    let condition = 'clear';
    if (month >= 11 || month <= 2) {
      condition = Math.random() > 0.7 ? 'clouds' : 'clear';
    } else if (month >= 6 && month <= 8) {
      condition = 'clear'; // Summer is always clear
    }

    return {
      temp,
      feelsLike: temp,
      description: this.getArabicDescription(condition, isDay),
      condition,
      humidity: 50,
      windSpeed: 15,
      icon: this.getWeatherIcon(condition, isDay),
      city: city,
      timestamp: Date.now(),
      estimated: true
    };
  }

  /**
   * Map OpenWeather condition to simplified condition
   */
  mapCondition(weatherMain) {
    const mapping = {
      'Clear': 'clear',
      'Clouds': 'clouds',
      'Rain': 'rain',
      'Drizzle': 'rain',
      'Thunderstorm': 'storm',
      'Snow': 'snow',
      'Mist': 'mist',
      'Fog': 'mist',
      'Haze': 'mist'
    };

    return mapping[weatherMain] || 'clear';
  }

  /**
   * Get Arabic description for weather
   */
  getArabicDescription(condition, isDay) {
    const descriptions = {
      clear: isDay ? 'سماء صافية' : 'سماء صافية ليلاً',
      clouds: 'غيوم متفرقة',
      rain: 'أمطار',
      storm: 'عواصف رعدية',
      snow: 'ثلوج',
      mist: 'ضباب خفيف'
    };

    return descriptions[condition] || 'معتدل';
  }

  /**
   * Get weather icon
   */
  getWeatherIcon(condition, isDay) {
    const icons = {
      clear: isDay ? '☀️' : '🌙',
      clouds: '⛅',
      rain: '🌧️',
      storm: '⛈️',
      snow: '❄️',
      mist: '🌫️'
    };

    return icons[condition] || '☀️';
  }

  /**
   * Get activity suggestion based on weather
   */
  getActivitySuggestion(weather) {
    const temp = weather.temp;
    const condition = weather.condition;

    // Too hot
    if (temp > 35) {
      return {
        outdoor: false,
        suggestion: 'الجو حار جداً! يُفضل اللعب داخل المنزل والإكثار من السوائل.',
        icon: '🌡️'
      };
    }

    // Too cold
    if (temp < 12) {
      return {
        outdoor: false,
        suggestion: 'الجو بارد! تأكد من إلباس الطفل ملابس دافئة أو اللعب داخل المنزل.',
        icon: '🧥'
      };
    }

    // Rainy
    if (condition === 'rain' || condition === 'storm') {
      return {
        outdoor: false,
        suggestion: 'الجو ممطر! وقت مثالي لألعاب منزلية أو قراءة قصص.',
        icon: '☔'
      };
    }

    // Perfect weather
    if (temp >= 18 && temp <= 28 && condition === 'clear') {
      return {
        outdoor: true,
        suggestion: 'الجو رائع! وقت مثالي للعب في الخارج أو نزهة في الحديقة.',
        icon: '🌟'
      };
    }

    // Good weather
    return {
      outdoor: true,
      suggestion: 'الجو مناسب للخروج! يمكن اللعب في الهواء الطلق مع الحذر.',
      icon: '👍'
    };
  }

  /**
   * Format weather message
   */
  formatWeatherMessage(weather) {
    const activity = this.getActivitySuggestion(weather);

    return `
${weather.icon} *الطقس الآن في ${weather.city}:*
🌡️ الحرارة: ${weather.temp}°م
💨 الرياح: ${weather.windSpeed} كم/س
💧 الرطوبة: ${weather.humidity}%

${activity.icon} ${activity.suggestion}
${weather.estimated ? '\n_تقدير تقريبي - للحصول على بيانات دقيقة، أضف WEATHER_API_KEY_' : ''}
    `.trim();
  }

  /**
   * Check if weather is suitable for outdoor activities
   */
  isSuitableForOutdoor(weather) {
    return this.getActivitySuggestion(weather).outdoor;
  }

  /**
   * Get cached weather
   */
  getCached(city) {
    const cached = this.cache.get(city);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached;
    }
    return null;
  }

  /**
   * Set cache
   */
  setCache(city, weather) {
    this.cache.set(city, weather);

    // Clear old cache entries
    setTimeout(() => {
      this.cache.delete(city);
    }, this.cacheTimeout);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default WeatherService;
