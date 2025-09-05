import { Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { Env } from "../../types/env";
import { KVStore } from "../../storage/kv";
import { R2Storage } from "../../storage/r2";
import { UniversalScraper } from "../../scraping/universal-scraper";
import { LLMExtractor } from "../../extraction/llm-extractor";
import { ValidationPipeline } from "../../validation/pipeline";
import { PROVIDERS } from "../../providers/configs";
import { PricingData } from "../../types";
import {
  providersListResponseSchema,
  providerParamsSchema,
  pricingDataResponseSchema,
  refreshBodySchema,
  refreshAcceptedResponseSchema,
  errorResponseSchema,
} from "../schemas";

const providersRouter = new Hono<{ Bindings: Env }>();

// List all providers
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
    const kvStore = new KVStore(c.env);

    const providerList = await Promise.all(
      PROVIDERS.map(async (provider) => {
        const data = await kvStore.getCurrentPricing(provider.id);
        return {
          id: provider.id,
          name: provider.name,
          category: provider.category,
          available: !!data,
        };
      })
    );

    return c.json({ providers: providerList });
  }
);

// Get provider pricing data
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
        {
          error: "NOT_FOUND",
          message: `Provider ${provider} not found or no data available`,
        },
        404
      );
    }

    // Add API version header
    c.header("API-Version", "2024-11-20");
    c.header("API-Version-Latest", "2024-11-20");

    return c.json(data);
  }
);

// Trigger scraping for a provider
providersRouter.post(
  "/:provider/refresh",
  describeRoute({
    tags: ["Providers"],
    summary: "Refresh provider data",
    description: "Triggers fresh scraping of provider pricing data",
    responses: {
      200: {
        description: "Scraping completed (when wait=true)",
        content: {
          "application/json": {
            schema: resolver(pricingDataResponseSchema),
          },
        },
      },
      202: {
        description: "Scraping job accepted",
        content: {
          "application/json": {
            schema: resolver(refreshAcceptedResponseSchema),
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
      500: {
        description: "Scraping failed",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", providerParamsSchema),
  zValidator("json", refreshBodySchema),
  async (c) => {
    const { provider } = c.req.valid("param");
    const { force = false, wait = false } = c.req.valid("json");

    // Check if provider exists
    if (!PROVIDERS.find((p) => p.id === provider)) {
      return c.json(
        { error: "NOT_FOUND", message: `Provider ${provider} not found` },
        404
      );
    }

    const kvStore = new KVStore(c.env);
    const r2Storage = new R2Storage(c.env);

    // Check if already running
    const jobId = `job-${provider}-${Date.now()}`;
    const locked = await kvStore.setScrapingLock(provider, jobId);

    if (!locked) {
      return c.json(
        {
          jobId: "",
          status: "already_running" as const,
          message: "Scraping already in progress for this provider",
        },
        202
      );
    }

    // Check if recent data exists (unless forced)
    if (!force) {
      const existing = await kvStore.getCurrentPricing(provider);
      if (existing) {
        const age = Date.now() - new Date(existing.scrapedAt).getTime();
        const oneHour = 60 * 60 * 1000;

        if (age < oneHour) {
          await kvStore.releaseScrapingLock(provider);
          return c.json(
            {
              jobId,
              status: "accepted" as const,
              message: "Recent data exists, use force=true to refresh",
            },
            202
          );
        }
      }
    }

    if (!wait) {
      // Return immediately and process in background
      c.executionCtx.waitUntil(performScraping(provider, jobId, c.env));

      return c.json(
        {
          jobId,
          status: "accepted" as const,
          message: "Scraping job accepted, processing in background",
        },
        202
      );
    }

    // Wait for scraping to complete
    try {
      const result = await performScraping(provider, jobId, c.env);
      return c.json(result, 200);
    } catch (error) {
      console.error(`[Provider Route] Scraping failed for ${provider}:`, error);
      return c.json(
        {
          error: "SCRAPING_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          provider,
          jobId,
        },
        500
      );
    }
  }
);

// Helper function to perform scraping
async function performScraping(
  provider: string,
  jobId: string,
  env: Env
): Promise<PricingData> {
  const kvStore = new KVStore(env);
  const r2Storage = new R2Storage(env);

  try {
    // 1. Scrape pages
    const scraper = new UniversalScraper(env);
    const scrapingResult = await scraper.scrapeProvider(provider);

    if (!scrapingResult.success) {
      throw new Error(scrapingResult.error || "Scraping failed");
    }

    // 2. Save raw data to R2
    await r2Storage.saveScrapingResult(provider, scrapingResult);

    // 3. Extract with LLM
    const extractor = new LLMExtractor(env);
    const extractionResult = await extractor.extract(
      provider,
      scrapingResult.pages
    );

    // 4. Save extraction to R2
    await r2Storage.saveExtractionResult(provider, extractionResult.data, {
      confidence: extractionResult.confidence,
      model: extractionResult.model,
      tokensUsed: extractionResult.tokensUsed,
    });

    // 5. Validate
    const validator = new ValidationPipeline(env);
    const validationResult = await validator.validate(
      provider,
      extractionResult.data,
      extractionResult.confidence
    );

    // 6. Save validation report
    await r2Storage.saveValidationReport(provider, validationResult);

    if (!validationResult.valid) {
      await kvStore.setLastFailure(provider, validationResult);
      throw new Error(
        `Validation failed: ${validationResult.errors?.join(", ")}`
      );
    }

    // 7. Create PricingData object
    const pricingData: PricingData = {
      provider,
      scrapedAt: new Date().toISOString(),
      sources: scrapingResult.pages.map((page) => ({
        url: page.url,
        type: inferSourceType(page.url),
        scrapedAt: page.scrapedAt,
      })),
      data: extractionResult.data,
      metadata: {
        confidence: validationResult.confidence,
        extractionModel: extractionResult.model,
        processingTime: scrapingResult.duration,
        schemaVersion: "2024-11-20",
      },
    };

    // 8. Save to KV
    await kvStore.setCurrentPricing(provider, pricingData);

    return pricingData;
  } finally {
    // Always release lock
    await kvStore.releaseScrapingLock(provider);
  }
}

function inferSourceType(
  url: string
): "pricing" | "limits" | "fair-use" | "docs" {
  const path = url.toLowerCase();
  if (path.includes("pricing")) return "pricing";
  if (path.includes("limits")) return "limits";
  if (path.includes("fair-use")) return "fair-use";
  return "docs";
}

export default providersRouter;