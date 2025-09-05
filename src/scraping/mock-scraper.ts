import { PageData, ScrapingResult } from '../types';

/**
 * Mock scraper for local development when Browser Rendering is not available
 */
export class MockScraper {
  async scrapeProvider(providerId: string): Promise<ScrapingResult> {
    console.log(`[MockScraper] Simulating scrape for provider: ${providerId}`);
    
    // Return mock data for development
    const mockPages: PageData[] = [
      {
        url: 'https://vercel.com/pricing',
        html: '<html><body><h1>Vercel Pricing</h1><div>Mock pricing data for development</div></body></html>',
        text: 'Vercel Pricing\n\nMock pricing data for development\n\nHobby: $0/month\nPro: $20/month\nEnterprise: Custom',
        screenshot: '',
        title: 'Vercel Pricing - Mock Data',
        scrapedAt: new Date().toISOString()
      }
    ];
    
    return {
      success: true,
      provider: providerId,
      pages: mockPages,
      duration: 100
    };
  }
}