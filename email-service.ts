import { D1Database } from '@cloudflare/workers-types';
import * as sgMail from '@sendgrid/mail';
import { ALERT_CONFIG } from './alert-config';

/**
 * Service class for sending email alerts
 */
export class EmailService {
  private db: D1Database;
  private apiKey: string | null = null;
  
  constructor(db: D1Database) {
    this.db = db;
  }
  
  /**
   * Initialize the email service
   */
  async initialize(): Promise<void> {
    try {
      // Get SendGrid API key from database
      const settings = await this.db
        .prepare('SELECT value FROM app_settings WHERE key = ?')
        .bind('sendgrid_api_key')
        .first();
      
      if (settings && settings.value) {
        this.apiKey = settings.value;
        sgMail.setApiKey(this.apiKey);
      } else {
        console.warn('SendGrid API key not found in database');
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }
  
  /**
   * Store SendGrid API key in the database
   * @param apiKey - SendGrid API key
   */
  async storeApiKey(apiKey: string): Promise<void> {
    try {
      // Check if app_settings table exists
      const tableExists = await this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'")
        .first();
      
      if (!tableExists) {
        // Create app_settings table
        await this.db.exec(`
          CREATE TABLE app_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX idx_app_settings_key ON app_settings(key);
        `);
      }
      
      // Check if API key already exists
      const existingKey = await this.db
        .prepare('SELECT id FROM app_settings WHERE key = ?')
        .bind('sendgrid_api_key')
        .first();
      
      if (existingKey) {
        // Update existing API key
        await this.db
          .prepare('UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
          .bind(apiKey, 'sendgrid_api_key')
          .run();
      } else {
        // Insert new API key
        await this.db
          .prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)')
          .bind('sendgrid_api_key', apiKey)
          .run();
      }
      
      // Update local API key
      this.apiKey = apiKey;
      sgMail.setApiKey(this.apiKey);
      
      console.log('SendGrid API key stored successfully');
    } catch (error) {
      console.error('Failed to store SendGrid API key:', error);
      throw error;
    }
  }
  
  /**
   * Send an email
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param html - Email HTML content
   * @param text - Email plain text content
   */
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    try {
      if (!this.apiKey) {
        await this.initialize();
        
        if (!this.apiKey) {
          throw new Error('SendGrid API key not configured');
        }
      }
      
      const msg = {
        to,
        from: {
          email: ALERT_CONFIG.email.fromEmail,
          name: ALERT_CONFIG.email.fromName
        },
        subject,
        text: text || html.replace(/<[^>]*>/g, ''),
        html
      };
      
      await sgMail.send(msg);
      
      // Record email in alert_history
      await this.recordEmailAlert(to, subject);
      
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }
  
  /**
   * Record email alert in the database
   * @param recipient - Recipient email address
   * @param subject - Email subject
   */
  private async recordEmailAlert(recipient: string, subject: string): Promise<void> {
    try {
      // Check if alert_history table exists
      const tableExists = await this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='alert_history'")
        .first();
      
      if (!tableExists) {
        // Create alert_history table
        await this.db.exec(`
          CREATE TABLE alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX idx_alert_history_recipient ON alert_history(recipient);
          CREATE INDEX idx_alert_history_created_at ON alert_history(created_at);
        `);
      }
      
      // Insert alert record
      await this.db
        .prepare('INSERT INTO alert_history (recipient, subject) VALUES (?, ?)')
        .bind(recipient, subject)
        .run();
    } catch (error) {
      console.error('Failed to record email alert:', error);
      // Don't throw error here, as this is a non-critical operation
    }
  }
  
  /**
   * Check if an alert was recently sent for a product
   * @param productId - Database ID of the product
   * @param hours - Number of hours to look back
   */
  async wasAlertRecentlySent(productId: number, hours: number = ALERT_CONFIG.frequency.minTimeBetweenAlerts): Promise<boolean> {
    try {
      // Check if product_alerts table exists
      const tableExists = await this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_alerts'")
        .first();
      
      if (!tableExists) {
        // Create product_alerts table
        await this.db.exec(`
          CREATE TABLE product_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            alert_type TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          );
          
          CREATE INDEX idx_product_alerts_product_id ON product_alerts(product_id);
          CREATE INDEX idx_product_alerts_created_at ON product_alerts(created_at);
        `);
        
        // No alerts have been sent yet
        return false;
      }
      
      // Check for recent alerts
      const recentAlert = await this.db
        .prepare(`
          SELECT id FROM product_alerts
          WHERE product_id = ? AND datetime(created_at) > datetime('now', '-' || ? || ' hours')
          LIMIT 1
        `)
        .bind(productId, hours)
        .first();
      
      return !!recentAlert;
    } catch (error) {
      console.error('Failed to check for recent alerts:', error);
      // In case of error, assume no recent alerts
      return false;
    }
  }
  
  /**
   * Record that an alert was sent for a product
   * @param productId - Database ID of the product
   * @param alertType - Type of alert
   */
  async recordProductAlert(productId: number, alertType: string): Promise<void> {
    try {
      // Check if product_alerts table exists
      const tableExists = await this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_alerts'")
        .first();
      
      if (!tableExists) {
        // Create product_alerts table
        await this.db.exec(`
          CREATE TABLE product_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            alert_type TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          );
          
          CREATE INDEX idx_product_alerts_product_id ON product_alerts(product_id);
          CREATE INDEX idx_product_alerts_created_at ON product_alerts(created_at);
        `);
      }
      
      // Insert alert record
      await this.db
        .prepare('INSERT INTO product_alerts (product_id, alert_type) VALUES (?, ?)')
        .bind(productId, alertType)
        .run();
    } catch (error) {
      console.error('Failed to record product alert:', error);
      // Don't throw error here, as this is a non-critical operation
    }
  }
}
