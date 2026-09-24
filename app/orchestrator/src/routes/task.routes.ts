// /src/routes/task.routes.ts - Routes for task management and rendering execution endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Router } from 'express';
import { TaskController } from '../controllers/task.controller';
import { validateCreateTask, validateTaskId } from '../validators/task.validator';




// Initialize the router and define routes for tasks
const router = Router();

router.get('/api/v1/tasks/', TaskController.listTasks);
router.post('/api/v1/tasks', validateCreateTask, TaskController.createTasks);
router.get('/api/v1/tasks/:id', validateTaskId, TaskController.getTaskById);
router.get('/api/v1/tasks/:id/image', validateTaskId, TaskController.streamTaskImage);
router.delete('/api/v1/tasks/:id', validateTaskId, TaskController.deleteTaskById);
router.delete('/api/v1/tasks', TaskController.deleteAllTasks);

export default router;