// This file contains the integration of all modules for the main application

import { D1Database } from '@cloudflare/workers-types';
import * as csvUtils from '../lib/csv-utils';
import * as crawler from '../lib/crawler';
import * as amazonSpApi from '../lib/amazon-sp-api';
import * as monitoring from '../lib/monitoring';
import * as alerts from '../lib/alerts';

/**
 * Main application service that integrates all modules
 */
export class AppService {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }
  
  /**
   * Initialize all application modules
   */
  async initialize(): Promise<void> {
    try {
      // Initialize monitoring system
      await monitoring.initializeMonitoringSystem(this.db);
      
      // Initialize alert system
      await alerts.initializeAlertSystem(this.db);
      
      console.log('Application modules initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application modules:', error);
      throw error;
    }
  }
  
  /**
   * Process uploaded CSV file with ASINs
   * @param csvContent - Raw CSV content
   */
  async processAsinCsv(csvContent: string): Promise<{
    success: boolean;
    asinsProcessed: number;
    message: string;
  }> {
    try {
      // Parse CSV
      const parseResult = csvUtils.parseCSV(csvContent);
      
      if (!parseResult.success) {
        return {
          success: false,
          asinsProcessed: 0,
          message: `Failed to parse CSV: ${parseResult.error}`
        };
      }
      
      // Validate CSV
      const validation = csvUtils.validateCSV(parseResult.records);
      
      if (!validation.valid) {
        return {
          success: false,
          asinsProcessed: 0,
          message: validation.message || 'Invalid CSV format'
        };
      }
      
      // Normalize records
      const normalizedRecords = csvUtils.normalizeCSVRecords(parseResult.records);
      
      // Store ASINs in database
      let asinsProcessed = 0;
      
      for (const record of normalizedRecords) {
        try {
          // Check if product already exists
          const existingProduct = await this.db
            .prepare('SELECT id FROM products WHERE asin = ?')
            .bind(record.asin)
            .first();
          
          if (!existingProduct) {
            // Insert new product
            await this.db
              .prepare('INSERT INTO products (asin, upc, title, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
              .bind(record.asin, record.upc, record.title)
              .run();
            
            asinsProcessed++;
          }
        } catch (error) {
          console.error(`Error processing ASIN ${record.asin}:`, error);
        }
      }
      
      // Update upload counter
      await this.db
        .prepare('UPDATE counters SET value = value + 1 WHERE name = ?')
        .bind('uploads_processed')
        .run();
      
      return {
        success: true,
        asinsProcessed,
        message: `Successfully processed ${asinsProcessed} ASINs`
      };
    } catch (error) {
      console.error('Failed to process ASIN CSV:', error);
      return {
        success: false,
        asinsProcessed: 0,
        message: `Error: ${error.message || 'Unknown error'}`
      };
    }
  }
  
  /**
   * Start crawling for unprocessed ASINs
   * @param limit - Maximum number of ASINs to process
   */
  async startCrawlingForAsins(limit: number = 10): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    try {
      // Create crawler service
      const crawlerService = crawler.createCrawlerService(this.db);
      
      // Process unprocessed ASINs
      return await crawlerService.processUnprocessedAsins(limit);
    } catch (error) {
      console.error('Failed to start crawling for ASINs:', error);
      throw error;
    }
  }
  
  /**
   * Calculate profitability for products
   * @param limit - Maximum number of products to process
   */
  async calculateProfitability(limit: number = 100): Promise<{
    processed: number;
    profitable: number;
    unprofitable: number;
  }> {
    try {
      // Create profitability service
      const profitabilityService = amazonSpApi.createProfitabilityService(this.db);
      
      // Calculate profitability for all products
      return await profitabilityService.calculateProfitabilityForAllProducts(limit);
    } catch (error) {
      console.error('Failed to calculate profitability:', error);
      throw error;
    }
  }
  
  /**
   * Run monitoring cycle to check for price and stock changes
   */
  async runMonitoringCycle(): Promise<{
    websitesChecked: number;
    priceChanges: number;
    stockChanges: number;
    profitableOpportunities: number;
  }> {
    try {
      // Run monitoring cycle
      return await monitoring.runMonitoringCycle(this.db);
    } catch (error) {
      console.error('Failed to run monitoring cycle:', error);
      throw error;
    }
  }
  
  /**
   * Send alerts for profitable opportunities
   * @param limit - Maximum number of opportunities to alert
   */
  async sendProfitableOpportunityAlerts(limit: number = 10): Promise<{
    sent: number;
    failed: number;
  }> {
    try {
      // Send alerts
      return await alerts.sendProfitableOpportunityAlerts(this.db, limit);
    } catch (error) {
      console.error('Failed to send profitable opportunity alerts:', error);
      throw error;
    }
  }
  
  /**
   * Send daily summary email
   */
  async sendDailySummaryEmail(): Promise<boolean> {
    try {
      // Send daily summary
      return await alerts.sendDailySummaryEmail(this.db);
    } catch (error) {
      console.error('Failed to send daily summary email:', error);
      throw error;
    }
  }
  
  /**
   * Process scheduled jobs
   */
  async processScheduledJobs(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    try {
      // Process scheduled jobs
      const result = await monitoring.processScheduledJobs(this.db);
      
      return {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed
      };
    } catch (error) {
      console.error('Failed to process scheduled jobs:', error);
      throw error;
    }
  }
  
  /**
   * Find profitable opportunities
   * @param limit - Maximum number of opportunities to return
   */
  async findProfitableOpportunities(limit: number = 100): Promise<any[]> {
    try {
      // Find profitable opportunities
      return await amazonSpApi.findProfitableProducts(this.db, limit);
    } catch (error) {
      console.error('Failed to find profitable opportunities:', error);
      throw error;
    }
  }
}
