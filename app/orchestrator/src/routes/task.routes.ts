// /src/routes/task.routes.ts - Routes for task management and rendering execution endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Router } from 'express';
import { TaskController } from '../controllers/task.controller';
import { validateCreateTask, validateTaskId } from '../validators/task.validator';




// Initialize the router and define routes for tasks
const router = Router();

router.get('/', TaskController.listTasks);
router.post('/', validateCreateTask, TaskController.createTasks);
router.get('/:id', validateTaskId, TaskController.getTaskById);
router.get('/:id/image', validateTaskId, TaskController.streamTaskImage);
router.delete('/:id', validateTaskId, TaskController.deleteTaskById);
router.delete('/', TaskController.deleteAllTasks);

export default router;