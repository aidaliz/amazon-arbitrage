import { CrawlerService } from './crawler-service';
import { D1Database } from '@cloudflare/workers-types';

/**
 * Main entry point for the crawler module
 * Exports all necessary components for web crawling and product matching
 */

export { ProductCrawler } from './product-crawler';
export { CrawlerService } from './crawler-service';
export { CRAWLER_CONFIG, SEARCH_TEMPLATES, SITE_SELECTORS } from './crawler-config';

/**
 * Create a new crawler service instance
 * @param db - D1 database instance
 * @returns CrawlerService instance
 */
export function createCrawlerService(db: D1Database): CrawlerService {
  return new CrawlerService(db);
}

/**
 * Process a batch of ASINs to find matching products on other websites
 * @param db - D1 database instance
 * @param asins - Array of ASINs to process
 * @returns Processing results
 */
export async function processBatchOfAsins(db: D1Database, asins: string[]): Promise<{
  success: string[];
  failed: string[];
}> {
  const service = createCrawlerService(db);
  return await service.processAsinBatch(asins);
}

/**
 * Process all unprocessed ASINs in the database
 * @param db - D1 database instance
 * @param limit - Maximum number of ASINs to process
 * @returns Processing results
 */
export async function processUnprocessedAsins(db: D1Database, limit: number = 10): Promise<{
  processed: number;
  success: number;
  failed: number;
}> {
  const service = createCrawlerService(db);
  return await service.processUnprocessedAsins(limit);
}

/**
 * Update product data for websites that need refreshing
 * @param db - D1 database instance
 * @param daysOld - Process websites that haven't been checked in this many days
 * @param limit - Maximum number of websites to update
 * @returns Update results
 */
export async function updateStaleWebsites(db: D1Database, daysOld: number = 1, limit: number = 20): Promise<{
  updated: number;
  unchanged: number;
  failed: number;
}> {
  const service = createCrawlerService(db);
  return await service.updateStaleWebsites(daysOld, limit);
}
