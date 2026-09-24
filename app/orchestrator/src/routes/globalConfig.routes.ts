// /src/routes/globalConfig.routes.ts - Routes for global configuration management endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Router } from 'express';
import { GlobalConfigController } from '../controllers/globalConfig.controller';
import { validateUpdateGlobalConfig } from '../validators/globalConfig.validator';




// Initialize the router and define routes for global configuration
const router = Router();

router.get('/api/v1/global_config', GlobalConfigController.getConfig);
router.put('/api/v1/global_config', validateUpdateGlobalConfig, GlobalConfigController.updateConfig);
router.patch('/api/v1/global_config', validateUpdateGlobalConfig, GlobalConfigController.updateConfig);

export default router;