import Amadeus from 'amadeus';

/**
 * Amadeus API Client
 * Provides access to real-time flight, hotel, and transport data
 *
 * Get your API keys from: https://developers.amadeus.com/
 * Free tier: 2,000 API calls/month
 */
export class AmadeusClient {
  private static client: Amadeus | null = null;

  static getClient(): Amadeus | null {
    if (!this.client && process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET) {
      this.client = new Amadeus({
        clientId: process.env.AMADEUS_API_KEY,
        clientSecret: process.env.AMADEUS_API_SECRET,
      });
    }
    return this.client;
  }

  static isConfigured(): boolean {
    return !!(process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET);
  }
}
