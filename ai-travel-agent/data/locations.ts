import { Location } from '../lib/types';

export const locations: Record<string, Location> = {
  // USA
  dallas: {
    city: 'Dallas',
    country: 'United States',
    airport: 'DFW',
    latitude: 32.7767,
    longitude: -96.7970
  },

  // Spain
  barcelona: {
    city: 'Barcelona',
    country: 'Spain',
    airport: 'BCN',
    latitude: 41.3851,
    longitude: 2.1734
  },
  madrid: {
    city: 'Madrid',
    country: 'Spain',
    airport: 'MAD',
    latitude: 40.4168,
    longitude: -3.7038
  },
  valencia: {
    city: 'Valencia',
    country: 'Spain',
    airport: 'VLC',
    latitude: 39.4699,
    longitude: -0.3763
  },
  seville: {
    city: 'Seville',
    country: 'Spain',
    airport: 'SVQ',
    latitude: 37.3891,
    longitude: -5.9845
  },

  // Netherlands
  amsterdam: {
    city: 'Amsterdam',
    country: 'Netherlands',
    airport: 'AMS',
    latitude: 52.3676,
    longitude: 4.9041
  },
  rotterdam: {
    city: 'Rotterdam',
    country: 'Netherlands',
    airport: 'RTM',
    latitude: 51.9244,
    longitude: 4.4777
  },
  utrecht: {
    city: 'Utrecht',
    country: 'Netherlands',
    latitude: 52.0907,
    longitude: 5.1214
  },
  hague: {
    city: 'The Hague',
    country: 'Netherlands',
    latitude: 52.0705,
    longitude: 4.3007
  },

  // France
  paris: {
    city: 'Paris',
    country: 'France',
    airport: 'CDG',
    latitude: 48.8566,
    longitude: 2.3522
  },
  nice: {
    city: 'Nice',
    country: 'France',
    airport: 'NCE',
    latitude: 43.7102,
    longitude: 7.2620
  },
  lyon: {
    city: 'Lyon',
    country: 'France',
    airport: 'LYS',
    latitude: 45.7640,
    longitude: 4.8357
  },

  // Belgium
  brussels: {
    city: 'Brussels',
    country: 'Belgium',
    airport: 'BRU',
    latitude: 50.8503,
    longitude: 4.3517
  },
  bruges: {
    city: 'Bruges',
    country: 'Belgium',
    latitude: 51.2093,
    longitude: 3.2247
  },

  // Germany
  berlin: {
    city: 'Berlin',
    country: 'Germany',
    airport: 'BER',
    latitude: 52.5200,
    longitude: 13.4050
  },
  munich: {
    city: 'Munich',
    country: 'Germany',
    airport: 'MUC',
    latitude: 48.1351,
    longitude: 11.5820
  },

  // Italy
  rome: {
    city: 'Rome',
    country: 'Italy',
    airport: 'FCO',
    latitude: 41.9028,
    longitude: 12.4964
  },
  venice: {
    city: 'Venice',
    country: 'Italy',
    airport: 'VCE',
    latitude: 45.4408,
    longitude: 12.3155
  },
  florence: {
    city: 'Florence',
    country: 'Italy',
    airport: 'FLR',
    latitude: 43.7696,
    longitude: 11.2558
  },

  // Portugal
  lisbon: {
    city: 'Lisbon',
    country: 'Portugal',
    airport: 'LIS',
    latitude: 38.7223,
    longitude: -9.1393
  },
  porto: {
    city: 'Porto',
    country: 'Portugal',
    airport: 'OPO',
    latitude: 41.1579,
    longitude: -8.6291
  },

  // United Kingdom
  london: {
    city: 'London',
    country: 'United Kingdom',
    airport: 'LHR',
    latitude: 51.5074,
    longitude: -0.1278
  },
  manchester: {
    city: 'Manchester',
    country: 'United Kingdom',
    airport: 'MAN',
    latitude: 53.4808,
    longitude: -2.2426
  },
  edinburgh: {
    city: 'Edinburgh',
    country: 'United Kingdom',
    airport: 'EDI',
    latitude: 55.9533,
    longitude: -3.1883
  },

  // USA - More Cities
  newyork: {
    city: 'New York',
    country: 'United States',
    airport: 'JFK',
    latitude: 40.7128,
    longitude: -74.0060
  },
  losangeles: {
    city: 'Los Angeles',
    country: 'United States',
    airport: 'LAX',
    latitude: 34.0522,
    longitude: -118.2437
  },
  chicago: {
    city: 'Chicago',
    country: 'United States',
    airport: 'ORD',
    latitude: 41.8781,
    longitude: -87.6298
  },
  miami: {
    city: 'Miami',
    country: 'United States',
    airport: 'MIA',
    latitude: 25.7617,
    longitude: -80.1918
  },
  sanfrancisco: {
    city: 'San Francisco',
    country: 'United States',
    airport: 'SFO',
    latitude: 37.7749,
    longitude: -122.4194
  },

  // Asia
  tokyo: {
    city: 'Tokyo',
    country: 'Japan',
    airport: 'NRT',
    latitude: 35.6762,
    longitude: 139.6503
  },
  singapore: {
    city: 'Singapore',
    country: 'Singapore',
    airport: 'SIN',
    latitude: 1.3521,
    longitude: 103.8198
  },
  dubai: {
    city: 'Dubai',
    country: 'United Arab Emirates',
    airport: 'DXB',
    latitude: 25.2048,
    longitude: 55.2708
  },
  bangkok: {
    city: 'Bangkok',
    country: 'Thailand',
    airport: 'BKK',
    latitude: 13.7563,
    longitude: 100.5018
  },
  hongkong: {
    city: 'Hong Kong',
    country: 'Hong Kong',
    airport: 'HKG',
    latitude: 22.3193,
    longitude: 114.1694
  },

  // Australia
  sydney: {
    city: 'Sydney',
    country: 'Australia',
    airport: 'SYD',
    latitude: -33.8688,
    longitude: 151.2093
  },
  melbourne: {
    city: 'Melbourne',
    country: 'Australia',
    airport: 'MEL',
    latitude: -37.8136,
    longitude: 144.9631
  },

  // Canada
  toronto: {
    city: 'Toronto',
    country: 'Canada',
    airport: 'YYZ',
    latitude: 43.6532,
    longitude: -79.3832
  },
  vancouver: {
    city: 'Vancouver',
    country: 'Canada',
    airport: 'YVR',
    latitude: 49.2827,
    longitude: -123.1207
  },

  // Greece
  athens: {
    city: 'Athens',
    country: 'Greece',
    airport: 'ATH',
    latitude: 37.9838,
    longitude: 23.7275
  },

  // Switzerland
  zurich: {
    city: 'Zurich',
    country: 'Switzerland',
    airport: 'ZRH',
    latitude: 47.3769,
    longitude: 8.5417
  },

  // Austria
  vienna: {
    city: 'Vienna',
    country: 'Austria',
    airport: 'VIE',
    latitude: 48.2082,
    longitude: 16.3738
  },

  // Czech Republic
  prague: {
    city: 'Prague',
    country: 'Czech Republic',
    airport: 'PRG',
    latitude: 50.0755,
    longitude: 14.4378
  },

  // India
  delhi: {
    city: 'New Delhi',
    country: 'India',
    airport: 'DEL',
    latitude: 28.6139,
    longitude: 77.2090
  },
  mumbai: {
    city: 'Mumbai',
    country: 'India',
    airport: 'BOM',
    latitude: 19.0760,
    longitude: 72.8777
  },
  bangalore: {
    city: 'Bangalore',
    country: 'India',
    airport: 'BLR',
    latitude: 12.9716,
    longitude: 77.5946
  },
  chennai: {
    city: 'Chennai',
    country: 'India',
    airport: 'MAA',
    latitude: 13.0827,
    longitude: 80.2707
  },
  kolkata: {
    city: 'Kolkata',
    country: 'India',
    airport: 'CCU',
    latitude: 22.5726,
    longitude: 88.3639
  },
  hyderabad: {
    city: 'Hyderabad',
    country: 'India',
    airport: 'HYD',
    latitude: 17.3850,
    longitude: 78.4867
  },
  goa: {
    city: 'Goa',
    country: 'India',
    airport: 'GOI',
    latitude: 15.2993,
    longitude: 74.1240
  },
  jaipur: {
    city: 'Jaipur',
    country: 'India',
    airport: 'JAI',
    latitude: 26.9124,
    longitude: 75.7873
  }
};

// Helper function to get unique countries
export const getCountries = (): string[] => {
  const countries = Object.values(locations).map(loc => loc.country);
  return [...new Set(countries)].sort();
};

// Helper function to get cities by country
export const getCitiesByCountry = (country: string): Location[] => {
  return Object.values(locations)
    .filter(loc => loc.country === country)
    .sort((a, b) => a.city.localeCompare(b.city));
};
