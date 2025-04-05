/**
 * Configuration for the web crawler
 * This file contains settings and options for the crawler module
 */

export const CRAWLER_CONFIG = {
  // Maximum number of requests per crawl session
  maxRequestsPerCrawl: 100,
  
  // Maximum concurrent requests
  maxConcurrency: 10,
  
  // Request timeout in milliseconds
  requestTimeout: 30000,
  
  // Navigation timeout in milliseconds (for browser-based crawling)
  navigationTimeout: 60000,
  
  // Default headers to use for requests
  defaultHeaders: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  
  // List of popular e-commerce sites to check for products
  targetSites: [
    'walmart.com',
    'target.com',
    'bestbuy.com',
    'ebay.com',
    'homedepot.com',
    'lowes.com',
    'wayfair.com',
    'overstock.com',
    'newegg.com',
    'bhphotovideo.com',
    'officedepot.com',
    'staples.com',
    'macys.com',
    'kohls.com',
    'costco.com'
  ],
  
  // Search engines to use for finding product matches
  searchEngines: [
    {
      name: 'Google',
      searchUrlTemplate: 'https://www.google.com/search?q={searchTerm}'
    },
    {
      name: 'Bing',
      searchUrlTemplate: 'https://www.bing.com/search?q={searchTerm}'
    }
  ],
  
  // Retry options for failed requests
  retryOptions: {
    maxRetries: 3,
    minDelayBetweenRetriesMillis: 2000,
    maxDelayBetweenRetriesMillis: 10000
  },
  
  // Proxy configuration (if needed)
  proxyConfiguration: {
    useProxies: false,
    proxyUrls: []
  }
};

// Search term templates for different matching strategies
export const SEARCH_TEMPLATES = {
  // Search by UPC code
  upcSearch: '{upc}',
  
  // Search by ASIN
  asinSearch: '{asin} amazon product',
  
  // Search by product title
  titleSearch: '{title} buy online',
  
  // Search by UPC and title
  combinedSearch: '{upc} {title}'
};

// Selectors for extracting product information from common e-commerce sites
export const SITE_SELECTORS = {
  // Walmart selectors
  'walmart.com': {
    title: '[data-testid="product-title"]',
    price: '[data-testid="price-value"]',
    stock: '.prod-availability-status',
    image: '[data-testid="hero-image"]',
    color: '[data-testid="variant-attribute-Color"]',
    size: '[data-testid="variant-attribute-Size"]'
  },
  
  // Target selectors
  'target.com': {
    title: '[data-test="product-title"]',
    price: '[data-test="product-price"]',
    stock: '[data-test="availabilityMessage"]',
    image: '[data-test="product-image"]',
    color: '[data-test="variationColorName"]',
    size: '[data-test="variationSizeName"]'
  },
  
  // Best Buy selectors
  'bestbuy.com': {
    title: '.heading-5',
    price: '.priceView-customer-price span',
    stock: '.fulfillment-add-to-cart-button button',
    image: '.primary-image',
    color: '.variation-item-color',
    size: '.variation-item-size'
  },
  
  // Default selectors (fallback for unknown sites)
  'default': {
    title: 'h1',
    price: '.price, [class*="price"], [id*="price"]',
    stock: '[class*="stock"], [class*="availability"], [class*="inventory"]',
    image: 'img[src*="product"], .product-image img, .main-image img',
    color: '[class*="color"], [id*="color"]',
    size: '[class*="size"], [id*="size"]'
  }
};
