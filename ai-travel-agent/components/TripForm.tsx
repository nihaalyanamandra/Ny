'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface TripFormProps {
  onSubmit: (data: any) => void;
  loading: boolean;
}

export default function TripForm({ onSubmit, loading }: TripFormProps) {
  const [formData, setFormData] = useState({
    originCity: 'Dallas',
    originCountry: 'United States',
    destinationCity: 'Barcelona',
    destinationCountry: 'Spain',
    returnCity: 'Amsterdam',
    returnCountry: 'Netherlands',
    startDate: '',
    endDate: '',
    travelers: 1,
    budget: 5000,
    budgetFlexibility: 'moderate' as const,
    pace: 'moderate' as const,
    interests: [] as string[],
    accommodationType: ['hotel'] as string[],
    visaType: 'schengen' as const,
  });

  const interestOptions = [
    'culture',
    'food',
    'nightlife',
    'nature',
    'shopping',
    'history',
    'art',
    'architecture',
    'sports',
    'adventure',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const toggleInterest = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const toggleAccommodation = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      accommodationType: prev.accommodationType.includes(type)
        ? prev.accommodationType.filter((t) => t !== type)
        : [...prev.accommodationType, type],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">Plan Your Trip</h3>

      {/* Origin */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Origin City</label>
          <input
            type="text"
            className="input-field"
            value={formData.originCity}
            onChange={(e) => setFormData({ ...formData, originCity: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Origin Country</label>
          <input
            type="text"
            className="input-field"
            value={formData.originCountry}
            onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Destination */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">First Destination</label>
          <input
            type="text"
            className="input-field"
            value={formData.destinationCity}
            onChange={(e) => setFormData({ ...formData, destinationCity: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Country</label>
          <input
            type="text"
            className="input-field"
            value={formData.destinationCountry}
            onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Return From */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Return From (Second City)</label>
          <input
            type="text"
            className="input-field"
            value={formData.returnCity}
            onChange={(e) => setFormData({ ...formData, returnCity: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Country</label>
          <input
            type="text"
            className="input-field"
            value={formData.returnCountry}
            onChange={(e) => setFormData({ ...formData, returnCountry: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Start Date</label>
          <input
            type="date"
            className="input-field"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">End Date</label>
          <input
            type="date"
            className="input-field"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Travelers and Budget */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Number of Travelers</label>
          <input
            type="number"
            min="1"
            max="10"
            className="input-field"
            value={formData.travelers}
            onChange={(e) => setFormData({ ...formData, travelers: parseInt(e.target.value) })}
            required
          />
        </div>
        <div>
          <label className="label">Total Budget (USD)</label>
          <input
            type="number"
            min="500"
            step="100"
            className="input-field"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value) })}
            required
          />
        </div>
      </div>

      {/* Budget Flexibility */}
      <div>
        <label className="label">Budget Flexibility</label>
        <select
          className="input-field"
          value={formData.budgetFlexibility}
          onChange={(e) =>
            setFormData({ ...formData, budgetFlexibility: e.target.value as any })
          }
        >
          <option value="strict">Strict - Must stay within budget</option>
          <option value="moderate">Moderate - Some flexibility allowed</option>
          <option value="flexible">Flexible - Budget is just a guideline</option>
        </select>
      </div>

      {/* Trip Pace */}
      <div>
        <label className="label">Trip Pace</label>
        <select
          className="input-field"
          value={formData.pace}
          onChange={(e) => setFormData({ ...formData, pace: e.target.value as any })}
        >
          <option value="relaxed">Relaxed - 2-3 activities per day</option>
          <option value="moderate">Moderate - 3-4 activities per day</option>
          <option value="packed">Packed - 4+ activities per day</option>
        </select>
      </div>

      {/* Interests */}
      <div>
        <label className="label">Your Interests (select all that apply)</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
          {interestOptions.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => toggleInterest(interest)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.interests.includes(interest)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 font-bold text-black hover:bg-gray-200'
              }`}
            >
              {interest.charAt(0).toUpperCase() + interest.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Accommodation Type */}
      <div>
        <label className="label">Accommodation Preferences</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {['hostel', 'hotel', 'apartment', 'luxury'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleAccommodation(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.accommodationType.includes(type)
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 font-bold text-black hover:bg-gray-200'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Visa Type */}
      <div>
        <label className="label">Visa Type</label>
        <select
          className="input-field"
          value={formData.visaType}
          onChange={(e) => setFormData({ ...formData, visaType: e.target.value as any })}
        >
          <option value="schengen">Schengen Visa</option>
          <option value="other">Other / Not Sure</option>
        </select>
        {formData.visaType === 'schengen' && (
          <p className="mt-2 text-sm font-bold text-black">
            ℹ️ Schengen visa allows you to visit all Schengen countries. Your itinerary will be
            checked for compliance.
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || formData.interests.length === 0}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generating Your Perfect Trip...</span>
          </>
        ) : (
          <span>Generate Itinerary</span>
        )}
      </button>

      {formData.interests.length === 0 && (
        <p className="text-sm text-red-600 text-center">Please select at least one interest</p>
      )}
    </form>
  );
}
