# Cloud Pricing API

A sophisticated LLM-powered API that aggregates and serves pricing data from 30+ cloud providers using intelligent web scraping and flexible data structures.

## 🚀 Features

- **Universal Provider Support**: Works with any cloud provider's pricing model
- **LLM-Powered Extraction**: Uses GPT-4 for intelligent data extraction
- **Flexible Data Structures**: No rigid schemas - each provider stores data naturally
- **Stable API**: Date-based versioning ensures clients never break
- **Dual Protocol**: REST API + MCP (Model Context Protocol) for LLM integration
- **Multi-Page Scraping**: Aggregates data from multiple pages per provider
- **Smart Validation**: Multi-layer validation ensures data quality

## 📚 Documentation

Complete architecture documentation is available in the [`architecture/`](./architecture/) directory:

- [System Overview](./architecture/01-system-overview.md) - High-level architecture and design principles
- [Data Architecture](./architecture/02-data-architecture.md) - Data flow, storage, and validation
- [API Design](./architecture/03-api-design.md) - REST API, MCP protocol, and versioning
- [Implementation Plan](./architecture/04-implementation-plan.md) - 5-week development roadmap

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono with OpenAPI
- **Scraping**: Cloudflare Browser Rendering (Playwright)
- **AI**: OpenAI GPT-4 via Cloudflare AI Gateway
- **Storage**: KV (data) + R2 (archives)
- **Validation**: Zod + Multi-layer validation pipeline

## 🚦 Quick Start

### Development Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Add your OpenAI API key and Cloudflare credentials

# Generate TypeScript types
pnpm run cf-typegen

# Run locally
pnpm run dev
```

### Deployment

```bash
# Deploy to Cloudflare Workers
pnpm run deploy
```

## 📖 API Usage

### REST API

```bash
# Get provider data
curl https://api.cloudpricing.dev/providers/vercel \
  -H "API-Version: 2024-11-20"

# Trigger fresh scraping
curl -X POST https://api.cloudpricing.dev/providers/vercel/refresh \
  -H "Authorization: Bearer YOUR_API_KEY"

# Search across providers
curl https://api.cloudpricing.dev/search?q=gpu+pricing
```

### TypeScript SDK

```typescript
import { CloudPricingClient } from '@cloud-pricing/sdk';

const client = new CloudPricingClient({
  apiKey: 'your-api-key',
  apiVersion: '2024-11-20' // Optional - uses latest by default
});

// Get provider data
const vercel = await client.getProvider('vercel');
console.log(vercel.pricing.raw); // Provider-specific structure

// Search across all providers
const results = await client.search('GPU pricing');
```

### MCP Integration

The API supports Model Context Protocol for direct LLM integration:

```javascript
// In Claude or other MCP-compatible LLMs
const pricing = await mcp.use('cloud-pricing', 'get_provider', {
  provider: 'openai'
});
```

## 🔧 Development

### Project Structure

```
cloud-pricing/
├── architecture/        # Complete architecture documentation
├── src/
│   ├── api/            # REST API routes and handlers
│   ├── scraping/       # Web scraping engine
│   ├── extraction/     # LLM-powered data extraction
│   ├── validation/     # Multi-layer validation pipeline
│   └── storage/        # KV and R2 storage management
├── wrangler.toml       # Cloudflare Workers configuration
└── package.json
```

### Adding a New Provider

1. Add provider configuration to the registry
2. Test scraping with `pnpm run test:provider [name]`
3. Deploy changes with `pnpm run deploy`

No schema changes required - the system automatically adapts to new providers!

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Test a specific provider
pnpm test:provider vercel
```

## 📊 Supported Providers

Currently supporting 30+ providers including:
- **Hosting**: Vercel, Netlify, Render, Railway
- **Cloud**: AWS, GCP, Azure, DigitalOcean
- **AI/ML**: OpenAI, Anthropic, Cohere, Replicate
- **Database**: MongoDB, Supabase, PlanetScale, Neon
- **And many more...**

## 🔒 Security

- Public pricing data only (no authentication scraping)
- Rate limiting and respectful scraping
- API key authentication for write operations
- No storage of credentials or PII

## 📝 License

MIT

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## 🔗 Links

- [API Documentation](https://api.cloudpricing.dev/docs)
- [OpenAPI Spec](https://api.cloudpricing.dev/openapi.json)
- [Architecture Docs](./architecture/)