# Cloud Pricing API

A Cloudflare Workers-based API that aggregates cloud provider pricing data using LLM-powered extraction and browser rendering.

## Features

- 🤖 **LLM-Powered Extraction**: Uses GPT-4 to intelligently extract pricing data from any provider website
- 🌐 **Browser Rendering**: Scrapes dynamic content using Cloudflare Browser Rendering
- 📊 **Flexible Schema**: Each provider stores data in its natural format - no rigid schemas
- 📅 **Date-Based Versioning**: Stripe-style API versioning (e.g., `2024-11-20`)
- 🔄 **Automatic Updates**: Scheduled scraping keeps pricing data current
- 📝 **OpenAPI Documentation**: Self-documenting API with Scalar UI

## Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account with Workers Paid plan (for Browser Rendering)
- OpenAI API key (for LLM extraction)

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Generate TypeScript types:
```bash
pnpm run cf-typegen
```

3. Configure environment variables in `wrangler.jsonc` or create `.dev.vars`:
```env
OPENAI_API_KEY=your-key-here
```

## Development

### Local Development with Mock Data

For local development without Browser Rendering:
```bash
pnpm run dev
```

This uses a mock scraper that returns sample data for testing.

### Remote Development with Real Browser Rendering

To use actual Browser Rendering (requires Cloudflare account):
```bash
pnpm run dev:remote
```

**Important**: Browser Rendering doesn't work in pure local mode. You must use `--remote` flag to connect to Cloudflare's infrastructure.

## API Endpoints

### Core Endpoints

- `GET /api/info` - API information
- `GET /api/providers` - List all providers
- `GET /api/providers/:name` - Get provider pricing data
- `POST /api/providers/:name/refresh` - Trigger fresh scraping

### Testing Endpoints (Development Only)

- `GET /api/test/test-browser` - Test browser launch
- `GET /api/test/:provider/test-scrape` - Test provider scraping with detailed logs

### Documentation

- `GET /api/docs` - Interactive API documentation (Scalar UI)
- `GET /api/openapi.json` - OpenAPI specification

## Project Structure

```
src/
├── index.tsx              # Main app entry
├── api/
│   ├── router.ts          # API router with CORS
│   ├── info/              # Info endpoints
│   ├── providers/         # Provider endpoints
│   └── schemas.ts         # Zod schemas
├── scraping/
│   ├── universal-scraper.ts  # Browser rendering scraper
│   └── mock-scraper.ts       # Mock scraper for local dev
├── extraction/
│   └── llm-extractor.ts   # GPT-4 extraction
├── storage/
│   ├── kv.ts              # KV store for pricing data
│   └── r2.ts              # R2 for archives
├── validation/
│   └── pipeline.ts        # Multi-layer validation
└── types/                 # TypeScript types
```

## Adding New Providers

1. Add provider configuration in `src/providers/configs.ts`:
```typescript
PROVIDER_MAP.set('new-provider', {
  id: 'new-provider',
  name: 'New Provider',
  category: 'compute',
  urls: [
    'https://newprovider.com/pricing',
    'https://newprovider.com/limits'
  ]
});
```

2. The system automatically handles:
   - Multi-page scraping
   - LLM extraction
   - Data validation
   - Storage in KV/R2

No schema changes or deployments required!

## Deployment

```bash
pnpm run deploy
```

## Architecture

- **Runtime**: Cloudflare Workers with nodejs_compat_v2
- **Scraping**: Cloudflare Browser Rendering (Playwright)
- **AI**: OpenAI GPT-4 via Cloudflare AI Gateway
- **Storage**: 
  - KV Store for current pricing data
  - R2 for archives and screenshots
- **Validation**: Multi-layer pipeline with confidence scoring

## Troubleshooting

### Browser Rendering Not Working

- Ensure you're on a Workers Paid plan
- Use `pnpm run dev:remote` instead of `pnpm run dev`
- Check browser binding in `wrangler.jsonc`

### Mock Data in Development

The system automatically uses mock data when:
- Running with `pnpm run dev` (local mode)
- Browser binding is not available
- `ENVIRONMENT` is set to `development`

## License

MIT