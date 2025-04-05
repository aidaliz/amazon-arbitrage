-- Migration number: 0001        2025-04-05T04:27:47.000Z
-- Amazon Arbitrage Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS alert_settings;
DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS websites;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS counters;
DROP TABLE IF EXISTS access_logs;

-- Create Products Table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asin TEXT NOT NULL UNIQUE,
  upc TEXT,
  title TEXT NOT NULL,
  image_url TEXT,
  amazon_price REAL,
  amazon_fees REAL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Websites Table
CREATE TABLE IF NOT EXISTS websites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  website_url TEXT NOT NULL,
  product_url TEXT NOT NULL,
  price REAL NOT NULL,
  stock_status TEXT,
  color TEXT,
  size TEXT,
  last_checked DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Create Price History Table
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id INTEGER NOT NULL,
  price REAL NOT NULL,
  stock_status TEXT,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
);

-- Create Alert Settings Table
CREATE TABLE IF NOT EXISTS alert_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  min_margin_percent REAL NOT NULL DEFAULT 15.0,
  min_profit_amount REAL NOT NULL DEFAULT 5.0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create system tables
CREATE TABLE IF NOT EXISTS counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT,
  path TEXT,
  accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Initial data
INSERT INTO counters (name, value) VALUES 
  ('page_views', 0),
  ('api_calls', 0),
  ('uploads_processed', 0);

-- Initial alert settings
INSERT INTO alert_settings (email, min_margin_percent, min_profit_amount) VALUES
  ('aidalizmaldonadoperez@gmail.com', 15.0, 5.0);

-- Create indexes
CREATE INDEX idx_products_asin ON products(asin);
CREATE INDEX idx_products_upc ON products(upc);
CREATE INDEX idx_websites_product_id ON websites(product_id);
CREATE INDEX idx_price_history_website_id ON price_history(website_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX idx_access_logs_accessed_at ON access_logs(accessed_at);
CREATE INDEX idx_counters_name ON counters(name);
