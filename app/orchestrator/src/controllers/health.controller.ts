// /src/controllers/health.controller.ts - Controller for health and readiness probe endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Request, Response } from 'express';
import { checkDBConnection } from '../config/database';
import { getIsShuttingDown } from '../server';




// HealthController
export class HealthController {
  // GET /healthz - Returns the health status of the orchestrator application
  public static getHealthz(req: Request, res: Response): void {
    if (checkDBConnection()) {
      res.status(200).json({ status: 'ok', timestamp: new Date() });
    } else {
      res.status(500).json({ status: 'unhealthy', reason: 'Database disconnected' });
    }
  }




  // GET /readyz - Returns the readiness status of the orchestrator application
  public static getReadyz(req: Request, res: Response): void {
    if (getIsShuttingDown()) {
      res.status(503).json({ status: 'unhealthy', reason: 'Server is shutting down' });
      return;
    }
    if (checkDBConnection()) {
      res.status(200).json({ status: 'ok', timestamp: new Date() });
    } else {
      res.status(503).json({ status: 'unhealthy', reason: 'Database disconnected' });
    }
  }
}
