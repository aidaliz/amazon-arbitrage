# Amazon Arbitrage Web Application - Deployment Guide

## Overview

This guide provides instructions for deploying the Amazon Arbitrage web application to Cloudflare Pages or Vercel. The application is built with Next.js and uses Cloudflare D1 for database storage.

## Prerequisites

Before deploying, you'll need:

1. A Cloudflare account or Vercel account
2. Amazon Selling Partner API credentials
3. SendGrid API key for email notifications

## Deployment Options

### Option 1: Cloudflare Pages (Recommended)

1. **Create a Cloudflare Pages project**:
   - Log in to your Cloudflare dashboard
   - Navigate to Pages > Create a project
   - Connect your GitHub/GitLab account or upload the source files directly

2. **Configure build settings**:
   - Build command: `npm run build`
   - Build output directory: `.next`
   - Node.js version: 18.x or higher

3. **Set up environment variables**:
   - `SELLING_PARTNER_APP_CLIENT_ID`: Your Amazon SP API Client ID
   - `SELLING_PARTNER_APP_CLIENT_SECRET`: Your Amazon SP API Client Secret
   - `SENDGRID_API_KEY`: Your SendGrid API key

4. **Create D1 database**:
   - In Cloudflare dashboard, go to Workers & Pages > D1
   - Create a new database named `amazon_arbitrage_db`
   - Note the database ID

5. **Update wrangler.toml**:
   - Replace the `database_id` in wrangler.toml with your actual database ID

6. **Deploy database migrations**:
   - Install Wrangler CLI: `npm install -g wrangler`
   - Login to Cloudflare: `wrangler login`
   - Apply migrations: `wrangler d1 execute amazon_arbitrage_db --file=migrations/0001_initial.sql`

7. **Configure scheduled tasks**:
   - In Cloudflare dashboard, go to Workers & Pages > your project
   - Navigate to Settings > Functions > Cron Triggers
   - Add a cron trigger: `0 */6 * * *` (runs every 6 hours)
   - Set the route to `/api/cron`

### Option 2: Vercel

1. **Create a Vercel project**:
   - Log in to your Vercel dashboard
   - Create a new project and import your repository or upload files

2. **Configure build settings**:
   - Framework preset: Next.js
   - Build command: `npm run build`
   - Output directory: `.next`

3. **Set up environment variables**:
   - `SELLING_PARTNER_APP_CLIENT_ID`: Your Amazon SP API Client ID
   - `SELLING_PARTNER_APP_CLIENT_SECRET`: Your Amazon SP API Client Secret
   - `SENDGRID_API_KEY`: Your SendGrid API key

4. **Database setup**:
   - For Vercel deployment, you'll need to use a different database solution
   - Options include Vercel Postgres, Supabase, or PlanetScale
   - Update database connection code accordingly

5. **Configure scheduled tasks**:
   - Use Vercel Cron Jobs feature
   - Add a cron job with schedule: `0 */6 * * *`
   - Set the path to `/api/cron`

## Post-Deployment Steps

After deploying the application:

1. **Access the application**:
   - Open the deployed URL in your browser
   - Navigate to the dashboard

2. **Configure API credentials**:
   - Go to Settings > API Credentials
   - Enter your Amazon SP API credentials
   - Enter your SendGrid API key

3. **Test the application**:
   - Upload a test CSV file with a few ASINs
   - Verify that the system processes the ASINs correctly
   - Check that email notifications are working

## Troubleshooting

If you encounter issues during deployment:

1. **Database connection errors**:
   - Verify that your database is properly configured
   - Check that migrations have been applied correctly

2. **API credential issues**:
   - Ensure your Amazon SP API credentials are valid
   - Verify that your refresh token has the correct permissions

3. **Email notification problems**:
   - Check that your SendGrid API key is valid
   - Verify that the recipient email address is correct

For additional assistance, refer to the documentation for your chosen deployment platform.
