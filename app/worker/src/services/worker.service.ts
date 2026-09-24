// /src/services/worker.service.ts - Service functions for the Mandelbrok8s worker application, including task claiming, rendering, and GridFS storage.

// Import required modules
import os from 'os';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { getDB } from '../config/database';




// Global configuration object
let globalConfig: any = null;



// Refresh the global configuration from the database
export async function refreshGlobalConfig(): Promise<boolean> {
  try {
    const { globalConfigCollection } = getDB();
    const doc = await globalConfigCollection.findOne({ _id: 'global_config' as any });
    if (doc) {
      globalConfig = doc;
      return true;
    }
  } catch (err: any) {
    console.error('[CONFIG  ]     Error reading global_config:', err.message);
  }
  return false;
}




// Get the current global configuration
export function getGlobalConfig() {
  return globalConfig;
}




// Run the Python renderer for a given task and return the path to the generated image along with the standard output
function runRenderer(task: any, pythonBin: string, scriptPath: string): Promise<{ tempOutputPath: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const defaultResolutionWidth = 1920;
    const defaultResolutionHeight = 1080;
    const defaultIterations = 1000;
    const defaultZoom = 1.0;
    const defaultCenterX = -0.5;
    const defaultCenterY = 0.0;
    const tempOutputPath = path.join(__dirname, `../../temp_${task._id}.png`);

    const renderConfig = task.renderConfig || {};
    const resolution = renderConfig.resolution || {};
    const center = renderConfig.center || [defaultCenterX, defaultCenterY];

    const width = resolution.width || defaultResolutionWidth;
    const height = resolution.height || defaultResolutionHeight;
    const iterations = renderConfig.iterations || defaultIterations;
    const zoom = renderConfig.zoom || defaultZoom;
    const centerX = center[0] !== undefined ? center[0] : defaultCenterX;
    const centerY = center[1] !== undefined ? center[1] : defaultCenterY;

    const args = [
      scriptPath,
      '--width', width.toString(),
      '--height', height.toString(),
      '--iterations', iterations.toString(),
      '--center-x', centerX.toString(),
      '--center-y', centerY.toString(),
      '--zoom', zoom.toString(),
      '--output', tempOutputPath
    ];

    // Execute the Python renderer with the specified arguments
    console.log(`[RENDERER] Running Python renderer for task ID: ${task._id} with args: ${args.join(' ')}`);
    execFile(pythonBin, args, (error, stdout, stderr) => {
      if (error) {
        console.error(`[RENDERER]     Python execution failed for task ID: ${task._id}: ${stderr || error.message}`);
        return reject(new Error(`[RENDERER]     Python execution failed: ${stderr || error.message}`));
      }
      console.log(`[RENDERER]     Python execution succeeded for task ID: ${task._id}`);
      resolve({ tempOutputPath, stdout });
    });
  });
}




// Save a file to GridFS and return the file ID
function saveToGridFS(filename: string, filePath: string): Promise<any> {
  console.log(`[WORKER  ] Saving file to GridFS: ${filename}`);
  const { gridFSBucket } = getDB();
  return new Promise((resolve, reject) => {
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      contentType: 'image/png'
    });
    fs.createReadStream(filePath)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        console.log(`[WORKER  ]     File saved to GridFS with ID: ${uploadStream.id}`);
        resolve(uploadStream.id);
      });
  });
}




// Claim the next pending task, process it using the Python renderer, save the result to GridFS, and update the task status
export async function claimAndProcessTask(pythonBin: string, scriptPath: string): Promise<void> {
  const { tasksCollection } = getDB();
  let task: any = null;
  let tempFilePath: string | null = null;

  try {
    // Attempt to claim the next pending task from the database
    console.log('[CLAIMER ] Attempting to acquire next pending task...');
    const claimTime = new Date();
    task = await tasksCollection.findOneAndUpdate(
      { status: 'pending' },
      { 
        $set: { 
          status: 'processing', 
          claimedAt: claimTime,
          claimedBy: `${os.hostname()}-pid-${process.pid}`,
          updatedAt: claimTime
        } 
      },
      { returnDocument: 'after' }
    );

    if (!task) {
      // No pending tasks are available, exit the function
      console.log('[CLAIMER ] No pending tasks found.');
      return;
    }
    console.log(`[CLAIMER ]   Task acquired. ID: ${task._id}`);

    // At this point, the task has been successfully claimed and is ready for processing
    // Record the start time for image processing
    const imageStartedAt = new Date();
    await tasksCollection.updateOne(
      { _id: task._id },
      { $set: { imageStartedAt: imageStartedAt, updatedAt: imageStartedAt } }
    );

    // Execute the Python renderer to generate the image for the claimed task
    console.log(`[CLAIMER ] Executing renderer for task ID: ${task._id}`);
    const { tempOutputPath, stdout } = await runRenderer(task, pythonBin, scriptPath);
    tempFilePath = tempOutputPath;
    console.log(`[CLAIMER ]   Renderer execution completed for task ID: ${task._id}`);

    // Record the time when the image rendering finished and save the rendered image to GridFS
    console.log(`[CLAIMER ] Saving rendered image (${tempFilePath}) to GridFS for task ID: ${task._id}`);
    const gridFsFileId = await saveToGridFS(`fractal_${task._id}.png`, tempFilePath);
    const imageFinishedAt = new Date();
    console.log(`[CLAIMER ]   Rendered image saved to GridFS with ID: ${gridFsFileId} for task ID: ${task._id}`);

    // Update the task with completion details, including render time and GridFS file reference
    console.log(`[CLAIMER ] Updating task completion details for task ID: ${task._id}`);
    const match = stdout.match(/render_time_sec=([\d.]+)/);
    const renderTimeSec = match ? parseFloat(match[1]) : null;
    await tasksCollection.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'completed',
          imageFinishedAt: imageFinishedAt,
          gridFSFileId: gridFsFileId,
          image: {
            $ref: 'fs.files',$id: gridFsFileId
          },
          renderTimeSec: renderTimeSec,
          updatedAt: imageFinishedAt
        }
      }
    );

    // Log the successful completion of the task with the GridFS file ID
    console.log(`[CLAIMER ]     Task ${task._id} COMPLETED successfully. GridFS ID: ${gridFsFileId}`);
  } catch (err: any) {
    // Handle any errors that occurred during task processing
    console.error(`[CLAIMER ]     Error processing task ID: ${task ? task._id : 'unknown'}:`, err.message);
    if (task) {
      const errorTime = new Date();
      await tasksCollection.updateOne(
        { _id: task._id },
        {
          $set: {
            status: 'failed',
            error: err.message,
            updatedAt: errorTime
          }
        }
      ).catch((dbErr: any) => console.error('[CLAIMER ]     Failed to update task status to failed:', dbErr));
    }
  } finally {
    // Clean up the temporary file used for rendering the image
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr: any) {
        console.error(`[CLAIMER ]     Failed to delete temp file ${tempFilePath}:`, cleanupErr.message);
      }
    }
  }
}
