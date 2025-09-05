import { PricingData } from '../types';
import { Env } from '../types/env';

export class KVStore {
  constructor(private env: Env) {}

  async getCurrentPricing(provider: string): Promise<PricingData | null> {
    const key = `pricing:${provider}:current`;
    const data = await this.env.PRICING_DATA.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setCurrentPricing(provider: string, data: PricingData): Promise<void> {
    const key = `pricing:${provider}:current`;
    await this.env.PRICING_DATA.put(key, JSON.stringify(data));
    
    // Also archive with date
    const date = new Date().toISOString().split('T')[0];
    const archiveKey = `pricing:${provider}:${date}`;
    await this.env.PRICING_DATA.put(
      archiveKey,
      JSON.stringify(data),
      { expirationTtl: 365 * 24 * 60 * 60 } // 1 year
    );
  }

  async getHistoricalPricing(provider: string, date: string): Promise<PricingData | null> {
    const key = `pricing:${provider}:${date}`;
    const data = await this.env.PRICING_DATA.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getProviderList(): Promise<string[]> {
    const list = await this.env.PRICING_DATA.get('provider:list');
    return list ? JSON.parse(list) : [];
  }

  async setProviderList(providers: string[]): Promise<void> {
    await this.env.PRICING_DATA.put('provider:list', JSON.stringify(providers));
  }

  async setScrapingLock(provider: string, jobId: string): Promise<boolean> {
    const key = `scraping:${provider}:lock`;
    const existing = await this.env.PRICING_DATA.get(key);
    
    if (existing) {
      return false; // Already locked
    }
    
    await this.env.PRICING_DATA.put(key, jobId, {
      expirationTtl: 5 * 60 // 5 minutes
    });
    
    return true;
  }

  async releaseScrapingLock(provider: string): Promise<void> {
    const key = `scraping:${provider}:lock`;
    await this.env.PRICING_DATA.delete(key);
  }

  async getLastFailure(provider: string): Promise<any | null> {
    const key = `validation:${provider}:last_failure`;
    const data = await this.env.PRICING_DATA.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setLastFailure(provider: string, failure: any): Promise<void> {
    const key = `validation:${provider}:last_failure`;
    await this.env.PRICING_DATA.put(
      key,
      JSON.stringify(failure),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );
  }
}