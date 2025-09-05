import { ProviderConfig } from '../types';

export const VERCEL_CONFIG: ProviderConfig = {
  id: 'vercel',
  name: 'Vercel',
  category: 'hosting',
  renderingMode: 'ssr', // Vercel pricing pages are server-side rendered
  urls: [
    'https://vercel.com/pricing',
    'https://vercel.com/docs/limits',
    'https://vercel.com/docs/limits/fair-use-guidelines',
    'https://vercel.com/docs/pricing'
  ],
  extractionHints: {
    keywords: ['Hobby', 'Pro', 'Enterprise', 'bandwidth', 'build minutes', 'serverless functions']
  }
};

export const NETLIFY_CONFIG: ProviderConfig = {
  id: 'netlify',
  name: 'Netlify',
  category: 'hosting',
  renderingMode: 'ssr', // Netlify pricing pages are server-side rendered
  urls: [
    'https://www.netlify.com/pricing/',
    'https://docs.netlify.com/manage/accounts-and-billing/billing-faq/',
    'https://www.netlify.com/pricing/faq/'
  ],
  extractionHints: {
    keywords: ['Free', 'Pro', 'Enterprise', 'bandwidth', 'build minutes', 'functions', 'edge functions']
  }
};

export const SUPABASE_CONFIG: ProviderConfig = {
  id: 'supabase',
  name: 'Supabase',
  category: 'database',
  renderingMode: 'ssr', // Supabase actually uses SSR with Next.js
  urls: [
    'https://supabase.com/pricing'
  ],
  extractionHints: {
    keywords: ['Free', 'Pro', 'Team', 'Enterprise', 'database', 'storage', 'bandwidth', 'edge functions', 'vector', 'auth']
  }
};

export const RENDER_CONFIG: ProviderConfig = {
  id: 'render',
  name: 'Render',
  category: 'hosting',
  renderingMode: 'ssr', // Render actually uses SSR
  urls: [
    'https://render.com/pricing'
  ],
  extractionHints: {
    keywords: ['Individual', 'Team', 'Organization', 'Enterprise', 'web services', 'databases', 'redis', 'bandwidth']
  }
};

export const FLY_CONFIG: ProviderConfig = {
  id: 'fly',
  name: 'Fly.io',
  category: 'hosting',
  renderingMode: 'auto', // Fly.io docs are SSR, but let's use auto to test browser fallback
  urls: [
    'https://fly.io/docs/about/pricing/'
  ],
  extractionHints: {
    keywords: ['Hobby', 'Launch', 'Scale', 'Enterprise', 'machines', 'volumes', 'bandwidth', 'anycast']
  }
};

export const PROVIDERS: ProviderConfig[] = [
  VERCEL_CONFIG,
  NETLIFY_CONFIG,
  SUPABASE_CONFIG,
  RENDER_CONFIG,
  FLY_CONFIG
];

export const PROVIDER_MAP = new Map(
  PROVIDERS.map(p => [p.id, p])
);