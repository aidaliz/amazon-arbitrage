import { ProductCrawler } from './product-crawler';
import { D1Database } from '@cloudflare/workers-types';

/**
 * Service class for managing product crawling operations
 */
export class CrawlerService {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }
  
  /**
   * Process a single ASIN by crawling for matching products
   * @param asin - Amazon ASIN to process
   */
  async processAsin(asin: string): Promise<void> {
    try {
      // Get product details from database
      const product = await this.db
        .prepare('SELECT id, asin, upc, title FROM products WHERE asin = ?')
        .bind(asin)
        .first();
      
      if (!product) {
        throw new Error(`Product with ASIN ${asin} not found in database`);
      }
      
      // Create crawler instance
      const crawler = new ProductCrawler(this.db);
      
      // Start crawling for this product
      await crawler.crawlForProduct(
        product.id,
        product.asin,
        product.upc,
        product.title
      );
      
      // Update product's updated_at timestamp
      await this.db
        .prepare('UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(product.id)
        .run();
      
      console.log(`Successfully processed ASIN: ${asin}`);
    } catch (error) {
      console.error(`Error processing ASIN ${asin}:`, error);
      throw error;
    }
  }
  
  /**
   * Process multiple ASINs in batch
   * @param asins - Array of ASINs to process
   */
  async processAsinBatch(asins: string[]): Promise<{
    success: string[];
    failed: string[];
  }> {
    const results = {
      success: [],
      failed: []
    };
    
    for (const asin of asins) {
      try {
        await this.processAsin(asin);
        results.success.push(asin);
      } catch (error) {
        results.failed.push(asin);
      }
    }
    
    return results;
  }
  
  /**
   * Process all unprocessed ASINs in the database
   * @param limit - Maximum number of ASINs to process
   */
  async processUnprocessedAsins(limit: number = 10): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    // Get ASINs that haven't been processed yet
    // (no matching entries in websites table)
    const unprocessedProducts = await this.db
      .prepare(`
        SELECT p.asin 
        FROM products p
        LEFT JOIN websites w ON p.id = w.product_id
        WHERE w.id IS NULL
        LIMIT ?
      `)
      .bind(limit)
      .all();
    
    if (!unprocessedProducts.results || unprocessedProducts.results.length === 0) {
      return { processed: 0, success: 0, failed: 0 };
    }
    
    const asins = unprocessedProducts.results.map(p => p.asin);
    const results = await this.processAsinBatch(asins);
    
    return {
      processed: asins.length,
      success: results.success.length,
      failed: results.failed.length
    };
  }
  
  /**
   * Update product data for websites that need refreshing
   * @param daysOld - Process websites that haven't been checked in this many days
   * @param limit - Maximum number of websites to update
   */
  async updateStaleWebsites(daysOld: number = 1, limit: number = 20): Promise<{
    updated: number;
    unchanged: number;
    failed: number;
  }> {
    // Get websites that need updating
    const staleWebsites = await this.db
      .prepare(`
        SELECT w.id, w.product_url, w.price, w.stock_status, p.id as product_id
        FROM websites w
        JOIN products p ON w.product_id = p.id
        WHERE datetime(w.last_checked) < datetime('now', '-' || ? || ' days')
        LIMIT ?
      `)
      .bind(daysOld, limit)
      .all();
    
    if (!staleWebsites.results || staleWebsites.results.length === 0) {
      return { updated: 0, unchanged: 0, failed: 0 };
    }
    
    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    
    // Create crawler instance
    const crawler = new ProductCrawler(this.db);
    
    for (const website of staleWebsites.results) {
      try {
        // TODO: Implement individual website update logic
        // This would require extending the ProductCrawler class with a method
        // to update a single website instead of crawling from search results
        
        // For now, we'll just mark it as updated
        await this.db
          .prepare('UPDATE websites SET last_checked = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(website.id)
          .run();
        
        unchanged++;
      } catch (error) {
        failed++;
      }
    }
    
    return { updated, unchanged, failed };
  }
}
