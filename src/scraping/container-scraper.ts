import { ProviderConfig, PageData, ScrapingResult } from '../types';
import { Env } from '../types/env';

interface ContainerBinding {
  get(id: string): Promise<ContainerInstance>;
}

interface ContainerInstance {
  fetch(request: Request): Promise<Response>;
}

export class ContainerScraper {
  constructor(private env: Env & { ScraperContainer?: ContainerBinding }) {}

  async scrapeWithContainer(config: ProviderConfig): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    if (!this.env.ScraperContainer) {
      console.error('[ContainerScraper] Container binding not available');
      return {
        success: false,
        provider: config.id,
        pages: [],
        error: 'Container scraper not configured',
        duration: Date.now() - startTime
      };
    }

    try {
      console.log(`[ContainerScraper] Getting container instance for ${config.id}...`);
      
      // Get a container instance - using provider ID as instance ID for consistency
      const container = await this.env.ScraperContainer.get(config.id);
      
      console.log(`[ContainerScraper] Sending scrape request for ${config.urls.length} URLs...`);
      
      // Prepare the scraping request
      const scrapeRequest = new Request('http://container/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urls: config.urls,
          config: {
            waitForSelector: config.waitForSelector,
            waitTime: config.waitTime || 2000,
            scrollToBottom: config.scrollToBottom !== false
          }
        })
      });
      
      // Send request to container
      const response = await container.fetch(scrapeRequest);
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`[ContainerScraper] Container returned error: ${error}`);
        return {
          success: false,
          provider: config.id,
          pages: [],
          error: `Container error: ${error}`,
          duration: Date.now() - startTime
        };
      }
      
      const result = await response.json() as {
        success: boolean;
        pages: PageData[];
        error?: string;
      };
      
      if (!result.success) {
        console.error(`[ContainerScraper] Scraping failed: ${result.error}`);
        return {
          success: false,
          provider: config.id,
          pages: result.pages || [],
          error: result.error || 'Unknown container error',
          duration: Date.now() - startTime
        };
      }
      
      console.log(`[ContainerScraper] Successfully scraped ${result.pages.length} pages`);
      
      return {
        success: true,
        provider: config.id,
        pages: result.pages,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ContainerScraper] Error during container scraping:`, errorMessage);
      
      return {
        success: false,
        provider: config.id,
        pages: [],
        error: `Container scraping failed: ${errorMessage}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Check if container scraping is available
   */
  isAvailable(): boolean {
    return !!this.env.ScraperContainer;
  }

  /**
   * Health check for container service
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.env.ScraperContainer) {
      return { healthy: false, message: 'Container binding not available' };
    }

    try {
      // Get a temporary instance for health check
      const container = await this.env.ScraperContainer.get('health-check');
      
      const healthRequest = new Request('http://container/health', {
        method: 'GET'
      });
      
      const response = await container.fetch(healthRequest);
      
      if (response.ok) {
        const data = await response.json() as { status: string };
        return { healthy: data.status === 'healthy' };
      }
      
      return { healthy: false, message: `Health check returned ${response.status}` };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Health check failed' 
      };
    }
  }
}