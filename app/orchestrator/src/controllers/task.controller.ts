// /src/controllers/task.controller.ts - Controller for task management and rendering execution endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Request, Response } from 'express';
import { getDB, globalConfigId } from '../config/database';
import { ObjectId, GridFSBucket } from 'mongodb';




// TaskController
const bucketName = 'fractals';
export class TaskController {
  // GET /api/v1/tasks - Lists rendering task documents with optional pagination and status filtering
  public static async listTasks(req: Request, res: Response): Promise<void> {
    try {
      // Define fallback defaults
      const defaultLimit = 50;
      const defaultPage = 1;

      // Extract query parameters for pagination and status filtering
      const limit = parseInt(req.query.limit as string, 10) || defaultLimit;
      const page = parseInt(req.query.page as string, 10) || defaultPage;
      const status = req.query.status as string;
      const skip = (page - 1) * limit;
      const query: any = {};
      if (status)
        query.status = status;

      // Fetch tasks from the database based on the query, with pagination and sorting
      const { tasksCollection } = getDB();
      const tasks = await tasksCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      // Count the total number of tasks matching the query for pagination purposes
      const total = await tasksCollection.countDocuments(query);

      // Respond with the list of tasks along with pagination metadata
      res.status(200).json({
        status: `success`,
        total,
        page,
        limit,
        tasks
      });
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[TASK_CTRL] Error listing tasks: ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while listing tasks`,
        details: err.message
      });
    }
  }




  // POST /api/v1/tasks - Injects new rendering tasks (supports burst creation and selective randomization)
  // If randomizeRender is true, the MISSED fields in the render configuration will be selectively randomized for each task
  // If not, the render configuration will strictly follow the user-provided values and global/base defaults.
  public static async createTasks(req: Request, res: Response): Promise<void> {
    try {
      // Define fallback defaults
      const defaultCount = 1;
      const defaultIterations = 1000;
      const defaultWidth = 1920;
      const defaultHeight = 1080;
      const defaultZoom = 1.0;
      const defaultCenter_x = -0.5;
      const defaultCenter_y = 0.0;
      const defaultRenderConfig = {
        iterations: defaultIterations,
        resolution: { width: defaultWidth, height: defaultHeight },
        zoom: defaultZoom,
        center: [defaultCenter_x, defaultCenter_y]
      };

      // Extract parameters from the request body
      const url = `${req.protocol}://${req.get('host')}/api/v1/tasks/_id/image`;
      const count = req.body.count || defaultCount;
      const randomizeRender = req.body.randomizeRender === true;
      const userRenderConfig = req.body.renderConfig || {};

      // Get references to the tasks and configuration collections from the database
      const { tasksCollection, globalConfigCollection } = getDB();

      // Fetch global defaults as base fallback
      const globalConfig = await globalConfigCollection.findOne({ _id: globalConfigId as any });
      const baseDefaults = globalConfig ? globalConfig.fractalDefaults : defaultRenderConfig;

      // Interesting coordinate pool for randomization/fallback
      const interestingCenters = [
        [-0.743643887037158704752191506114774, 0.131825904205311970493132056385139],
        [-0.75, 0.1],
        [-1.25, 0.0],
        [0.0, 0.0],
        [-0.15, 1.04],
        [0.360240443437614387, -0.64131306106480317]
      ];

      // Generate the list of tasks to insert into the database
      const tasksToInsert = [];
      const now = new Date();

      for (let i = 0; i < count; i++) {
        // Pre-calculate random candidates for this iteration if needed
        const randomCenterBase = interestingCenters[Math.floor(Math.random() * interestingCenters.length)];
        const randomIterations = Math.floor(Math.random() * (3000 - 500 + 1)) + 500;
        const randomZoom = parseFloat((Math.random() * (50.0 - 1.0) + 1.0).toFixed(2));
        const randomCenter = [
          parseFloat((randomCenterBase[0] + (Math.random() - 0.5) * 0.1).toFixed(12)),
          parseFloat((randomCenterBase[1] + (Math.random() - 0.5) * 0.1).toFixed(12))
        ];

        // Merge hierarchy: Explicit user value > Random value (if randomizeRender is true) > Global/Base default
        const taskRenderConfig = {
          iterations: userRenderConfig.iterations !== undefined 
            ? userRenderConfig.iterations 
            : (randomizeRender ? randomIterations : (baseDefaults.iterations ?? defaultIterations)),

          resolution: {
            width: userRenderConfig.resolution?.width !== undefined 
              ? userRenderConfig.resolution.width 
              : (baseDefaults.resolution?.width ?? defaultWidth),
            height: userRenderConfig.resolution?.height !== undefined 
              ? userRenderConfig.resolution.height 
              : (baseDefaults.resolution?.height ?? defaultHeight)
          },

          zoom: userRenderConfig.zoom !== undefined 
            ? userRenderConfig.zoom 
            : (randomizeRender ? randomZoom : (baseDefaults.zoom ?? defaultZoom)),

          center: userRenderConfig.center !== undefined 
            ? userRenderConfig.center 
            : (randomizeRender ? randomCenter : (baseDefaults.center ?? [defaultCenter_x, defaultCenter_y]))
        };

        // Finally, push the task with the resolved render configuration into the tasksToInsert array
        tasksToInsert.push({
          status: `pending`,
          url: url,
          renderConfig: taskRenderConfig,
          claimedAt: null,
          claimedBy: null,
          imageStartedAt: null,
          imageFinishedAt: null,
          imageRenderTimeSec: null,
          gridFSFileId: null,
          image: null,
          error: null,
          createdAt: now,
          updatedAt: now
        });
      }

      // Insert the generated tasks into the database
      const result = await tasksCollection.insertMany(tasksToInsert);

      // Log success and respond
      console.log(`[TASK_CTRL] Successfully injected ${count} task(s) (randomizeRender: ${randomizeRender}).`);
      res.status(201).json({
        status: `success`,
        message: `Successfully created ${count} task(s)`,
        insertedCount: result.insertedCount,
        insertedIds: result.insertedIds
      });
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[TASK_CTRL] Error creating tasks: ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while creating tasks`,
        details: err.message
      });
    }
  }




  // GET /api/v1/tasks/:id - Retrieves execution state and details for a specific task
  public static async getTaskById(req: Request, res: Response): Promise<void> {
    try {
      // Extract the task ID from the request parameters and validate it
      const taskId = req.params.id;
      if (!ObjectId.isValid(taskId)) {
        res.status(400).json({ status: `error`, message: `Invalid task ID format. Required a valid ObjectId. Received: ${taskId}` });
        return;
      }

      // Query the database for the task with the specified ID
      const { tasksCollection } = getDB();
      const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
      if (!task) {
        res.status(404).json({ status: `error`, message: `Task not found. Task ID: ${taskId}` });
        return;
      }

      // Respond with the task details
      res.status(200).json({
        status: `success`,
        task
      });
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[TASK_CTRL] Error fetching task by ID (${req.params.id}): ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while fetching task. Task ID: ${req.params.id}`,
        details: err.message
      });
    }
  }




  // GET /api/v1/tasks/:id/image - Streams the rendered PNG binary directly from MongoDB GridFS
  public static async streamTaskImage(req: Request, res: Response): Promise<void> {
    try {
      // Extract the task ID from the request parameters and validate it
      const taskId = req.params.id;
      if (!ObjectId.isValid(taskId)) {
        res.status(400).json({ status: `error`, message: `Invalid task ID format. Required a valid ObjectId. Received: ${taskId}` });
        return;
      }

      // Query the database for the task with the specified ID
      const { tasksCollection, db } = getDB();
      const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
      if (!task) {
        res.status(404).json({ status: `error`, message: `Task not found. Task ID: ${taskId}` });
        return;
      }

      // Check if the task has an associated GridFS file ID
      if (!task.gridFSFileId) {
        res.status(404).json({ status: `error`, message: `Image not available yet or task not completed. Task ID: ${taskId}` });
        return;
      }

      // Initialize the GridFS bucket and prepare the file ID for streaming
      const bucket = new GridFSBucket(db, { bucketName: bucketName });
      const fileId = new ObjectId(task.gridFSFileId);

      // Check if file exists in GridFS before attempting to stream it
      const filesCursor = bucket.find({ _id: fileId });
      const files = await filesCursor.toArray();
      if (files.length === 0) {
        res.status(404).json({ status: `error`, message: `Binary image stream not found in storage. Task ID: ${taskId}` });
        return;
      }

      // Prepare for PNG image streaming
      res.setHeader('Content-Type', 'image/png');
      const downloadStream = bucket.openDownloadStream(fileId);
      downloadStream.on('error', (streamErr: any) => {
        // Log the streaming error and respond with a 500 status if headers have not been sent yet
        console.error(`[TASK_CTRL] GridFS stream error: ${streamErr.message}`);
        if (!res.headersSent) {
          res.status(500).json({ status: `error`, message: `Error streaming image binary. Task ID: ${taskId}` });
        }
      });

      // Pipe the download stream to the response to stream the image binary to the client
      downloadStream.pipe(res);

      // Log that the streaming has started successfully
      console.log('[TASK_CTRL] Streaming image for task ID:', taskId);
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[TASK_CTRL] Error streaming task image by ID (${req.params.id}): ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while streaming image. Task ID: ${req.params.id}`,
        details: err.message
      });
    }
  }




  // DELETE /api/v1/tasks/:id - Deletes a specific task and its associated GridFS binary if present
  public static async deleteTaskById(req: Request, res: Response): Promise<void> {
    try {
      // Extract the task ID from the request parameters and validate it
      const taskId = req.params.id;
      if (!ObjectId.isValid(taskId)) {
        res.status(400).json({ status: `error`, message: `Invalid task ID format. Required a valid ObjectId. Received: ${taskId}` });
        return;
      }

      // Query the database for the task with the specified ID
      const { tasksCollection, db } = getDB();
      const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
      // If the task does not exist, return a 404 error
      if (!task) {
        res.status(404).json({ status: `error`, message: `Task not found. Task ID: ${taskId}` });
        return;
      }

      // If there is an associated GridFS image, delete it too to avoid orphaned files
      if (task.gridFSFileId) {
        try {
          const { gridFSBucket } = getDB();
          await gridFSBucket.delete(task.gridFSFileId);
        } catch (gridErr: any) {
          console.warn(`[TASK_CTRL] Warning: Could not delete GridFS file. Task ID: ${taskId}. Error: ${gridErr.message}`);
        }
      }

      // Delete the task record from the database
      await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });
      
      // Log the successful deletion of the task and respond to the client
      console.log(`[TASK_CTRL] Task ${taskId} deleted successfully.`);
      res.status(200).json({
        status: `success`,
        message: `Task ${taskId} deleted successfully`
      });
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[TASK_CTRL] Error deleting task by ID: ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while deleting task. Task ID: ${req.params.id}`,
        details: err.message
      });
    }
  }




  // DELETE /api/v1/tasks - Flushes all task records and associated GridFS chunks
  public static async deleteAllTasks(req: Request, res: Response): Promise<void> {
    try {
      // Delete all task records from the database
      const { tasksCollection, db } = getDB();
      await tasksCollection.deleteMany({});
      console.log(`[TASK_CTRL] All task records deleted from the database.`);

      // Attempt to clean up all files in the GridFS bucket
      try {
        const { gridFSBucket } = getDB();
        const files = await gridFSBucket.find({}).toArray();
        for (const file of files) {
          await gridFSBucket.delete(file._id);
        }
        console.log(`[TASK_CTRL] All files in the GridFS bucket deleted successfully.`);
      } catch (gridErr: any) {
        // Log the warning for debugging purposes
        console.warn(`[TASK_CTRL] Warning Error during GridFS bucket cleanup: ${gridErr.message}`);
      }

      // Respond to the client with a success message
      res.status(200).json({
        status: `success`,
        message: `All tasks and storage flushed successfully`
      });
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[TASK_CTRL] Error flushing tasks: ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while flushing tasks`,
        details: err.message
      });
    }
  }
}
