'use client';

import { useState } from 'react';
import { Loader2, Plus, X, MapPin as MapPinIcon } from 'lucide-react';
import { locations, getCountries, getCitiesByCountry } from '@/data/locations';
import { getCountryInfo } from '@/data/countryInfo';

interface TripFormProps {
  onSubmit: (data: any) => void;
  loading: boolean;
}

export default function TripForm({ onSubmit, loading }: TripFormProps) {
  const [formData, setFormData] = useState({
    originCountry: 'United States',
    originCity: 'Dallas',
    destinationCountry: 'Spain',
    destinationCity: 'Barcelona',
    returnCountry: 'Netherlands',
    returnCity: 'Amsterdam',
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

  const [additionalCities, setAdditionalCities] = useState<Array<{ country: string; city: string }>>([]);

  const countries = getCountries();
  const originCities = getCitiesByCountry(formData.originCountry);
  const destinationCities = getCitiesByCountry(formData.destinationCountry);
  const returnCities = getCitiesByCountry(formData.returnCountry);

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
    onSubmit({ ...formData, additionalCities });
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

  const addCity = () => {
    setAdditionalCities([...additionalCities, { country: 'Spain', city: 'Madrid' }]);
  };

  const removeCity = (index: number) => {
    setAdditionalCities(additionalCities.filter((_, i) => i !== index));
  };

  const updateAdditionalCity = (index: number, field: 'country' | 'city', value: string) => {
    const updated = [...additionalCities];
    updated[index][field] = value;
    // Reset city if country changed
    if (field === 'country') {
      const citiesInCountry = getCitiesByCountry(value);
      updated[index].city = citiesInCountry[0]?.city || '';
    }
    setAdditionalCities(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">Plan Your Trip</h3>

      {/* Origin */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Origin Country</label>
          <select
            className="input-field"
            value={formData.originCountry}
            onChange={(e) => {
              const country = e.target.value;
              const cities = getCitiesByCountry(country);
              setFormData({
                ...formData,
                originCountry: country,
                originCity: cities[0]?.city || '',
              });
            }}
            required
          >
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Origin City</label>
          <select
            className="input-field"
            value={formData.originCity}
            onChange={(e) => setFormData({ ...formData, originCity: e.target.value })}
            required
          >
            {originCities.map((location) => (
              <option key={location.city} value={location.city}>
                {location.city} ({location.airport || 'N/A'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* First Destination */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">First Destination Country</label>
          <select
            className="input-field"
            value={formData.destinationCountry}
            onChange={(e) => {
              const country = e.target.value;
              const cities = getCitiesByCountry(country);
              setFormData({
                ...formData,
                destinationCountry: country,
                destinationCity: cities[0]?.city || '',
              });
            }}
            required
          >
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">First Destination City</label>
          <select
            className="input-field"
            value={formData.destinationCity}
            onChange={(e) => setFormData({ ...formData, destinationCity: e.target.value })}
            required
          >
            {destinationCities.map((location) => (
              <option key={location.city} value={location.city}>
                {location.city} ({location.airport || 'N/A'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Destination Country Info */}
      {formData.destinationCountry && (
        <div className={`p-4 rounded-xl bg-gradient-to-r ${getCountryInfo(formData.destinationCountry).color} text-white shadow-lg`}>
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-4xl">{getCountryInfo(formData.destinationCountry).emoji}</span>
            <div>
              <h4 className="text-lg font-bold">Discover {formData.destinationCountry}</h4>
              <p className="text-sm opacity-90">Famous for: {getCountryInfo(formData.destinationCountry).landmark}</p>
            </div>
          </div>
          <p className="text-sm opacity-90">{getCountryInfo(formData.destinationCountry).description}</p>
        </div>
      )}

      {/* Additional Cities */}
      {additionalCities.map((city, index) => (
        <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-700/50 rounded-lg relative border border-slate-600">
          <button
            type="button"
            onClick={() => removeCity(index)}
            className="absolute top-2 right-2 text-red-400 hover:text-red-500"
          >
            <X className="h-5 w-5" />
          </button>
          <div>
            <label className="label">Additional City {index + 1} - Country</label>
            <select
              className="input-field"
              value={city.country}
              onChange={(e) => updateAdditionalCity(index, 'country', e.target.value)}
              required
            >
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Additional City {index + 1}</label>
            <select
              className="input-field"
              value={city.city}
              onChange={(e) => updateAdditionalCity(index, 'city', e.target.value)}
              required
            >
              {getCitiesByCountry(city.country).map((location) => (
                <option key={location.city} value={location.city}>
                  {location.city} ({location.airport || 'N/A'})
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      {/* Add City Button */}
      <button
        type="button"
        onClick={addCity}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-blue-500 rounded-lg text-blue-400 hover:bg-slate-700/50 transition-colors font-semibold"
      >
        <Plus className="h-5 w-5" />
        <span>Add Another City to Visit</span>
      </button>

      {/* Return From */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Return From Country</label>
          <select
            className="input-field"
            value={formData.returnCountry}
            onChange={(e) => {
              const country = e.target.value;
              const cities = getCitiesByCountry(country);
              setFormData({
                ...formData,
                returnCountry: country,
                returnCity: cities[0]?.city || '',
              });
            }}
            required
          >
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Return From City</label>
          <select
            className="input-field"
            value={formData.returnCity}
            onChange={(e) => setFormData({ ...formData, returnCity: e.target.value })}
            required
          >
            {returnCities.map((location) => (
              <option key={location.city} value={location.city}>
                {location.city} ({location.airport || 'N/A'})
              </option>
            ))}
          </select>
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
                  : 'bg-slate-700 text-gray-200 hover:bg-slate-600 border border-slate-600'
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
                  : 'bg-slate-700 text-gray-200 hover:bg-slate-600 border border-slate-600'
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
