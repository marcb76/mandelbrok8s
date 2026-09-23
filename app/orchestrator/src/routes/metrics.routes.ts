// /src/routes/metrics.routes.ts - Routes for telemetry and performance metrics endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Router } from 'express';
import { MetricsController } from '../controllers/metrics.controller';




// Initialize the router and define routes for telemetry metrics
const router = Router();
router.get('/metrics', MetricsController.getMetrics);

export default router;
