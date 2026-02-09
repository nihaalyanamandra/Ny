import { LocalTransport } from '../types';
import { addMinutes } from 'date-fns';

export class TransportService {
  /**
   * Get local transport options between cities
   */
  static async getTransportOptions(
    from: string,
    to: string,
    date?: Date
  ): Promise<LocalTransport[]> {
    return this.generateTransportOptions(from, to, date);
  }

  /**
   * Get city-specific metro/local transport info
   */
  static getCityTransportInfo(city: string): {
    metro: boolean;
    tram: boolean;
    bus: boolean;
    bike: boolean;
    passes: Array<{ name: string; price: number; duration: string }>;
  } {
    const cityInfo: Record<string, any> = {
      'Barcelona': {
        metro: true,
        tram: true,
        bus: true,
        bike: true,
        passes: [
          { name: 'T-Casual (10 trips)', price: 12, duration: '10 trips' },
          { name: 'Hola Barcelona 2 days', price: 17, duration: '2 days' },
          { name: 'Hola Barcelona 3 days', price: 24, duration: '3 days' }
        ]
      },
      'Amsterdam': {
        metro: true,
        tram: true,
        bus: true,
        bike: true,
        passes: [
          { name: 'GVB Day Pass', price: 9, duration: '1 day' },
          { name: 'GVB 2-Day Pass', price: 15, duration: '2 days' },
          { name: 'I amsterdam City Card 24h', price: 65, duration: '1 day (includes museums)' }
        ]
      },
      'Madrid': {
        metro: true,
        tram: false,
        bus: true,
        bike: true,
        passes: [
          { name: '10-Trip Ticket', price: 12, duration: '10 trips' },
          { name: 'Tourist Travel Pass 1 day', price: 8.40, duration: '1 day' },
          { name: 'Tourist Travel Pass 2 days', price: 14.20, duration: '2 days' }
        ]
      },
      'Paris': {
        metro: true,
        tram: true,
        bus: true,
        bike: true,
        passes: [
          { name: 'Paris Visite 1 day', price: 13.20, duration: '1 day' },
          { name: 'Paris Visite 3 days', price: 29.40, duration: '3 days' },
          { name: 'Navigo Week Pass', price: 30, duration: '1 week' }
        ]
      }
    };

    return cityInfo[city] || {
      metro: false,
      tram: false,
      bus: true,
      bike: false,
      passes: []
    };
  }

  private static generateTransportOptions(
    from: string,
    to: string,
    date?: Date
  ): LocalTransport[] {
    const options: LocalTransport[] = [];
    const routes = this.getRouteData(from, to);

    if (!routes) {
      return options;
    }

    const departureDate = date || new Date();

    // Train options
    if (routes.train) {
      options.push({
        id: `train-${from}-${to}-1`,
        type: 'train',
        from,
        to,
        provider: routes.train.provider,
        departure: departureDate,
        arrival: addMinutes(departureDate, routes.train.duration),
        duration: routes.train.duration,
        price: routes.train.price,
        currency: 'USD',
        bookingUrl: routes.train.bookingUrl,
        details: {
          class: 'Second Class',
          amenities: ['WiFi', 'Power Outlets', 'Snack Bar']
        }
      });

      // High-speed train option
      if (routes.train.highSpeed) {
        options.push({
          id: `train-${from}-${to}-2`,
          type: 'train',
          from,
          to,
          provider: routes.train.provider,
          departure: departureDate,
          arrival: addMinutes(departureDate, Math.round(routes.train.duration * 0.7)),
          duration: Math.round(routes.train.duration * 0.7),
          price: Math.round(routes.train.price * 1.5),
          currency: 'USD',
          bookingUrl: routes.train.bookingUrl,
          details: {
            class: 'First Class High-Speed',
            amenities: ['WiFi', 'Power Outlets', 'Meal Included', 'Extra Legroom']
          }
        });
      }
    }

    // Bus options
    if (routes.bus) {
      options.push({
        id: `bus-${from}-${to}-1`,
        type: 'bus',
        from,
        to,
        provider: routes.bus.provider,
        departure: departureDate,
        arrival: addMinutes(departureDate, routes.bus.duration),
        duration: routes.bus.duration,
        price: routes.bus.price,
        currency: 'USD',
        bookingUrl: routes.bus.bookingUrl,
        details: {
          amenities: ['WiFi', 'USB Charging', 'Restroom']
        }
      });
    }

    // Car rental option
    if (routes.car) {
      options.push({
        id: `car-${from}-${to}-1`,
        type: 'car rental',
        from,
        to,
        provider: 'Europcar',
        duration: routes.car.duration,
        price: routes.car.price,
        currency: 'USD',
        bookingUrl: 'https://www.europcar.com',
        details: {
          carType: 'Compact',
          fuel: 'Not included',
          insurance: 'Basic included',
          mileage: 'Unlimited'
        }
      });

      options.push({
        id: `car-${from}-${to}-2`,
        type: 'car rental',
        from,
        to,
        provider: 'Hertz',
        duration: routes.car.duration,
        price: routes.car.price + 20,
        currency: 'USD',
        bookingUrl: 'https://www.hertz.com',
        details: {
          carType: 'SUV',
          fuel: 'Not included',
          insurance: 'Full coverage',
          mileage: 'Unlimited'
        }
      });
    }

    return options;
  }

  private static getRouteData(from: string, to: string): any {
    const routes: Record<string, Record<string, any>> = {
      'Barcelona-Madrid': {
        train: {
          provider: 'Renfe (AVE)',
          duration: 165, // 2h 45min
          price: 85,
          bookingUrl: 'https://www.renfe.com',
          highSpeed: true
        },
        bus: {
          provider: 'ALSA',
          duration: 420, // 7 hours
          price: 35,
          bookingUrl: 'https://www.alsa.com'
        },
        car: {
          duration: 360, // 6 hours
          price: 60 // per day
        }
      },
      'Barcelona-Valencia': {
        train: {
          provider: 'Renfe',
          duration: 180, // 3 hours
          price: 45,
          bookingUrl: 'https://www.renfe.com',
          highSpeed: true
        },
        bus: {
          provider: 'ALSA',
          duration: 240, // 4 hours
          price: 25,
          bookingUrl: 'https://www.alsa.com'
        },
        car: {
          duration: 210, // 3.5 hours
          price: 50
        }
      },
      'Barcelona-Seville': {
        train: {
          provider: 'Renfe (AVE)',
          duration: 330, // 5.5 hours
          price: 95,
          bookingUrl: 'https://www.renfe.com',
          highSpeed: true
        },
        bus: {
          provider: 'ALSA',
          duration: 600, // 10 hours
          price: 45,
          bookingUrl: 'https://www.alsa.com'
        }
      },
      'Amsterdam-Rotterdam': {
        train: {
          provider: 'NS (Dutch Railways)',
          duration: 40,
          price: 15,
          bookingUrl: 'https://www.ns.nl',
          highSpeed: false
        },
        bus: {
          provider: 'FlixBus',
          duration: 60,
          price: 8,
          bookingUrl: 'https://www.flixbus.com'
        },
        car: {
          duration: 50,
          price: 40
        }
      },
      'Amsterdam-Utrecht': {
        train: {
          provider: 'NS (Dutch Railways)',
          duration: 27,
          price: 12,
          bookingUrl: 'https://www.ns.nl',
          highSpeed: false
        },
        car: {
          duration: 35,
          price: 35
        }
      },
      'Amsterdam-Hague': {
        train: {
          provider: 'NS (Dutch Railways)',
          duration: 50,
          price: 14,
          bookingUrl: 'https://www.ns.nl',
          highSpeed: false
        },
        car: {
          duration: 45,
          price: 35
        }
      },
      'Amsterdam-Brussels': {
        train: {
          provider: 'Thalys',
          duration: 113, // 1h 53min
          price: 55,
          bookingUrl: 'https://www.thalys.com',
          highSpeed: true
        },
        bus: {
          provider: 'FlixBus',
          duration: 180, // 3 hours
          price: 20,
          bookingUrl: 'https://www.flixbus.com'
        }
      },
      'Amsterdam-Paris': {
        train: {
          provider: 'Thalys',
          duration: 196, // 3h 16min
          price: 85,
          bookingUrl: 'https://www.thalys.com',
          highSpeed: true
        },
        bus: {
          provider: 'FlixBus',
          duration: 390, // 6.5 hours
          price: 35,
          bookingUrl: 'https://www.flixbus.com'
        }
      }
    };

    // Check both directions
    const key = `${from}-${to}`;
    const reverseKey = `${to}-${from}`;

    return routes[key] || routes[reverseKey] || null;
  }

  /**
   * Get bike rental information for a city
   */
  static getBikeRentalInfo(city: string): {
    available: boolean;
    providers: Array<{ name: string; pricePerDay: number; bookingUrl: string }>;
  } {
    const bikeData: Record<string, any> = {
      'Barcelona': {
        available: true,
        providers: [
          { name: 'Bicing (City Bikes)', pricePerDay: 5, bookingUrl: 'https://www.bicing.barcelona' },
          { name: 'Barcelona Rent a Bike', pricePerDay: 15, bookingUrl: 'https://www.barcelonarentabike.com' }
        ]
      },
      'Amsterdam': {
        available: true,
        providers: [
          { name: 'MacBike', pricePerDay: 12, bookingUrl: 'https://www.macbike.nl' },
          { name: 'A-Bike', pricePerDay: 10, bookingUrl: 'https://www.a-bike.nl' }
        ]
      },
      'Paris': {
        available: true,
        providers: [
          { name: 'Vélib\' Métropole', pricePerDay: 5, bookingUrl: 'https://www.velib-metropole.fr' }
        ]
      }
    };

    return bikeData[city] || { available: false, providers: [] };
  }
}
