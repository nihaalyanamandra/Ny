import { Weather } from '../types';
import { addDays } from 'date-fns';

export class WeatherService {
  /**
   * Get weather forecast for a location
   */
  static async getWeather(
    city: string,
    date: Date
  ): Promise<Weather> {
    // In production, this would call OpenWeatherMap or similar API
    // For now, we'll generate realistic mock data based on city and season
    return this.generateMockWeather(city, date);
  }

  /**
   * Get weather forecast for multiple days
   */
  static async getWeatherForecast(
    city: string,
    startDate: Date,
    days: number
  ): Promise<Weather[]> {
    const forecast: Weather[] = [];

    for (let i = 0; i < days; i++) {
      const date = addDays(startDate, i);
      forecast.push(await this.getWeather(city, date));
    }

    return forecast;
  }

  private static generateMockWeather(city: string, date: Date): Weather {
    const month = date.getMonth();
    const season = this.getSeason(month);
    const cityClimate = this.getCityClimate(city);

    // Generate realistic temperature based on city and season
    const baseTemp = cityClimate[season];
    const tempVariation = Math.floor(Math.random() * 8) - 4; // ±4°C variation
    const minTemp = baseTemp.min + tempVariation;
    const maxTemp = baseTemp.max + tempVariation;

    // Generate weather condition
    const conditions = this.getSeasonalConditions(season);
    const condition = conditions[Math.floor(Math.random() * conditions.length)];

    // Generate precipitation based on condition
    let precipitation = 0;
    if (condition.includes('rain')) precipitation = Math.floor(Math.random() * 15) + 5;
    if (condition.includes('shower')) precipitation = Math.floor(Math.random() * 8) + 2;

    return {
      location: city,
      date,
      temperature: {
        min: minTemp,
        max: maxTemp,
        unit: 'C'
      },
      condition,
      precipitation,
      humidity: Math.floor(Math.random() * 30) + 50, // 50-80%
      windSpeed: Math.floor(Math.random() * 20) + 5, // 5-25 km/h
      description: this.getWeatherDescription(condition, maxTemp)
    };
  }

  private static getSeason(month: number): string {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  private static getCityClimate(city: string): Record<string, { min: number; max: number }> {
    const climates: Record<string, Record<string, { min: number; max: number }>> = {
      'Barcelona': {
        spring: { min: 12, max: 19 },
        summer: { min: 22, max: 28 },
        fall: { min: 15, max: 22 },
        winter: { min: 8, max: 14 }
      },
      'Amsterdam': {
        spring: { min: 6, max: 14 },
        summer: { min: 14, max: 22 },
        fall: { min: 9, max: 15 },
        winter: { min: 2, max: 7 }
      },
      'Madrid': {
        spring: { min: 10, max: 20 },
        summer: { min: 20, max: 33 },
        fall: { min: 12, max: 21 },
        winter: { min: 4, max: 11 }
      },
      'Valencia': {
        spring: { min: 12, max: 21 },
        summer: { min: 22, max: 30 },
        fall: { min: 16, max: 24 },
        winter: { min: 9, max: 16 }
      },
      'Paris': {
        spring: { min: 8, max: 16 },
        summer: { min: 16, max: 25 },
        fall: { min: 10, max: 17 },
        winter: { min: 3, max: 8 }
      },
      'Brussels': {
        spring: { min: 7, max: 15 },
        summer: { min: 14, max: 23 },
        fall: { min: 9, max: 15 },
        winter: { min: 2, max: 7 }
      }
    };

    return climates[city] || {
      spring: { min: 10, max: 18 },
      summer: { min: 18, max: 26 },
      fall: { min: 12, max: 19 },
      winter: { min: 5, max: 10 }
    };
  }

  private static getSeasonalConditions(season: string): string[] {
    const conditions: Record<string, string[]> = {
      spring: ['Partly cloudy', 'Sunny', 'Light rain', 'Cloudy', 'Scattered showers'],
      summer: ['Sunny', 'Partly cloudy', 'Clear', 'Hot and sunny', 'Warm'],
      fall: ['Cloudy', 'Partly cloudy', 'Light rain', 'Overcast', 'Scattered showers'],
      winter: ['Cloudy', 'Overcast', 'Rain', 'Cold and cloudy', 'Drizzle']
    };

    return conditions[season] || conditions.spring;
  }

  private static getWeatherDescription(condition: string, temp: number): string {
    const descriptions: Record<string, string> = {
      'Sunny': 'Perfect weather for outdoor activities',
      'Clear': 'Beautiful clear skies',
      'Partly cloudy': 'Good weather with some clouds',
      'Cloudy': 'Overcast but dry',
      'Overcast': 'Gray skies, might rain',
      'Light rain': 'Bring an umbrella',
      'Rain': 'Rainy day, indoor activities recommended',
      'Scattered showers': 'Intermittent rain expected',
      'Drizzle': 'Light rain throughout the day',
      'Hot and sunny': 'Very warm, stay hydrated',
      'Warm': 'Pleasant warm weather',
      'Cold and cloudy': 'Bundle up, it\'s cold'
    };

    let description = descriptions[condition] || 'Check local forecast';

    if (temp > 30) description += '. Very hot!';
    if (temp < 5) description += '. Very cold!';

    return description;
  }

  /**
   * Get best time to visit a city
   */
  static getBestTimeToVisit(city: string): {
    best: string[];
    avoid: string[];
    notes: string;
  } {
    const recommendations: Record<string, any> = {
      'Barcelona': {
        best: ['April', 'May', 'September', 'October'],
        avoid: ['July', 'August'],
        notes: 'Summer is crowded and hot. Spring and fall offer perfect weather.'
      },
      'Amsterdam': {
        best: ['April', 'May', 'September'],
        avoid: ['November', 'December', 'January'],
        notes: 'April-May for tulips. Summer is busy. Winter is cold and rainy.'
      },
      'Madrid': {
        best: ['March', 'April', 'May', 'September', 'October'],
        avoid: ['July', 'August'],
        notes: 'Summer can be extremely hot (35°C+). Spring and fall are ideal.'
      },
      'Paris': {
        best: ['April', 'May', 'June', 'September', 'October'],
        avoid: ['August'],
        notes: 'August is peak tourist season. Spring is beautiful, fall is charming.'
      }
    };

    return recommendations[city] || {
      best: ['Spring', 'Fall'],
      avoid: ['Peak summer'],
      notes: 'Shoulder seasons typically offer best balance of weather and crowds.'
    };
  }
}
