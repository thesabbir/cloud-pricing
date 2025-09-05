import { ProviderConfig, PageData, ScrapingResult } from '../types';
import { Env } from '../types/env';
import { PROVIDER_MAP } from '../providers/configs';
import type { BrowserWorker } from '@cloudflare/playwright';
// import { ContainerScraper } from './container-scraper';

export class UniversalScraper {
  // private containerScraper: ContainerScraper;
  
  constructor(private env: Env) {
    // this.containerScraper = new ContainerScraper(env as any);
  }

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
    console.log(`[Scraper] Rendering mode: ${config.renderingMode || 'auto'}`)

    // Try fetch first for SSR sites or auto mode
    if (config.renderingMode === 'ssr' || config.renderingMode === 'auto') {
      console.log(`[Scraper] Attempting SSR fetch for ${providerId}`);
      const fetchedPages = await this.tryFetchPages(config);
      
      // If SSR fetch succeeded and got content, use it
      if (fetchedPages.length > 0 && fetchedPages.every(p => p.text && p.text.length > 500)) {
        console.log(`[Scraper] SSR fetch successful for ${providerId}`);
        return {
          success: true,
          provider: providerId,
          pages: fetchedPages,
          duration: Date.now() - startTime
        };
      }
      
      // If SSR mode only, don't fall back to browser
      if (config.renderingMode === 'ssr') {
        console.log(`[Scraper] SSR fetch failed for ${providerId}, no browser fallback`);
        return {
          success: false,
          provider: providerId,
          pages: fetchedPages,
          error: 'SSR fetch returned insufficient content',
          duration: Date.now() - startTime
        };
      }
      
      console.log(`[Scraper] SSR fetch insufficient, falling back to browser for ${providerId}`);
    }

    // Use container scraper for CSR sites if available
    // if (this.containerScraper.isAvailable()) {
    //   console.log(`[Scraper] Using container scraper for ${providerId}`);
    //   return await this.containerScraper.scrapeWithContainer(config);
    // }
    
    // Fallback to Cloudflare Browser if container not available
    console.log(`[Scraper] Container not available, falling back to Cloudflare Browser`);
    let browser;
    try {
      console.log(`[Scraper] Launching browser...`);
      const { launch } = await import('@cloudflare/playwright');
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

  private async tryFetchPages(config: ProviderConfig): Promise<PageData[]> {
    const results: PageData[] = [];
    
    for (const url of config.urls) {
      try {
        console.log(`[Scraper] Fetching ${url} via HTTP...`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        if (!response.ok) {
          console.log(`[Scraper] HTTP ${response.status} for ${url}`);
          continue;
        }
        
        const html = await response.text();
        
        // Extract text from HTML (simple extraction without DOM)
        // Remove script and style content
        let cleanHtml = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
        
        // Extract text from remaining HTML
        const text = cleanHtml
          .replace(/<[^>]+>/g, ' ') // Remove HTML tags
          .replace(/&[^;]+;/g, ' ') // Remove HTML entities
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
        
        console.log(`[Scraper] Fetched ${url} - Title: ${title}, Text: ${text.length} chars`);
        
        results.push({
          url,
          html,
          text,
          title,
          scrapedAt: new Date().toISOString()
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Scraper] Error fetching ${url}: ${errorMessage}`);
        
        results.push({
          url,
          html: '',
          text: '',
          title: 'Error',
          scrapedAt: new Date().toISOString(),
          error: errorMessage
        });
      }
    }
    
    return results;
  }
  
  private async scrapeAllPages(browser: any, config: ProviderConfig): Promise<PageData[]> {
    const results: PageData[] = [];
    const errors: Array<{ url: string; error: string }> = [];
    
    // Process pages with controlled concurrency to avoid browser issues
    const maxConcurrent = 3;
    const urls = [...config.urls];
    
    while (urls.length > 0) {
      const batch = urls.splice(0, maxConcurrent);
      const batchPromises = batch.map(async (url) => {
        try {
          return await this.scrapePage(browser, url, config);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Scraper] Failed to scrape ${url}: ${errorMessage}`);
          errors.push({ url, error: errorMessage });
          
          // Return a partial result with error info
          return {
            url,
            html: '',
            text: '',
            screenshot: '',
            title: 'Error loading page',
            scrapedAt: new Date().toISOString(),
            error: errorMessage
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    if (errors.length > 0) {
      console.warn(`[Scraper] ${errors.length} pages failed to scrape:`, errors);
    }
    
    return results;
  }

  private async scrapePage(browser: any, url: string, config: ProviderConfig): Promise<PageData> {
    console.log(`[Scraper] Scraping page: ${url}`);
    let page: any = null;
    
    try {
      page = await browser.newPage();
      
      // Set Googlebot user agent and viewport to appear as legitimate crawler
      await page.setUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set additional headers to appear more legitimate
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });
      
      console.log(`[Scraper] Navigating to ${url} with Googlebot user agent...`);
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
      
      // Debug: Log HTML length
      console.log(`[Scraper] HTML length for ${url}: ${html.length} chars`);
      
      // Extract text content using improved method
      let text = '';
      
      try {
        // Use page evaluation to get clean text with better extraction
        text = await page.evaluate(() => {
          // Remove unwanted elements
          const unwantedSelectors = [
            'script', 'style', 'noscript', 'iframe', 
            'nav', 'header > nav', 'footer',
            '.cookie-banner', '#cookie-banner',
            '.popup', '.modal', '.overlay'
          ];
          
          // Clone document to avoid modifying original
          const docClone = document.cloneNode(true) as Document;
          
          // Remove unwanted elements
          unwantedSelectors.forEach(selector => {
            docClone.querySelectorAll(selector).forEach(el => el.remove());
          });
          
          // Try to find main content areas
          const contentSelectors = [
            'main', 'article', '[role="main"]',
            '.content', '#content', '.main-content',
            '.pricing', '[class*="pricing"]', '[id*="pricing"]'
          ];
          
          let mainContent = '';
          for (const selector of contentSelectors) {
            const element = docClone.querySelector(selector);
            if (element && element.textContent) {
              mainContent = element.textContent;
              if (mainContent.length > 500) break; // Found substantial content
            }
          }
          
          // If no main content found, get body text
          if (!mainContent || mainContent.length < 500) {
            mainContent = docClone.body?.innerText || docClone.body?.textContent || '';
          }
          
          // Clean up whitespace
          return mainContent.replace(/\s+/g, ' ').trim();
        });
        
        console.log(`[Scraper] Extracted ${text.length} chars of clean text`);
        
        // If still too short, try getting all text
        if (text.length < 500) {
          const allText = await page.evaluate(() => {
            return document.body?.innerText || document.body?.textContent || '';
          });
          if (allText.length > text.length) {
            text = allText;
            console.log(`[Scraper] Using full body text: ${text.length} chars`);
          }
        }
      } catch (error) {
        console.error(`[Scraper] Error with text extraction:`, error);
        // Final fallback
        text = await page.evaluate(() => document.body?.innerText || '');
      }
      
      // Debug: Log extracted text
      console.log(`[Scraper] Final text length for ${url}: ${text.length} chars`);
      if (text.length < 100) {
        console.log(`[Scraper] Warning: Very short text content: "${text.substring(0, 100)}"`);
      }
      
      console.log(`[Scraper] Taking screenshot for ${url}...`);
      // Take screenshot
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      // Convert screenshot to base64 (use btoa for Cloudflare Workers compatibility)
      const screenshotBase64 = btoa(String.fromCharCode(...new Uint8Array(screenshot)));
      
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
      if (page) {
        try {
          await page.close();
          console.log(`[Scraper] Page closed for ${url}`);
        } catch (closeError) {
          console.error(`[Scraper] Error closing page for ${url}:`, closeError);
        }
      }
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