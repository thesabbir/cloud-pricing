import { launch, type BrowserWorker } from '@cloudflare/playwright';
import { ProviderConfig, PageData, ScrapingResult } from '../types';
import { Env } from '../types/env';
import { PROVIDER_MAP } from '../providers/configs';

export class UniversalScraper {
  constructor(private env: Env) {}

  async scrapeProvider(providerId: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    const config = PROVIDER_MAP.get(providerId);
    
    console.log(`[Scraper] Starting scrape for provider: ${providerId}`);
    
    if (!config) {
      const error = `Provider ${providerId} not found in PROVIDER_MAP`;
      console.error(`[Scraper] ${error}`);
      return {
        success: false,
        provider: providerId,
        pages: [],
        error,
        duration: Date.now() - startTime
      };
    }

    console.log(`[Scraper] Found config for ${providerId}, URLs to scrape:`, config.urls);

    let browser;
    try {
      console.log(`[Scraper] Launching browser...`);
      browser = await launch(this.env.CLOUD_PRICING_BROWSER as BrowserWorker);
      console.log(`[Scraper] Browser launched successfully`);
      
      const pages = await this.scrapeAllPages(browser, config);
      
      console.log(`[Scraper] Successfully scraped ${pages.length} pages`);
      
      return {
        success: true,
        provider: providerId,
        pages,
        duration: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`[Scraper] Error during scraping:`, errorMessage);
      console.error(`[Scraper] Stack trace:`, errorStack);
      
      return {
        success: false,
        provider: providerId,
        pages: [],
        error: `${errorMessage}\n\nStack: ${errorStack}`,
        duration: Date.now() - startTime
      };
    } finally {
      if (browser) {
        console.log(`[Scraper] Closing browser...`);
        await browser.close();
      }
    }
  }

  private async scrapeAllPages(browser: any, config: ProviderConfig): Promise<PageData[]> {
    const scrapingPromises = config.urls.map(url => 
      this.scrapePage(browser, url, config)
    );
    
    // Scrape all pages in parallel
    return Promise.all(scrapingPromises);
  }

  private async scrapePage(browser: any, url: string, config: ProviderConfig): Promise<PageData> {
    console.log(`[Scraper] Scraping page: ${url}`);
    const page = await browser.newPage();
    
    try {
      console.log(`[Scraper] Navigating to ${url}...`);
      // Navigate to the page with timeout
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log(`[Scraper] Navigation complete for ${url}`);
      
      // Wait for content to load
      await this.waitForContent(page, config);
      
      // Extract data
      console.log(`[Scraper] Extracting data from ${url}...`);
      const title = await page.title();
      const html = await page.content();
      const text = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(el => el.remove());
        
        // Get text content
        return document.body?.innerText || '';
      });
      
      console.log(`[Scraper] Taking screenshot for ${url}...`);
      // Take screenshot
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      // Convert screenshot to base64
      const screenshotBase64 = Buffer.from(screenshot).toString('base64');
      
      console.log(`[Scraper] Successfully scraped ${url} - Title: ${title}, Text length: ${text.length}`);
      
      return {
        url,
        html,
        text,
        screenshot: screenshotBase64,
        title,
        scrapedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[Scraper] Error scraping ${url}:`, error);
      throw error;
    } finally {
      await page.close();
    }
  }

  private async waitForContent(page: any, config: ProviderConfig): Promise<void> {
    // Wait for common pricing elements
    const selectors = [
      '.pricing',
      '[class*="pricing"]',
      '[id*="pricing"]',
      'table',
      ...(config.extractionHints?.selectors || [])
    ];
    
    // Try to wait for at least one selector
    try {
      await page.waitForSelector(selectors.join(', '), {
        timeout: 5000
      });
    } catch {
      // Continue even if selectors not found
      // The content might be dynamically loaded
      // Use a promise-based delay instead of waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
  }
}