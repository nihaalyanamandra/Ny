'use client';

import { useState } from 'react';
import { Plane, MapPin, Calendar, Users, DollarSign, Sparkles } from 'lucide-react';
import TripForm from '@/components/TripForm';
import ItineraryResults from '@/components/ItineraryResults';
import { AIRecommendation } from '@/lib/types';

export default function Home() {
  const [results, setResults] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTripSubmit = async (formData: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/generate-itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate itinerary');
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate itinerary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Plane className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">AI Travel Agent</h1>
            </div>
            <div className="flex items-center space-x-2 text-sm font-bold text-black">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span>Powered by Claude AI</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-4">
            Plan Your Perfect Trip
          </h2>
          <p className="text-xl font-bold text-black max-w-3xl mx-auto">
            Get personalized multi-city itineraries with visa guidance, accommodation options,
            activities, and complete day-by-day planning powered by AI.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <FeatureCard
            icon={<MapPin className="h-6 w-6 text-blue-600" />}
            title="Multi-City Planning"
            description="Plan trips across multiple cities with seamless connections"
          />
          <FeatureCard
            icon={<Calendar className="h-6 w-6 text-green-600" />}
            title="Day-by-Day Itinerary"
            description="Detailed daily plans with activities, meals, and transport"
          />
          <FeatureCard
            icon={<Users className="h-6 w-6 text-purple-600" />}
            title="Visa Guidance"
            description="Schengen visa rules and country restrictions included"
          />
          <FeatureCard
            icon={<DollarSign className="h-6 w-6 text-orange-600" />}
            title="Budget Options"
            description="Multiple itineraries from budget to premium"
          />
        </div>

        {/* Main Content */}
        {!results ? (
          <div className="max-w-4xl mx-auto">
            <TripForm onSubmit={handleTripSubmit} loading={loading} />
          </div>
        ) : (
          <ItineraryResults results={results} onReset={() => setResults(null)} />
        )}
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center font-bold text-black">
            © 2024 AI Travel Agent. Built with Next.js and Claude AI.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-center space-x-3 mb-3">
        {icon}
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm font-bold text-black">{description}</p>
    </div>
  );
}
