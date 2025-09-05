import { ProviderConfig } from '../types';

export const VERCEL_CONFIG: ProviderConfig = {
  id: 'vercel',
  name: 'Vercel',
  category: 'hosting',
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
  urls: [
    'https://www.netlify.com/pricing/',
    'https://docs.netlify.com/manage/accounts-and-billing/billing-faq/',
    'https://www.netlify.com/pricing/faq/'
  ],
  extractionHints: {
    keywords: ['Free', 'Pro', 'Enterprise', 'bandwidth', 'build minutes', 'functions', 'edge functions']
  }
};

export const PROVIDERS: ProviderConfig[] = [
  VERCEL_CONFIG,
  NETLIFY_CONFIG
];

export const PROVIDER_MAP = new Map(
  PROVIDERS.map(p => [p.id, p])
);