/**
 * Configuration for the Amazon SP API integration
 * This file contains settings and options for the SP API module
 */

export const SP_API_CONFIG = {
  // Default region for SP API calls
  region: 'na', // 'na' for North America, 'eu' for Europe, 'fe' for Far East
  
  // Default marketplace ID for US
  defaultMarketplaceId: 'ATVPDKIKX0DER', // US marketplace
  
  // Marketplace IDs by country
  marketplaceIds: {
    US: 'ATVPDKIKX0DER',
    CA: 'A2EUQ1WTGCTBG2',
    MX: 'A1AM78C64UM0Y8',
    UK: 'A1F83G8C2ARO7P',
    DE: 'A1PA6795UKMFR9',
    FR: 'A13V1IB3VIYZZH',
    IT: 'APJ6JRA9NG5V4',
    ES: 'A1RKKUPIHCS9HS',
    JP: 'A1VC38T7YXB528',
    AU: 'A39IBJ37TRP1C6'
  },
  
  // SP API options
  options: {
    auto_request_tokens: true,
    auto_request_throttled: true,
    version_fallback: true,
    use_sandbox: false,
    debug_log: false
  },
  
  // Fee calculation defaults
  feeDefaults: {
    // Default referral fee percentage by category
    referralFeePercentage: {
      default: 0.15, // 15% for most categories
      Books: 0.15,
      Electronics: 0.08,
      Computers: 0.06,
      HomeAndKitchen: 0.15,
      Beauty: 0.15,
      Toys: 0.15,
      Clothing: 0.17,
      Jewelry: 0.20,
      Grocery: 0.08
    },
    
    // Default FBA fees by product size tier
    fbaFees: {
      smallStandardSize: 3.22, // Small standard-size
      largeStandardSize: 4.99, // Large standard-size
      smallOversize: 9.66,     // Small oversize
      mediumOversize: 16.09,   // Medium oversize
      largeOversize: 89.98,    // Large oversize
      specialOversize: 158.49  // Special oversize
    },
    
    // Default variable closing fee by category
    variableClosingFee: {
      Books: 1.80,
      DVD: 1.80,
      Music: 1.80,
      Software: 1.80,
      VideoGames: 1.80,
      ConsoleVideoGames: 1.80,
      default: 0.00
    }
  },
  
  // Profitability thresholds
  profitabilityThresholds: {
    minMarginPercent: 15.0, // Minimum profit margin percentage
    minProfitAmount: 5.0    // Minimum profit amount in dollars
  }
};

// Endpoints and operations needed for pricing calculations
export const PRICING_ENDPOINTS = {
  // Product pricing endpoint
  productPricing: {
    endpoint: 'productPricing',
    version: '2022-05-01',
    operations: [
      'getCompetitivePricing',
      'getListingOffers',
      'getItemOffers',
      'getPricing'
    ]
  },
  
  // Product fees endpoint
  productFees: {
    endpoint: 'productFees',
    version: '2022-05-01',
    operations: [
      'getMyFeesEstimate'
    ]
  },
  
  // Catalog items endpoint
  catalogItems: {
    endpoint: 'catalogItems',
    version: '2022-04-01',
    operations: [
      'getCatalogItem'
    ]
  }
};

// Sample fee request template
export const FEE_REQUEST_TEMPLATE = {
  FeesEstimateRequest: {
    MarketplaceId: 'ATVPDKIKX0DER',
    PriceToEstimateFees: {
      ListingPrice: {
        CurrencyCode: 'USD',
        Amount: 0 // Will be replaced with actual price
      },
      Shipping: {
        CurrencyCode: 'USD',
        Amount: 0
      },
      Points: {
        PointsNumber: 0,
        PointsMonetaryValue: {
          CurrencyCode: 'USD',
          Amount: 0
        }
      }
    },
    Identifier: 'request_1',
    IsAmazonFulfilled: true,
    PriceToEstimateFees: {
      ListingPrice: {
        CurrencyCode: 'USD',
        Amount: 0 // Will be replaced with actual price
      }
    }
  }
};
