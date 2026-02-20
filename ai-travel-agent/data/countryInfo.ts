export interface CountryInfo {
  emoji: string;
  landmark: string;
  description: string;
  color: string;
}

export const countryInfo: Record<string, CountryInfo> = {
  'Spain': {
    emoji: '🇪🇸',
    landmark: 'Sagrada Familia',
    description: 'Gaudí\'s masterpiece and vibrant culture',
    color: 'from-red-500 to-yellow-500'
  },
  'Netherlands': {
    emoji: '🇳🇱',
    landmark: 'Windmills & Canals',
    description: 'Tulips, bikes, and canal houses',
    color: 'from-orange-500 to-blue-500'
  },
  'France': {
    emoji: '🇫🇷',
    landmark: 'Eiffel Tower',
    description: 'Romance, art, and exquisite cuisine',
    color: 'from-blue-600 to-red-600'
  },
  'Italy': {
    emoji: '🇮🇹',
    landmark: 'Colosseum',
    description: 'Ancient history and la dolce vita',
    color: 'from-green-500 to-red-500'
  },
  'United Kingdom': {
    emoji: '🇬🇧',
    landmark: 'Big Ben',
    description: 'Royal heritage and modern culture',
    color: 'from-blue-700 to-red-700'
  },
  'Germany': {
    emoji: '🇩🇪',
    landmark: 'Brandenburg Gate',
    description: 'Rich history and innovation',
    color: 'from-black to-red-600'
  },
  'Portugal': {
    emoji: '🇵🇹',
    landmark: 'Torre de Belém',
    description: 'Coastal beauty and port wine',
    color: 'from-green-600 to-red-600'
  },
  'Belgium': {
    emoji: '🇧🇪',
    landmark: 'Grand Place',
    description: 'Chocolates, waffles, and medieval charm',
    color: 'from-black to-yellow-500'
  },
  'Greece': {
    emoji: '🇬🇷',
    landmark: 'Parthenon',
    description: 'Ancient civilization and islands',
    color: 'from-blue-500 to-white'
  },
  'Switzerland': {
    emoji: '🇨🇭',
    landmark: 'Matterhorn',
    description: 'Alpine peaks and precision',
    color: 'from-red-600 to-white'
  },
  'Austria': {
    emoji: '🇦🇹',
    landmark: 'Schönbrunn Palace',
    description: 'Imperial elegance and music',
    color: 'from-red-600 to-white'
  },
  'Czech Republic': {
    emoji: '🇨🇿',
    landmark: 'Prague Castle',
    description: 'Fairytale architecture and beer',
    color: 'from-blue-600 to-red-600'
  },
  'United States': {
    emoji: '🇺🇸',
    landmark: 'Statue of Liberty',
    description: 'Diverse landscapes and cultures',
    color: 'from-blue-700 to-red-700'
  },
  'Japan': {
    emoji: '🇯🇵',
    landmark: 'Mount Fuji',
    description: 'Ancient traditions meet modern tech',
    color: 'from-red-600 to-white'
  },
  'Singapore': {
    emoji: '🇸🇬',
    landmark: 'Marina Bay Sands',
    description: 'Garden city and culinary paradise',
    color: 'from-red-500 to-white'
  },
  'United Arab Emirates': {
    emoji: '🇦🇪',
    landmark: 'Burj Khalifa',
    description: 'Modern luxury in the desert',
    color: 'from-green-600 to-red-600'
  },
  'Thailand': {
    emoji: '🇹🇭',
    landmark: 'Grand Palace',
    description: 'Temples, beaches, and street food',
    color: 'from-red-600 to-blue-600'
  },
  'Hong Kong': {
    emoji: '🇭🇰',
    landmark: 'Victoria Peak',
    description: 'East meets West skyline',
    color: 'from-red-600 to-white'
  },
  'Australia': {
    emoji: '🇦🇺',
    landmark: 'Sydney Opera House',
    description: 'Beaches, wildlife, and adventure',
    color: 'from-blue-600 to-green-600'
  },
  'Canada': {
    emoji: '🇨🇦',
    landmark: 'CN Tower',
    description: 'Natural beauty and multiculturalism',
    color: 'from-red-600 to-white'
  },
  'India': {
    emoji: '🇮🇳',
    landmark: 'Taj Mahal',
    description: 'Rich heritage, colors, and spices',
    color: 'from-orange-500 to-green-600'
  }
};

export const getCountryInfo = (country: string): CountryInfo => {
  return countryInfo[country] || {
    emoji: '🌍',
    landmark: 'Local Attractions',
    description: 'Discover this amazing destination',
    color: 'from-blue-500 to-purple-500'
  };
};
