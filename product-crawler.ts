import { PlaywrightCrawler, Dataset, createPlaywrightRouter } from 'crawlee';
import { D1Database } from '@cloudflare/workers-types';
import { CRAWLER_CONFIG, SEARCH_TEMPLATES, SITE_SELECTORS } from './crawler-config';

/**
 * Main crawler class for finding matching products on other websites
 */
export class ProductCrawler {
  private db: D1Database;
  private crawler: PlaywrightCrawler;
  
  constructor(db: D1Database) {
    this.db = db;
    
    // Create a router for handling different types of pages
    const router = createPlaywrightRouter();
    
    // Handle search engine result pages
    router.addHandler('SEARCH', this.handleSearchPage.bind(this));
    
    // Handle product pages
    router.addHandler('PRODUCT', this.handleProductPage.bind(this));
    
    // Create the crawler with configuration
    this.crawler = new PlaywrightCrawler({
      requestHandler: router,
      maxRequestsPerCrawl: CRAWLER_CONFIG.maxRequestsPerCrawl,
      maxConcurrency: CRAWLER_CONFIG.maxConcurrency,
      requestHandlerTimeoutSecs: Math.floor(CRAWLER_CONFIG.requestTimeout / 1000),
      navigationTimeoutSecs: Math.floor(CRAWLER_CONFIG.navigationTimeout / 1000),
      headless: true,
      useChrome: false,
      preNavigationHooks: [
        async ({ page, request }) => {
          // Set user agent and other headers
          await page.setExtraHTTPHeaders(CRAWLER_CONFIG.defaultHeaders);
        }
      ]
    });
  }
  
  /**
   * Start crawling for a specific product
   * @param productId - Database ID of the product
   * @param asin - Amazon ASIN
   * @param upc - Universal Product Code (optional)
   * @param title - Product title
   */
  async crawlForProduct(productId: number, asin: string, upc: string | null, title: string): Promise<void> {
    console.log(`Starting crawl for product: ${asin} - ${title}`);
    
    // Clear previous requests
    await this.crawler.requestQueue.clear();
    
    // Generate search terms based on available product information
    const searchTerms = this.generateSearchTerms(asin, upc, title);
    
    // Add search engine requests to the queue
    for (const searchTerm of searchTerms) {
      for (const engine of CRAWLER_CONFIG.searchEngines) {
        const searchUrl = engine.searchUrlTemplate.replace('{searchTerm}', encodeURIComponent(searchTerm));
        
        await this.crawler.requestQueue.addRequest({
          url: searchUrl,
          userData: {
            label: 'SEARCH',
            productId,
            asin,
            upc,
            title,
            searchTerm
          }
        });
      }
    }
    
    // Run the crawler
    await this.crawler.run();
    
    // Process and store the results
    await this.processResults(productId);
  }
  
  /**
   * Generate search terms for finding the product
   */
  private generateSearchTerms(asin: string, upc: string | null, title: string): string[] {
    const searchTerms = [];
    
    // If UPC is available, use it for precise matching
    if (upc) {
      searchTerms.push(SEARCH_TEMPLATES.upcSearch.replace('{upc}', upc));
      searchTerms.push(SEARCH_TEMPLATES.combinedSearch
        .replace('{upc}', upc)
        .replace('{title}', this.getShortTitle(title)));
    }
    
    // Always include ASIN-based search
    searchTerms.push(SEARCH_TEMPLATES.asinSearch.replace('{asin}', asin));
    
    // Include title-based search
    searchTerms.push(SEARCH_TEMPLATES.titleSearch.replace('{title}', title));
    
    return searchTerms;
  }
  
  /**
   * Extract a shorter version of the title for search queries
   */
  private getShortTitle(title: string): string {
    // Remove common filler words and limit to first 5-7 words
    const words = title
      .replace(/[^\w\s]/gi, ' ')
      .split(/\s+/)
      .filter(word => !['the', 'a', 'an', 'and', 'or', 'for', 'with', 'by', 'in', 'on', 'at'].includes(word.toLowerCase()));
    
    return words.slice(0, 6).join(' ');
  }
  
  /**
   * Handle search engine result pages
   */
  private async handleSearchPage({ request, page, enqueueLinks, log }) {
    const { productId, asin, upc, title } = request.userData;
    log.info(`Processing search results for ${asin} - ${title}`);
    
    // Extract all links from the search results
    const links = await enqueueLinks({
      globs: CRAWLER_CONFIG.targetSites.map(site => `**${site}**`),
      label: 'PRODUCT',
      transformRequestFunction: (req) => {
        // Add product information to the request
        req.userData = {
          ...req.userData,
          label: 'PRODUCT',
          productId,
          asin,
          upc,
          title
        };
        return req;
      }
    });
    
    log.info(`Enqueued ${links.processedRequests.length} product links from search results`);
  }
  
  /**
   * Handle product pages
   */
  private async handleProductPage({ request, page, log }) {
    const { productId, asin, upc, title } = request.userData;
    const url = request.loadedUrl || request.url;
    
    log.info(`Processing product page: ${url}`);
    
    try {
      // Determine which site we're on to use the appropriate selectors
      const site = this.determineSite(url);
      const selectors = SITE_SELECTORS[site] || SITE_SELECTORS.default;
      
      // Extract product information
      const extractedData = await this.extractProductData(page, selectors);
      
      // Store the extracted data
      await Dataset.pushData({
        url,
        productId,
        asin,
        site,
        ...extractedData,
        timestamp: new Date().toISOString()
      });
      
      log.info(`Successfully extracted data from ${url}`);
    } catch (error) {
      log.error(`Failed to extract data from ${url}: ${error.message}`);
    }
  }
  
  /**
   * Determine which e-commerce site the URL belongs to
   */
  private determineSite(url: string): string {
    for (const site of CRAWLER_CONFIG.targetSites) {
      if (url.includes(site)) {
        return site;
      }
    }
    return 'default';
  }
  
  /**
   * Extract product data from the page using the provided selectors
   */
  private async extractProductData(page, selectors) {
    // Helper function to safely extract text content
    const extractText = async (selector) => {
      try {
        const element = await page.$(selector);
        if (element) {
          return await element.textContent() || '';
        }
      } catch (e) {
        // Ignore errors
      }
      return '';
    };
    
    // Helper function to safely extract attribute
    const extractAttribute = async (selector, attribute) => {
      try {
        const element = await page.$(selector);
        if (element) {
          return await element.getAttribute(attribute) || '';
        }
      } catch (e) {
        // Ignore errors
      }
      return '';
    };
    
    // Extract product details
    const productTitle = await extractText(selectors.title);
    const priceText = await extractText(selectors.price);
    const stockStatus = await extractText(selectors.stock);
    const imageUrl = await extractAttribute(selectors.image, 'src');
    const color = await extractText(selectors.color);
    const size = await extractText(selectors.size);
    
    // Parse price from text
    const price = this.extractPrice(priceText);
    
    return {
      title: productTitle.trim(),
      price,
      priceText: priceText.trim(),
      stockStatus: stockStatus.trim(),
      imageUrl,
      color: color.trim(),
      size: size.trim(),
      inStock: this.determineStockStatus(stockStatus)
    };
  }
  
  /**
   * Extract numeric price from price text
   */
  private extractPrice(priceText: string): number | null {
    if (!priceText) return null;
    
    // Remove currency symbols and non-numeric characters except decimal point
    const cleaned = priceText.replace(/[^\d.]/g, '');
    const matches = cleaned.match(/\d+(\.\d+)?/);
    
    if (matches && matches[0]) {
      return parseFloat(matches[0]);
    }
    
    return null;
  }
  
  /**
   * Determine if the product is in stock based on the stock status text
   */
  private determineStockStatus(stockText: string): boolean {
    if (!stockText) return false;
    
    const lowerText = stockText.toLowerCase();
    
    // Check for out of stock indicators
    const outOfStockPhrases = [
      'out of stock',
      'sold out',
      'unavailable',
      'not available',
      'no longer available',
      'out-of-stock',
      'currently unavailable'
    ];
    
    for (const phrase of outOfStockPhrases) {
      if (lowerText.includes(phrase)) {
        return false;
      }
    }
    
    // Check for in stock indicators
    const inStockPhrases = [
      'in stock',
      'available',
      'add to cart',
      'buy now',
      'in-stock',
      'ships'
    ];
    
    for (const phrase of inStockPhrases) {
      if (lowerText.includes(phrase)) {
        return true;
      }
    }
    
    // Default to false if we can't determine
    return false;
  }
  
  /**
   * Process and store the crawling results in the database
   */
  private async processResults(productId: number): Promise<void> {
    // Get all collected data
    const dataset = await Dataset.getData();
    
    for (const item of dataset.items) {
      try {
        // Skip items without price
        if (!item.price) continue;
        
        // Insert into websites table
        await this.db
          .prepare(`
            INSERT INTO websites 
            (product_id, website_url, product_url, price, stock_status, color, size, last_checked, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `)
          .bind(
            productId,
            item.site,
            item.url,
            item.price,
            item.stockStatus,
            item.color,
            item.size
          )
          .run();
        
        // Get the inserted website ID
        const result = await this.db
          .prepare('SELECT last_insert_rowid() as id')
          .first();
        
        if (result && result.id) {
          // Insert into price history
          await this.db
            .prepare(`
              INSERT INTO price_history 
              (website_id, price, stock_status, recorded_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `)
            .bind(
              result.id,
              item.price,
              item.stockStatus
            )
            .run();
        }
      } catch (error) {
        console.error(`Error storing result for ${item.url}:`, error);
      }
    }
    
    // Clear the dataset for the next crawl
    await Dataset.clear();
  }
}
