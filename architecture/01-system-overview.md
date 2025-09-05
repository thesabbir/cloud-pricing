# Chapter 1: System Overview

## 1.1 Executive Summary

The Cloud Pricing API is a sophisticated data extraction and serving platform that aggregates pricing information from 30+ cloud service providers. Using LLM-powered extraction and flexible data structures, it provides a unified API for accessing diverse pricing models without requiring schema changes for new providers.

## 1.2 System Goals

### Primary Goals
1. **Universal Coverage**: Support any cloud provider's pricing model
2. **Data Accuracy**: Extract complete pricing information including hidden limits
3. **API Stability**: Never break client integrations
4. **Rapid Scaling**: Add new providers without code changes
5. **Real-time Updates**: Fresh data available on-demand

### Non-Goals
- Price optimization recommendations
- Billing management
- Usage tracking
- Cost predictions

## 1.3 Architecture Principles

### Flexibility Over Structure
```typescript
// ❌ Rigid: Forces all providers into same structure
interface Pricing {
  plans: Plan[];
  features: Feature[];
}

// ✅ Flexible: Each provider has natural structure
interface Pricing {
  data: any; // Provider-specific structure
}
```

### Intelligence Over Rules
- Use LLM to understand pricing rather than hard-coded parsers
- Semantic validation instead of strict schemas
- Adaptive extraction based on provider patterns

### Stability Through Versioning
- Date-based API versioning (2024-11-20 format)
- Immutable API contracts
- Graceful deprecation cycles

## 1.4 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     External Layer                       │
├───────────────────┬───────────────┬───────────────────┤
│   REST API        │   MCP Server  │   Client SDKs     │
│   /providers/:id  │  LLM Tools    │   TypeScript      │
│                   │               │   Python          │
└───────────────────┴───────────────┴───────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                         │
├───────────────────┬───────────────┬───────────────────┤
│  API Gateway      │  Validation   │  Transformation   │
│  (Hono + OpenAPI) │   Pipeline    │    Pipeline       │
└───────────────────┴───────────────┴───────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   Processing Layer                       │
├───────────────────┬───────────────┬───────────────────┤
│  Web Scraper      │ LLM Extractor │  Data Validator   │
│  (Playwright)     │  (GPT-4)      │  (Multi-layer)    │
└───────────────────┴───────────────┴───────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                    Storage Layer                         │
├───────────────────┬───────────────┬───────────────────┤
│    KV Store       │   R2 Storage  │   AI Gateway      │
│  (Pricing Data)   │  (Archives)   │   (OpenAI)        │
└───────────────────┴───────────────┴───────────────────┘
```

## 1.5 Component Overview

### Core Components

#### 1. Universal Scraper
- Single scraper works for all providers
- Navigates multiple pages per provider
- Captures screenshots and HTML
- Handles dynamic content

#### 2. LLM Extraction Engine
- GPT-4 powered data extraction
- Understands any pricing structure
- Correlates multi-page information
- Provides confidence scoring

#### 3. Validation Pipeline
- Core schema validation (wrapper only)
- Provider-specific rules (optional)
- LLM semantic validation
- Statistical anomaly detection

#### 4. API Gateway
- REST endpoints with OpenAPI specs
- MCP server for LLM integration
- Date-based versioning
- Response transformation

#### 5. Storage System
- KV: Primary data store (flexible JSON)
- R2: Screenshots, HTML, backups
- No rigid schemas required

## 1.6 Technology Stack

### Cloudflare Infrastructure
| Component | Purpose | Why Chosen |
|-----------|---------|------------|
| Workers | Serverless compute | Global edge deployment |
| Browser Rendering | Web scraping | Native Playwright support |
| KV Storage | Data store | Fast, flexible JSON storage |
| R2 Storage | Archives | Cost-effective blob storage |
| AI Gateway | LLM proxy | Rate limiting, caching |
| Cron Triggers | Scheduling | Reliable daily scraping |

### Application Stack
| Component | Purpose | Why Chosen |
|-----------|---------|------------|
| Hono | Web framework | Lightweight, CF optimized |
| @hono/zod-openapi | API docs | Auto-generated OpenAPI |
| Playwright | Browser automation | Best scraping support |
| Zod | Validation | Runtime type safety |
| @modelcontextprotocol/sdk | MCP server | LLM tool standard |

## 1.7 Data Flow

### Scraping Flow
```
1. Trigger (Manual/Cron)
    ↓
2. Load Provider Config (URLs)
    ↓
3. Scrape All Pages (Parallel)
    ↓
4. Capture Screenshots + HTML
    ↓
5. Store Raw Data (R2)
    ↓
6. LLM Extraction (GPT-4)
    ↓
7. Validation Pipeline
    ↓
8. Store in KV (If Valid)
    ↓
9. Update Cache
```

### API Request Flow
```
1. Client Request
    ↓
2. Version Detection (Header/Default)
    ↓
3. Fetch from KV
    ↓
4. Transform Response (Version-specific)
    ↓
5. Return Stable Structure
```

## 1.8 Key Design Decisions

### 1. Why Flexible Schemas?
- **Problem**: 30+ providers with different pricing models
- **Solution**: Store provider-specific structures as-is
- **Benefit**: No schema updates when adding providers

### 2. Why LLM Extraction?
- **Problem**: Complex, changing website structures
- **Solution**: Use GPT-4 to understand content semantically
- **Benefit**: Adapts to website changes automatically

### 3. Why Date-Based Versioning?
- **Problem**: Need stability without blocking evolution
- **Solution**: Stripe-style date versions (2024-11-20)
- **Benefit**: Continuous delivery with clear timeline

### 4. Why KV Over Database?
- **Problem**: Each provider has different structure
- **Solution**: Document store with JSON
- **Benefit**: No migrations, instant flexibility

## 1.9 System Constraints

### Technical Constraints
- Cloudflare Workers: 10ms CPU limit (per request)
- KV Storage: 25MB value size limit
- Browser Rendering: 2 browsers per account
- R2 Storage: 10TB limit per bucket

### Business Constraints
- Must never break existing client integrations
- New providers must work without deployment
- Data freshness within 24 hours
- 99.9% API availability target

## 1.10 Security Considerations

### Data Security
- No storage of credentials or PII
- Public pricing data only
- Encrypted data in transit (HTTPS)
- API key authentication for write operations

### Scraping Ethics
- Respect robots.txt
- Reasonable rate limiting
- No aggressive scraping
- Cache data to minimize requests

## 1.11 Scalability Strategy

### Horizontal Scaling
- Workers auto-scale globally
- Stateless architecture
- Edge caching via KV

### Provider Scaling
```typescript
// Adding 31st provider
PROVIDERS.push({
  id: "new-provider",
  name: "New Provider",
  urls: ["https://new-provider.com/pricing"]
});
// System automatically handles it
```

### Performance Targets
- API Response: < 100ms (cached)
- Scraping: < 30s per provider
- LLM Extraction: < 10s per provider
- Daily refresh: All providers < 30 min

## 1.12 Success Metrics

### Technical Metrics
- API uptime: > 99.9%
- Response time: P95 < 200ms
- Extraction accuracy: > 95%
- Provider coverage: 30+

### Business Metrics
- Time to add provider: < 1 hour
- Client integration time: < 1 day
- Data freshness: < 24 hours
- Zero breaking changes

## Next Chapter

→ [Chapter 2: Data Architecture](./02-data-architecture.md) - Deep dive into data flow, storage, and validation strategies.