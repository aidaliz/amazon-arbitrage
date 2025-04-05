# Amazon Arbitrage Web Application - User Guide

## Overview

This web application helps Amazon Marketplace resellers find profitable online arbitrage opportunities. The system:

1. Accepts a CSV file with ASINs from Keepa's Product Finder
2. Crawls the web to find the same products on other sites
3. Scrapes product details (title, image, price, stock, color, size)
4. Calculates margin and ROI using Amazon's SP API
5. Stores data in a database and monitors daily changes
6. Sends email alerts when profitable products are found (15% margin, $5+ profit)

## Getting Started

### Accessing the Application

The application is deployed at: https://amazon-arbitrage.yourdomain.com

### Initial Setup

1. **Amazon SP API Credentials**:
   - You'll need to provide your Amazon Selling Partner API credentials
   - Go to Settings > API Credentials
   - Enter your Client ID, Client Secret, and Refresh Token

2. **Email Alert Settings**:
   - The system is configured to send alerts to: aidalizmaldonadoperez@gmail.com
   - You can adjust alert preferences in Settings > Notifications

## Using the Application

### Uploading ASINs

1. Go to the Dashboard
2. Use the upload form to select your CSV file from Keepa
3. The CSV should contain at minimum an ASIN column
4. Optional columns: UPC, Title
5. Click "Upload and Process"

### Viewing Opportunities

1. After uploading, the system will begin processing your ASINs
2. Initial results will appear within minutes
3. Complete processing may take several hours depending on the number of ASINs
4. Profitable opportunities will be displayed in the Dashboard
5. You'll receive email alerts for highly profitable items

### Monitoring and Updates

- The system automatically checks for price and stock changes every 6 hours
- You'll receive alerts when previously unprofitable items become profitable
- Daily summary emails provide an overview of all opportunities

## Profitability Criteria

The system identifies profitable opportunities based on:
- Minimum profit margin: 15%
- Minimum profit amount: $5 per unit

These thresholds can be adjusted in Settings > Profitability Criteria.

## Troubleshooting

If you encounter any issues:
1. Check the System Status panel on the Dashboard
2. Ensure your Amazon SP API credentials are valid
3. Verify your CSV format matches the expected structure

## Support

For additional assistance, please contact support at support@amazon-arbitrage.com
