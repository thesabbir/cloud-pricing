import { PageData, ScrapingResult } from '../types';
import { Env } from '../types/env';

export class R2Storage {
  constructor(private env: Env) {}

  async saveScrapingResult(provider: string, result: ScrapingResult): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();
    
    // Save HTML for each page
    for (let i = 0; i < result.pages.length; i++) {
      const page = result.pages[i];
      
      // Save HTML
      const htmlKey = `providers/${provider}/${date}/html/page-${i + 1}.html`;
      await this.env.ARCHIVE.put(htmlKey, page.html, {
        httpMetadata: {
          contentType: 'text/html',
        },
        customMetadata: {
          url: page.url,
          title: page.title,
          scrapedAt: page.scrapedAt,
        }
      });
      
      // Save screenshot if available
      if (page.screenshot) {
        const screenshotKey = `providers/${provider}/${date}/screenshots/page-${i + 1}.png`;
        const screenshotData = Buffer.from(page.screenshot, 'base64');
        await this.env.ARCHIVE.put(screenshotKey, screenshotData, {
          httpMetadata: {
            contentType: 'image/png',
          },
          customMetadata: {
            url: page.url,
            scrapedAt: page.scrapedAt,
          }
        });
      }
    }
    
    // Save complete scraping result
    const resultKey = `providers/${provider}/${date}/scraping-result.json`;
    await this.env.ARCHIVE.put(resultKey, JSON.stringify(result), {
      httpMetadata: {
        contentType: 'application/json',
      },
      customMetadata: {
        provider,
        timestamp,
        pageCount: String(result.pages.length),
      }
    });
  }

  async saveExtractionResult(provider: string, data: any, metadata: any): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    
    // Save raw extraction response
    const rawKey = `providers/${provider}/${date}/extraction/raw-response.json`;
    await this.env.ARCHIVE.put(rawKey, JSON.stringify({ data, metadata }), {
      httpMetadata: {
        contentType: 'application/json',
      }
    });
    
    // Save processed data
    const processedKey = `providers/${provider}/${date}/extraction/processed-data.json`;
    await this.env.ARCHIVE.put(processedKey, JSON.stringify(data), {
      httpMetadata: {
        contentType: 'application/json',
      }
    });
  }

  async saveValidationReport(provider: string, report: any): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const key = `providers/${provider}/${date}/validation/report.json`;
    
    await this.env.ARCHIVE.put(key, JSON.stringify(report), {
      httpMetadata: {
        contentType: 'application/json',
      }
    });
  }

  async getArchivedData(provider: string, date: string, type: 'html' | 'screenshots' | 'extraction' | 'validation'): Promise<any[]> {
    const prefix = `providers/${provider}/${date}/${type}/`;
    const listed = await this.env.ARCHIVE.list({ prefix });
    
    const results = [];
    for (const object of listed.objects) {
      const data = await this.env.ARCHIVE.get(object.key);
      if (data) {
        const content = await data.text();
        results.push({
          key: object.key,
          content,
          metadata: object.customMetadata
        });
      }
    }
    
    return results;
  }
}