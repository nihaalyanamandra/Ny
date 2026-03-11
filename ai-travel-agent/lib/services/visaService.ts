import { VisaRule, VisaRestrictions, Location } from '../types';

// Visa rules database
export const visaRules: Record<string, VisaRule> = {
  schengen: {
    type: 'schengen',
    countries: [
      'Austria', 'Belgium', 'Czech Republic', 'Croatia', 'Denmark',
      'Estonia', 'Finland', 'France', 'Germany', 'Greece',
      'Hungary', 'Iceland', 'Italy', 'Latvia', 'Liechtenstein',
      'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Norway',
      'Poland', 'Portugal', 'Slovakia', 'Slovenia', 'Spain',
      'Sweden', 'Switzerland'
    ],
    maxCountries: 27, // Can visit all
    maxDuration: 90, // 90 days within 180 days
    requirements: [
      'Valid passport (6+ months validity)',
      'Travel insurance (minimum €30,000 coverage)',
      'Proof of accommodation',
      'Proof of sufficient funds',
      'Return flight ticket'
    ],
    restrictions: [
      'Cannot work without work permit',
      'Must enter through country that issued visa',
      '90 days max in any 180-day period'
    ]
  }
};

export class VisaService {
  /**
   * Check if a location is in Schengen area
   */
  static isSchengenCountry(country: string): boolean {
    return visaRules.schengen.countries.includes(country);
  }

  /**
   * Get list of Schengen countries
   */
  static getSchengenCountries(): string[] {
    return visaRules.schengen.countries;
  }

  /**
   * Validate trip against visa restrictions
   */
  static validateTrip(
    locations: Location[],
    restrictions?: VisaRestrictions
  ): {
    valid: boolean;
    visitedCountries: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const uniqueCountries = [...new Set(locations.map(loc => loc.country))];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!restrictions) {
      return {
        valid: true,
        visitedCountries: uniqueCountries,
        warnings: [],
        suggestions: ['Consider checking visa requirements for your nationality']
      };
    }

    if (restrictions.type === 'schengen') {
      const schengenCountries = uniqueCountries.filter(country =>
        this.isSchengenCountry(country)
      );
      const nonSchengenCountries = uniqueCountries.filter(country =>
        !this.isSchengenCountry(country)
      );

      if (nonSchengenCountries.length > 0) {
        warnings.push(
          `Non-Schengen countries detected: ${nonSchengenCountries.join(', ')}. ` +
          'You may need additional visas.'
        );
      }

      // Note: Schengen visa allows all Schengen countries
      if (schengenCountries.length > 0) {
        suggestions.push(
          `You can visit all ${schengenCountries.length} Schengen countries on your itinerary: ` +
          schengenCountries.join(', ')
        );
      }

      return {
        valid: true,
        visitedCountries: uniqueCountries,
        warnings,
        suggestions
      };
    }

    return {
      valid: true,
      visitedCountries: uniqueCountries,
      warnings: ['Unable to verify visa requirements for this visa type'],
      suggestions: ['Please verify visa requirements manually']
    };
  }

  /**
   * Suggest nearby countries to visit based on visa
   */
  static suggestCountries(
    currentLocation: Location,
    restrictions?: VisaRestrictions
  ): string[] {
    if (!restrictions || restrictions.type !== 'schengen') {
      return [];
    }

    const nearbyCountries: Record<string, string[]> = {
      'Spain': ['France', 'Portugal', 'Italy'],
      'France': ['Spain', 'Italy', 'Belgium', 'Switzerland', 'Germany'],
      'Italy': ['France', 'Switzerland', 'Austria', 'Slovenia'],
      'Netherlands': ['Belgium', 'Germany', 'France'],
      'Germany': ['France', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Czech Republic', 'Poland'],
      'Belgium': ['Netherlands', 'France', 'Germany', 'Luxembourg'],
      'Austria': ['Germany', 'Switzerland', 'Italy', 'Czech Republic', 'Hungary', 'Slovenia'],
      'Switzerland': ['France', 'Germany', 'Italy', 'Austria'],
      'Portugal': ['Spain'],
      'Greece': ['Italy'],
      'Czech Republic': ['Germany', 'Austria', 'Poland', 'Slovakia'],
      'Poland': ['Germany', 'Czech Republic', 'Slovakia', 'Lithuania'],
      'Hungary': ['Austria', 'Slovakia', 'Slovenia', 'Croatia'],
      'Croatia': ['Slovenia', 'Hungary', 'Italy']
    };

    const nearby = nearbyCountries[currentLocation.country] || [];
    return nearby.filter(country => this.isSchengenCountry(country));
  }

  /**
   * Get visa requirements for a country
   */
  static getVisaRequirements(visaType: string): string[] {
    const rule = visaRules[visaType];
    return rule ? rule.requirements : [];
  }

  /**
   * Calculate days used in Schengen area
   */
  static calculateSchengenDays(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Check if trip duration is within Schengen limits
   */
  static checkSchengenDuration(startDate: Date, endDate: Date): {
    valid: boolean;
    daysUsed: number;
    daysRemaining: number;
    warning?: string;
  } {
    const daysUsed = this.calculateSchengenDays(startDate, endDate);
    const maxDays = visaRules.schengen.maxDuration;
    const daysRemaining = maxDays - daysUsed;

    return {
      valid: daysUsed <= maxDays,
      daysUsed,
      daysRemaining: Math.max(0, daysRemaining),
      warning: daysUsed > maxDays
        ? `Trip duration (${daysUsed} days) exceeds Schengen limit (${maxDays} days in 180-day period)`
        : daysUsed > maxDays * 0.8
        ? `You're using ${daysUsed} of ${maxDays} allowed days in Schengen area`
        : undefined
    };
  }
}
