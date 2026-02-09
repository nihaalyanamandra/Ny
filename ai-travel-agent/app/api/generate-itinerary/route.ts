import { NextResponse } from 'next/server';
import { AIService } from '@/lib/services/aiService';
import { TripRequest, Location } from '@/lib/types';
import { locations } from '@/data/locations';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Parse the form data into a TripRequest
    const origin: Location = getLocationByCity(body.originCity) || {
      city: body.originCity,
      country: body.originCountry,
      latitude: 0,
      longitude: 0,
    };

    const destination: Location = getLocationByCity(body.destinationCity) || {
      city: body.destinationCity,
      country: body.destinationCountry,
      latitude: 0,
      longitude: 0,
    };

    const returnFrom: Location = getLocationByCity(body.returnCity) || {
      city: body.returnCity,
      country: body.returnCountry,
      latitude: 0,
      longitude: 0,
    };

    const tripRequest: TripRequest = {
      origin,
      destination,
      returnFrom,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      travelers: body.travelers,
      budget: {
        total: body.budget,
        currency: 'USD',
        flexibility: body.budgetFlexibility,
        priorities: ['cost', 'comfort', 'experience'],
      },
      preferences: {
        pace: body.pace,
        interests: body.interests,
        accommodationType: body.accommodationType,
        transportPreference: ['flight', 'train', 'bus'],
      },
      visaRestrictions: body.visaType === 'schengen'
        ? {
            type: 'schengen',
            allowedCountries: 27,
          }
        : undefined,
    };

    // Generate recommendations
    const recommendations = await AIService.generateTripRecommendations(tripRequest);

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Error generating itinerary:', error);
    return NextResponse.json(
      { error: 'Failed to generate itinerary' },
      { status: 500 }
    );
  }
}

function getLocationByCity(city: string): Location | null {
  const cityLower = city.toLowerCase();
  const locationKey = Object.keys(locations).find(
    (key) => locations[key as keyof typeof locations].city.toLowerCase() === cityLower
  );

  return locationKey ? locations[locationKey as keyof typeof locations] : null;
}
