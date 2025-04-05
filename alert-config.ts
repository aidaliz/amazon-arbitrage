/**
 * Configuration for the email alert system
 * This file contains settings and options for the alerts module
 */

export const ALERT_CONFIG = {
  // Default email settings
  email: {
    // Default sender email address
    fromEmail: 'alerts@amazon-arbitrage.com',
    
    // Default sender name
    fromName: 'Amazon Arbitrage Alerts',
    
    // Default recipient email
    defaultRecipient: 'aidalizmaldonadoperez@gmail.com',
    
    // Email subject prefixes
    subjectPrefixes: {
      opportunity: '💰 Profitable Opportunity Found',
      priceChange: '📉 Price Drop Alert',
      stockChange: '📦 Stock Status Change',
      summary: '📊 Daily Summary Report'
    }
  },
  
  // Alert thresholds (should match monitoring config)
  thresholds: {
    minMarginPercent: 15.0, // Minimum profit margin percentage
    minProfitAmount: 5.0    // Minimum profit amount in dollars
  },
  
  // Alert frequency settings
  frequency: {
    // Whether to send immediate alerts for profitable opportunities
    immediateAlerts: true,
    
    // Whether to send daily summary reports
    dailySummary: true,
    
    // Maximum number of opportunities to include in a single email
    maxOpportunitiesPerEmail: 10,
    
    // Minimum time between alerts for the same product (in hours)
    minTimeBetweenAlerts: 24
  },
  
  // Alert types to enable
  enabledAlerts: {
    profitableOpportunities: true,
    priceDrops: true,
    backInStock: true,
    dailySummary: true
  }
};
