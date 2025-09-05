# Chapter 2: Data Architecture

## 2.1 Data Philosophy

### Core Principle: Embrace Natural Structure
Each provider's pricing data is stored in its most natural form, not forced into a common schema. This ensures we never lose information trying to fit square pegs into round holes.

```typescript
// ❌ Wrong: Forcing structure
{ plans: [...], limits: [...], features: [...] }

// ✅ Right: Natural structure
// Vercel: tier-based
{ tiers: [...] }

// OpenAI: model-based
{ models: { "gpt-4": {...}, "dall-e": {...} } }

// AWS: service-based
{ services: { ec2: {...}, s3: {...} } }
```

## 2.2 Data Model

### Universal Wrapper
```typescript
interface PricingData {
  // Metadata (same for all)
  provider: string;
  scrapedAt: string;
  sources: Source[];
  
  // Flexible content
  data: any; // Provider-specific
  
  // Extraction metadata
  metadata: {
    confidence: number;
    extractionModel: string;
    processingTime: number;
    schemaVersion: string;
  };
}
```

### Provider Examples

#### SaaS Platform (Vercel)
```json
{
  "provider": "vercel",
  "data": {
    "tiers": [
      {
        "name": "Hobby",
        "price": 0,
        "limits": {
          "bandwidth": "100 GB",
          "buildMinutes": 6000,
          "serverlessFunctions": "12 per deployment"
        }
      },
      {
        "name": "Pro",
        "price": 20,
        "limits": {
          "bandwidth": "1 TB",
          "buildMinutes": 24000,
          "serverlessFunctions": "Unlimited"
        }
      }
    ]
  }
}
```

#### Usage-Based API (OpenAI)
```json
{
  "provider": "openai",
  "data": {
    "models": {
      "gpt-4-turbo": {
        "context": "128K",
        "pricing": {
          "input": "$0.01 per 1K tokens",
          "output": "$0.03 per 1K tokens"
        }
      },
      "gpt-3.5-turbo": {
        "context": "16K",
        "pricing": {
          "input": "$0.0005 per 1K tokens",
          "output": "$0.0015 per 1K tokens"
        }
      }
    },
    "rate_limits": {
      "tier1": { "rpm": 500, "tpm": 30000 },
      "tier2": { "rpm": 3500, "tpm": 60000 }
    }
  }
}
```

## 2.3 Multi-Page Scraping Architecture

### Provider Configuration
```typescript
interface ProviderConfig {
  id: string;
  name: string;
  urls: string[]; // All pages to scrape
  extractionHints?: {
    selectors?: string[];
    keywords?: string[];
  };
}

// Example: Comprehensive Vercel scraping
const VERCEL_CONFIG: ProviderConfig = {
  id: "vercel",
  name: "Vercel",
  urls: [
    "https://vercel.com/pricing",           // Main pricing
    "https://vercel.com/docs/limits",       // Technical limits
    "https://vercel.com/docs/fair-use",     // Hidden restrictions
    "https://vercel.com/enterprise"         // Enterprise options
  ]
};
```

### Scraping Pipeline
```
Provider Config
    ↓
Parallel Page Fetching
    ↓
[Page 1] [Page 2] [Page 3] [Page 4]
    ↓        ↓        ↓        ↓
Screenshots + HTML + Text
    ↓
Combined Context Document
    ↓
LLM Extraction (with all context)
    ↓
Unified Pricing Data
```

## 2.4 LLM Extraction Strategy

### Extraction Prompt Template
```typescript
const extractionPrompt = (provider: string, pages: PageData[]) => `
Extract comprehensive pricing information from ${provider}.

You have ${pages.length} pages of content:
${pages.map(p => `- ${p.url}: ${p.type}`).join('\n')}

IMPORTANT INSTRUCTIONS:
1. Correlate information across ALL pages
2. Include pricing, limits, features, and restrictions
3. Don't force into a standard structure
4. Organize naturally for this provider
5. Include ALL details, even if mentioned once

CONTENT:
${pages.map(p => p.content).join('\n\n---PAGE BREAK---\n\n')}

OUTPUT:
Return JSON in the most natural structure for ${provider}'s business model.
`;
```

### Confidence Scoring
```typescript
interface ExtractionConfidence {
  overall: number;      // 0-1 overall confidence
  completeness: {
    pricing: boolean;   // Found pricing info
    limits: boolean;    // Found limitations
    features: boolean;  // Found feature list
    terms: boolean;     // Found terms/conditions
  };
  sources: {
    url: string;
    dataFound: boolean;
    confidence: number;
  }[];
}
```

## 2.5 Validation Pipeline

### Multi-Layer Validation
```
Raw Extraction
      ↓
1. Core Validation (Required)
   - Has provider, data, metadata
      ↓
2. Rule Validation (Optional)
   - Provider-specific checks
      ↓
3. LLM Validation (Semantic)
   - Makes sense for provider?
      ↓
4. Statistical Validation
   - Dramatic changes from history?
      ↓
5. Decision Engine
   - Confidence > 75%: Accept
   - Confidence 50-75%: Review
   - Confidence < 50%: Reject
```

### Validation Implementation
```typescript
class ValidationPipeline {
  async validate(provider: string, data: any): Promise<ValidationResult> {
    const results = {
      core: await this.validateCore(data),
      rules: await this.validateRules(provider, data),
      semantic: await this.validateWithLLM(provider, data),
      statistical: await this.validateStatistically(provider, data)
    };
    
    const confidence = this.calculateConfidence(results);
    
    if (confidence < 0.5) {
      return this.usePreviousData(provider);
    }
    
    return { valid: true, data, confidence };
  }
}
```

## 2.6 Storage Architecture

### KV Storage Structure
```
Key Pattern                          | Value Type        | TTL
-------------------------------------|-------------------|--------
pricing:{provider}:current           | PricingData       | None
pricing:{provider}:{YYYY-MM-DD}     | PricingData       | 1 year
metadata:{provider}                  | ProviderMetadata  | None
validation:{provider}:last_failure   | ValidationResult  | 30 days
scraping:{provider}:lock            | JobID             | 5 min
```

### R2 Storage Structure
```
/providers/
  /{provider}/
    /{YYYY-MM-DD}/
      /screenshots/
        /page-1.png
        /page-2.png
      /html/
        /page-1.html
        /page-2.html
      /extraction/
        /raw-response.json
        /processed-data.json
      /validation/
        /report.json
```

### Data Lifecycle
```typescript
class DataLifecycle {
  async scrapeAndStore(provider: string): Promise<void> {
    // 1. Scrape all pages
    const pages = await this.scrapePages(provider);
    
    // 2. Store raw data in R2
    await this.storeRawData(provider, pages);
    
    // 3. Extract with LLM
    const extracted = await this.extractWithLLM(provider, pages);
    
    // 4. Validate
    const validated = await this.validate(provider, extracted);
    
    if (validated.valid) {
      // 5. Store current version
      await this.kv.put(
        `pricing:${provider}:current`,
        JSON.stringify(validated.data)
      );
      
      // 6. Archive dated version
      const date = new Date().toISOString().split('T')[0];
      await this.kv.put(
        `pricing:${provider}:${date}`,
        JSON.stringify(validated.data),
        { expirationTtl: 365 * 24 * 60 * 60 } // 1 year
      );
    }
  }
}
```

## 2.7 Data Consistency

### Handling Updates
```typescript
class UpdateHandler {
  async handlePriceChange(
    provider: string,
    oldData: any,
    newData: any
  ): Promise<void> {
    const change = this.calculateChange(oldData, newData);
    
    if (change.significance > 0.5) {
      // Major change - require confirmation
      await this.flagForReview({
        provider,
        change,
        oldData,
        newData
      });
    } else {
      // Minor change - auto-accept
      await this.acceptChange(provider, newData);
    }
  }
}
```

### Fallback Strategy
```typescript
class FallbackHandler {
  async getData(provider: string): Promise<any> {
    // Try current
    const current = await this.kv.get(`pricing:${provider}:current`);
    if (current) return JSON.parse(current);
    
    // Try yesterday
    const yesterday = await this.getYesterdayData(provider);
    if (yesterday) return yesterday;
    
    // Try last week
    const lastWeek = await this.getLastWeekData(provider);
    if (lastWeek) return lastWeek;
    
    // Use static fallback
    return this.getStaticFallback(provider);
  }
}
```

## 2.8 Provider Registry

### Dynamic Provider Management
```typescript
class ProviderRegistry {
  private providers = new Map<string, ProviderConfig>();
  
  async addProvider(config: ProviderConfig): Promise<void> {
    // No schema changes needed
    this.providers.set(config.id, config);
    
    // Store in KV
    await this.kv.put(
      `provider:${config.id}`,
      JSON.stringify(config)
    );
    
    // Update provider list
    const list = Array.from(this.providers.keys());
    await this.kv.put('provider:list', JSON.stringify(list));
  }
  
  async removeProvider(id: string): Promise<void> {
    this.providers.delete(id);
    // Keep historical data
  }
}
```

## 2.9 Data Quality Metrics

### Quality Scoring
```typescript
interface QualityMetrics {
  completeness: number;  // 0-1: How complete is the data?
  freshness: number;     // 0-1: How recent?
  confidence: number;    // 0-1: LLM confidence
  consistency: number;   // 0-1: Matches historical patterns?
  coverage: number;      // 0-1: All pages scraped successfully?
}

class QualityMonitor {
  calculateQuality(data: PricingData): QualityMetrics {
    return {
      completeness: this.checkCompleteness(data),
      freshness: this.checkFreshness(data.scrapedAt),
      confidence: data.metadata.confidence,
      consistency: this.checkConsistency(data),
      coverage: this.checkCoverage(data.sources)
    };
  }
}
```

## 2.10 Performance Optimization

### Caching Strategy
```typescript
class CacheManager {
  async get(provider: string): Promise<any> {
    // L1: Memory cache (Worker)
    if (this.memory.has(provider)) {
      return this.memory.get(provider);
    }
    
    // L2: KV cache (Edge)
    const cached = await this.kv.get(`pricing:${provider}:current`);
    if (cached) {
      this.memory.set(provider, cached);
      return cached;
    }
    
    // L3: Generate fresh
    return this.generateFresh(provider);
  }
}
```

### Parallel Processing
```typescript
class ParallelScraper {
  async scrapeAll(): Promise<void> {
    const providers = await this.getProviderList();
    
    // Batch by resource limits
    const batches = this.chunk(providers, 5); // 5 concurrent
    
    for (const batch of batches) {
      await Promise.all(
        batch.map(p => this.scrapeProvider(p))
      );
    }
  }
}
```

## 2.11 Data Migration

### Schema Evolution
```typescript
class SchemaMigration {
  async migrate(fromVersion: string, toVersion: string): Promise<void> {
    // No migrations needed for flexible schema!
    // Only update transformation logic
    
    console.log(`Updated transformers from ${fromVersion} to ${toVersion}`);
  }
}
```

## 2.12 Monitoring & Alerts

### Data Health Dashboard
```typescript
interface HealthMetrics {
  providers: {
    total: number;
    healthy: number;
    stale: number;
    failed: number;
  };
  lastScrape: {
    success: number;
    failed: number;
    duration: number;
  };
  storage: {
    kvUsage: number;
    r2Usage: number;
  };
}
```

## Key Takeaways

1. **No Rigid Schemas**: Each provider stores data naturally
2. **Multi-Page Aggregation**: Complete data from all sources
3. **LLM Intelligence**: Semantic understanding over rules
4. **Validation Layers**: Multiple checks ensure quality
5. **Graceful Fallbacks**: Always serve something useful

## Next Chapter

→ [Chapter 3: API Design](./03-api-design.md) - REST API, MCP protocol, versioning, and client SDKs.