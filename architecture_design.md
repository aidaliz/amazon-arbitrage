# Amazon Arbitrage Web Application - Architecture Design

## Overview
This web application will help Amazon Marketplace resellers identify profitable products by comparing prices across multiple websites. The application will accept a CSV file containing ASINs from Keepa's Product Finder, crawl the web to find matching products, calculate profitability, store the data, and send alerts for profitable opportunities.

## Core Requirements
1. Upload CSV file with ASINs from Keepa's Product Finder
2. Web crawling to find matching products on other websites
3. Web scraping to extract product details (title, image, price, stock, color, size)
4. Calculate margin and ROI using Amazon's SP API
5. Database storage and daily monitoring of price/stock changes
6. Email alerts for profitable products (15% margin, $5+ profit per unit)

## Technology Stack
- **Frontend**: Next.js with React and Tailwind CSS
- **Backend**: Next.js API routes with Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite-compatible database)
- **Deployment**: Cloudflare Pages
- **Scheduled Tasks**: Cloudflare Cron Triggers for daily monitoring
- **Email Service**: SendGrid for email notifications

## System Architecture

### Components
1. **Web Interface**
   - CSV Upload Form
   - Dashboard for viewing product opportunities
   - Settings page for alert preferences

2. **Data Processing Pipeline**
   - CSV Parser
   - Web Crawler/Scraper
   - Amazon SP API Integration
   - Profitability Calculator

3. **Database Layer**
   - Products Table
   - Websites Table
   - Price History Table
   - Alert Settings Table

4. **Monitoring System**
   - Daily Price/Stock Checker
   - Change Detector
   - Alert Generator

5. **Notification System**
   - Email Alert Service

### Data Flow
1. User uploads CSV with ASINs
2. System processes each ASIN:
   - Retrieves Amazon product details via SP API
   - Searches for matching products on other websites
   - Scrapes product details from found websites
   - Calculates potential profit margins
   - Stores all data in database
3. Daily monitoring process:
   - Checks for price/stock changes on previously found websites
   - Recalculates profitability
   - Generates alerts for profitable opportunities
4. Email notifications sent to user when profitable products are found

## Database Schema

### Products Table
- id (Primary Key)
- asin
- upc
- title
- image_url
- amazon_price
- amazon_fees
- created_at
- updated_at

### Websites Table
- id (Primary Key)
- product_id (Foreign Key)
- website_url
- product_url
- price
- stock_status
- color
- size
- last_checked
- created_at
- updated_at

### PriceHistory Table
- id (Primary Key)
- website_id (Foreign Key)
- price
- stock_status
- recorded_at

### AlertSettings Table
- id (Primary Key)
- email
- min_margin_percent
- min_profit_amount
- created_at
- updated_at

## API Endpoints

### User Interface Endpoints
- `GET /` - Main dashboard
- `GET /upload` - CSV upload page
- `GET /settings` - Alert settings page
- `GET /products` - View all products
- `GET /products/:id` - View specific product details

### API Endpoints
- `POST /api/upload` - Handle CSV upload
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get specific product
- `POST /api/settings` - Update alert settings
- `POST /api/crawl` - Manually trigger crawl for specific ASIN

## Scheduled Tasks
- Daily price monitoring (runs once per day)
- Database maintenance (runs weekly)

## Security Considerations
- Rate limiting for API endpoints
- Input validation for all user inputs
- Secure storage of Amazon SP API credentials
- CORS configuration for API endpoints

## Scalability Considerations
- Implement queue system for processing large CSV files
- Optimize database queries for performance
- Implement caching for frequently accessed data
- Use pagination for large data sets

## Implementation Phases
1. Setup Next.js application with basic UI
2. Implement CSV upload functionality
3. Develop web crawling and scraping module
4. Integrate Amazon SP API for pricing calculations
5. Create database schema and storage system
6. Implement daily monitoring system
7. Add email alert functionality
8. Deploy application to production
