import { ValidationResult, PricingData } from '../types';
import { KVStore } from '../storage/kv';
import { Env } from '../types/env';

export class ValidationPipeline {
  private kvStore: KVStore;

  constructor(private env: Env) {
    this.kvStore = new KVStore(env);
  }

  async validate(
    provider: string, 
    data: any, 
    confidence: number
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Core validation - required fields
    const coreValid = this.validateCore(data, errors);
    
    // 2. Provider-specific validation
    const providerValid = this.validateProvider(provider, data, warnings);
    
    // 3. Statistical validation - compare with historical data
    const statsValid = await this.validateStatistically(provider, data, warnings);
    
    // 4. Semantic validation - does it make sense?
    const semanticValid = this.validateSemantically(data, warnings);
    
    // Calculate overall confidence
    const validationScore = [
      coreValid ? 1 : 0,
      providerValid ? 0.8 : 0,
      statsValid ? 0.7 : 0.5,
      semanticValid ? 0.9 : 0.5
    ].reduce((a, b) => a + b, 0) / 4;
    
    const finalConfidence = (confidence + validationScore) / 2;
    
    // Decision logic
    const valid = coreValid && finalConfidence > 0.5;
    
    if (!valid && errors.length === 0) {
      errors.push(`Confidence too low: ${(finalConfidence * 100).toFixed(1)}%`);
    }
    
    return {
      valid,
      confidence: finalConfidence,
      data: valid ? data : undefined,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private validateCore(data: any, errors: string[]): boolean {
    // Check if data exists and is not empty
    if (!data || typeof data !== 'object') {
      errors.push('Data is empty or not an object');
      return false;
    }
    
    // Check if data has meaningful content
    const dataStr = JSON.stringify(data);
    if (dataStr.length < 100) {
      errors.push('Data appears to be too small to contain pricing information');
      return false;
    }
    
    // Check for at least some expected fields
    const hasExpectedFields = 
      this.hasAnyProperty(data, ['price', 'cost', 'plan', 'tier', 'free', 'pro', 'enterprise']) ||
      this.hasAnyProperty(data, ['limits', 'quotas', 'features', 'included']);
    
    if (!hasExpectedFields) {
      errors.push('Data does not contain expected pricing-related fields');
      return false;
    }
    
    return true;
  }

  private validateProvider(provider: string, data: any, warnings: string[]): boolean {
    // Provider-specific checks
    switch (provider) {
      case 'vercel':
        return this.validateVercel(data, warnings);
      case 'netlify':
        return this.validateNetlify(data, warnings);
      default:
        // Unknown provider - basic validation only
        return true;
    }
  }

  private validateVercel(data: any, warnings: string[]): boolean {
    // Check for expected Vercel structure
    const hasPlans = 
      this.hasAnyProperty(data, ['hobby', 'pro', 'enterprise']) ||
      this.hasAnyProperty(data, ['tiers', 'plans']);
    
    if (!hasPlans) {
      warnings.push('Vercel data missing expected plan structure');
    }
    
    // Check for Vercel-specific limits
    const hasLimits = this.hasAnyProperty(data, ['bandwidth', 'buildMinutes', 'functions']);
    if (!hasLimits) {
      warnings.push('Vercel data missing expected limit types');
    }
    
    return true; // Warnings don't fail validation
  }

  private validateNetlify(data: any, warnings: string[]): boolean {
    // Check for expected Netlify structure
    const hasPlans = 
      this.hasAnyProperty(data, ['free', 'pro', 'business', 'enterprise']) ||
      this.hasAnyProperty(data, ['plans', 'tiers']);
    
    if (!hasPlans) {
      warnings.push('Netlify data missing expected plan structure');
    }
    
    // Check for Netlify-specific features
    const hasFeatures = this.hasAnyProperty(data, ['bandwidth', 'buildMinutes', 'functions', 'edgeFunctions']);
    if (!hasFeatures) {
      warnings.push('Netlify data missing expected feature types');
    }
    
    return true;
  }

  private async validateStatistically(
    provider: string, 
    newData: any, 
    warnings: string[]
  ): Promise<boolean> {
    // Get historical data
    const historical = await this.kvStore.getCurrentPricing(provider);
    
    if (!historical) {
      // No historical data - can't compare
      return true;
    }
    
    // Compare data sizes
    const oldSize = JSON.stringify(historical.data).length;
    const newSize = JSON.stringify(newData).length;
    const sizeChange = Math.abs(oldSize - newSize) / oldSize;
    
    if (sizeChange > 0.5) {
      warnings.push(`Data size changed by ${(sizeChange * 100).toFixed(0)}% from last extraction`);
    }
    
    // Check for dramatic price changes
    const oldPrices = this.extractPrices(historical.data);
    const newPrices = this.extractPrices(newData);
    
    for (const price of newPrices) {
      const closestOld = this.findClosestPrice(price, oldPrices);
      if (closestOld) {
        const change = Math.abs(price - closestOld) / closestOld;
        if (change > 0.5) {
          warnings.push(`Detected ${(change * 100).toFixed(0)}% price change: $${closestOld} → $${price}`);
        }
      }
    }
    
    return true;
  }

  private validateSemantically(data: any, warnings: string[]): boolean {
    // Check for reasonable price values
    const prices = this.extractPrices(data);
    
    for (const price of prices) {
      if (price < 0) {
        warnings.push(`Invalid negative price found: $${price}`);
        return false;
      }
      if (price > 100000) {
        warnings.push(`Unusually high price found: $${price}`);
      }
    }
    
    // Check for duplicate or conflicting information
    const jsonStr = JSON.stringify(data, null, 2);
    const lines = jsonStr.split('\n');
    const seen = new Map<string, number>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('"price"') || line.includes('"cost"')) {
        const value = line.match(/:\s*(.+?)[,}]/)?.[1];
        if (value && seen.has(value)) {
          const prevLine = seen.get(value)!;
          if (Math.abs(i - prevLine) > 5) {
            warnings.push(`Duplicate price value found: ${value}`);
          }
        }
        if (value) seen.set(value, i);
      }
    }
    
    return true;
  }

  private hasAnyProperty(obj: any, properties: string[]): boolean {
    const objStr = JSON.stringify(obj).toLowerCase();
    return properties.some(prop => objStr.includes(prop.toLowerCase()));
  }

  private extractPrices(data: any): number[] {
    const prices: number[] = [];
    const jsonStr = JSON.stringify(data);
    
    // Find numeric values that look like prices
    const pricePatterns = [
      /"\$?(\d+(?:\.\d{2})?)"/, // "$19.99" or "19.99"
      /:\s*(\d+(?:\.\d{2})?)[,}]/, // : 19.99
      /"price":\s*(\d+(?:\.\d{2})?)/i, // "price": 19.99
      /"cost":\s*(\d+(?:\.\d{2})?)/i, // "cost": 19.99
    ];
    
    for (const pattern of pricePatterns) {
      const matches = jsonStr.matchAll(new RegExp(pattern, 'g'));
      for (const match of matches) {
        const price = parseFloat(match[1]);
        if (!isNaN(price) && price >= 0 && price < 100000) {
          prices.push(price);
        }
      }
    }
    
    return [...new Set(prices)]; // Remove duplicates
  }

  private findClosestPrice(target: number, prices: number[]): number | null {
    if (prices.length === 0) return null;
    
    let closest = prices[0];
    let minDiff = Math.abs(target - prices[0]);
    
    for (const price of prices) {
      const diff = Math.abs(target - price);
      if (diff < minDiff) {
        minDiff = diff;
        closest = price;
      }
    }
    
    // Only consider it a match if within 20% of target
    if (minDiff / target < 0.2) {
      return closest;
    }
    
    return null;
  }
}