import Anthropic from '@anthropic-ai/sdk';
import {
  TripRequest,
  TripItinerary,
  AIRecommendation,
  FlightOption,
  Accommodation,
  Activity,
  DayTrip,
  DailyItinerary,
  Weather
} from '../types';
import { FlightService } from './flightService';
import { AccommodationService } from './accommodationService';
import { ActivityService } from './activityService';
import { TransportService } from './transportService';
import { WeatherService } from './weatherService';
import { VisaService } from './visaService';
import { addDays, differenceInDays } from 'date-fns';

export class AIService {
  private static client: Anthropic | null = null;

  private static getClient(): Anthropic | null {
    if (!this.client && process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
    return this.client;
  }

  /**
   * Generate complete trip recommendations
   */
  static async generateTripRecommendations(
    request: TripRequest
  ): Promise<AIRecommendation> {
    try {
      // 1. Validate visa restrictions
      const visaCheck = VisaService.validateTrip(
        [request.origin, request.destination, ...(request.returnFrom ? [request.returnFrom] : [])],
        request.visaRestrictions
      );

      // 2. Get flight options
      const flightOptions = await FlightService.getRoundTripOptions(
        request.origin,
        request.returnFrom || request.destination,
        request.startDate,
        request.endDate,
        request.travelers
      );

      // 3. Calculate trip duration
      const tripDays = differenceInDays(request.endDate, request.startDate) + 1;

      // 4. Generate multiple itinerary options
      const itineraries: TripItinerary[] = [];

      // Option 1: Budget-focused
      itineraries.push(
        await this.generateItinerary(request, flightOptions[2] || flightOptions[0], 'budget', tripDays)
      );

      // Option 2: Balanced
      itineraries.push(
        await this.generateItinerary(request, flightOptions[0], 'balanced', tripDays)
      );

      // Option 3: Premium
      if (flightOptions.length > 3) {
        itineraries.push(
          await this.generateItinerary(request, flightOptions[3], 'premium', tripDays)
        );
      }

      // 5. Use AI to analyze and provide recommendations
      const aiInsights = await this.getAIRecommendations(request, itineraries, visaCheck);

      // 6. Identify best options
      const cheapest = itineraries.reduce((prev, curr) =>
        curr.totalCost.total < prev.totalCost.total ? curr : prev
      ).id;

      const fastest = itineraries.reduce((prev, curr) =>
        curr.flights.totalDuration < prev.flights.totalDuration ? curr : prev
      ).id;

      const mostExperiences = itineraries.reduce((prev, curr) => {
        const prevActivities = prev.dailyItinerary.reduce((sum, day) => sum + day.activities.length, 0);
        const currActivities = curr.dailyItinerary.reduce((sum, day) => sum + day.activities.length, 0);
        return currActivities > prevActivities ? curr : prev;
      }).id;

      const recommended = itineraries.reduce((prev, curr) =>
        curr.score > prev.score ? curr : prev
      ).id;

      return {
        itineraries,
        comparisons: {
          cheapest,
          fastest,
          mostExperiences,
          recommended
        },
        tips: [
          ...aiInsights.tips,
          ...visaCheck.suggestions,
          ...this.getGeneralTips(request)
        ],
        warnings: [
          ...aiInsights.warnings,
          ...visaCheck.warnings
        ]
      };
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate a single itinerary
   */
  private static async generateItinerary(
    request: TripRequest,
    flights: FlightOption,
    style: 'budget' | 'balanced' | 'premium',
    tripDays: number
  ): Promise<TripItinerary> {
    // Determine accommodation types based on style
    const accommodationTypes = {
      budget: ['hostel' as const, 'apartment' as const],
      balanced: ['hotel' as const, 'apartment' as const],
      premium: ['hotel' as const, 'resort' as const]
    };

    // Get days in each location
    const daysInBarcelona = Math.floor(tripDays * 0.4);
    const daysInAmsterdam = tripDays - daysInBarcelona - 1; // -1 for travel day

    // Get accommodations
    const barcelonaAccommodations = await AccommodationService.searchAccommodations(
      request.destination,
      request.startDate,
      addDays(request.startDate, daysInBarcelona),
      request.travelers,
      accommodationTypes[style]
    );

    const travelDate = addDays(request.startDate, daysInBarcelona);
    const returnLocation = request.returnFrom || request.destination;

    const amsterdamAccommodations = await AccommodationService.searchAccommodations(
      returnLocation,
      travelDate,
      request.endDate,
      request.travelers,
      accommodationTypes[style]
    );

    // Select accommodations based on style
    const barcelonaAccommodation = style === 'budget'
      ? barcelonaAccommodations.sort((a, b) => a.pricePerNight - b.pricePerNight)[0]
      : barcelonaAccommodations[0];

    const amsterdamAccommodation = style === 'budget'
      ? amsterdamAccommodations.sort((a, b) => a.pricePerNight - b.pricePerNight)[0]
      : amsterdamAccommodations[0];

    // Get activities based on preferences and budget
    const budgetLevel = style === 'budget' ? 'low' : style === 'balanced' ? 'medium' : 'high';
    const barcelonaActivities = ActivityService.getActivities(
      request.destination.city,
      request.preferences.interests,
      budgetLevel
    );
    const amsterdamActivities = ActivityService.getActivities(
      returnLocation.city,
      request.preferences.interests,
      budgetLevel
    );

    // Get day trips
    const barcelonaDayTrips = ActivityService.getDayTrips(request.destination.city);
    const amsterdamDayTrips = ActivityService.getDayTrips(returnLocation.city);

    // Generate daily itinerary
    const dailyItinerary: DailyItinerary[] = [];
    let currentDate = request.startDate;
    let accommodationCost = 0;
    let activitiesCost = 0;
    let transportCost = 0;
    let foodCost = 0;

    // Barcelona days
    for (let i = 0; i < daysInBarcelona; i++) {
      const weather = await WeatherService.getWeather(request.destination.city, currentDate);
      const dayActivities = this.selectDayActivities(
        barcelonaActivities,
        request.preferences.pace,
        i,
        daysInBarcelona
      );

      dailyItinerary.push({
        day: i + 1,
        date: currentDate,
        location: request.destination.city,
        accommodation: barcelonaAccommodation,
        activities: dayActivities,
        meals: this.generateMeals(style),
        transport: [],
        weather,
        estimatedCost: this.calculateDayCost(dayActivities, barcelonaAccommodation, style),
        notes: i === 0 ? ['Arrival day - adjust based on flight arrival time'] : []
      });

      accommodationCost += barcelonaAccommodation.pricePerNight;
      activitiesCost += dayActivities.reduce((sum, a) => sum + a.activity.price, 0);
      foodCost += this.getDailyFoodBudget(style);

      currentDate = addDays(currentDate, 1);
    }

    // Travel day to Amsterdam
    const interCityTransport = await TransportService.getTransportOptions(
      request.destination.city,
      returnLocation.city,
      currentDate
    );

    if (interCityTransport.length > 0) {
      const selectedTransport = style === 'budget'
        ? interCityTransport.sort((a, b) => a.price - b.price)[0]
        : interCityTransport.filter(t => t.type === 'train')[0] || interCityTransport[0];

      transportCost += selectedTransport.price;
    }

    // Amsterdam days
    for (let i = 0; i < daysInAmsterdam; i++) {
      const weather = await WeatherService.getWeather(returnLocation.city, currentDate);
      const dayActivities = this.selectDayActivities(
        amsterdamActivities,
        request.preferences.pace,
        i,
        daysInAmsterdam
      );

      const isLastDay = i === daysInAmsterdam - 1;

      dailyItinerary.push({
        day: daysInBarcelona + i + 1,
        date: currentDate,
        location: returnLocation.city,
        accommodation: amsterdamAccommodation,
        activities: dayActivities,
        meals: this.generateMeals(style),
        transport: [],
        weather,
        estimatedCost: this.calculateDayCost(dayActivities, amsterdamAccommodation, style),
        notes: isLastDay ? ['Departure day - plan activities based on flight time'] : []
      });

      accommodationCost += amsterdamAccommodation.pricePerNight;
      activitiesCost += dayActivities.reduce((sum, a) => sum + a.activity.price, 0);
      foodCost += this.getDailyFoodBudget(style);

      currentDate = addDays(currentDate, 1);
    }

    // Calculate total costs
    const totalCost = {
      flights: flights.totalPrice,
      accommodation: accommodationCost * request.travelers,
      activities: activitiesCost * request.travelers,
      food: foodCost * request.travelers,
      transport: transportCost * request.travelers,
      total: (flights.totalPrice + accommodationCost + activitiesCost + foodCost + transportCost) * request.travelers,
      currency: 'USD'
    };

    // Calculate score based on budget match and preferences
    const budgetMatch = Math.max(0, 100 - Math.abs(totalCost.total - request.budget.total) / request.budget.total * 100);
    const flightScore = flights.score;
    const score = Math.round((budgetMatch * 0.4 + flightScore * 0.3 + 70 * 0.3));

    return {
      id: `itinerary-${style}-${Date.now()}`,
      name: `${style.charAt(0).toUpperCase() + style.slice(1)} Trip`,
      request,
      flights,
      dailyItinerary,
      dayTrips: [...barcelonaDayTrips.slice(0, 2), ...amsterdamDayTrips.slice(0, 2)],
      totalCost,
      score,
      pros: this.generatePros(style, totalCost, request.budget.total),
      cons: this.generateCons(style, totalCost, request.budget.total),
      aiRecommendations: [],
      visaCompliant: true,
      generatedAt: new Date()
    };
  }

  private static selectDayActivities(
    activities: Activity[],
    pace: 'relaxed' | 'moderate' | 'packed',
    dayIndex: number,
    totalDays: number
  ): any[] {
    const activitiesPerDay = {
      relaxed: 2,
      moderate: 3,
      packed: 4
    };

    const count = activitiesPerDay[pace];
    const startIndex = (dayIndex * count) % activities.length;

    return activities.slice(startIndex, startIndex + count).map((activity, idx) => ({
      time: `${9 + idx * 3}:00`,
      activity,
      duration: activity.duration,
      notes: dayIndex === 0 && idx === 0 ? 'Start your day here' : undefined
    }));
  }

  private static generateMeals(style: string): any[] {
    const budgets = {
      budget: { breakfast: 8, lunch: 15, dinner: 25 },
      balanced: { breakfast: 12, lunch: 25, dinner: 45 },
      premium: { breakfast: 20, lunch: 40, dinner: 80 }
    };

    const budget = budgets[style as keyof typeof budgets] || budgets.balanced;

    return [
      {
        type: 'breakfast' as const,
        time: '8:00',
        suggestion: style === 'budget' ? 'Local cafe or bakery' : 'Hotel breakfast or brunch spot',
        estimatedCost: budget.breakfast
      },
      {
        type: 'lunch' as const,
        time: '13:00',
        suggestion: style === 'budget' ? 'Local eatery or market' : 'Popular local restaurant',
        estimatedCost: budget.lunch
      },
      {
        type: 'dinner' as const,
        time: '20:00',
        suggestion: style === 'premium' ? 'Fine dining experience' : 'Traditional local cuisine',
        estimatedCost: budget.dinner
      }
    ];
  }

  private static calculateDayCost(activities: any[], accommodation: Accommodation, style: string): number {
    const activityCost = activities.reduce((sum, a) => sum + a.activity.price, 0);
    const foodCost = this.getDailyFoodBudget(style);
    return activityCost + accommodation.pricePerNight + foodCost;
  }

  private static getDailyFoodBudget(style: string): number {
    const budgets = {
      budget: 48,
      balanced: 82,
      premium: 140
    };
    return budgets[style as keyof typeof budgets] || budgets.balanced;
  }

  private static generatePros(style: string, totalCost: any, budget: number): string[] {
    const pros: string[] = [];

    if (style === 'budget') {
      pros.push('Most affordable option', 'Great value for money');
    } else if (style === 'balanced') {
      pros.push('Good balance of cost and comfort', 'Quality accommodations and experiences');
    } else {
      pros.push('Premium comfort throughout', 'Fastest travel options', 'Best accommodations');
    }

    if (totalCost.total <= budget) {
      pros.push('Within your budget');
    }

    return pros;
  }

  private static generateCons(style: string, totalCost: any, budget: number): string[] {
    const cons: string[] = [];

    if (style === 'budget') {
      cons.push('Basic accommodations', 'More time spent in transit');
    } else if (style === 'premium') {
      cons.push('Higher cost');
    }

    if (totalCost.total > budget) {
      const overBudget = ((totalCost.total - budget) / budget * 100).toFixed(0);
      cons.push(`${overBudget}% over budget`);
    }

    return cons;
  }

  private static async getAIRecommendations(
    request: TripRequest,
    itineraries: TripItinerary[],
    visaCheck: any
  ): Promise<{ tips: string[]; warnings: string[] }> {
    const client = this.getClient();

    if (!client) {
      // Fallback recommendations without AI
      return {
        tips: this.getGeneralTips(request),
        warnings: visaCheck.warnings
      };
    }

    try {
      const prompt = this.buildRecommendationPrompt(request, itineraries, visaCheck);

      const message = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const response = message.content[0].type === 'text' ? message.content[0].text : '';
      return this.parseAIResponse(response);
    } catch (error) {
      console.error('AI recommendation error:', error);
      return {
        tips: this.getGeneralTips(request),
        warnings: []
      };
    }
  }

  private static buildRecommendationPrompt(
    request: TripRequest,
    itineraries: TripItinerary[],
    visaCheck: any
  ): string {
    return `You are a professional travel advisor. Analyze this trip and provide personalized recommendations.

Trip Details:
- From: ${request.origin.city} to ${request.destination.city}
- Duration: ${differenceInDays(request.endDate, request.startDate)} days
- Travelers: ${request.travelers}
- Budget: $${request.budget.total}
- Interests: ${request.preferences.interests.join(', ')}
- Pace: ${request.preferences.pace}

Generated Itineraries:
${itineraries.map(it => `
- ${it.name}: $${it.totalCost.total} (Score: ${it.score}/100)
  Pros: ${it.pros.join(', ')}
  Cons: ${it.cons.join(', ')}
`).join('\n')}

Visa Status: ${visaCheck.valid ? 'Valid' : 'Issues detected'}

Please provide:
1. Top 3-5 personalized tips for this specific trip
2. Any warnings or important considerations
3. Which itinerary you'd recommend and why

Format as JSON:
{
  "tips": ["tip1", "tip2", ...],
  "warnings": ["warning1", "warning2", ...],
  "recommendation": "brief explanation"
}`;
  }

  private static parseAIResponse(response: string): { tips: string[]; warnings: string[] } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          tips: parsed.tips || [],
          warnings: parsed.warnings || []
        };
      }
    } catch (error) {
      console.error('Error parsing AI response:', error);
    }

    // Fallback parsing
    return {
      tips: [],
      warnings: []
    };
  }

  private static getGeneralTips(request: TripRequest): string[] {
    const tips: string[] = [];

    tips.push('Book accommodations and major attractions in advance to save money');
    tips.push('Get travel insurance for your trip');
    tips.push('Download offline maps before your trip');

    if (request.preferences.interests.includes('food')) {
      tips.push('Try local markets for authentic and affordable meals');
    }

    if (request.preferences.interests.includes('culture')) {
      tips.push('Many museums offer free entry on certain days - check schedules');
    }

    tips.push('Consider getting a city pass for public transportation and attractions');

    return tips;
  }
}
