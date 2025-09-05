import { type BrowserWorker } from '@cloudflare/playwright';

export interface Env {
  // KV Namespaces
  PRICING_DATA: KVNamespace;
  
  // R2 Buckets
  ARCHIVE: R2Bucket;
  
  // Browser Rendering
  CLOUD_PRICING_BROWSER: BrowserWorker; // Cloudflare Browser binding
  
  // AI Configuration
  OPENAI_API_KEY?: string; // Optional when using AI Gateway with stored keys
  AI_GATEWAY_URL?: string; // Cloudflare AI Gateway URL
  USE_AI_GATEWAY?: string; // Flag to use AI Gateway
  
  // Environment
  ENVIRONMENT: 'development' | 'staging' | 'production';
}

export interface CloudflareBindings extends Env {}