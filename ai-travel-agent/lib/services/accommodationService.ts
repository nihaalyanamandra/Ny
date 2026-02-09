import { Accommodation, Location } from '../types';
import { addDays } from 'date-fns';

export class AccommodationService {
  /**
   * Search for accommodations in a location
   */
  static async searchAccommodations(
    location: Location,
    checkIn: Date,
    checkOut: Date,
    travelers: number,
    types: ('hotel' | 'hostel' | 'apartment' | 'resort')[] = ['hotel']
  ): Promise<Accommodation[]> {
    return this.generateMockAccommodations(location, checkIn, checkOut, travelers, types);
  }

  private static generateMockAccommodations(
    location: Location,
    checkIn: Date,
    checkOut: Date,
    travelers: number,
    types: ('hotel' | 'hostel' | 'apartment' | 'resort')[]
  ): Accommodation[] {
    const accommodations: Accommodation[] = [];
    const cityData = this.getCityAccommodationData(location.city);

    types.forEach(type => {
      const items = cityData[type] || [];
      items.forEach(item => {
        accommodations.push({
          ...item,
          location,
          checkIn: '15:00',
          checkOut: '11:00',
          pricePerNight: this.adjustPriceForSeason(item.pricePerNight, checkIn),
          currency: 'USD'
        });
      });
    });

    return accommodations.sort((a, b) => b.rating - a.rating);
  }

  private static adjustPriceForSeason(basePrice: number, date: Date): number {
    const month = date.getMonth();
    // Summer (June-August) and holidays are more expensive
    if (month >= 5 && month <= 7) {
      return Math.round(basePrice * 1.3);
    }
    // Spring/Fall moderate prices
    if (month >= 3 && month <= 5 || month >= 8 && month <= 10) {
      return Math.round(basePrice * 1.1);
    }
    // Winter lower prices
    return basePrice;
  }

  private static getCityAccommodationData(city: string): Record<string, Partial<Accommodation>[]> {
    const data: Record<string, Record<string, Partial<Accommodation>[]>> = {
      'Barcelona': {
        hotel: [
          {
            id: 'bcn-hotel-1',
            name: 'Hotel Arts Barcelona',
            type: 'hotel',
            address: 'Marina 19-21, Barceloneta, 08005 Barcelona',
            rating: 4.7,
            reviews: 3245,
            pricePerNight: 350,
            amenities: ['Free WiFi', 'Pool', 'Spa', 'Gym', 'Restaurant', 'Beach Access', 'Room Service'],
            images: ['https://example.com/hotel1.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 48 hours before check-in'
          },
          {
            id: 'bcn-hotel-2',
            name: 'H10 Cubik',
            type: 'hotel',
            address: 'Via Laietana 69, Gothic Quarter, 08003 Barcelona',
            rating: 4.3,
            reviews: 1876,
            pricePerNight: 180,
            amenities: ['Free WiFi', 'Pool', 'Gym', 'Bar', 'Breakfast'],
            images: ['https://example.com/hotel2.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 24 hours before check-in'
          },
          {
            id: 'bcn-hotel-3',
            name: 'Barceló Raval',
            type: 'hotel',
            address: 'Rambla del Raval 17-21, El Raval, 08001 Barcelona',
            rating: 4.2,
            reviews: 2103,
            pricePerNight: 150,
            amenities: ['Free WiFi', 'Rooftop Pool', 'Bar', 'Restaurant', 'City Views'],
            images: ['https://example.com/hotel3.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 24 hours before check-in'
          }
        ],
        hostel: [
          {
            id: 'bcn-hostel-1',
            name: 'Generator Barcelona',
            type: 'hostel',
            address: 'Carrer de Còrsega 373, Gràcia, 08037 Barcelona',
            rating: 4.1,
            reviews: 5432,
            pricePerNight: 35,
            amenities: ['Free WiFi', 'Bar', 'Common Room', 'Breakfast Available', 'Terrace'],
            images: ['https://example.com/hostel1.jpg'],
            bookingUrl: 'https://www.hostelworld.com',
            cancellationPolicy: 'Free cancellation up to 7 days before check-in'
          }
        ],
        apartment: [
          {
            id: 'bcn-apt-1',
            name: 'Modern Gothic Quarter Apartment',
            type: 'apartment',
            address: 'Carrer dels Escudellers, Gothic Quarter, 08002 Barcelona',
            rating: 4.5,
            reviews: 234,
            pricePerNight: 120,
            amenities: ['Free WiFi', 'Kitchen', 'Washer', 'Air Conditioning', 'Balcony'],
            images: ['https://example.com/apt1.jpg'],
            bookingUrl: 'https://www.airbnb.com',
            cancellationPolicy: 'Moderate: Free cancellation up to 5 days before check-in'
          }
        ]
      },
      'Amsterdam': {
        hotel: [
          {
            id: 'ams-hotel-1',
            name: 'Waldorf Astoria Amsterdam',
            type: 'hotel',
            address: 'Herengracht 542-556, Canal Belt, 1017 CG Amsterdam',
            rating: 4.8,
            reviews: 1567,
            pricePerNight: 450,
            amenities: ['Free WiFi', 'Spa', 'Restaurant', 'Canal Views', 'Concierge', 'Room Service'],
            images: ['https://example.com/ams-hotel1.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 48 hours before check-in'
          },
          {
            id: 'ams-hotel-2',
            name: 'Hotel V Nesplein',
            type: 'hotel',
            address: 'Nes 49, Amsterdam City Centre, 1012 KD Amsterdam',
            rating: 4.4,
            reviews: 892,
            pricePerNight: 180,
            amenities: ['Free WiFi', 'Bar', 'Bikes Available', 'Breakfast'],
            images: ['https://example.com/ams-hotel2.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 24 hours before check-in'
          },
          {
            id: 'ams-hotel-3',
            name: 'citizenM Amsterdam South',
            type: 'hotel',
            address: 'Prinses Irenestraat 30, Amsterdam-Zuid, 1077 WX Amsterdam',
            rating: 4.3,
            reviews: 2341,
            pricePerNight: 140,
            amenities: ['Free WiFi', '24h Gym', 'Bar', 'Modern Design', 'Self Check-in'],
            images: ['https://example.com/ams-hotel3.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 24 hours before check-in'
          }
        ],
        hostel: [
          {
            id: 'ams-hostel-1',
            name: 'ClinkNOORD',
            type: 'hostel',
            address: 'Badhuiskade 3, Amsterdam-Noord, 1031 KV Amsterdam',
            rating: 4.2,
            reviews: 3876,
            pricePerNight: 40,
            amenities: ['Free WiFi', 'Bar', 'Common Area', 'Kitchen', 'Bike Rental'],
            images: ['https://example.com/ams-hostel1.jpg'],
            bookingUrl: 'https://www.hostelworld.com',
            cancellationPolicy: 'Free cancellation up to 7 days before check-in'
          }
        ],
        apartment: [
          {
            id: 'ams-apt-1',
            name: 'Canal House Studio',
            type: 'apartment',
            address: 'Prinsengracht, Canal Belt, 1015 DV Amsterdam',
            rating: 4.6,
            reviews: 187,
            pricePerNight: 160,
            amenities: ['Free WiFi', 'Kitchen', 'Canal Views', 'Washer', 'Air Conditioning'],
            images: ['https://example.com/ams-apt1.jpg'],
            bookingUrl: 'https://www.airbnb.com',
            cancellationPolicy: 'Moderate: Free cancellation up to 5 days before check-in'
          }
        ]
      },
      'Madrid': {
        hotel: [
          {
            id: 'mad-hotel-1',
            name: 'The Principal Madrid',
            type: 'hotel',
            address: 'Calle del Marqués de Valdeiglesias 1, Centro, 28004 Madrid',
            rating: 4.6,
            reviews: 1234,
            pricePerNight: 280,
            amenities: ['Free WiFi', 'Rooftop Bar', 'Restaurant', 'Gym', 'City Views'],
            images: ['https://example.com/mad-hotel1.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 48 hours before check-in'
          }
        ],
        hostel: [
          {
            id: 'mad-hostel-1',
            name: 'The Hat Madrid',
            type: 'hostel',
            address: 'Calle Imperial 9, Centro, 28012 Madrid',
            rating: 4.3,
            reviews: 2876,
            pricePerNight: 38,
            amenities: ['Free WiFi', 'Bar', 'Terrace', 'Common Room', 'Kitchen'],
            images: ['https://example.com/mad-hostel1.jpg'],
            bookingUrl: 'https://www.hostelworld.com',
            cancellationPolicy: 'Free cancellation up to 7 days before check-in'
          }
        ]
      },
      'Valencia': {
        hotel: [
          {
            id: 'vlc-hotel-1',
            name: 'The Westin Valencia',
            type: 'hotel',
            address: 'Amadeo de Saboya 16, Ciutat de les Arts i de les Ciències, 46010 Valencia',
            rating: 4.5,
            reviews: 987,
            pricePerNight: 180,
            amenities: ['Free WiFi', 'Pool', 'Spa', 'Restaurant', 'Modern Design'],
            images: ['https://example.com/vlc-hotel1.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 24 hours before check-in'
          }
        ]
      },
      'Paris': {
        hotel: [
          {
            id: 'par-hotel-1',
            name: 'Hotel du Louvre',
            type: 'hotel',
            address: 'Place André Malraux, 1st Arrondissement, 75001 Paris',
            rating: 4.7,
            reviews: 2134,
            pricePerNight: 400,
            amenities: ['Free WiFi', 'Restaurant', 'Bar', 'Concierge', 'Louvre Views'],
            images: ['https://example.com/par-hotel1.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 48 hours before check-in'
          }
        ]
      },
      'Brussels': {
        hotel: [
          {
            id: 'bru-hotel-1',
            name: 'Hotel Amigo',
            type: 'hotel',
            address: 'Rue de l\'Amigo 1-3, Brussels City Center, 1000 Brussels',
            rating: 4.6,
            reviews: 876,
            pricePerNight: 320,
            amenities: ['Free WiFi', 'Restaurant', 'Bar', 'Concierge', 'Grand Place Views'],
            images: ['https://example.com/bru-hotel1.jpg'],
            bookingUrl: 'https://www.booking.com',
            cancellationPolicy: 'Free cancellation up to 48 hours before check-in'
          }
        ]
      }
    };

    return data[city] || this.getDefaultAccommodations();
  }

  private static getDefaultAccommodations(): Record<string, Partial<Accommodation>[]> {
    return {
      hotel: [
        {
          id: 'default-hotel-1',
          name: 'City Center Hotel',
          type: 'hotel',
          address: 'City Center',
          rating: 4.0,
          reviews: 500,
          pricePerNight: 150,
          amenities: ['Free WiFi', 'Breakfast', 'Reception 24h'],
          images: ['https://example.com/default-hotel.jpg'],
          bookingUrl: 'https://www.booking.com',
          cancellationPolicy: 'Free cancellation up to 24 hours before check-in'
        }
      ]
    };
  }
}
