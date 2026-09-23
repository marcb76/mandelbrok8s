// /src/routes/globalConfig.routes.ts - Routes for global configuration management endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Router } from 'express';
import { GlobalConfigController } from '../controllers/globalConfig.controller';
import { validateUpdateGlobalConfig } from '../validators/globalConfig.validator';




// Initialize the router and define routes for global configuration
const router = Router();

router.get('/', GlobalConfigController.getConfig);
router.put('/', validateUpdateGlobalConfig, GlobalConfigController.updateConfig);
router.patch('/', validateUpdateGlobalConfig, GlobalConfigController.updateConfig);

export default router;