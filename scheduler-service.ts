import { D1Database } from '@cloudflare/workers-types';
import { MonitoringService } from './monitoring-service';

/**
 * Service class for scheduling and managing monitoring jobs
 */
export class SchedulerService {
  private db: D1Database;
  private monitoringService: MonitoringService;
  
  constructor(db: D1Database) {
    this.db = db;
    this.monitoringService = new MonitoringService(db);
  }
  
  /**
   * Create the scheduler tables if they don't exist
   */
  async initializeSchedulerTables(): Promise<void> {
    try {
      // Check if scheduler_jobs table exists
      const tableExists = await this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduler_jobs'")
        .first();
      
      if (!tableExists) {
        // Create scheduler_jobs table
        await this.db.exec(`
          CREATE TABLE scheduler_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_type TEXT NOT NULL,
            status TEXT NOT NULL,
            scheduled_time DATETIME NOT NULL,
            last_run_time DATETIME,
            next_run_time DATETIME,
            interval_hours INTEGER NOT NULL,
            metadata TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX idx_scheduler_jobs_next_run_time ON scheduler_jobs(next_run_time);
          CREATE INDEX idx_scheduler_jobs_job_type ON scheduler_jobs(job_type);
        `);
        
        // Create scheduler_job_runs table
        await this.db.exec(`
          CREATE TABLE scheduler_job_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            result TEXT,
            error TEXT,
            FOREIGN KEY (job_id) REFERENCES scheduler_jobs(id) ON DELETE CASCADE
          );
          
          CREATE INDEX idx_scheduler_job_runs_job_id ON scheduler_job_runs(job_id);
        `);
        
        // Create default jobs
        await this.createDefaultJobs();
      }
    } catch (error) {
      console.error('Failed to initialize scheduler tables:', error);
      throw error;
    }
  }
  
  /**
   * Create default scheduled jobs
   */
  private async createDefaultJobs(): Promise<void> {
    try {
      // Create daily monitoring job
      await this.db
        .prepare(`
          INSERT INTO scheduler_jobs (
            job_type, status, scheduled_time, interval_hours, next_run_time
          ) VALUES (
            'monitoring_cycle', 'active', CURRENT_TIMESTAMP, 24, datetime('now', '+1 day')
          )
        `)
        .run();
      
      // Create weekly data cleanup job
      await this.db
        .prepare(`
          INSERT INTO scheduler_jobs (
            job_type, status, scheduled_time, interval_hours, next_run_time
          ) VALUES (
            'data_cleanup', 'active', CURRENT_TIMESTAMP, 168, datetime('now', '+7 day')
          )
        `)
        .run();
    } catch (error) {
      console.error('Failed to create default jobs:', error);
      throw error;
    }
  }
  
  /**
   * Get jobs that are due to run
   */
  async getDueJobs(): Promise<any[]> {
    try {
      const result = await this.db
        .prepare(`
          SELECT * FROM scheduler_jobs
          WHERE status = 'active' AND datetime(next_run_time) <= datetime('now')
          ORDER BY next_run_time ASC
        `)
        .all();
      
      return result.results || [];
    } catch (error) {
      console.error('Failed to get due jobs:', error);
      throw error;
    }
  }
  
  /**
   * Run a specific job
   * @param jobId - ID of the job to run
   */
  async runJob(jobId: number): Promise<any> {
    try {
      // Get job details
      const job = await this.db
        .prepare('SELECT * FROM scheduler_jobs WHERE id = ?')
        .bind(jobId)
        .first();
      
      if (!job) {
        throw new Error(`Job with ID ${jobId} not found`);
      }
      
      // Create job run record
      const runResult = await this.db
        .prepare(`
          INSERT INTO scheduler_job_runs (job_id, status, start_time)
          VALUES (?, 'running', CURRENT_TIMESTAMP)
          RETURNING id
        `)
        .bind(jobId)
        .first();
      
      const runId = runResult?.id;
      
      let result;
      let error;
      
      try {
        // Run the job based on job_type
        switch (job.job_type) {
          case 'monitoring_cycle':
            result = await this.monitoringService.runMonitoringCycle();
            break;
          case 'data_cleanup':
            result = await this.monitoringService.cleanupOldData();
            break;
          default:
            throw new Error(`Unknown job type: ${job.job_type}`);
        }
        
        // Update job run record with success
        await this.db
          .prepare(`
            UPDATE scheduler_job_runs
            SET status = 'completed', end_time = CURRENT_TIMESTAMP, result = ?
            WHERE id = ?
          `)
          .bind(JSON.stringify(result), runId)
          .run();
        
        // Update job with new next_run_time
        await this.db
          .prepare(`
            UPDATE scheduler_jobs
            SET 
              last_run_time = CURRENT_TIMESTAMP,
              next_run_time = datetime('now', '+' || ? || ' hours'),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(job.interval_hours, jobId)
          .run();
        
        return { success: true, result };
      } catch (e) {
        error = e;
        
        // Update job run record with failure
        await this.db
          .prepare(`
            UPDATE scheduler_job_runs
            SET status = 'failed', end_time = CURRENT_TIMESTAMP, error = ?
            WHERE id = ?
          `)
          .bind(e.message || 'Unknown error', runId)
          .run();
        
        // Update job with new next_run_time despite failure
        await this.db
          .prepare(`
            UPDATE scheduler_jobs
            SET 
              last_run_time = CURRENT_TIMESTAMP,
              next_run_time = datetime('now', '+' || ? || ' hours'),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(job.interval_hours, jobId)
          .run();
        
        return { success: false, error: e.message || 'Unknown error' };
      }
    } catch (error) {
      console.error(`Failed to run job ${jobId}:`, error);
      throw error;
    }
  }
  
  /**
   * Process all due jobs
   */
  async processAllDueJobs(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: any[];
  }> {
    try {
      const dueJobs = await this.getDueJobs();
      
      const results = [];
      let succeeded = 0;
      let failed = 0;
      
      for (const job of dueJobs) {
        try {
          const result = await this.runJob(job.id);
          results.push({
            jobId: job.id,
            jobType: job.job_type,
            success: result.success,
            result: result.result,
            error: result.error
          });
          
          if (result.success) {
            succeeded++;
          } else {
            failed++;
          }
        } catch (error) {
          results.push({
            jobId: job.id,
            jobType: job.job_type,
            success: false,
            error: error.message || 'Unknown error'
          });
          failed++;
        }
      }
      
      return {
        processed: dueJobs.length,
        succeeded,
        failed,
        results
      };
    } catch (error) {
      console.error('Failed to process due jobs:', error);
      throw error;
    }
  }
}
