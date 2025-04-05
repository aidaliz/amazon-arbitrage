import { SellingPartner } from 'amazon-sp-api';
import { D1Database } from '@cloudflare/workers-types';
import { SP_API_CONFIG, PRICING_ENDPOINTS, FEE_REQUEST_TEMPLATE } from './sp-api-config';

/**
 * Amazon SP API client for pricing and fee calculations
 */
export class AmazonSpApiClient {
  private spClient: any;
  private db: D1Database;
  private credentials: {
    refresh_token?: string;
    client_id?: string;
    client_secret?: string;
  };

  /**
   * Create a new Amazon SP API client
   * @param db - D1 database instance
   * @param credentials - Optional SP API credentials
   */
  constructor(db: D1Database, credentials?: {
    refresh_token?: string;
    client_id?: string;
    client_secret?: string;
  }) {
    this.db = db;
    this.credentials = credentials || {};
  }

  /**
   * Initialize the SP API client
   */
  async initialize(): Promise<void> {
    try {
      // Get credentials from database if not provided
      if (!this.credentials.refresh_token) {
        const settings = await this.db
          .prepare('SELECT * FROM sp_api_credentials LIMIT 1')
          .first();
        
        if (settings) {
          this.credentials.refresh_token = settings.refresh_token;
          this.credentials.client_id = settings.client_id;
          this.credentials.client_secret = settings.client_secret;
        }
      }

      // Create SP API client
      this.spClient = new SellingPartner({
        region: SP_API_CONFIG.region,
        refresh_token: this.credentials.refresh_token,
        credentials: {
          SELLING_PARTNER_APP_CLIENT_ID: this.credentials.client_id,
          SELLING_PARTNER_APP_CLIENT_SECRET: this.credentials.client_secret
        },
        options: SP_API_CONFIG.options
      });

      console.log('Amazon SP API client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Amazon SP API client:', error);
      throw error;
    }
  }

  /**
   * Get product pricing information from Amazon
   * @param asin - Amazon ASIN
   * @param marketplaceId - Amazon marketplace ID (defaults to US)
   */
  async getProductPricing(asin: string, marketplaceId: string = SP_API_CONFIG.defaultMarketplaceId): Promise<any> {
    try {
      if (!this.spClient) {
        await this.initialize();
      }

      const response = await this.spClient.callAPI({
        operation: 'getPricing',
        endpoint: PRICING_ENDPOINTS.productPricing.endpoint,
        query: {
          MarketplaceId: marketplaceId,
          Asins: asin,
          ItemType: 'Asin'
        }
      });

      return response;
    } catch (error) {
      console.error(`Failed to get pricing for ASIN ${asin}:`, error);
      throw error;
    }
  }

  /**
   * Get fee estimate for a product
   * @param asin - Amazon ASIN
   * @param price - Product price
   * @param marketplaceId - Amazon marketplace ID (defaults to US)
   */
  async getFeesEstimate(asin: string, price: number, marketplaceId: string = SP_API_CONFIG.defaultMarketplaceId): Promise<any> {
    try {
      if (!this.spClient) {
        await this.initialize();
      }

      // Create fee request based on template
      const feeRequest = JSON.parse(JSON.stringify(FEE_REQUEST_TEMPLATE));
      feeRequest.FeesEstimateRequest.MarketplaceId = marketplaceId;
      feeRequest.FeesEstimateRequest.PriceToEstimateFees.ListingPrice.Amount = price;
      
      const response = await this.spClient.callAPI({
        operation: 'getMyFeesEstimate',
        endpoint: PRICING_ENDPOINTS.productFees.endpoint,
        body: {
          FeesEstimateRequest: feeRequest.FeesEstimateRequest
        },
        path: {
          Asin: asin
        }
      });

      return response;
    } catch (error) {
      console.error(`Failed to get fees estimate for ASIN ${asin}:`, error);
      throw error;
    }
  }

  /**
   * Get product details from Amazon catalog
   * @param asin - Amazon ASIN
   * @param marketplaceId - Amazon marketplace ID (defaults to US)
   */
  async getProductDetails(asin: string, marketplaceId: string = SP_API_CONFIG.defaultMarketplaceId): Promise<any> {
    try {
      if (!this.spClient) {
        await this.initialize();
      }

      const response = await this.spClient.callAPI({
        operation: 'getCatalogItem',
        endpoint: PRICING_ENDPOINTS.catalogItems.endpoint,
        path: {
          asin: asin
        },
        query: {
          MarketplaceId: marketplaceId
        }
      });

      return response;
    } catch (error) {
      console.error(`Failed to get product details for ASIN ${asin}:`, error);
      throw error;
    }
  }

  /**
   * Calculate estimated profit for a product
   * @param asin - Amazon ASIN
   * @param sourcingPrice - Price from external source
   * @param marketplaceId - Amazon marketplace ID (defaults to US)
   */
  async calculateProfit(asin: string, sourcingPrice: number, marketplaceId: string = SP_API_CONFIG.defaultMarketplaceId): Promise<{
    asin: string;
    sourcingPrice: number;
    amazonPrice: number;
    fees: number;
    profit: number;
    margin: number;
    isProfitable: boolean;
    details: any;
  }> {
    try {
      // Get Amazon pricing
      const pricingData = await this.getProductPricing(asin, marketplaceId);
      
      if (!pricingData || !pricingData.payload || pricingData.payload.length === 0) {
        throw new Error(`No pricing data found for ASIN ${asin}`);
      }
      
      // Extract Amazon price
      const amazonPrice = pricingData.payload[0].Price?.ListingPrice?.Amount || 0;
      
      if (amazonPrice === 0) {
        throw new Error(`No valid price found for ASIN ${asin}`);
      }
      
      // Get fees estimate
      const feesData = await this.getFeesEstimate(asin, amazonPrice, marketplaceId);
      
      // Extract fees
      const fees = feesData?.payload?.FeesEstimateResult?.FeesEstimate?.TotalFeesEstimate?.Amount || 0;
      
      // Calculate profit
      const profit = amazonPrice - sourcingPrice - fees;
      
      // Calculate margin
      const margin = amazonPrice > 0 ? (profit / amazonPrice) * 100 : 0;
      
      // Determine if profitable based on thresholds
      const isProfitable = 
        margin >= SP_API_CONFIG.profitabilityThresholds.minMarginPercent && 
        profit >= SP_API_CONFIG.profitabilityThresholds.minProfitAmount;
      
      return {
        asin,
        sourcingPrice,
        amazonPrice,
        fees,
        profit,
        margin,
        isProfitable,
        details: {
          pricing: pricingData,
          fees: feesData
        }
      };
    } catch (error) {
      console.error(`Failed to calculate profit for ASIN ${asin}:`, error);
      throw error;
    }
  }

  /**
   * Store SP API credentials in the database
   * @param credentials - SP API credentials
   */
  async storeCredentials(credentials: {
    refresh_token: string;
    client_id: string;
    client_secret: string;
  }): Promise<void> {
    try {
      // Check if credentials table exists
      const tableExists = await this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sp_api_credentials'")
        .first();
      
      if (!tableExists) {
        // Create table if it doesn't exist
        await this.db.exec(`
          CREATE TABLE sp_api_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            refresh_token TEXT NOT NULL,
            client_id TEXT NOT NULL,
            client_secret TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
      
      // Check if credentials already exist
      const existingCredentials = await this.db
        .prepare('SELECT id FROM sp_api_credentials LIMIT 1')
        .first();
      
      if (existingCredentials) {
        // Update existing credentials
        await this.db
          .prepare(`
            UPDATE sp_api_credentials 
            SET refresh_token = ?, client_id = ?, client_secret = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(
            credentials.refresh_token,
            credentials.client_id,
            credentials.client_secret,
            existingCredentials.id
          )
          .run();
      } else {
        // Insert new credentials
        await this.db
          .prepare(`
            INSERT INTO sp_api_credentials (refresh_token, client_id, client_secret)
            VALUES (?, ?, ?)
          `)
          .bind(
            credentials.refresh_token,
            credentials.client_id,
            credentials.client_secret
          )
          .run();
      }
      
      // Update local credentials
      this.credentials = credentials;
      
      console.log('SP API credentials stored successfully');
    } catch (error) {
      console.error('Failed to store SP API credentials:', error);
      throw error;
    }
  }
}
