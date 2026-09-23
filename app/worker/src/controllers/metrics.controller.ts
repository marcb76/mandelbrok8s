// /src/controllers/metrics.controller.ts - Controller for API telemetry and execution metrics of the Mandelbrok8s worker application

// Import required modules
import { Request, Response } from 'express';
import { checkDBConnection } from '../config/database';




// MetricsController
export class MetricsController {
  // GET /metrics - Exposes API execution stats, memory usage, and component status
  public static getMetrics(req: Request, res: Response): void {
    // Collect memory usage and uptime metrics
    const memoryUsage = process.memoryUsage();
    const uptimeSec = process.uptime();

    // Respond with the collected metrics
    res.status(200).json({
      status: 'ok',
      service: 'mandelbrok8s-worker',
      uptimeSec: Math.round(uptimeSec),
      memory: {
        rssMB: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsedMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      },
      databaseConnected: checkDBConnection(),
      timestamp: new Date()
    });
  }
}
