/**
 * Configuration for the monitoring system
 * This file contains settings and options for the monitoring module
 */

export const MONITORING_CONFIG = {
  // Default monitoring schedule (in hours)
  defaultSchedule: 24, // Check once per day
  
  // Monitoring intervals for different priority levels
  monitoringIntervals: {
    high: 6,     // Check every 6 hours for high priority items
    medium: 12,  // Check every 12 hours for medium priority items
    low: 24      // Check every 24 hours for low priority items
  },
  
  // Maximum number of items to process in a single monitoring run
  batchSize: 100,
  
  // Thresholds for price change detection
  priceChangeThresholds: {
    // Minimum absolute price change to trigger an alert (in dollars)
    minAbsoluteChange: 1.00,
    
    // Minimum percentage price change to trigger an alert
    minPercentageChange: 5.0
  },
  
  // Profitability thresholds (should match SP API config)
  profitabilityThresholds: {
    minMarginPercent: 15.0, // Minimum profit margin percentage
    minProfitAmount: 5.0    // Minimum profit amount in dollars
  },
  
  // Stock status monitoring
  stockStatusMonitoring: {
    // Whether to monitor stock status changes
    enabled: true,
    
    // Whether to alert when an item comes back in stock
    alertOnBackInStock: true,
    
    // Whether to alert when an item goes out of stock
    alertOnOutOfStock: false
  },
  
  // Historical data retention (in days)
  dataRetention: {
    priceHistory: 90,  // Keep price history for 90 days
    alertHistory: 30   // Keep alert history for 30 days
  }
};
