import { D1Database } from '@cloudflare/workers-types';
import { MONITORING_CONFIG } from './monitoring-config';

/**
 * Service class for monitoring product prices and stock changes
 */
export class MonitoringService {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }
  
  /**
   * Get websites that need to be checked for price/stock updates
   * @param limit - Maximum number of websites to return
   */
  async getWebsitesToMonitor(limit: number = MONITORING_CONFIG.batchSize): Promise<any[]> {
    try {
      // Get websites that haven't been checked recently
      const result = await this.db
        .prepare(`
          SELECT 
            w.id, 
            w.product_id, 
            w.website_url, 
            w.product_url, 
            w.price, 
            w.stock_status,
            w.last_checked,
            p.asin,
            p.title
          FROM websites w
          JOIN products p ON w.product_id = p.id
          WHERE datetime(w.last_checked) < datetime('now', '-' || ? || ' hours')
          ORDER BY w.last_checked ASC
          LIMIT ?
        `)
        .bind(MONITORING_CONFIG.defaultSchedule, limit)
        .all();
      
      return result.results || [];
    } catch (error) {
      console.error('Failed to get websites to monitor:', error);
      throw error;
    }
  }
  
  /**
   * Record a new price and stock status for a website
   * @param websiteId - Database ID of the website
   * @param newPrice - New price
   * @param newStockStatus - New stock status
   */
  async recordPriceUpdate(websiteId: number, newPrice: number, newStockStatus: string): Promise<{
    priceChanged: boolean;
    stockChanged: boolean;
    priceChangeAmount: number;
    priceChangePercent: number;
  }> {
    try {
      // Get current website data
      const website = await this.db
        .prepare('SELECT id, price, stock_status FROM websites WHERE id = ?')
        .bind(websiteId)
        .first();
      
      if (!website) {
        throw new Error(`Website with ID ${websiteId} not found`);
      }
      
      // Calculate price change
      const oldPrice = website.price || 0;
      const priceChangeAmount = newPrice - oldPrice;
      const priceChangePercent = oldPrice > 0 ? (priceChangeAmount / oldPrice) * 100 : 0;
      
      // Determine if price or stock has changed
      const priceChanged = Math.abs(priceChangeAmount) >= MONITORING_CONFIG.priceChangeThresholds.minAbsoluteChange &&
                          Math.abs(priceChangePercent) >= MONITORING_CONFIG.priceChangeThresholds.minPercentageChange;
      
      const stockChanged = newStockStatus !== website.stock_status;
      
      // If price or stock has changed, update the website and add to price history
      if (priceChanged || stockChanged) {
        // Update website
        await this.db
          .prepare(`
            UPDATE websites 
            SET price = ?, stock_status = ?, last_checked = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(newPrice, newStockStatus, websiteId)
          .run();
        
        // Add to price history
        await this.db
          .prepare(`
            INSERT INTO price_history (website_id, price, stock_status, recorded_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `)
          .bind(websiteId, newPrice, newStockStatus)
          .run();
      } else {
        // Just update the last_checked timestamp
        await this.db
          .prepare('UPDATE websites SET last_checked = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(websiteId)
          .run();
      }
      
      return {
        priceChanged,
        stockChanged,
        priceChangeAmount,
        priceChangePercent
      };
    } catch (error) {
      console.error(`Failed to record price update for website ${websiteId}:`, error);
      throw error;
    }
  }
  
  /**
   * Check for profitable opportunities based on recent price changes
   * @param limit - Maximum number of opportunities to return
   */
  async findProfitableOpportunities(limit: number = 100): Promise<any[]> {
    try {
      // Find profitable opportunities based on recent price changes
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
            ((p.amazon_price - w.price - p.amazon_fees) / p.amazon_price * 100) as margin,
            ph.recorded_at as price_updated_at,
            (
              SELECT ph_prev.price 
              FROM price_history ph_prev 
              WHERE ph_prev.website_id = w.id AND ph_prev.recorded_at < ph.recorded_at 
              ORDER BY ph_prev.recorded_at DESC 
              LIMIT 1
            ) as previous_price
          FROM products p
          JOIN websites w ON p.id = w.product_id
          JOIN price_history ph ON w.id = ph.website_id
          WHERE 
            p.amazon_price IS NOT NULL 
            AND p.amazon_fees IS NOT NULL
            AND ((p.amazon_price - w.price - p.amazon_fees) / p.amazon_price * 100) >= ?
            AND (p.amazon_price - w.price - p.amazon_fees) >= ?
            AND ph.recorded_at = (
              SELECT MAX(recorded_at) FROM price_history WHERE website_id = w.id
            )
          ORDER BY ph.recorded_at DESC, profit DESC
          LIMIT ?
        `)
        .bind(
          MONITORING_CONFIG.profitabilityThresholds.minMarginPercent,
          MONITORING_CONFIG.profitabilityThresholds.minProfitAmount,
          limit
        )
        .all();
      
      return result.results || [];
    } catch (error) {
      console.error('Failed to find profitable opportunities:', error);
      throw error;
    }
  }
  
  /**
   * Clean up old price history data
   */
  async cleanupOldData(): Promise<{
    priceHistoryDeleted: number;
    alertHistoryDeleted: number;
  }> {
    try {
      // Delete old price history
      const priceHistoryResult = await this.db
        .prepare(`
          DELETE FROM price_history
          WHERE datetime(recorded_at) < datetime('now', '-' || ? || ' days')
        `)
        .bind(MONITORING_CONFIG.dataRetention.priceHistory)
        .run();
      
      // Delete old alert history (if table exists)
      let alertHistoryDeleted = 0;
      try {
        const alertHistoryResult = await this.db
          .prepare(`
            DELETE FROM alert_history
            WHERE datetime(created_at) < datetime('now', '-' || ? || ' days')
          `)
          .bind(MONITORING_CONFIG.dataRetention.alertHistory)
          .run();
        
        alertHistoryDeleted = alertHistoryResult.changes || 0;
      } catch (error) {
        // Alert history table might not exist yet
        console.log('Alert history table not found or other error:', error);
      }
      
      return {
        priceHistoryDeleted: priceHistoryResult.changes || 0,
        alertHistoryDeleted
      };
    } catch (error) {
      console.error('Failed to clean up old data:', error);
      throw error;
    }
  }
  
  /**
   * Run a complete monitoring cycle
   */
  async runMonitoringCycle(): Promise<{
    websitesChecked: number;
    priceChanges: number;
    stockChanges: number;
    profitableOpportunities: number;
  }> {
    try {
      // Get websites to monitor
      const websites = await this.getWebsitesToMonitor();
      
      let priceChanges = 0;
      let stockChanges = 0;
      
      // Process each website
      for (const website of websites) {
        try {
          // In a real implementation, this would call the crawler to get updated prices
          // For now, we'll just simulate a price update with the same values
          const result = await this.recordPriceUpdate(
            website.id,
            website.price,
            website.stock_status
          );
          
          if (result.priceChanged) priceChanges++;
          if (result.stockChanged) stockChanges++;
        } catch (error) {
          console.error(`Error monitoring website ${website.id}:`, error);
        }
      }
      
      // Find profitable opportunities
      const opportunities = await this.findProfitableOpportunities();
      
      // Clean up old data
      await this.cleanupOldData();
      
      return {
        websitesChecked: websites.length,
        priceChanges,
        stockChanges,
        profitableOpportunities: opportunities.length
      };
    } catch (error) {
      console.error('Failed to run monitoring cycle:', error);
      throw error;
    }
  }
}
