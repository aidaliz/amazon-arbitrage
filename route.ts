import { AppService } from '../services/app-service';
import { D1Database } from '@cloudflare/workers-types';

/**
 * API route handler for processing scheduled jobs
 * This endpoint is called by Cloudflare Cron Triggers
 */
export async function POST(request: Request) {
  try {
    // Get the database from the environment
    const db = (request as any).env.DB as D1Database;
    
    // Create app service
    const appService = new AppService(db);
    
    // Initialize app
    await appService.initialize();
    
    // Process scheduled jobs
    const jobsResult = await appService.processScheduledJobs();
    
    // Run monitoring cycle
    const monitoringResult = await appService.runMonitoringCycle();
    
    // Calculate profitability
    const profitabilityResult = await appService.calculateProfitability();
    
    // Send alerts for profitable opportunities
    const alertsResult = await appService.sendProfitableOpportunityAlerts();
    
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      jobs: jobsResult,
      monitoring: monitoringResult,
      profitability: profitabilityResult,
      alerts: alertsResult
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error processing scheduled tasks:', error);
    
    // Return error response
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
