# 🌍 AI Travel Agent

An intelligent travel planning application that generates comprehensive multi-city trip itineraries with AI-powered recommendations, visa guidance, accommodation options, and complete day-by-day planning.

## ✨ Features

### Core Functionality
- **Multi-City Trip Planning**: Seamlessly plan trips across multiple cities (e.g., Dallas → Barcelona → Amsterdam → Dallas)
- **Visa Compliance**: Automatic Schengen visa validation and country restrictions
- **Multiple Itinerary Options**: Get 3 different itineraries (Budget, Balanced, Premium) for comparison
- **AI-Powered Recommendations**: Claude AI analyzes your preferences and provides personalized suggestions

### Comprehensive Planning
- ✈️ **Flight Options**: Multiple flight choices with pricing, stops, and booking links
- 🏨 **Accommodations**: Hotels, hostels, apartments with reviews and pricing
- 🎭 **Activities & Attractions**: Curated activities based on your interests
- 🚆 **Local Transport**: Trains, buses, car rentals, and city transport passes
- 🌤️ **Weather Forecasts**: Daily weather predictions for better planning
- 🗺️ **Day Trips**: Suggestions for nearby cities and attractions
- 🍽️ **Meal Planning**: Daily meal budgets and restaurant suggestions
- 💰 **Budget Tracking**: Detailed cost breakdown by category

### Smart Features
- **Interest-Based Recommendations**: Activities filtered by your interests (culture, food, nightlife, nature, etc.)
- **Pace Customization**: Choose relaxed, moderate, or packed itineraries
- **Budget Flexibility**: Set strict, moderate, or flexible budget constraints
- **Real-Time Comparison**: Compare itineraries by cost, speed, and experiences
- **Direct Booking Links**: Links to airlines, hotels, and activity booking sites

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- (Optional) Anthropic API key for enhanced AI recommendations

### Installation

1. **Clone the repository**
   ```bash
   cd ai-travel-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional)
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

   > **Note**: The app works without an API key using mock data and fallback recommendations. With an API key, you get enhanced AI-powered personalized recommendations.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 How to Use

### Planning Your Trip

1. **Enter Trip Details**
   - Origin city and country
   - First destination (e.g., Barcelona, Spain)
   - Second city to return from (e.g., Amsterdam, Netherlands)
   - Start and end dates
   - Number of travelers

2. **Set Your Preferences**
   - Total budget in USD
   - Budget flexibility (strict/moderate/flexible)
   - Trip pace (relaxed/moderate/packed)
   - Select your interests (culture, food, nightlife, nature, etc.)
   - Accommodation preferences (hostel/hotel/apartment/luxury)
   - Visa type (Schengen or other)

3. **Generate Itinerary**
   - Click "Generate Itinerary"
   - Wait while AI creates personalized options (typically 10-15 seconds)

4. **Review Options**
   - Compare 3 different itinerary styles:
     - **Budget**: Most affordable option with hostels/budget accommodations
     - **Balanced**: Good mix of cost and comfort
     - **Premium**: Best accommodations and fastest travel options
   - See quick comparisons: Cheapest, Fastest, Most Activities, AI Recommended

5. **View Details**
   - Click "View Full Itinerary" on any option
   - See complete day-by-day breakdown:
     - Flight details with booking links
     - Daily accommodation with ratings
     - Activities scheduled throughout the day
     - Weather forecasts
     - Meal suggestions
     - Daily cost estimates
   - Explore optional day trips to nearby cities

## 🏗️ Architecture

### Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude API
- **Icons**: Lucide React
- **Date Handling**: date-fns

### Project Structure
```
ai-travel-agent/
├── app/
│   ├── api/
│   │   └── generate-itinerary/
│   │       └── route.ts          # API endpoint for itinerary generation
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/
│   ├── TripForm.tsx              # Trip planning form
│   └── ItineraryResults.tsx      # Results display and comparison
├── lib/
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   └── services/
│       ├── aiService.ts          # AI recommendation engine
│       ├── flightService.ts      # Flight search and mock data
│       ├── accommodationService.ts # Hotel/hostel search
│       ├── activityService.ts    # Activities and day trips
│       ├── transportService.ts   # Local transport options
│       ├── weatherService.ts     # Weather forecasts
│       └── visaService.ts        # Visa validation logic
├── data/
│   └── locations.ts              # City and airport data
└── README.md
```

## 🎯 Example Use Case

**Scenario**: 7-day bachelor trip from Dallas to Barcelona and Amsterdam

**Input**:
- From: Dallas, USA
- To: Barcelona, Spain
- Return from: Amsterdam, Netherlands
- Dates: 7 days
- Travelers: 4
- Budget: $5000 per person
- Interests: Nightlife, Food, Culture, Sports

**Output**:
The AI generates 3 itineraries with:
- Round-trip flights with options
- 3 nights in Barcelona (hotel recommendations)
- 3 nights in Amsterdam (hotel recommendations)
- Daily activities based on interests (Camp Nou tour, Gothic Quarter, Anne Frank House, etc.)
- Day trip suggestions (Montserrat, Bruges)
- Transport between cities (train/flight options)
- Weather forecasts
- Meal budgets and restaurant suggestions
- Complete cost breakdown
- Visa compliance check (Schengen)

## 🔧 Configuration

### Adding New Cities

Edit `data/locations.ts`:
```typescript
export const locations = {
  yourCity: {
    city: 'City Name',
    country: 'Country',
    airport: 'IATA Code',
    latitude: 0.0,
    longitude: 0.0
  }
};
```

### Adding Activities

Edit `lib/services/activityService.ts` and add to the `getCityActivities` function.

### Customizing AI Prompts

Edit `lib/services/aiService.ts` and modify the `buildRecommendationPrompt` function.

## 🌐 API Integration

### Current Status
The app currently uses mock data for:
- Flights (realistic pricing and schedules)
- Accommodations (based on real hotels/hostels)
- Activities (real attractions with accurate info)
- Weather (seasonal patterns)
- Local transport (actual routes and pricing)

### Ready for Integration
The service architecture is designed to easily integrate real APIs:

**Flights**:
- [Amadeus Flight API](https://developers.amadeus.com/)
- [Skyscanner API](https://partners.skyscanner.net/)

**Hotels**:
- [Booking.com API](https://developers.booking.com/)
- [Hotels.com API](https://www.hotels.com/page/content/developers/)

**Activities**:
- [GetYourGuide API](https://api.getyourguide.com/)
- [Viator API](https://www.viator.com/partner/)

**Weather**:
- [OpenWeatherMap API](https://openweathermap.org/api)

## 🤖 AI Features

### With Anthropic API Key
- Personalized recommendations based on your specific trip
- Analysis of itinerary pros and cons
- Smart tips for your destination
- Context-aware suggestions

### Without API Key
- Fallback to rule-based recommendations
- General travel tips
- Full functionality for itinerary generation
- All features work except personalized AI insights

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm run build
# Deploy to Vercel
vercel
```

### Docker
```bash
docker build -t ai-travel-agent .
docker run -p 3000:3000 ai-travel-agent
```

### Environment Variables for Production
Set `ANTHROPIC_API_KEY` in your deployment platform's environment settings.

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Real API integrations
- Additional cities and activities
- Multi-language support
- Currency conversion
- User accounts and saved trips
- Social sharing features
- Mobile app version

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- AI powered by [Anthropic Claude](https://www.anthropic.com/)
- Icons by [Lucide](https://lucide.dev/)
- Inspiration from real-world travel planning challenges

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

**Happy Travels! 🌍✈️**
