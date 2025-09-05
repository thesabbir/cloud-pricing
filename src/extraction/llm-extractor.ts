import OpenAI from 'openai';
import { PageData, ExtractionResult } from '../types';
import { PROVIDER_MAP } from '../providers/configs';
import { Env } from '../types/env';

export class LLMExtractor {
  private openai: OpenAI;

  constructor(env: Env) {
    // When using AI Gateway with stored keys, we don't need to pass an API key
    const useGateway = env.USE_AI_GATEWAY === 'true';
    
    if (useGateway && env.AI_GATEWAY_URL) {
      // Using Cloudflare AI Gateway with stored keys
      this.openai = new OpenAI({
        apiKey: 'gateway-managed', // Dummy key since the gateway has the real key
        baseURL: env.AI_GATEWAY_URL,
        defaultHeaders: {
          // AI Gateway manages the actual OpenAI API key
        }
      });
    } else if (env.OPENAI_API_KEY) {
      // Direct OpenAI API usage
      this.openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY
      });
    } else {
      throw new Error('No OpenAI configuration found. Set either AI_GATEWAY_URL or OPENAI_API_KEY');
    }
  }

  async extract(providerId: string, pages: PageData[]): Promise<ExtractionResult> {
    const config = PROVIDER_MAP.get(providerId);
    if (!config) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const prompt = this.buildExtractionPrompt(config.name, pages);
    
    const startTime = Date.now();
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('Empty response from LLM');
    }

    const extractedData = JSON.parse(response);
    const tokensUsed = completion.usage?.total_tokens || 0;

    // Calculate confidence based on completeness
    const confidence = this.calculateConfidence(extractedData, pages);

    return {
      data: extractedData,
      confidence,
      model: 'gpt-4-turbo',
      tokensUsed
    };
  }

  private getSystemPrompt(): string {
    return `You are an expert at extracting pricing information from websites.
Your task is to extract comprehensive pricing data from the provided content.

IMPORTANT INSTRUCTIONS:
1. Extract ALL pricing tiers, plans, and options
2. Include ALL limits, quotas, and restrictions
3. Capture overage pricing and additional costs
4. Note fair use policies and hidden limitations
5. Preserve the natural structure of the provider's pricing model
6. Include both included and paid features
7. Extract pricing for all services/products offered

Return the data in the most natural JSON structure for this provider.
Do NOT force the data into a predetermined schema.
Organize it in a way that makes sense for this specific provider's business model.`;
  }

  private buildExtractionPrompt(providerName: string, pages: PageData[]): string {
    const pageDescriptions = pages.map((page, index) => {
      const url = new URL(page.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const pageType = this.inferPageType(url.pathname);
      
      return `Page ${index + 1} (${pageType}): ${page.url}`;
    }).join('\n');

    const combinedText = pages.map((page, index) => {
      return `
=== PAGE ${index + 1}: ${page.url} ===
Title: ${page.title}

${page.text}

=== END OF PAGE ${index + 1} ===`;
    }).join('\n\n');

    return `Extract comprehensive pricing information from ${providerName}.

You have ${pages.length} pages of content:
${pageDescriptions}

IMPORTANT: Correlate information across ALL pages to build a complete picture.
Pay special attention to:
- Main pricing tiers and their costs
- Resource limits and quotas
- Overage charges
- Fair use policies
- Hidden costs or restrictions
- Enterprise/custom pricing mentions
- Free tier limitations
- Features included vs paid add-ons

CONTENT TO ANALYZE:
${combinedText}

Extract and return a comprehensive JSON object with all pricing information.
Structure it naturally for ${providerName}'s specific pricing model.`;
  }

  private inferPageType(pathname: string): string {
    const path = pathname.toLowerCase();
    
    if (path.includes('pricing')) return 'Main Pricing';
    if (path.includes('limits')) return 'Limits & Quotas';
    if (path.includes('fair-use')) return 'Fair Use Policy';
    if (path.includes('enterprise')) return 'Enterprise';
    if (path.includes('faq')) return 'FAQ';
    if (path.includes('billing')) return 'Billing Info';
    if (path.includes('docs')) return 'Documentation';
    
    return 'Info Page';
  }

  private calculateConfidence(data: any, pages: PageData[]): number {
    let score = 0;
    let checks = 0;

    // Check for pricing information
    checks++;
    if (this.hasNestedProperty(data, ['price', 'cost', 'pricing', 'plans', 'tiers'])) {
      score += 1;
    }

    // Check for limits/quotas
    checks++;
    if (this.hasNestedProperty(data, ['limits', 'quotas', 'included', 'allowance'])) {
      score += 1;
    }

    // Check for features
    checks++;
    if (this.hasNestedProperty(data, ['features', 'capabilities', 'included'])) {
      score += 1;
    }

    // Check data completeness based on page count
    checks++;
    const dataSize = JSON.stringify(data).length;
    const expectedMinSize = pages.length * 500; // Expect at least 500 chars per page
    if (dataSize >= expectedMinSize) {
      score += 1;
    }

    // Check for multiple tiers/plans
    checks++;
    const tierCount = this.countPlansOrTiers(data);
    if (tierCount >= 2) {
      score += 1;
    }

    return score / checks;
  }

  private hasNestedProperty(obj: any, keywords: string[]): boolean {
    const objStr = JSON.stringify(obj).toLowerCase();
    return keywords.some(keyword => objStr.includes(keyword));
  }

  private countPlansOrTiers(data: any): number {
    // Try to count distinct pricing tiers
    if (Array.isArray(data.plans)) return data.plans.length;
    if (Array.isArray(data.tiers)) return data.tiers.length;
    if (Array.isArray(data.products)) return data.products.length;
    
    // Check for nested structures
    let count = 0;
    const checkObject = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        // Look for price-like properties
        if ('price' in obj || 'cost' in obj || 'monthly' in obj) {
          count++;
        }
        // Recurse
        Object.values(obj).forEach(value => {
          if (typeof value === 'object') checkObject(value);
        });
      }
    };
    
    checkObject(data);
    return Math.min(count, 10); // Cap at 10 to avoid over-counting
  }
}