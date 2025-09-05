import { z } from "zod";

// Flexible schemas for the Cloud Pricing API

// Info endpoint schemas
export const infoResponseSchema = z.object({
  supportedProviders: z.array(z.string()),
});

// Provider schemas
export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["hosting", "api", "cloud", "database", "auth"]),
  available: z.boolean(),
});

export const providersListResponseSchema = z.object({
  providers: z.array(providerSchema),
});

// Provider params
export const providerParamsSchema = z.object({
  provider: z.string(),
});

// Refresh body schema
export const refreshBodySchema = z.object({
  force: z.boolean().optional().default(false),
  wait: z.boolean().optional().default(false),
});

// Flexible pricing data response - using z.any() for flexible data
export const pricingDataResponseSchema = z.object({
  provider: z.string(),
  scrapedAt: z.string(),
  sources: z.array(
    z.object({
      url: z.string(),
      type: z.enum(["pricing", "limits", "fair-use", "docs"]),
      scrapedAt: z.string(),
    })
  ),
  // Flexible data field - can contain any structure
  data: z.any(),
  metadata: z.object({
    confidence: z.number(),
    extractionModel: z.string(),
    processingTime: z.number(),
    schemaVersion: z.string(),
  }),
});

// Refresh response schemas
export const refreshAcceptedResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(["accepted", "already_running"]),
  message: z.string(),
});

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});