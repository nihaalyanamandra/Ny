import { Flight, FlightOption, Location } from '../types';
import { addHours, addMinutes, format } from 'date-fns';
import { AmadeusClient } from './amadeusClient';

/**
 * FlightService - Handles flight search and pricing
 *
 * Now integrated with Amadeus API for real-time flight data!
 * Falls back to mock data if API is not configured.
 *
 * Get your Amadeus API keys from: https://developers.amadeus.com/
 * Free tier: 2,000 API calls/month
 */
export class FlightService {
  private static airlines = [
    'American Airlines', 'Delta', 'United', 'KLM', 'Air France',
    'Lufthansa', 'British Airways', 'Iberia', 'Vueling', 'Ryanair',
    'Emirates', 'Qatar Airways', 'Air India', 'Singapore Airlines'
  ];

  /**
   * Search for flights between two locations
   * Uses Amadeus API if configured, otherwise falls back to mock data
   */
  static async searchFlights(
    origin: Location,
    destination: Location,
    date: Date,
    travelers: number = 1
  ): Promise<Flight[]> {
    // Try Amadeus API first
    if (AmadeusClient.isConfigured()) {
      try {
        const realFlights = await this.fetchFromAmadeusAPI(origin, destination, date, travelers);
        if (realFlights && realFlights.length > 0) {
          return realFlights;
        }
      } catch (error) {
        console.error('Amadeus API error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    return this.generateMockFlights(origin, destination, date, travelers);
  }

  /**
   * Fetch real flight data from Amadeus API
   */
  private static async fetchFromAmadeusAPI(
    origin: Location,
    destination: Location,
    date: Date,
    travelers: number
  ): Promise<Flight[]> {
    const client = AmadeusClient.getClient();
    if (!client) return [];

    try {
      // Get airport codes
      const originCode = origin.airport || await this.getAirportCode(origin.city);
      const destCode = destination.airport || await this.getAirportCode(destination.city);

      if (!originCode || !destCode) {
        console.log('Airport codes not found, using mock data');
        return [];
      }

      // Call Amadeus Flight Offers API
      const response = await client.shopping.flightOffersSearch.get({
        originLocationCode: originCode,
        destinationLocationCode: destCode,
        departureDate: format(date, 'yyyy-MM-dd'),
        adults: travelers.toString(),
        max: '6', // Get top 6 results
        currencyCode: 'USD'
      });

      // Transform Amadeus response to our Flight type
      return this.transformAmadeusFlights(response.data, origin, destination, travelers);
    } catch (error: any) {
      console.error('Amadeus API call failed:', error.description || error.message);
      return [];
    }
  }

  /**
   * Transform Amadeus API response to our Flight type
   */
  private static transformAmadeusFlights(
    amadeusData: any[],
    origin: Location,
    destination: Location,
    travelers: number
  ): Flight[] {
    return amadeusData.map((offer) => {
      const itinerary = offer.itineraries[0];
      const firstSegment = itinerary.segments[0];
      const lastSegment = itinerary.segments[itinerary.segments.length - 1];

      // Calculate total duration
      const durationMatch = itinerary.duration.match(/PT(\d+)H(\d+)M/);
      const hours = durationMatch ? parseInt(durationMatch[1]) : 0;
      const minutes = durationMatch ? parseInt(durationMatch[2]) : 0;
      const totalMinutes = hours * 60 + minutes;

      // Number of stops
      const stops = itinerary.segments.length - 1;

      // Get cabin class
      const cabinClass = firstSegment.cabin || 'ECONOMY';
      const flightClass = this.mapCabinClass(cabinClass);

      // Price
      const price = parseFloat(offer.price.total);

      return {
        id: offer.id,
        airline: firstSegment.carrierCode,
        flightNumber: `${firstSegment.carrierCode}${firstSegment.number}`,
        origin,
        destination,
        departure: new Date(firstSegment.departure.at),
        arrival: new Date(lastSegment.arrival.at),
        duration: totalMinutes,
        stops,
        price: Math.round(price),
        currency: offer.price.currency,
        class: flightClass,
        bookingUrl: `https://www.google.com/flights?hl=en#flt=${firstSegment.departure.iataCode}.${lastSegment.arrival.iataCode}.${format(new Date(firstSegment.departure.at), 'yyyy-MM-dd')}`,
        baggage: {
          cabin: '1 carry-on (10kg)',
          checked: flightClass === 'economy' ? '1 bag (23kg)' : '2 bags (32kg each)'
        }
      };
    });
  }

  /**
   * Map Amadeus cabin class to our flight class type
   */
  private static mapCabinClass(cabin: string): 'economy' | 'premium economy' | 'business' | 'first' {
    const cabinUpper = cabin.toUpperCase();
    if (cabinUpper.includes('BUSINESS')) return 'business';
    if (cabinUpper.includes('FIRST')) return 'first';
    if (cabinUpper.includes('PREMIUM')) return 'premium economy';
    return 'economy';
  }

  /**
   * Get airport code for a city
   */
  private static async getAirportCode(city: string): Promise<string | null> {
    // Common airport codes mapping
    const airportMap: Record<string, string> = {
      'Dallas': 'DFW',
      'Barcelona': 'BCN',
      'Amsterdam': 'AMS',
      'Mumbai': 'BOM',
      'Madrid': 'MAD',
      'Paris': 'CDG',
      'London': 'LHR',
      'New York': 'JFK',
      'Los Angeles': 'LAX',
      'Tokyo': 'NRT',
      'Singapore': 'SIN',
      'Dubai': 'DXB'
    };

    return airportMap[city] || null;
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
