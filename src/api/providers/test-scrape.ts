import { Hono } from 'hono';
import { Env } from '../../types/env';
import { UniversalScraper } from '../../scraping/universal-scraper';
import { PROVIDER_MAP } from '../../providers/configs';

const testRouter = new Hono<{ Bindings: Env }>();

// Simple test endpoint to debug scraping
testRouter.get('/:provider/test-scrape', async (c) => {
  const provider = c.req.param('provider');
  
  // Check if provider exists
  const config = PROVIDER_MAP.get(provider);
  if (!config) {
    return c.json({
      error: 'Provider not found',
      availableProviders: Array.from(PROVIDER_MAP.keys())
    }, 404);
  }
  
  try {
    console.log(`[Test] Starting test scrape for ${provider}`);
    
    const scraper = new UniversalScraper(c.env);
    const result = await scraper.scrapeProvider(provider);
    
    // Return detailed results for debugging
    return c.json({
      success: result.success,
      provider: result.provider,
      duration: result.duration,
      error: result.error,
      pagesScraped: result.pages.length,
      pages: result.pages.map(page => ({
        url: page.url,
        title: page.title,
        textLength: page.text.length,
        htmlLength: page.html.length,
        hasScreenshot: !!page.screenshot,
        scrapedAt: page.scrapedAt,
        // Include first 500 chars of text for debugging
        textPreview: page.text.substring(0, 500)
      }))
    });
  } catch (error) {
    console.error('[Test] Error in test-scrape:', error);
    
    return c.json({
      error: 'Failed to scrape',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      provider,
      availableProviders: Array.from(PROVIDER_MAP.keys())
    }, 500);
  }
});

// Simple browser test endpoint
testRouter.get('/test-browser', async (c) => {
  try {
    console.log('[Test] Testing browser launch...');
    
    // Import directly for testing
    const { launch } = await import('@cloudflare/playwright');
    
    const browser = await launch(c.env.CLOUD_PRICING_BROWSER);
    console.log('[Test] Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('[Test] Page created successfully');
    
    await page.goto('https://example.com');
    console.log('[Test] Navigation successful');
    
    const title = await page.title();
    const content = await page.content();
    
    await page.close();
    await browser.close();
    
    return c.json({
      success: true,
      message: 'Browser test successful',
      title,
      contentLength: content.length
    });
  } catch (error) {
    console.error('[Test] Browser test failed:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

export default testRouter;