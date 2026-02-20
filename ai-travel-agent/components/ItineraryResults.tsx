'use client';

import { useState } from 'react';
import { AIRecommendation, TripItinerary } from '@/lib/types';
import {
  ArrowLeft,
  DollarSign,
  Clock,
  Star,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  MapPin,
  Plane,
  Hotel,
  Activity,
  AlertCircle,
  Lightbulb,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { getCountryInfo } from '@/data/countryInfo';

interface ItineraryResultsProps {
  results: AIRecommendation;
  onReset: () => void;
}

export default function ItineraryResults({ results, onReset }: ItineraryResultsProps) {
  const [selectedItinerary, setSelectedItinerary] = useState<TripItinerary | null>(null);

  if (selectedItinerary) {
    return (
      <DetailedItinerary
        itinerary={selectedItinerary}
        onBack={() => setSelectedItinerary(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Your Trip Options</h2>
        <button onClick={onReset} className="btn-secondary flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span>New Search</span>
        </button>
      </div>

      {/* Tips and Warnings */}
      {(results.tips.length > 0 || results.warnings.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.tips.length > 0 && (
            <div className="card bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-3">
                <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">Travel Tips</h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    {results.tips.map((tip, idx) => (
                      <li key={idx}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {results.warnings.length > 0 && (
            <div className="card bg-orange-50 border-orange-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-orange-900 mb-2">Important Notes</h3>
                  <ul className="space-y-1 text-sm text-orange-800">
                    {results.warnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comparison Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ComparisonCard
          title="Cheapest"
          icon={<DollarSign className="h-5 w-5" />}
          itinerary={results.itineraries.find((it) => it.id === results.comparisons.cheapest)}
        />
        <ComparisonCard
          title="Fastest Travel"
          icon={<Clock className="h-5 w-5" />}
          itinerary={results.itineraries.find((it) => it.id === results.comparisons.fastest)}
        />
        <ComparisonCard
          title="Most Activities"
          icon={<Activity className="h-5 w-5" />}
          itinerary={results.itineraries.find(
            (it) => it.id === results.comparisons.mostExperiences
          )}
        />
        <ComparisonCard
          title="AI Recommended"
          icon={<Star className="h-5 w-5" />}
          itinerary={results.itineraries.find((it) => it.id === results.comparisons.recommended)}
          highlighted
        />
      </div>

      {/* Itinerary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {results.itineraries.map((itinerary) => (
          <ItineraryCard
            key={itinerary.id}
            itinerary={itinerary}
            onSelect={() => setSelectedItinerary(itinerary)}
            isRecommended={itinerary.id === results.comparisons.recommended}
          />
        ))}
      </div>
    </div>
  );
}

function ComparisonCard({
  title,
  icon,
  itinerary,
  highlighted = false,
}: {
  title: string;
  icon: React.ReactNode;
  itinerary?: TripItinerary;
  highlighted?: boolean;
}) {
  if (!itinerary) return null;

  return (
    <div
      className={`card ${
        highlighted ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-300' : ''
      }`}
    >
      <div className="flex items-center space-x-2 mb-2">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-2xl font-bold text-gray-900">${itinerary.totalCost.total.toLocaleString()}</p>
      <p className="text-sm font-bold text-black mt-1">{itinerary.name}</p>
    </div>
  );
}

function ItineraryCard({
  itinerary,
  onSelect,
  isRecommended,
}: {
  itinerary: TripItinerary;
  onSelect: () => void;
  isRecommended: boolean;
}) {
  return (
    <div className={`card hover:shadow-xl transition-shadow ${isRecommended ? 'ring-2 ring-purple-400' : ''}`}>
      {isRecommended && (
        <div className="mb-3 flex items-center space-x-2 text-purple-600">
          <Star className="h-4 w-4 fill-current" />
          <span className="text-sm font-semibold">AI Recommended</span>
        </div>
      )}

      <h3 className="text-2xl font-bold text-gray-900 mb-4">{itinerary.name}</h3>

      {/* Score */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
            style={{ width: `${itinerary.score}%` }}
          />
        </div>
        <span className="text-sm font-semibold font-bold text-black">{itinerary.score}/100</span>
      </div>

      {/* Cost Breakdown */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="font-bold text-black">Total Cost</span>
          <span className="font-bold text-2xl text-gray-900">
            ${itinerary.totalCost.total.toLocaleString()}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-black">
          <div>Flights: ${itinerary.totalCost.flights}</div>
          <div>Hotels: ${itinerary.totalCost.accommodation}</div>
          <div>Activities: ${itinerary.totalCost.activities}</div>
          <div>Food: ${itinerary.totalCost.food}</div>
        </div>
      </div>

      {/* Pros and Cons */}
      <div className="space-y-3 mb-6">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <ThumbsUp className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold font-bold text-black">Pros</span>
          </div>
          <ul className="space-y-1">
            {itinerary.pros.map((pro, idx) => (
              <li key={idx} className="text-sm font-bold text-black">
                • {pro}
              </li>
            ))}
          </ul>
        </div>

        {itinerary.cons.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <ThumbsDown className="h-4 w-4 text-red-600" />
              <span className="text-sm font-semibold font-bold text-black">Cons</span>
            </div>
            <ul className="space-y-1">
              {itinerary.cons.map((con, idx) => (
                <li key={idx} className="text-sm font-bold text-black">
                  • {con}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* View Details Button */}
      <button onClick={onSelect} className="btn-primary w-full">
        View Full Itinerary
      </button>
    </div>
  );
}

function DetailedItinerary({
  itinerary,
  onBack,
}: {
  itinerary: TripItinerary;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <button onClick={onBack} className="mb-4 flex items-center space-x-2 text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Options</span>
        </button>

        <h2 className="text-3xl font-bold text-gray-900 mb-4">{itinerary.name}</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-bold text-black">Total Cost</p>
            <p className="text-2xl font-bold text-gray-900">${itinerary.totalCost.total.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-black">Duration</p>
            <p className="text-2xl font-bold text-gray-900">{itinerary.dailyItinerary.length} days</p>
          </div>
          <div>
            <p className="text-sm font-bold text-black">Activities</p>
            <p className="text-2xl font-bold text-gray-900">
              {itinerary.dailyItinerary.reduce((sum, day) => sum + day.activities.length, 0)}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-black">Score</p>
            <p className="text-2xl font-bold text-gray-900">{itinerary.score}/100</p>
          </div>
        </div>
      </div>

      {/* Flights */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Plane className="h-5 w-5 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900">Flights</h3>
        </div>

        <div className="space-y-4">
          {itinerary.flights.outbound.map((flight) => (
            <FlightCard key={flight.id} flight={flight} type="Outbound" />
          ))}
          {itinerary.flights.return?.map((flight) => (
            <FlightCard key={flight.id} flight={flight} type="Return" />
          ))}
        </div>
      </div>

      {/* Daily Itinerary */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-gray-900">Day-by-Day Itinerary</h3>
        {itinerary.dailyItinerary.map((day) => (
          <DayCard key={day.day} day={day} />
        ))}
      </div>

      {/* Day Trips */}
      {itinerary.dayTrips.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Optional Day Trips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {itinerary.dayTrips.map((trip) => (
              <div key={trip.id} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">{trip.name}</h4>
                <p className="text-sm font-bold text-black mb-2">{trip.description}</p>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-black">{trip.duration} hours</span>
                  <span className="font-semibold text-gray-900">${trip.estimatedCost}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FlightCard({ flight, type }: { flight: any; type: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-bold text-black">{type} Flight</p>
          <p className="font-semibold text-gray-900">
            {flight.airline} {flight.flightNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">${flight.price}</p>
          <p className="text-sm font-bold text-black">{flight.class}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div>
          <p className="font-semibold">{flight.origin.city}</p>
          <p className="font-bold text-black">{format(new Date(flight.departure), 'MMM dd, HH:mm')}</p>
        </div>
        <div className="text-center">
          <p className="font-bold text-black">{Math.floor(flight.duration / 60)}h {flight.duration % 60}m</p>
          <p className="font-bold text-black">{flight.stops} {flight.stops === 1 ? 'stop' : 'stops'}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{flight.destination.city}</p>
          <p className="font-bold text-black">{format(new Date(flight.arrival), 'MMM dd, HH:mm')}</p>
        </div>
      </div>
      <a
        href={flight.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
      >
        <span>Book on {flight.airline}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function DayCard({ day }: { day: any }) {
  const countryInfo = getCountryInfo(day.accommodation.location.country);

  return (
    <div className="card overflow-hidden">
      {/* Country Header */}
      <div className={`-mx-6 -mt-6 mb-4 p-4 bg-gradient-to-r ${countryInfo.color}`}>
        <div className="flex items-center space-x-3 text-white">
          <span className="text-3xl">{countryInfo.emoji}</span>
          <div>
            <h4 className="text-xl font-bold">Day {day.day} - {day.location}</h4>
            <p className="text-sm opacity-90">{format(new Date(day.date), 'EEEE, MMMM dd, yyyy')}</p>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-purple-600" />
          <p className="text-sm font-bold text-black">Exploring {countryInfo.landmark}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-black">Daily Cost</p>
          <p className="text-xl font-bold text-gray-900">${day.estimatedCost}</p>
        </div>
      </div>

      {/* Weather */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm font-semibold text-blue-900 mb-1">Weather</p>
        <p className="text-sm text-blue-800">
          {day.weather.condition} • {day.weather.temperature.min}°-{day.weather.temperature.max}°{day.weather.temperature.unit}
        </p>
        <p className="text-xs text-blue-700 mt-1">{day.weather.description}</p>
      </div>

      {/* Accommodation */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <Hotel className="h-4 w-4 text-purple-600" />
          <p className="text-sm font-semibold font-bold text-black">Accommodation</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-gray-900">{day.accommodation.name}</p>
              <p className="text-sm font-bold text-black">{day.accommodation.address}</p>
              <p className="text-xs text-gray-500 mt-1">
                ⭐ {day.accommodation.rating} ({day.accommodation.reviews} reviews)
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">${day.accommodation.pricePerNight}</p>
              <p className="text-xs font-bold text-black">per night</p>
            </div>
          </div>
          <a
            href={day.accommodation.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs"
          >
            <span>Book Now</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Activities */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <Activity className="h-4 w-4 text-green-600" />
          <p className="text-sm font-semibold font-bold text-black">Activities</p>
        </div>
        <div className="space-y-3">
          {day.activities.map((act: any, idx: number) => (
            <div key={idx} className="border-l-2 border-green-500 pl-3">
              <p className="text-sm font-semibold text-gray-900">{act.time} - {act.activity.name}</p>
              <p className="text-xs font-bold text-black mt-1">{act.activity.description}</p>
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                <span>{act.duration} min</span>
                <span>${act.activity.price}</span>
                {act.activity.bookingUrl && (
                  <a
                    href={act.activity.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <span>Book</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {day.notes && day.notes.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm font-semibold text-yellow-900 mb-1">Notes</p>
          {day.notes.map((note: string, idx: number) => (
            <p key={idx} className="text-sm text-yellow-800">
              • {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
