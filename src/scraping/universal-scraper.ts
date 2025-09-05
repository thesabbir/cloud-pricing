import { launch } from '@cloudflare/playwright';
import { ProviderConfig, PageData, ScrapingResult } from '../types';
import { Env } from '../types/env';
import { PROVIDER_MAP } from '../providers/configs';

export class UniversalScraper {
  constructor(private env: Env) {}

  async scrapeProvider(providerId: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    const config = PROVIDER_MAP.get(providerId);
    
    if (!config) {
      return {
        success: false,
        provider: providerId,
        pages: [],
        error: `Provider ${providerId} not found`,
        duration: Date.now() - startTime
      };
    }

    const browser = await launch(this.env.BROWSER);
    
    try {
      const pages = await this.scrapeAllPages(browser, config);
      
      return {
        success: true,
        provider: providerId,
        pages,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        provider: providerId,
        pages: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    } finally {
      await browser.close();
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
    const page = await browser.newPage();
    
    try {
      // Set viewport for consistent screenshots
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Navigate to the page with timeout
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      // Wait for content to load
      await this.waitForContent(page, config);
      
      // Extract data
      const title = await page.title();
      const html = await page.content();
      const text = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(el => el.remove());
        
        // Get text content
        return document.body?.innerText || '';
      });
      
      // Take screenshot
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      return {
        url,
        html,
        text,
        screenshot: screenshot.toString('base64'),
        title,
        scrapedAt: new Date().toISOString()
      };
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
      await page.waitForTimeout(2000);
    }
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    // Wait a bit for dynamic content
    await page.waitForTimeout(1000);
    
    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
  }
}