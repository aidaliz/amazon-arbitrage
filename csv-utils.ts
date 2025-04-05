// This file contains utility functions for CSV parsing and validation

import { parse } from 'csv-parse/sync';

/**
 * Parse CSV content into records
 * @param csvContent - Raw CSV content as string
 * @returns Parsed records as array of objects
 */
export function parseCSV(csvContent: string) {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return { success: true, records };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to parse CSV' 
    };
  }
}

/**
 * Validate CSV content structure
 * @param records - Parsed CSV records
 * @returns Validation result with status and message
 */
export function validateCSV(records: any[]) {
  // Check if file is empty
  if (!records || records.length === 0) {
    return { 
      valid: false, 
      message: 'CSV file is empty' 
    };
  }

  // Check for required ASIN column (case insensitive)
  const firstRow = records[0];
  const headers = Object.keys(firstRow).map(h => h.toLowerCase());
  
  if (!headers.includes('asin')) {
    return { 
      valid: false, 
      message: 'CSV file must contain an ASIN column' 
    };
  }

  // Check if all rows have ASIN values
  const missingAsinRows = records.filter(row => {
    const asin = row.ASIN || row.asin;
    return !asin || asin.trim() === '';
  });

  if (missingAsinRows.length > 0) {
    return {
      valid: false,
      message: `${missingAsinRows.length} row(s) are missing ASIN values`
    };
  }

  return { valid: true };
}

/**
 * Normalize CSV records to ensure consistent property names
 * @param records - Parsed CSV records
 * @returns Normalized records with consistent property names
 */
export function normalizeCSVRecords(records: any[]) {
  return records.map(record => {
    const normalizedRecord: Record<string, any> = {};
    
    // Normalize known fields
    normalizedRecord.asin = record.ASIN || record.asin || '';
    normalizedRecord.upc = record.UPC || record.upc || null;
    normalizedRecord.title = record.Title || record.title || `Product ${normalizedRecord.asin}`;
    
    // Copy any other fields that might be present
    Object.keys(record).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (!['asin', 'upc', 'title'].includes(lowerKey)) {
        normalizedRecord[lowerKey] = record[key];
      }
    });
    
    return normalizedRecord;
  });
}
