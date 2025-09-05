# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies using pnpm
pnpm install

# Generate TypeScript types for Cloudflare bindings
pnpm run cf-typegen

# Start development server (port 9000)
pnpm run dev

# Build the application
pnpm run build

# Preview built application
pnpm run preview

# Deploy to Cloudflare Workers
pnpm run deploy

# Run tests (when implemented)
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Test a specific provider
pnpm test:provider vercel
```

## Architecture Overview

This is a **Cloud Pricing API** that aggregates pricing data from 30+ cloud providers using LLM-powered extraction. The system is built on Cloudflare Workers with a flexible, schema-less architecture.

### Core Design Principles

1. **Flexible Data Structures**: Each provider stores data in its natural format - no rigid schemas. Provider data is stored as flexible JSON in KV storage.

2. **LLM-Powered Extraction**: Uses GPT-4 for intelligent data extraction rather than hard-coded parsers. This allows the system to adapt to website changes automatically.

3. **Date-Based API Versioning**: Uses Stripe-style date versions (e.g., `2024-11-20`) to ensure API stability while allowing continuous evolution.

### Tech Stack

- **Runtime**: Cloudflare Workers with `nodejs_compat_v2` compatibility
- **Framework**: Hono with JSX support for server-side rendering
- **Build Tool**: Vite with Cloudflare plugin
- **Language**: TypeScript with strict mode enabled
- **Scraping**: Cloudflare Browser Rendering (Playwright)
- **AI**: OpenAI GPT-4 via Cloudflare AI Gateway
- **Storage**:
  - KV Store for pricing data (flexible JSON)
  - R2 for archives, screenshots, and HTML backups

### Project Structure

```
src/
├── index.tsx           # Main app entry with Hono routes
├── api/
│   ├── router.ts       # API router with CORS
│   └── info/          # Info endpoints
│
└── web/
    ├── router.ts      # Web router for UI
    └── renderer.tsx   # SSR renderer
```

### Key Architectural Components

1. **Universal Scraper**: Single scraper that works for all providers, handling multi-page navigation and dynamic content
2. **LLM Extraction Engine**: GPT-4 powered extraction that understands any pricing structure
3. **Validation Pipeline**: Multi-layer validation (core wrapper, provider-specific rules, semantic validation)
4. **API Gateway**: REST endpoints with OpenAPI specs and MCP server for LLM integration
5. **Storage System**: KV for primary data, R2 for archives

### Adding New Providers

To add a new provider, create provider-specific files in `src/api/providers/[name]/` following the existing pattern. No schema changes or deployments required - the system automatically adapts.

### API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/info` - API information
- `GET /api/providers/:name` - Get provider pricing data
- `POST /api/providers/:name/refresh` - Trigger fresh scraping (requires auth)
- `GET /api/search?q=query` - Search across all providers

### Environment Configuration

The project uses Cloudflare Workers with browser rendering capabilities. Key bindings:

- `CLOUD_PRICING_BROWSER` - Browser rendering binding for web scraping
- KV namespaces for data storage
- R2 buckets for archives

### TypeScript Configuration

- Target: ESNext
- Module: ESNext with Bundler resolution
- Strict mode enabled
- JSX with Hono runtime
- Vite client types included

### Git Commit

Do not add any co-authors to the commit.
Use conventional commit messages.
For example:
feat: add new provider
fix: fix bug
refactor: refactor code
test: add tests
docs: add documentation
chore: add dependencies
ci: add CI/CD
style: add styling
style: add styling
perf: add performance improvements
