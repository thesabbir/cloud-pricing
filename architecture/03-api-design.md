# Chapter 3: API Design

## 3.1 API Philosophy

### Principles
1. **Stability**: APIs never break, only evolve
2. **Flexibility**: Support any provider without changes - using `z.any()` for data fields
3. **Discoverability**: Self-documenting with automatic OpenAPI generation from Zod schemas
4. **Dual Protocol**: REST for apps, MCP for LLMs
5. **Type Safety**: Runtime validation with Zod ensures data integrity

## 3.2 Date-Based Versioning

### Why Date Versioning?
```typescript
// ❌ Semantic Versioning Problems
"v1" -> "v2"  // When? What changed? Breaking?

// ✅ Date Versioning Benefits
"2024-01-15"  // Clear timeline
"2024-11-20"  // 10 months of evolution visible
```

### Implementation
```typescript
// Request with version
GET /providers/vercel
Headers: { "API-Version": "2024-01-15" }

// Response includes version
{
  "version": "2024-01-15",
  "provider": "vercel",
  "data": {...}
}
Headers: {
  "API-Version": "2024-01-15",
  "API-Version-Latest": "2024-11-20"
}
```

### Version Registry
```typescript
const VERSION_CHANGES = {
  "2024-01-15": "Initial release",
  "2024-03-01": "Added pricing.normalized field",
  "2024-06-15": "Added meta.capabilities",
  "2024-09-01": "Added _links.schema",
  "2024-11-20": "Current stable version"
};
```

## 3.3 REST API Design

### Base Configuration
```typescript
import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';

const app = new OpenAPIHono<{ Bindings: Env }>();

// Middleware
app.use('*', cors());
app.use('*', versionMiddleware());
app.use('*', rateLimiting());
```

### Core Endpoints with Zod Validation

#### Schema Definitions
```typescript
import { z } from "zod";

// Flexible pricing data schema - maintains schema-less design
export const pricingDataResponseSchema = z.object({
  provider: z.string(),
  scrapedAt: z.string(),
  sources: z.array(z.object({
    url: z.string(),
    type: z.enum(["pricing", "limits", "fair-use", "docs"]),
    scrapedAt: z.string(),
  })),
  data: z.any(), // Flexible data field for provider-specific structures
  metadata: z.object({
    confidence: z.number(),
    extractionModel: z.string(),
    processingTime: z.number(),
    schemaVersion: z.string(),
  }),
});
```

#### 1. List Providers
```typescript
import { describeRoute, resolver } from "hono-openapi";

providersRouter.get(
  "/",
  describeRoute({
    tags: ["Providers"],
    summary: "List all providers",
    description: "Returns a list of all available cloud providers",
    responses: {
      200: {
        description: "List of providers",
        content: {
          "application/json": {
            schema: resolver(providersListResponseSchema),
          },
        },
      },
    },
  }),
  async (c) => {
    // Implementation
  }
);
```

#### 2. Get Provider Data
```typescript
import { validator as zValidator } from "hono-openapi";

providersRouter.get(
  "/:provider",
  describeRoute({
    tags: ["Providers"],
    summary: "Get provider pricing data",
    description: "Returns pricing data for a specific cloud provider",
    responses: {
      200: {
        description: "Provider pricing data",
        content: {
          "application/json": {
            schema: resolver(pricingDataResponseSchema),
          },
        },
      },
      404: {
        description: "Provider not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", providerParamsSchema),
  async (c) => {
    const { provider } = c.req.valid("param");
    const kvStore = new KVStore(c.env);
    
    const data = await kvStore.getCurrentPricing(provider);
    if (!data) {
      return c.json(
        { error: "NOT_FOUND", message: `Provider ${provider} not found` },
        404
      );
    }
    
    // Add API version headers
    c.header("API-Version", "2024-11-20");
    c.header("API-Version-Latest", "2024-11-20");
    
    return c.json(data);
  }
);
```

#### 3. Trigger Scraping
```typescript
providersRouter.post(
  "/:provider/refresh",
  describeRoute({
    tags: ["Providers"],
    summary: "Refresh provider data",
    description: "Triggers fresh scraping of provider pricing data",
  request: {
    params: z.object({
      provider: z.string()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            force: z.boolean().default(false),
            wait: z.boolean().default(false)
          })
        }
      }
    }
  },
  responses: {
    202: {
      description: 'Scraping job accepted',
      content: {
        'application/json': {
          schema: z.object({
            jobId: z.string(),
            status: z.string(),
            estimatedTime: z.number()
          })
        }
      }
    }
  }
});
```

#### 4. Search Across Providers
```typescript
const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  request: {
    query: z.object({
      q: z.string(),
      category: z.string().optional(),
      maxPrice: z.number().optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            results: z.array(z.object({
              provider: z.string(),
              relevance: z.number(),
              snippet: z.any()
            }))
          })
        }
      }
    }
  }
});
```

### Response Structure
```typescript
interface StableAPIResponse<T = any> {
  // Always present (stable contract)
  version: string;
  provider: string;
  lastUpdated: string;
  
  // Flexible data with optional normalization
  pricing: {
    raw: T;                    // Always present
    normalized?: Normalized;   // Best effort
  };
  
  // Metadata
  meta: {
    confidence: number;
    sources: Source[];
    quality: QualityScore;
  };
  
  // HATEOAS links
  _links: {
    self: string;
    refresh: string;
    history: string;
    docs: string;
  };
}
```

## 3.4 MCP Server Implementation

### Server Setup
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const mcp = new McpServer({
  name: "cloud-pricing",
  version: "1.0.0",
  description: "Access cloud provider pricing data"
});
```

### MCP Tools

#### 1. Get Provider Data
```typescript
mcp.registerTool("get_provider", {
  title: "Get provider pricing",
  description: "Fetch pricing data for any cloud provider",
  inputSchema: z.object({
    provider: z.string().describe("Provider ID"),
    fields: z.array(z.string()).optional().describe("Specific fields to return")
  })
}, async ({ provider, fields }) => {
  const data = await kv.get(`pricing:${provider}:current`);
  
  if (!data) {
    return {
      content: [{
        type: "text",
        text: `Provider ${provider} not found. Available: ${await getProviderList()}`
      }]
    };
  }
  
  const parsed = JSON.parse(data);
  const result = fields ? pick(parsed, fields) : parsed;
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify(result, null, 2)
    }]
  };
});
```

#### 2. Compare Providers
```typescript
mcp.registerTool("compare", {
  title: "Compare providers",
  description: "Compare pricing across multiple providers",
  inputSchema: z.object({
    providers: z.array(z.string()),
    aspect: z.string().describe("What to compare")
  })
}, async ({ providers, aspect }) => {
  const data = await Promise.all(
    providers.map(p => kv.get(`pricing:${p}:current`))
  );
  
  // Let LLM analyze the comparison
  return {
    content: [{
      type: "text",
      text: `Comparing ${aspect} across ${providers.join(', ')}:\n${
        data.map((d, i) => `${providers[i]}: ${d}`).join('\n\n')
      }`
    }]
  };
});
```

#### 3. Search Features
```typescript
mcp.registerTool("search", {
  title: "Search pricing features",
  description: "Search for specific features or pricing across all providers",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    budget: z.number().optional(),
    requirements: z.array(z.string()).optional()
  })
}, async ({ query, budget, requirements }) => {
  const allProviders = await getAllProviderData();
  
  // LLM will filter based on query
  return {
    content: [{
      type: "text",
      text: `Search: ${query}\nBudget: ${budget || 'any'}\nRequirements: ${requirements?.join(', ') || 'none'}\n\nData:\n${JSON.stringify(allProviders, null, 2)}`
    }]
  };
});
```

### MCP Resources
```typescript
mcp.registerResource(
  "providers-list",
  "providers://list",
  { title: "List of all providers" },
  async () => ({
    contents: [{
      uri: "providers://list",
      mimeType: "application/json",
      text: JSON.stringify(await getProviderList())
    }]
  })
);

mcp.registerResource(
  "pricing-history",
  "pricing://history/{provider}/{date}",
  { title: "Historical pricing data" },
  async (uri, { provider, date }) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: await kv.get(`pricing:${provider}:${date}`)
    }]
  })
);
```

## 3.5 OpenAPI Documentation

### Auto-Generated Docs
```typescript
// OpenAPI spec endpoint
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Cloud Pricing API',
    version: LATEST_VERSION,
    description: 'Unified API for cloud provider pricing'
  },
  servers: [
    { url: 'https://api.cloudpricing.dev' }
  ],
  security: [
    { apiKey: [] }
  ]
});

// Scalar UI
app.get('/docs', apiReference({
  spec: { url: '/openapi.json' },
  theme: 'purple',
  layout: 'modern'
}));
```

### API Documentation with hono-openapi

The API documentation is automatically generated from Zod schemas and route descriptions:

```typescript
// Automatic OpenAPI generation
import { openAPIRouteHandler } from "hono-openapi";

apiRouter.get(
  "/openapi.json",
  openAPIRouteHandler(apiRouter, {
    documentation: {
      info: {
        title: "Cloud Pricing API",
        version: "1.0.0",
        description: "API for aggregating cloud provider pricing data",
      },
      servers: [
        { url: "/api", description: "API Server" },
      ],
      tags: [
        { name: "Info", description: "API information endpoints" },
        { name: "Providers", description: "Cloud provider pricing endpoints" },
      ],
    },
  })
);

// Scalar UI for interactive documentation
apiRouter.get(
  "/docs",
  Scalar({
    spec: { url: "/api/openapi.json" },
    theme: "purple",
    layout: "modern",
  })
);
            example: "2024-11-20"
            
components:
  schemas:
    PricingData:
      type: object
      properties:
        provider: { type: string }
        data: { type: object }
```

## 3.6 Client SDKs

### TypeScript SDK
```typescript
// @cloud-pricing/sdk
export class CloudPricingClient {
  constructor(
    private config: {
      apiKey?: string;
      apiVersion?: string;  // Date version
      baseUrl?: string;
    }
  ) {}
  
  async getProvider<T = any>(id: string): Promise<PricingResponse<T>> {
    const response = await fetch(`${this.baseUrl}/providers/${id}`, {
      headers: {
        'API-Version': this.config.apiVersion || 'latest',
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });
    
    return response.json();
  }
  
  // Type-safe provider methods
  async getVercel(): Promise<PricingResponse<VercelData>> {
    return this.getProvider<VercelData>('vercel');
  }
  
  async getOpenAI(): Promise<PricingResponse<OpenAIData>> {
    return this.getProvider<OpenAIData>('openai');
  }
}
```

### Python SDK
```python
# cloud_pricing/__init__.py
class CloudPricingClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_version: str = "latest",
        base_url: str = "https://api.cloudpricing.dev"
    ):
        self.api_key = api_key
        self.api_version = api_version
        self.base_url = base_url
    
    def get_provider(self, provider: str) -> dict:
        response = requests.get(
            f"{self.base_url}/providers/{provider}",
            headers={
                "API-Version": self.api_version,
                "Authorization": f"Bearer {self.api_key}"
            }
        )
        return response.json()
    
    def search(self, query: str, **filters) -> list:
        params = {"q": query, **filters}
        response = requests.get(
            f"{self.base_url}/search",
            params=params,
            headers=self._headers()
        )
        return response.json()
```

## 3.7 Authentication & Security

### API Key Management
```typescript
const authMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    // Public endpoints allowed without key
    if (c.req.method === 'GET') {
      return next();
    }
    return c.json({ error: 'API key required' }, 401);
  }
  
  // Validate API key
  const valid = await validateApiKey(apiKey);
  if (!valid) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  
  // Add user context
  c.set('user', await getUserFromKey(apiKey));
  return next();
};
```

### Rate Limiting
```typescript
const rateLimiter = {
  public: {
    requests: 100,
    window: '1h'
  },
  authenticated: {
    requests: 1000,
    window: '1h'
  },
  scraping: {
    requests: 10,
    window: '1h'
  }
};
```

## 3.8 Error Handling

### Standard Error Responses
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  _links: {
    docs: string;
    support: string;
  };
}

// Error codes
const ERROR_CODES = {
  PROVIDER_NOT_FOUND: 'provider_not_found',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_VERSION: 'invalid_version',
  SCRAPING_IN_PROGRESS: 'scraping_in_progress',
  VALIDATION_FAILED: 'validation_failed'
};
```

### Error Middleware
```typescript
app.onError((err: Error, c: Context) => {
  console.error(err);
  
  if (err instanceof ProviderNotFoundError) {
    return c.json({
      error: {
        code: 'provider_not_found',
        message: err.message,
        details: { provider: err.provider }
      }
    }, 404);
  }
  
  // Default error
  return c.json({
    error: {
      code: 'internal_error',
      message: 'An error occurred'
    }
  }, 500);
});
```

## 3.9 Caching Strategy

### Multi-Layer Caching
```typescript
const cacheMiddleware = async (c: Context, next: Next) => {
  const key = c.req.url;
  
  // Check memory cache
  if (memoryCache.has(key)) {
    c.header('X-Cache', 'HIT-MEMORY');
    return c.json(memoryCache.get(key));
  }
  
  // Check KV cache
  const cached = await c.env.KV.get(`cache:${key}`);
  if (cached) {
    c.header('X-Cache', 'HIT-KV');
    const data = JSON.parse(cached);
    memoryCache.set(key, data);
    return c.json(data);
  }
  
  // Generate fresh
  c.header('X-Cache', 'MISS');
  await next();
  
  // Cache response
  const response = await c.res.json();
  memoryCache.set(key, response);
  await c.env.KV.put(`cache:${key}`, JSON.stringify(response), {
    expirationTtl: 3600 // 1 hour
  });
};
```

## 3.10 Monitoring & Analytics

### Request Tracking
```typescript
const analyticsMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  
  await next();
  
  const metrics = {
    path: c.req.path,
    method: c.req.method,
    status: c.res.status,
    duration: Date.now() - start,
    version: c.req.header('API-Version'),
    provider: c.req.param('provider'),
    cache: c.res.headers.get('X-Cache')
  };
  
  // Send to analytics
  c.executionCtx.waitUntil(
    sendAnalytics(metrics)
  );
};
```

## 3.11 Migration Support

### Backwards Compatibility
```typescript
class VersionTransformer {
  transform(version: string, data: any): any {
    // Always support old versions
    if (version <= "2024-01-15") {
      return this.transformToV1(data);
    }
    if (version <= "2024-06-15") {
      return this.transformToV2(data);
    }
    return data; // Latest format
  }
  
  private transformToV1(data: any): any {
    // Remove fields added after v1
    const { normalized, ...v1Data } = data.pricing;
    return { ...data, pricing: v1Data };
  }
}
```

## 3.12 Testing Strategy

### Contract Testing
```typescript
describe('API Contract', () => {
  test('Version stability', async () => {
    const versions = ['2024-01-15', '2024-06-15', '2024-11-20'];
    
    for (const version of versions) {
      const response = await api.get('/providers/vercel', {
        headers: { 'API-Version': version }
      });
      
      // Core fields must exist
      expect(response).toHaveProperty('provider');
      expect(response).toHaveProperty('pricing.raw');
      expect(response).toHaveProperty('meta');
    }
  });
});
```

## Key Takeaways

1. **Date Versioning**: Clear evolution timeline
2. **Dual Protocol**: REST + MCP for maximum reach
3. **Stable Contracts**: Never break clients
4. **Self-Documenting**: OpenAPI + Scalar UI
5. **Type Safety**: SDKs with TypeScript/Python

## Next Chapter

→ [Chapter 4: Implementation Plan](./04-implementation-plan.md) - Development roadmap, testing, and deployment.