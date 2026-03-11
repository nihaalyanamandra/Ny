# Amadeus API Integration Guide

This AI Travel Agent now supports **real-time flight and hotel data** through the Amadeus Travel API!

## Features with Amadeus API

✅ **Real Flight Prices** - Live pricing from airlines worldwide
✅ **Real Hotel Data** - Actual hotel availability and rates
✅ **Up-to-date Information** - Current availability and pricing
✅ **Free Tier** - 2,000 API calls/month at no cost

## Quick Setup (5 minutes)

### 1. Create Amadeus Account

1. Go to https://developers.amadeus.com/register
2. Sign up for a free account
3. Verify your email

### 2. Create an App

1. Log in to https://developers.amadeus.com/my-apps
2. Click "Create New App"
3. Give it a name (e.g., "AI Travel Agent")
4. Select "Self-Service" (free tier)

### 3. Get Your API Keys

1. Once your app is created, you'll see:
   - **API Key** (Client ID)
   - **API Secret** (Client Secret)
2. Copy both values

### 4. Add Keys to Environment

Open `/ai-travel-agent/.env.local` and update:

```bash
AMADEUS_API_KEY=your_api_key_here
AMADEUS_API_SECRET=your_api_secret_here
```

### 5. Restart the Server

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

That's it! The app will now use real flight and hotel data.

## API Endpoints Used

- **Flight Offers Search** - `GET /v2/shopping/flight-offers`
- **Hotel Search** - `GET /v1/reference-data/locations/hotels/by-city`
- **Hotel Offers** - `GET /v3/shopping/hotel-offers`

## Free Tier Limits

- **2,000 API calls/month**
- **10 calls per second**
- Sufficient for development and small-scale apps

## Fallback Behavior

The app is smart:
- ✅ If Amadeus API is configured → Uses real data
- ✅ If not configured or API fails → Falls back to mock data
- ✅ No errors, always works!

## Need More API Calls?

Amadeus offers paid tiers starting at $0.0002 per API call.
Visit: https://developers.amadeus.com/pricing

## Support

- **Amadeus Docs**: https://developers.amadeus.com/self-service
- **API Reference**: https://developers.amadeus.com/self-service/apis-docs
- **Community**: https://developers.amadeus.com/support

---

**Note**: Without Amadeus API keys, the app still works perfectly with realistic mock data. Real API integration is optional but recommended for production use.
