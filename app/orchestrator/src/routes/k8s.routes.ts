// /src/routes/k8s.routes.ts - Routes for Kubernetes cluster health, pods, and HPA monitoring endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Router } from 'express';
import { K8sController } from '../controllers/k8s.controller';
import { validatePodName } from '../validators/k8s.validator';




// Initialize the router and define routes for Kubernetes cluster metrics
const router = Router();

router.get('/api/v1/k8s', K8sController.getClusterHealth);
router.get('/api/v1/k8s/pods', K8sController.listPods);
router.get('/api/v1/k8s/pods/:name', validatePodName, K8sController.getPodDetails);
router.get('/api/v1/k8s/hpa', K8sController.getHpaMetrics);

export default router;