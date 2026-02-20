import { Flight, FlightOption, Location } from '../types';
import { addHours, addMinutes } from 'date-fns';

/**
 * FlightService - Handles flight search and pricing
 *
 * REAL API INTEGRATION OPTIONS:
 *
 * 1. Google Flights API (via Serpapi)
 *    - URL: https://serpapi.com/google-flights-api
 *    - Pros: Real-time prices, multiple airlines, easy integration
 *    - Usage: GET request with origin, destination, dates
 *
 * 2. Amadeus Flight API
 *    - URL: https://developers.amadeus.com/self-service/category/flights
 *    - Pros: Industry standard, comprehensive data, free tier available
 *    - Usage: OAuth token + REST API calls
 *
 * 3. Skyscanner API
 *    - URL: https://rapidapi.com/skyscanner/api/skyscanner-flight-search
 *    - Pros: Price comparison across airlines, popular for travel apps
 *    - Usage: RapidAPI subscription
 *
 * 4. Kiwi.com Tequila API
 *    - URL: https://tequila.kiwi.com/
 *    - Pros: Budget flights, multi-city routes
 *    - Usage: API key + REST calls
 *
 * Implementation example:
 * ```typescript
 * const response = await fetch(`https://api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${dest}&departureDate=${date}&adults=${travelers}`, {
 *   headers: { 'Authorization': `Bearer ${accessToken}` }
 * });
 * const data = await response.json();
 * ```
 */
export class FlightService {
  private static airlines = [
    'American Airlines', 'Delta', 'United', 'KLM', 'Air France',
    'Lufthansa', 'British Airways', 'Iberia', 'Vueling', 'Ryanair',
    'Emirates', 'Qatar Airways', 'Air India', 'Singapore Airlines'
  ];

  /**
   * Search for flights between two locations
   */
  static async searchFlights(
    origin: Location,
    destination: Location,
    date: Date,
    travelers: number = 1
  ): Promise<Flight[]> {
    // TODO: Replace with real API call
    // Example: const flights = await this.fetchFromAmadeusAPI(origin, destination, date, travelers);
    return this.generateMockFlights(origin, destination, date, travelers);
  }

  /**
   * Get round trip flight options
   */
  static async getRoundTripOptions(
    origin: Location,
    destination: Location,
    departDate: Date,
    returnDate: Date,
    travelers: number = 1
  ): Promise<FlightOption[]> {
    const outboundFlights = await this.searchFlights(origin, destination, departDate, travelers);
    const returnFlights = await this.searchFlights(destination, origin, returnDate, travelers);

    // Create combinations
    const options: FlightOption[] = [];

    // Direct flights combination
    const directOut = outboundFlights.filter(f => f.stops === 0);
    const directRet = returnFlights.filter(f => f.stops === 0);

    if (directOut.length > 0 && directRet.length > 0) {
      options.push(this.createFlightOption([directOut[0]], [directRet[0]]));
    }

    // One stop combinations
    const oneStopOut = outboundFlights.filter(f => f.stops === 1);
    const oneStopRet = returnFlights.filter(f => f.stops === 1);

    if (oneStopOut.length > 0 && oneStopRet.length > 0) {
      options.push(this.createFlightOption([oneStopOut[0]], [oneStopRet[0]]));
    }

    // Budget option (cheapest)
    const cheapestOut = [...outboundFlights].sort((a, b) => a.price - b.price)[0];
    const cheapestRet = [...returnFlights].sort((a, b) => a.price - b.price)[0];

    if (cheapestOut && cheapestRet) {
      options.push(this.createFlightOption([cheapestOut], [cheapestRet]));
    }

    // Premium option
    const businessOut = outboundFlights.filter(f => f.class === 'business')[0];
    const businessRet = returnFlights.filter(f => f.class === 'business')[0];

    if (businessOut && businessRet) {
      options.push(this.createFlightOption([businessOut], [businessRet]));
    }

    return options;
  }

  private static createFlightOption(
    outbound: Flight[],
    returnFlights: Flight[]
  ): FlightOption {
    const totalPrice =
      outbound.reduce((sum, f) => sum + f.price, 0) +
      returnFlights.reduce((sum, f) => sum + f.price, 0);

    const totalDuration =
      outbound.reduce((sum, f) => sum + f.duration, 0) +
      returnFlights.reduce((sum, f) => sum + f.duration, 0);

    // Calculate score based on price, duration, and stops
    const avgPrice = totalPrice / (outbound.length + returnFlights.length);
    const totalStops = outbound.reduce((sum, f) => sum + f.stops, 0) +
                      returnFlights.reduce((sum, f) => sum + f.stops, 0);

    const priceScore = Math.max(0, 100 - (avgPrice / 10));
    const durationScore = Math.max(0, 100 - (totalDuration / 60));
    const stopScore = Math.max(0, 100 - (totalStops * 20));

    const score = (priceScore * 0.4 + durationScore * 0.3 + stopScore * 0.3);

    return {
      outbound,
      return: returnFlights,
      totalPrice,
      totalDuration,
      currency: 'USD',
      score: Math.round(score)
    };
  }

  private static generateMockFlights(
    origin: Location,
    destination: Location,
    date: Date,
    travelers: number
  ): Flight[] {
    const flights: Flight[] = [];
    const basePrice = this.calculateBasePrice(origin, destination);

    // 1. BEST VALUE - Direct flight with major carrier (ranked #1)
    flights.push(this.createFlight(
      origin,
      destination,
      date,
      0,
      basePrice * 1.1,
      'economy',
      travelers,
      undefined,
      'morning'
    ));

    // 2. CHEAPEST - Budget airline with 2 stops
    flights.push(this.createFlight(
      origin,
      destination,
      date,
      2,
      basePrice * 0.55,
      'economy',
      travelers,
      'Ryanair',
      'early morning'
    ));

    // 3. One stop flight - Good balance
    flights.push(this.createFlight(
      origin,
      destination,
      date,
      1,
      basePrice * 0.75,
      'economy',
      travelers,
      undefined,
      'afternoon'
    ));

    // 4. Direct evening flight
    flights.push(this.createFlight(
      origin,
      destination,
      date,
      0,
      basePrice * 1.25,
      'economy',
      travelers,
      undefined,
      'evening'
    ));

    // 5. Premium Economy - More comfort
    flights.push(this.createFlight(
      origin,
      destination,
      date,
      0,
      basePrice * 1.5,
      'premium economy',
      travelers,
      undefined,
      'morning'
    ));

    // 6. Business Class - Luxury option
    flights.push(this.createFlight(
      origin,
      destination,
      date,
      0,
      basePrice * 2.8,
      'business',
      travelers,
      undefined,
      'morning'
    ));

    // Sort by value (best options first)
    return flights.sort((a, b) => {
      const scoreA = (1000 - a.price) + (a.stops === 0 ? 500 : 0);
      const scoreB = (1000 - b.price) + (b.stops === 0 ? 500 : 0);
      return scoreB - scoreA;
    });
  }

  private static createFlight(
    origin: Location,
    destination: Location,
    date: Date,
    stops: number,
    basePrice: number,
    flightClass: 'economy' | 'premium economy' | 'business' | 'first',
    travelers: number,
    airline?: string,
    timeOfDay?: 'early morning' | 'morning' | 'afternoon' | 'evening'
  ): Flight {
    const selectedAirline = airline || this.airlines[Math.floor(Math.random() * this.airlines.length)];
    const flightNumber = `${this.getAirlineCode(selectedAirline)}${Math.floor(Math.random() * 9000) + 1000}`;

    // Calculate duration based on distance and stops
    const baseDistance = this.calculateDistance(origin, destination);
    const baseDuration = Math.ceil((baseDistance / 800) * 60); // ~800 km/h average
    const duration = baseDuration + (stops * 90); // Add 90 min per stop

    const departure = new Date(date);
    // Set departure time based on timeOfDay
    if (timeOfDay === 'early morning') {
      departure.setHours(5, Math.floor(Math.random() * 60));
    } else if (timeOfDay === 'morning') {
      departure.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60));
    } else if (timeOfDay === 'afternoon') {
      departure.setHours(13 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));
    } else if (timeOfDay === 'evening') {
      departure.setHours(18 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));
    } else {
      departure.setHours(6 + Math.floor(Math.random() * 18), Math.floor(Math.random() * 60));
    }

    const arrival = addMinutes(departure, duration);

    // Price variation based on time of day
    let priceMultiplier = 1;
    const hour = departure.getHours();
    if (hour >= 6 && hour <= 9) priceMultiplier = 1.2; // Morning premium
    if (hour >= 18 && hour <= 22) priceMultiplier = 1.1; // Evening premium

    const bookingUrls: Record<string, string> = {
      'American Airlines': 'https://www.aa.com',
      'Delta': 'https://www.delta.com',
      'United': 'https://www.united.com',
      'KLM': 'https://www.klm.com',
      'Air France': 'https://www.airfrance.com',
      'Lufthansa': 'https://www.lufthansa.com',
      'British Airways': 'https://www.britishairways.com',
      'Iberia': 'https://www.iberia.com',
      'Vueling': 'https://www.vueling.com',
      'Ryanair': 'https://www.ryanair.com'
    };

    return {
      id: `FL-${flightNumber}-${date.getTime()}`,
      airline: selectedAirline,
      flightNumber,
      origin,
      destination,
      departure,
      arrival,
      duration,
      stops,
      price: Math.round(basePrice * priceMultiplier * travelers),
      currency: 'USD',
      class: flightClass,
      bookingUrl: bookingUrls[selectedAirline] || 'https://www.google.com/flights',
      baggage: {
        cabin: flightClass === 'economy' ? '1 carry-on (10kg)' : '2 carry-on (15kg)',
        checked: flightClass === 'economy' ? '1 bag (23kg)' : '2 bags (32kg each)'
      }
    };
  }

  private static getAirlineCode(airline: string): string {
    const codes: Record<string, string> = {
      'American Airlines': 'AA',
      'Delta': 'DL',
      'United': 'UA',
      'KLM': 'KL',
      'Air France': 'AF',
      'Lufthansa': 'LH',
      'British Airways': 'BA',
      'Iberia': 'IB',
      'Vueling': 'VY',
      'Ryanair': 'FR'
    };
    return codes[airline] || 'XX';
  }

  private static calculateBasePrice(origin: Location, destination: Location): number {
    const distance = this.calculateDistance(origin, destination);
    // Base formula: $0.10 per km + $200 base fare
    return Math.round(200 + (distance * 0.10));
  }

  private static calculateDistance(loc1: Location, loc2: Location): number {
    // Haversine formula for great-circle distance
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(loc1.latitude)) *
      Math.cos(this.toRad(loc2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
