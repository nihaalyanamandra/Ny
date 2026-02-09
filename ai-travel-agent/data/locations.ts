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
  }
};
