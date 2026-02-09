// Core types for the AI Travel Agent

export interface Location {
  city: string;
  country: string;
  airport?: string;
  latitude: number;
  longitude: number;
}

export interface TripRequest {
  origin: Location;
  destination: Location;
  returnFrom?: Location; // For multi-city trips
  startDate: Date;
  endDate: Date;
  travelers: number;
  budget: BudgetPreferences;
  preferences: TravelPreferences;
  visaRestrictions?: VisaRestrictions;
}

export interface BudgetPreferences {
  total: number;
  currency: string;
  flexibility: 'strict' | 'moderate' | 'flexible';
  priorities: ('cost' | 'comfort' | 'time' | 'experience')[];
}

export interface TravelPreferences {
  pace: 'relaxed' | 'moderate' | 'packed';
  interests: string[]; // e.g., ['culture', 'food', 'nightlife', 'nature', 'shopping']
  accommodationType: ('hostel' | 'hotel' | 'apartment' | 'luxury')[];
  transportPreference: ('flight' | 'train' | 'bus' | 'car')[];
  mealPreferences?: string[];
  accessibility?: string[];
}

export interface VisaRestrictions {
  type: 'schengen' | 'other';
  allowedCountries: number; // e.g., 2-3 for Schengen
  countries?: string[]; // Specific countries allowed
  validUntil?: Date;
}

// Flight types
export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  origin: Location;
  destination: Location;
  departure: Date;
  arrival: Date;
  duration: number; // in minutes
  stops: number;
  price: number;
  currency: string;
  class: 'economy' | 'premium economy' | 'business' | 'first';
  bookingUrl: string;
  baggage: {
    cabin: string;
    checked: string;
  };
}

export interface FlightOption {
  outbound: Flight[];
  return?: Flight[];
  totalPrice: number;
  totalDuration: number;
  currency: string;
  score: number; // Our AI-generated score
}

// Accommodation types
export interface Accommodation {
  id: string;
  name: string;
  type: 'hotel' | 'hostel' | 'apartment' | 'resort';
  location: Location;
  address: string;
  rating: number;
  reviews: number;
  pricePerNight: number;
  currency: string;
  amenities: string[];
  images: string[];
  bookingUrl: string;
  checkIn: string;
  checkOut: string;
  cancellationPolicy: string;
}

// Transportation types
export interface LocalTransport {
  id: string;
  type: 'train' | 'bus' | 'car rental' | 'metro' | 'taxi' | 'bike';
  from: string;
  to: string;
  provider: string;
  departure?: Date;
  arrival?: Date;
  duration?: number; // in minutes
  price: number;
  currency: string;
  bookingUrl: string;
  details: Record<string, any>;
}

// Activity types
export interface Activity {
  id: string;
  name: string;
  type: string; // museum, restaurant, tour, attraction, etc.
  location: Location;
  address: string;
  description: string;
  duration: number; // in minutes
  price: number;
  currency: string;
  rating: number;
  reviews: number;
  bookingUrl?: string;
  openingHours: {
    [day: string]: string;
  };
  bestTimeToVisit?: string;
  images: string[];
  tags: string[];
}

// Day trip types
export interface DayTrip {
  id: string;
  from: string;
  to: string;
  name: string;
  description: string;
  duration: number; // in hours
  transport: LocalTransport[];
  activities: Activity[];
  estimatedCost: number;
  currency: string;
  difficulty: 'easy' | 'moderate' | 'challenging';
  bestSeason: string[];
}

// Weather types
export interface Weather {
  location: string;
  date: Date;
  temperature: {
    min: number;
    max: number;
    unit: 'C' | 'F';
  };
  condition: string;
  precipitation: number;
  humidity: number;
  windSpeed: number;
  description: string;
}

// Itinerary types
export interface DailyItinerary {
  day: number;
  date: Date;
  location: string;
  accommodation: Accommodation;
  activities: ItineraryActivity[];
  meals: Meal[];
  transport: LocalTransport[];
  weather: Weather;
  estimatedCost: number;
  notes: string[];
}

export interface ItineraryActivity {
  time: string;
  activity: Activity;
  duration: number;
  transport?: LocalTransport;
  notes?: string;
}

export interface Meal {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  time: string;
  suggestion?: string;
  estimatedCost: number;
  bookingUrl?: string;
}

// Complete itinerary
export interface TripItinerary {
  id: string;
  name: string;
  request: TripRequest;
  flights: FlightOption;
  dailyItinerary: DailyItinerary[];
  dayTrips: DayTrip[];
  totalCost: {
    flights: number;
    accommodation: number;
    activities: number;
    food: number;
    transport: number;
    total: number;
    currency: string;
  };
  score: number;
  pros: string[];
  cons: string[];
  aiRecommendations: string[];
  visaCompliant: boolean;
  generatedAt: Date;
}

// Response from AI service
export interface AIRecommendation {
  itineraries: TripItinerary[];
  comparisons: {
    cheapest: string; // itinerary id
    fastest: string;
    mostExperiences: string;
    recommended: string;
  };
  tips: string[];
  warnings: string[];
}

// Visa rules database
export interface VisaRule {
  type: string;
  countries: string[];
  maxCountries: number;
  maxDuration: number; // in days
  requirements: string[];
  restrictions: string[];
}
