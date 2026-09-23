// /src/routes/health.routes.ts - Routes for health and readiness endpoints endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';




// Initialize the router and define routes for health and readiness endpoints
const router = Router();
router.get('/healthz', HealthController.getHealthz);
router.get('/readyz', HealthController.getReadyz);

export default router;
