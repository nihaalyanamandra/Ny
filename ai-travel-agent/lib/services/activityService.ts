import { Activity, DayTrip, Location } from '../types';

export class ActivityService {
  /**
   * Get activities for a city based on interests
   */
  static getActivities(
    city: string,
    interests: string[] = [],
    budget: 'low' | 'medium' | 'high' = 'medium'
  ): Activity[] {
    const allActivities = this.getCityActivities(city);

    // Filter by interests if provided
    let filtered = interests.length > 0
      ? allActivities.filter(activity =>
          activity.tags.some(tag => interests.includes(tag))
        )
      : allActivities;

    // Filter by budget
    filtered = filtered.filter(activity => {
      if (budget === 'low') return activity.price <= 30;
      if (budget === 'medium') return activity.price <= 80;
      return true; // high budget - no filter
    });

    return filtered;
  }

  /**
   * Get day trip options from a city
   */
  static getDayTrips(from: string): DayTrip[] {
    const dayTrips: Record<string, DayTrip[]> = {
      'Barcelona': [
        {
          id: 'bcn-daytrip-1',
          from: 'Barcelona',
          to: 'Montserrat',
          name: 'Montserrat Mountain Monastery',
          description: 'Visit the stunning mountain monastery, see the Black Madonna, and enjoy breathtaking views.',
          duration: 6,
          transport: [],
          activities: [],
          estimatedCost: 50,
          currency: 'USD',
          difficulty: 'moderate',
          bestSeason: ['spring', 'fall']
        },
        {
          id: 'bcn-daytrip-2',
          from: 'Barcelona',
          to: 'Girona',
          name: 'Medieval Girona',
          description: 'Explore the beautiful medieval city, walk the ancient walls, and visit the Jewish Quarter.',
          duration: 8,
          transport: [],
          activities: [],
          estimatedCost: 40,
          currency: 'USD',
          difficulty: 'easy',
          bestSeason: ['spring', 'summer', 'fall']
        },
        {
          id: 'bcn-daytrip-3',
          from: 'Barcelona',
          to: 'Sitges',
          name: 'Beach Town Sitges',
          description: 'Relax in this charming coastal town with beautiful beaches and a vibrant atmosphere.',
          duration: 6,
          transport: [],
          activities: [],
          estimatedCost: 35,
          currency: 'USD',
          difficulty: 'easy',
          bestSeason: ['summer', 'fall']
        }
      ],
      'Amsterdam': [
        {
          id: 'ams-daytrip-1',
          from: 'Amsterdam',
          to: 'Zaanse Schans',
          name: 'Windmills at Zaanse Schans',
          description: 'Visit traditional windmills, cheese farms, and clog workshops in this open-air museum.',
          duration: 5,
          transport: [],
          activities: [],
          estimatedCost: 30,
          currency: 'USD',
          difficulty: 'easy',
          bestSeason: ['spring', 'summer', 'fall']
        },
        {
          id: 'ams-daytrip-2',
          from: 'Amsterdam',
          to: 'Keukenhof',
          name: 'Keukenhof Tulip Gardens',
          description: 'Experience millions of blooming tulips in the world\'s largest flower garden (March-May only).',
          duration: 6,
          transport: [],
          activities: [],
          estimatedCost: 45,
          currency: 'USD',
          difficulty: 'easy',
          bestSeason: ['spring']
        },
        {
          id: 'ams-daytrip-3',
          from: 'Amsterdam',
          to: 'Giethoorn',
          name: 'Venice of the North',
          description: 'Explore this car-free village with canals, thatched cottages, and peaceful boat rides.',
          duration: 8,
          transport: [],
          activities: [],
          estimatedCost: 55,
          currency: 'USD',
          difficulty: 'easy',
          bestSeason: ['spring', 'summer', 'fall']
        },
        {
          id: 'ams-daytrip-4',
          from: 'Amsterdam',
          to: 'Bruges',
          name: 'Fairy-tale Bruges',
          description: 'Day trip to Belgium\'s most romantic city with canals, chocolate, and medieval architecture.',
          duration: 10,
          transport: [],
          activities: [],
          estimatedCost: 70,
          currency: 'USD',
          difficulty: 'moderate',
          bestSeason: ['spring', 'summer', 'fall']
        }
      ],
      'Madrid': [
        {
          id: 'mad-daytrip-1',
          from: 'Madrid',
          to: 'Toledo',
          name: 'Imperial City of Toledo',
          description: 'UNESCO World Heritage city with medieval architecture, El Greco\'s art, and sword-making tradition.',
          duration: 7,
          transport: [],
          activities: [],
          estimatedCost: 45,
          currency: 'USD',
          difficulty: 'moderate',
          bestSeason: ['spring', 'fall']
        },
        {
          id: 'mad-daytrip-2',
          from: 'Madrid',
          to: 'Segovia',
          name: 'Roman Aqueduct of Segovia',
          description: 'See the impressive Roman aqueduct, fairy-tale Alcázar castle, and try the famous roasted pig.',
          duration: 7,
          transport: [],
          activities: [],
          estimatedCost: 50,
          currency: 'USD',
          difficulty: 'easy',
          bestSeason: ['spring', 'summer', 'fall']
        }
      ]
    };

    return dayTrips[from] || [];
  }

  private static getCityActivities(city: string): Activity[] {
    const activities: Record<string, Activity[]> = {
      'Barcelona': [
        {
          id: 'bcn-act-1',
          name: 'Sagrada Familia',
          type: 'attraction',
          location: { city: 'Barcelona', country: 'Spain', latitude: 41.4036, longitude: 2.1744 },
          address: 'Carrer de Mallorca, 401, 08013 Barcelona',
          description: 'Gaudí\'s masterpiece basilica, still under construction after 140+ years.',
          duration: 120,
          price: 33,
          currency: 'USD',
          rating: 4.8,
          reviews: 187453,
          bookingUrl: 'https://sagradafamilia.org',
          openingHours: {
            'Mon-Sat': '9:00 AM - 8:00 PM',
            'Sun': '10:30 AM - 8:00 PM'
          },
          bestTimeToVisit: 'Early morning or late afternoon to avoid crowds',
          images: ['https://example.com/sagrada.jpg'],
          tags: ['culture', 'architecture', 'religious', 'unesco']
        },
        {
          id: 'bcn-act-2',
          name: 'Park Güell',
          type: 'attraction',
          location: { city: 'Barcelona', country: 'Spain', latitude: 41.4145, longitude: 2.1527 },
          address: 'Carrer d\'Olot, 5, 08024 Barcelona',
          description: 'Whimsical park designed by Gaudí with colorful mosaics and city views.',
          duration: 120,
          price: 13,
          currency: 'USD',
          rating: 4.6,
          reviews: 98234,
          bookingUrl: 'https://www.parkguell.cat',
          openingHours: {
            'Daily': '8:00 AM - 8:30 PM'
          },
          bestTimeToVisit: 'Early morning for best photos',
          images: ['https://example.com/parkguell.jpg'],
          tags: ['nature', 'architecture', 'photography', 'unesco']
        },
        {
          id: 'bcn-act-3',
          name: 'La Rambla & Boqueria Market',
          type: 'attraction',
          location: { city: 'Barcelona', country: 'Spain', latitude: 41.3818, longitude: 2.1713 },
          address: 'La Rambla, 91, 08001 Barcelona',
          description: 'Famous street and vibrant food market with fresh produce, seafood, and local delicacies.',
          duration: 90,
          price: 0,
          currency: 'USD',
          rating: 4.5,
          reviews: 125643,
          openingHours: {
            'Mon-Sat': '8:00 AM - 8:30 PM',
            'Sun': 'Closed'
          },
          bestTimeToVisit: 'Morning for freshest market experience',
          images: ['https://example.com/boqueria.jpg'],
          tags: ['food', 'shopping', 'culture']
        },
        {
          id: 'bcn-act-4',
          name: 'Gothic Quarter Walking Tour',
          type: 'tour',
          location: { city: 'Barcelona', country: 'Spain', latitude: 41.3828, longitude: 2.1764 },
          address: 'Gothic Quarter, Barcelona',
          description: 'Explore medieval streets, Roman ruins, and hidden squares in Barcelona\'s oldest neighborhood.',
          duration: 180,
          price: 25,
          currency: 'USD',
          rating: 4.7,
          reviews: 34521,
          bookingUrl: 'https://www.getyourguide.com',
          openingHours: {
            'Daily': '10:00 AM - 6:00 PM'
          },
          bestTimeToVisit: 'Morning or late afternoon',
          images: ['https://example.com/gothic.jpg'],
          tags: ['culture', 'history', 'walking', 'architecture']
        },
        {
          id: 'bcn-act-5',
          name: 'Barceloneta Beach',
          type: 'attraction',
          location: { city: 'Barcelona', country: 'Spain', latitude: 41.3806, longitude: 2.1895 },
          address: 'Passeig Marítim de la Barceloneta, Barcelona',
          description: 'Popular city beach with restaurants, bars, and Mediterranean vibes.',
          duration: 180,
          price: 0,
          currency: 'USD',
          rating: 4.3,
          reviews: 67890,
          openingHours: {
            'Daily': '24 hours'
          },
          bestTimeToVisit: 'Sunset for beautiful views',
          images: ['https://example.com/beach.jpg'],
          tags: ['beach', 'nature', 'relaxation', 'free']
        },
        {
          id: 'bcn-act-6',
          name: 'Flamenco Show & Tapas',
          type: 'entertainment',
          location: { city: 'Barcelona', country: 'Spain', latitude: 41.3874, longitude: 2.1686 },
          address: 'Various locations in Barcelona',
          description: 'Authentic flamenco performance with traditional Spanish tapas dinner.',
          duration: 180,
          price: 65,
          currency: 'USD',
          rating: 4.6,
          reviews: 12456,
          bookingUrl: 'https://www.getyourguide.com',
          openingHours: {
            'Daily': '7:00 PM - 10:00 PM'
          },
          bestTimeToVisit: 'Evening shows',
          images: ['https://example.com/flamenco.jpg'],
          tags: ['culture', 'nightlife', 'food', 'entertainment']
        },
        {
          id: 'bcn-act-7',
          name: 'Camp Nou Stadium Tour',
          type: 'tour',
          location: { city: 'Barcelona', country: 'Spain', latitude: 41.3809, longitude: 2.1228 },
          address: 'C. d\'Aristides Maillol, 12, 08028 Barcelona',
          description: 'Tour FC Barcelona\'s iconic stadium, museum, and trophy room.',
          duration: 120,
          price: 30,
          currency: 'USD',
          rating: 4.7,
          reviews: 45678,
          bookingUrl: 'https://www.fcbarcelona.com',
          openingHours: {
            'Daily': '10:00 AM - 6:30 PM'
          },
          bestTimeToVisit: 'Weekday mornings',
          images: ['https://example.com/campnou.jpg'],
          tags: ['sports', 'culture', 'tour']
        }
      ],
      'Amsterdam': [
        {
          id: 'ams-act-1',
          name: 'Anne Frank House',
          type: 'museum',
          location: { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3752, longitude: 4.8840 },
          address: 'Prinsengracht 263-267, 1016 GV Amsterdam',
          description: 'Moving museum in the actual house where Anne Frank hid during WWII.',
          duration: 90,
          price: 16,
          currency: 'USD',
          rating: 4.7,
          reviews: 89234,
          bookingUrl: 'https://www.annefrank.org',
          openingHours: {
            'Daily': '9:00 AM - 7:00 PM'
          },
          bestTimeToVisit: 'Book weeks in advance, first time slot of the day',
          images: ['https://example.com/annefrank.jpg'],
          tags: ['history', 'culture', 'museum']
        },
        {
          id: 'ams-act-2',
          name: 'Rijksmuseum',
          type: 'museum',
          location: { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3600, longitude: 4.8852 },
          address: 'Museumstraat 1, 1071 XX Amsterdam',
          description: 'World-class museum featuring Dutch Golden Age masterpieces including Rembrandt and Vermeer.',
          duration: 180,
          price: 25,
          currency: 'USD',
          rating: 4.8,
          reviews: 125678,
          bookingUrl: 'https://www.rijksmuseum.nl',
          openingHours: {
            'Daily': '9:00 AM - 5:00 PM'
          },
          bestTimeToVisit: 'Weekday mornings',
          images: ['https://example.com/rijksmuseum.jpg'],
          tags: ['art', 'culture', 'museum', 'history']
        },
        {
          id: 'ams-act-3',
          name: 'Van Gogh Museum',
          type: 'museum',
          location: { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3584, longitude: 4.8811 },
          address: 'Museumplein 6, 1071 DJ Amsterdam',
          description: 'Largest collection of Van Gogh paintings and letters in the world.',
          duration: 120,
          price: 22,
          currency: 'USD',
          rating: 4.7,
          reviews: 98765,
          bookingUrl: 'https://www.vangoghmuseum.nl',
          openingHours: {
            'Daily': '9:00 AM - 6:00 PM'
          },
          bestTimeToVisit: 'Early morning or late afternoon',
          images: ['https://example.com/vangogh.jpg'],
          tags: ['art', 'culture', 'museum']
        },
        {
          id: 'ams-act-4',
          name: 'Canal Cruise',
          type: 'tour',
          location: { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3702, longitude: 4.8952 },
          address: 'Various departure points',
          description: 'Scenic boat tour through Amsterdam\'s UNESCO-listed canal ring.',
          duration: 75,
          price: 18,
          currency: 'USD',
          rating: 4.5,
          reviews: 67543,
          bookingUrl: 'https://www.getyourguide.com',
          openingHours: {
            'Daily': '10:00 AM - 10:00 PM'
          },
          bestTimeToVisit: 'Sunset cruise or evening for lights',
          images: ['https://example.com/canal.jpg'],
          tags: ['tour', 'photography', 'relaxation']
        },
        {
          id: 'ams-act-5',
          name: 'Jordaan Neighborhood Walk',
          type: 'attraction',
          location: { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3785, longitude: 4.8833 },
          address: 'Jordaan, Amsterdam',
          description: 'Explore charming streets, indie boutiques, cozy cafes, and local markets.',
          duration: 120,
          price: 0,
          currency: 'USD',
          rating: 4.6,
          reviews: 34567,
          openingHours: {
            'Daily': '24 hours'
          },
          bestTimeToVisit: 'Afternoon for shops and cafes',
          images: ['https://example.com/jordaan.jpg'],
          tags: ['walking', 'shopping', 'food', 'free', 'culture']
        },
        {
          id: 'ams-act-6',
          name: 'Heineken Experience',
          type: 'tour',
          location: { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3579, longitude: 4.8917 },
          address: 'Stadhouderskade 78, 1072 AE Amsterdam',
          description: 'Interactive tour of the historic Heineken brewery with tastings included.',
          duration: 90,
          price: 23,
          currency: 'USD',
          rating: 4.4,
          reviews: 56789,
          bookingUrl: 'https://www.heinekenexperience.com',
          openingHours: {
            'Mon-Thu': '10:30 AM - 7:30 PM',
            'Fri-Sun': '10:30 AM - 9:00 PM'
          },
          bestTimeToVisit: 'Late afternoon',
          images: ['https://example.com/heineken.jpg'],
          tags: ['tour', 'food', 'nightlife']
        },
        {
          id: 'ams-act-7',
          name: 'Bike Tour',
          type: 'tour',
          location: { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3676, longitude: 4.9041 },
          address: 'Various starting points',
          description: 'Experience Amsterdam like a local on a guided bike tour through the city.',
          duration: 180,
          price: 35,
          currency: 'USD',
          rating: 4.8,
          reviews: 23456,
          bookingUrl: 'https://www.getyourguide.com',
          openingHours: {
            'Daily': '9:00 AM - 5:00 PM'
          },
          bestTimeToVisit: 'Morning or afternoon',
          images: ['https://example.com/biketour.jpg'],
          tags: ['tour', 'active', 'culture']
        },
        {
          id: 'ams-act-8',
          name: 'Vondelpark',
          type: 'attraction',
          location: { city: 'Amsterdam', country: 'Netherlands', latitude: 52.3579, longitude: 4.8686 },
          address: 'Vondelpark, Amsterdam',
          description: 'Amsterdam\'s largest park, perfect for picnics, jogging, or relaxing.',
          duration: 120,
          price: 0,
          currency: 'USD',
          rating: 4.6,
          reviews: 45678,
          openingHours: {
            'Daily': '24 hours'
          },
          bestTimeToVisit: 'Sunny afternoons',
          images: ['https://example.com/vondelpark.jpg'],
          tags: ['nature', 'relaxation', 'free']
        }
      ]
    };

    return activities[city] || [];
  }
}
