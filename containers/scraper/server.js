const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Scraping endpoint
app.post('/scrape', async (req, res) => {
  const { urls, config = {} } = req.body;
  
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  let browser;
  try {
    console.log(`[Container] Launching browser for ${urls.length} URLs...`);
    
    // Launch Puppeteer with optimized settings for container environment
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Required for container environment
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--user-agent=Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      ],
      executablePath: '/usr/bin/google-chrome-stable'
    });

    const results = [];
    
    for (const url of urls) {
      try {
        console.log(`[Container] Scraping ${url}...`);
        const page = await browser.newPage();
        
        // Set viewport and headers
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        // Navigate with timeout
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // Wait for content based on config
        if (config.waitForSelector) {
          try {
            await page.waitForSelector(config.waitForSelector, { timeout: 5000 });
          } catch (e) {
            console.log(`[Container] Selector ${config.waitForSelector} not found, continuing...`);
          }
        }
        
        // Additional wait if specified
        if (config.waitTime) {
          await new Promise(resolve => setTimeout(resolve, config.waitTime));
        }
        
        // Extract page data
        const title = await page.title();
        const html = await page.content();
        
        // Extract text content
        const text = await page.evaluate(() => {
          // Remove unwanted elements
          const elementsToRemove = document.querySelectorAll('script, style, noscript, iframe');
          elementsToRemove.forEach(el => el.remove());
          
          // Get text from body
          const body = document.body;
          if (!body) return '';
          
          // Clean up whitespace
          return body.innerText
            .replace(/\s+/g, ' ')
            .trim();
        });
        
        // Take screenshot
        const screenshot = await page.screenshot({ 
          encoding: 'base64',
          fullPage: true,
          type: 'jpeg',
          quality: 80
        });
        
        await page.close();
        
        results.push({
          url,
          title,
          html,
          text,
          screenshot,
          scrapedAt: new Date().toISOString()
        });
        
        console.log(`[Container] Successfully scraped ${url}`);
      } catch (error) {
        console.error(`[Container] Error scraping ${url}:`, error.message);
        results.push({
          url,
          title: 'Error',
          html: '',
          text: '',
          screenshot: '',
          error: error.message,
          scrapedAt: new Date().toISOString()
        });
      }
    }
    
    await browser.close();
    
    res.json({
      success: true,
      pages: results,
      duration: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('[Container] Fatal error:', error);
    if (browser) await browser.close();
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[Container] Scraper service running on port ${PORT}`);
});