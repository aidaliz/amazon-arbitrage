import { D1Database } from '@cloudflare/workers-types';
import { EmailService } from './email-service';
import { ALERT_CONFIG } from './alert-config';

/**
 * Service class for generating and sending alert emails
 */
export class AlertService {
  private db: D1Database;
  private emailService: EmailService;
  
  constructor(db: D1Database) {
    this.db = db;
    this.emailService = new EmailService(db);
  }
  
  /**
   * Initialize the alert service
   */
  async initialize(): Promise<void> {
    await this.emailService.initialize();
  }
  
  /**
   * Send an alert for a profitable opportunity
   * @param productId - Database ID of the product
   * @param websiteId - Database ID of the website
   */
  async sendProfitableOpportunityAlert(productId: number, websiteId: number): Promise<boolean> {
    try {
      // Check if alerts are enabled
      if (!ALERT_CONFIG.enabledAlerts.profitableOpportunities) {
        return false;
      }
      
      // Check if an alert was recently sent for this product
      const recentlySent = await this.emailService.wasAlertRecentlySent(productId);
      if (recentlySent) {
        return false;
      }
      
      // Get product and website data
      const data = await this.db
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
          WHERE p.id = ? AND w.id = ?
        `)
        .bind(productId, websiteId)
        .first();
      
      if (!data) {
        throw new Error(`Product ${productId} or website ${websiteId} not found`);
      }
      
      // Check if the opportunity meets the profitability thresholds
      if (data.margin < ALERT_CONFIG.thresholds.minMarginPercent || 
          data.profit < ALERT_CONFIG.thresholds.minProfitAmount) {
        return false;
      }
      
      // Generate email content
      const subject = `${ALERT_CONFIG.email.subjectPrefixes.opportunity}: ${data.title}`;
      const html = this.generateProfitableOpportunityEmailHtml(data);
      
      // Send the email
      const success = await this.emailService.sendEmail(
        ALERT_CONFIG.email.defaultRecipient,
        subject,
        html
      );
      
      if (success) {
        // Record that an alert was sent
        await this.emailService.recordProductAlert(productId, 'opportunity');
      }
      
      return success;
    } catch (error) {
      console.error(`Failed to send profitable opportunity alert for product ${productId}:`, error);
      return false;
    }
  }
  
  /**
   * Send alerts for all profitable opportunities
   * @param limit - Maximum number of opportunities to alert
   */
  async sendAllProfitableOpportunityAlerts(limit: number = 10): Promise<{
    sent: number;
    failed: number;
  }> {
    try {
      // Check if alerts are enabled
      if (!ALERT_CONFIG.enabledAlerts.profitableOpportunities) {
        return { sent: 0, failed: 0 };
      }
      
      // Find profitable opportunities
      const result = await this.db
        .prepare(`
          SELECT 
            p.id as product_id, 
            w.id as website_id
          FROM products p
          JOIN websites w ON p.id = w.product_id
          WHERE 
            p.amazon_price IS NOT NULL 
            AND p.amazon_fees IS NOT NULL
            AND ((p.amazon_price - w.price - p.amazon_fees) / p.amazon_price * 100) >= ?
            AND (p.amazon_price - w.price - p.amazon_fees) >= ?
          ORDER BY (p.amazon_price - w.price - p.amazon_fees) DESC
          LIMIT ?
        `)
        .bind(
          ALERT_CONFIG.thresholds.minMarginPercent,
          ALERT_CONFIG.thresholds.minProfitAmount,
          limit
        )
        .all();
      
      if (!result.results || result.results.length === 0) {
        return { sent: 0, failed: 0 };
      }
      
      let sent = 0;
      let failed = 0;
      
      // Send alerts for each opportunity
      for (const opportunity of result.results) {
        // Check if an alert was recently sent for this product
        const recentlySent = await this.emailService.wasAlertRecentlySent(opportunity.product_id);
        if (recentlySent) {
          continue;
        }
        
        const success = await this.sendProfitableOpportunityAlert(
          opportunity.product_id,
          opportunity.website_id
        );
        
        if (success) {
          sent++;
        } else {
          failed++;
        }
      }
      
      return { sent, failed };
    } catch (error) {
      console.error('Failed to send profitable opportunity alerts:', error);
      return { sent: 0, failed: 0 };
    }
  }
  
  /**
   * Send a daily summary email with all profitable opportunities
   */
  async sendDailySummaryEmail(): Promise<boolean> {
    try {
      // Check if daily summary is enabled
      if (!ALERT_CONFIG.enabledAlerts.dailySummary) {
        return false;
      }
      
      // Find profitable opportunities
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
          ALERT_CONFIG.thresholds.minMarginPercent,
          ALERT_CONFIG.thresholds.minProfitAmount,
          ALERT_CONFIG.frequency.maxOpportunitiesPerEmail
        )
        .all();
      
      if (!result.results || result.results.length === 0) {
        return false;
      }
      
      // Generate email content
      const subject = `${ALERT_CONFIG.email.subjectPrefixes.summary}: ${result.results.length} Profitable Opportunities`;
      const html = this.generateDailySummaryEmailHtml(result.results);
      
      // Send the email
      return await this.emailService.sendEmail(
        ALERT_CONFIG.email.defaultRecipient,
        subject,
        html
      );
    } catch (error) {
      console.error('Failed to send daily summary email:', error);
      return false;
    }
  }
  
  /**
   * Generate HTML email content for a profitable opportunity
   * @param data - Opportunity data
   */
  private generateProfitableOpportunityEmailHtml(data: any): string {
    const amazonUrl = `https://www.amazon.com/dp/${data.asin}`;
    const formattedProfit = data.profit.toFixed(2);
    const formattedMargin = data.margin.toFixed(2);
    const formattedAmazonPrice = data.amazon_price.toFixed(2);
    const formattedSourcingPrice = data.sourcing_price.toFixed(2);
    const formattedFees = data.amazon_fees.toFixed(2);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Profitable Opportunity Found</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #232f3e;
            color: #fff;
            padding: 20px;
            text-align: center;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .product {
            margin-bottom: 20px;
            border: 1px solid #ddd;
            padding: 15px;
            background-color: #fff;
          }
          .product-image {
            text-align: center;
            margin-bottom: 15px;
          }
          .product-image img {
            max-width: 200px;
            max-height: 200px;
          }
          .product-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .product-details {
            margin-bottom: 15px;
          }
          .profit {
            color: #067D62;
            font-weight: bold;
            font-size: 16px;
          }
          .button {
            display: inline-block;
            padding: 10px 15px;
            background-color: #FF9900;
            color: #fff;
            text-decoration: none;
            border-radius: 4px;
            margin-right: 10px;
            margin-bottom: 10px;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #777;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          table, th, td {
            border: 1px solid #ddd;
          }
          th, td {
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Profitable Opportunity Found</h1>
          </div>
          <div class="content">
            <p>We've found a profitable arbitrage opportunity for you:</p>
            
            <div class="product">
              <div class="product-image">
                ${data.image_url ? `<img src="${data.image_url}" alt="${data.title}">` : ''}
              </div>
              <div class="product-title">${data.title}</div>
              <div class="product-details">
                <p><strong>ASIN:</strong> ${data.asin}</p>
                <p class="profit">Profit: $${formattedProfit} (${formattedMargin}% margin)</p>
                
                <table>
                  <tr>
                    <th>Amazon Price</th>
                    <th>Source Price</th>
                    <th>Amazon Fees</th>
                    <th>Profit</th>
                  </tr>
                  <tr>
                    <td>$${formattedAmazonPrice}</td>
                    <td>$${formattedSourcingPrice}</td>
                    <td>$${formattedFees}</td>
                    <td>$${formattedProfit}</td>
                  </tr>
                </table>
                
                <p><strong>Source Website:</strong> ${data.website_url}</p>
                <p><strong>Stock Status:</strong> ${data.stock_status || 'Unknown'}</p>
                ${data.color ? `<p><strong>Color:</strong> ${data.color}</p>` : ''}
                ${data.size ? `<p><strong>Size:</strong> ${data.size}</p>` : ''}
              </div>
              
              <a href="${data.product_url}" class="button" target="_blank">View on Source Website</a>
              <a href="${amazonUrl}" class="button" target="_blank">View on Amazon</a>
            </div>
            
            <p>Act quickly to take advantage of this opportunity before prices change!</p>
          </div>
          <div class="footer">
            <p>This email was sent by your Amazon Arbitrage tool. You received this because a profitable opportunity matching your criteria was found.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  /**
   * Generate HTML email content for a daily summary
   * @param opportunities - List of profitable opportunities
   */
  private generateDailySummaryEmailHtml(opportunities: any[]): string {
    const opportunitiesHtml = opportunities.map(opportunity => {
      const amazonUrl = `https://www.amazon.com/dp/${opportunity.asin}`;
      const formattedProfit = opportunity.profit.toFixed(2);
      const formattedMargin = opportunity.margin.toFixed(2);
      const formattedAmazonPrice = opportunity.amazon_price.toFixed(2);
      const formattedSourcingPrice = opportunity.sourcing_price.toFixed(2);
      
      return `
        <div class="product">
          <div class="product-title">${opportunity.title}</div>
          <div class="product-details">
            <p><strong>ASIN:</strong> ${opportunity.asin}</p>
            <p class="profit">Profit: $${formattedProfit} (${formattedMargin}% margin)</p>
            <p><strong>Amazon Price:</strong> $${formattedAmazonPrice}</p>
            <p><strong>Source Price:</strong> $${formattedSourcingPrice}</p>
            <p><strong>Source Website:</strong> ${opportunity.website_url}</p>
          </div>
          
          <a href="${opportunity.product_url}" class="button" target="_blank">View on Source Website</a>
          <a href="${amazonUrl}" class="button" target="_blank">View on Amazon</a>
        </div>
      `;
    }).join('');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Summary: Profitable Opportunities</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #232f3e;
            color: #fff;
            padding: 20px;
            text-align: center;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .product {
            margin-bottom: 20px;
            border: 1px solid #ddd;
            padding: 15px;
            background-color: #fff;
          }
          .product-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .product-details {
            margin-bottom: 15px;
          }
          .profit {
            color: #067D62;
            font-weight: bold;
          }
          .button {
            display: inline-block;
            padding: 8px 12px;
            background-color: #FF9900;
            color: #fff;
            text-decoration: none;
            border-radius: 4px;
            margin-right: 10px;
            font-size: 12px;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #777;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Daily Summary: Profitable Opportunities</h1>
          </div>
          <div class="content">
            <p>Here are today's top profitable arbitrage opportunities:</p>
            
            ${opportunitiesHtml}
            
            <p>Log in to your Amazon Arbitrage dashboard to see more opportunities and details.</p>
          </div>
          <div class="footer">
            <p>This email was sent by your Amazon Arbitrage tool. You received this daily summary because you have enabled summary reports in your settings.</p
(Content truncated due to size limit. Use line ranges to read in chunks)