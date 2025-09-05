export interface Source {
  url: string;
  type: 'pricing' | 'limits' | 'fair-use' | 'docs';
  scrapedAt: string;
}

export interface Metadata {
  confidence: number;
  extractionModel: string;
  processingTime: number;
  schemaVersion: string;
}

export interface PricingData {
  provider: string;
  scrapedAt: string;
  sources: Source[];
  data: any; // Provider-specific structure
  metadata: Metadata;
}

export interface ProviderConfig {
  id: string;
  name: string;
  urls: string[];
  category: 'hosting' | 'api' | 'cloud' | 'database' | 'auth';
  extractionHints?: {
    selectors?: string[];
    keywords?: string[];
  };
}

export interface PageData {
  url: string;
  html: string;
  text: string;
  screenshot?: string; // Base64 encoded
  title: string;
  scrapedAt: string;
}

export interface ScrapingResult {
  success: boolean;
  provider: string;
  pages: PageData[];
  error?: string;
  duration: number;
}

export interface ValidationResult {
  valid: boolean;
  confidence: number;
  data?: any;
  errors?: string[];
  warnings?: string[];
}

export interface ExtractionResult {
  data: any;
  confidence: number;
  model: string;
  tokensUsed: number;
}