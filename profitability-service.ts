import { AmazonSpApiClient } from './amazon-sp-api-client';
import { SP_API_CONFIG, PRICING_ENDPOINTS } from './sp-api-config';
import { D1Database } from '@cloudflare/workers-types';

/**
 * Service class for managing product profitability calculations
 */
export class ProfitabilityService {
  private db: D1Database;
  private apiClient: AmazonSpApiClient;
  
  constructor(db: D1Database) {
    this.db = db;
    this.apiClient = new AmazonSpApiClient(db);
  }
  
  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.apiClient.initialize();
  }
  
  /**
   * Calculate profitability for a product found on an external website
   * @param productId - Database ID of the product
   * @param websiteId - Database ID of the website
   */
  async calculateProfitability(productId: number, websiteId: number): Promise<{
    productId: number;
    websiteId: number;
    asin: string;
    sourcingPrice: number;
    amazonPrice: number;
    fees: number;
    profit: number;
    margin: number;
    isProfitable: boolean;
  }> {
    try {
      // Get product and website data from database
      const product = await this.db
        .prepare('SELECT id, asin, amazon_price, amazon_fees FROM products WHERE id = ?')
        .bind(productId)
        .first();
      
      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }
      
      const website = await this.db
        .prepare('SELECT id, price FROM websites WHERE id = ?')
        .bind(websiteId)
        .first();
      
      if (!website) {
        throw new Error(`Website with ID ${websiteId} not found`);
      }
      
      // If we already have Amazon price and fees, use them
      if (product.amazon_price && product.amazon_fees) {
        const amazonPrice = product.amazon_price;
        const fees = product.amazon_fees;
        const sourcingPrice = website.price;
        
        // Calculate profit and margin
        const profit = amazonPrice - sourcingPrice - fees;
        const margin = amazonPrice > 0 ? (profit / amazonPrice) * 100 : 0;
        
        // Determine if profitable based on thresholds
        const isProfitable = 
          margin >= SP_API_CONFIG.profitabilityThresholds.minMarginPercent && 
          profit >= SP_API_CONFIG.profitabilityThresholds.minProfitAmount;
        
        return {
          productId,
          websiteId,
          asin: product.asin,
          sourcingPrice,
          amazonPrice,
          fees,
          profit,
          margin,
          isProfitable
        };
      }
      
      // Otherwise, get data from Amazon SP API
      const profitData = await this.apiClient.calculateProfit(product.asin, website.price);
      
      // Update product with Amazon price and fees
      await this.db
        .prepare('UPDATE products SET amazon_price = ?, amazon_fees = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(profitData.amazonPrice, profitData.fees, productId)
        .run();
      
      return {
        productId,
        websiteId,
        asin: product.asin,
        sourcingPrice: profitData.sourcingPrice,
        amazonPrice: profitData.amazonPrice,
        fees: profitData.fees,
        profit: profitData.profit,
        margin: profitData.margin,
        isProfitable: profitData.isProfitable
      };
    } catch (error) {
      console.error(`Failed to calculate profitability for product ${productId} and website ${websiteId}:`, error);
      throw error;
    }
  }
  
  /**
   * Calculate profitability for all products found on external websites
   * @param limit - Maximum number of products to process
   */
  async calculateProfitabilityForAllProducts(limit: number = 100): Promise<{
    processed: number;
    profitable: number;
    unprofitable: number;
  }> {
    try {
      // Get products and websites that need profitability calculation
      const websitesResult = await this.db
        .prepare(`
          SELECT w.id as website_id, p.id as product_id
          FROM websites w
          JOIN products p ON w.product_id = p.id
          WHERE (p.amazon_price IS NULL OR p.amazon_fees IS NULL)
          LIMIT ?
        `)
        .bind(limit)
        .all();
      
      if (!websitesResult.results || websitesResult.results.length === 0) {
        return { processed: 0, profitable: 0, unprofitable: 0 };
      }
      
      let profitable = 0;
      let unprofitable = 0;
      
      // Calculate profitability for each product
      for (const item of websitesResult.results) {
        try {
          const result = await this.calculateProfitability(item.product_id, item.website_id);
          
          if (result.isProfitable) {
            profitable++;
          } else {
            unprofitable++;
          }
        } catch (error) {
          console.error(`Error calculating profitability for product ${item.product_id}:`, error);
          unprofitable++;
        }
      }
      
      return {
        processed: websitesResult.results.length,
        profitable,
        unprofitable
      };
    } catch (error) {
      console.error('Failed to calculate profitability for all products:', error);
      throw error;
    }
  }
  
  /**
   * Find profitable products based on configured thresholds
   * @param limit - Maximum number of products to return
   */
  async findProfitableProducts(limit: number = 100): Promise<any[]> {
    try {
      // Get profitable products from database
      const result = await this.db
        .prepare(`
          SELECT 
            p.id as product_id, 
            p.asin, 
            p.title, 
            p.image_url,
            p.amazon_price, 
            p.amazon_fees,
            w.id as website_id,
            w.website_url,
            w.product_url,
            w.price as sourcing_price,
            w.stock_status,
            w.color,
            w.size,
            (p.amazon_price - w.price - p.amazon_fees) as profit,
            ((p.amazon_price - w.price - p.amazon_fees) / p.amazon_price * 100) as margin
          FROM products p
          JOIN websites w ON p.id = w.product_id
          WHERE 
            p.amazon_price IS NOT NULL 
            AND p.amazon_fees IS NOT NULL
            AND ((p.amazon_price - w.price - p.amazon_fees) / p.amazon_price * 100) >= ?
            AND (p.amazon_price - w.price - p.amazon_fees) >= ?
          ORDER BY profit DESC
          LIMIT ?
        `)
        .bind(
          SP_API_CONFIG.profitabilityThresholds.minMarginPercent,
          SP_API_CONFIG.profitabilityThresholds.minProfitAmount,
          limit
        )
        .all();
      
      return result.results || [];
    } catch (error) {
      console.error('Failed to find profitable products:', error);
      throw error;
    }
  }
  
  /**
   * Store SP API credentials
   * @param credentials - SP API credentials
   */
  async storeCredentials(credentials: {
    refresh_token: string;
    client_id: string;
    client_secret: string;
  }): Promise<void> {
    await this.apiClient.storeCredentials(credentials);
  }
}
