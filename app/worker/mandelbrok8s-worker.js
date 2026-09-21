// mandelbrok8s-worker.js - Main entry point for the Mandelbrok8s worker application

// Import modules
const dotenv = require("dotenv");
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { MongoClient, GridFSBucket } = require('mongodb');




let db, tasksCollection, gridFSBucket;
let isConnected = false;




// Load environment variables and configuration
console.log('[MAIN   ] Loading environment variables and configuration...');
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mandelbrok8s';
const PORT = process.env.PORT || 8080;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '3000', 10);
const PYTHON_SCRIPT_PATH = process.env.PYTHON_SCRIPT_PATH || path.join(__dirname, '../renderer/mandelbrok8s.py');
console.log('[MAIN   ] Configuration loaded:');
console.log(`[MAIN   ]   MONGO_URI: ${MONGO_URI}`);
console.log(`[MAIN   ]   PORT: ${PORT}`);
console.log(`[MAIN   ]   POLL_INTERVAL_MS: ${POLL_INTERVAL_MS}`);
console.log(`[MAIN   ]   PYTHON_SCRIPT_PATH: ${PYTHON_SCRIPT_PATH}`);




// Minimal HTTP server for K8s Liveness/Readiness probes
console.log('[MAIN   ] Creating HTTP server...');
const server = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/readyz') {
    if (isConnected) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date() }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy', reason: 'Database disconnected' }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});




// Python CLI renderer execution wrapper
function runRenderer(task) {
  return new Promise((resolve, reject) => {
    const tempOutputPath = path.join(__dirname, `temp_${task._id}.png`);
    const args = [
      PYTHON_SCRIPT_PATH,
      '--width', task.width || 1920,
      '--height', task.height || 1080,
      '--iterations', task.iterations || 1000,
      '--center-x', task.center_x !== undefined ? task.center_x : -0.5,
      '--center-y', task.center_y !== undefined ? task.center_y : 0.0,
      '--zoom', task.zoom || 1.0,
      '--output', tempOutputPath
    ];
    console.log(`[RENDERER] Running Python renderer for task ID: ${task._id} with args: ${args.join(' ')}`);
    execFile('python3', args, (error, stdout, stderr) => {
      if (error) {
        console.error(`[RENDERER] Python renderer execution failed for task ID: ${task._id}: ${stderr || error.message}`);
        return reject(new Error(`Python renderer execution failed: ${stderr || error.message}`));
      }
      console.log(`[RENDERER] Python renderer execution succeeded for task ID: ${task._id}`);
      resolve({ tempOutputPath, stdout });
    });
  });
}




// Upload PNG stream to MongoDB GridFS
function saveToGridFS(filename, filePath) {
  console.log(`[WORKER] Saving file to GridFS: ${filename}`);
  return new Promise((resolve, reject) => {
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      contentType: 'image/png'
    });
    fs.createReadStream(filePath)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        console.log(`[WORKER] File saved to GridFS with ID: ${uploadStream.id}`);
        resolve(uploadStream.id);
      });
  });
}




// Task processor
async function claimAndProcessTask() {
  let task = null;
  let tempFilePath = null;

  try {
    // Atomic lock: find a pending task and mark it as PROCESSING
    console.log('[CLAIMER ] Attempting to acquire next pending task...');
    task = await tasksCollection.findOneAndUpdate(
      { status: 'PENDING' },
      { 
        $set: { 
          status: 'PROCESSING', 
          startedAt: new Date(),
          workerId: process.env.HOSTNAME || 'local-worker'
        } 
      },
      { returnDocument: 'after' }
    );

    if (!task) {
      console.log('[CLAIMER ] No pending tasks found.');
      return;
    }
    console.log(`[CLAIMER ] Task acquired. ID: ${task._id}`);

    // Execute Numba Python rendering engine
    console.log(`[CLAIMER ] Executing renderer for task ID: ${task._id}`);
    const { tempOutputPath, stdout } = await runRenderer(task);
    tempFilePath = tempOutputPath;
    console.log(`[CLAIMER ] Renderer execution completed for task ID: ${task._id}`);

    // Save image artifact to GridFS
    console.log(`[CLAIMER ] Saving rendered image (${tempFilePath}) to GridFS for task ID: ${task._id}`);
    const gridFsFileId = await saveToGridFS(`fractal_${task._id}.png`, tempFilePath);
    console.log(`[CLAIMER ] Rendered image saved to GridFS with ID: ${gridFsFileId} for task ID: ${task._id}`);

    // Update task completion details in database
    console.log(`[CLAIMER ] Updating task completion details in database for task ID: ${task._id}`);
    const match = stdout.match(/render_time_sec=([\d.]+)/);
    const renderTimeSec = match ? parseFloat(match[1]) : null;
    await tasksCollection.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'COMPLETED',
          completedAt: new Date(),
          gridFsFileId: gridFsFileId,
          renderTimeSec: renderTimeSec
        }
      }
    );
    console.log(`[CLAIMER ] Task ${task._id} COMPLETED successfully. GridFS ID: ${gridFsFileId}`);

  } catch (err) {
    console.error(`[CLAIMER ] Error processing task ID: ${task ? task._id : 'unknown'}:`, err.message);

    // Mark task as FAILED in database if an error occurs
    if (task) {
      await tasksCollection.updateOne(
        { _id: task._id },
        {
          $set: {
            status: 'FAILED',
            failedAt: new Date(),
            error: err.message
          }
        }
      ).catch(dbErr => console.error('[CLAIMER ] Failed to update task status to FAILED:', dbErr));
    }
  } finally {
    // Guaranteed cleanup of temporary local files
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.error(`[CLAIMER ] Failed to delete temp file ${tempFilePath}:`, cleanupErr.message);
      }
    }
  }
}




// Database connection and execution loop
async function worker() {
  try {
    console.log('[WORKER ] Connecting to MongoDB Atlas...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db();
    tasksCollection = db.collection('tasks');
    gridFSBucket = new GridFSBucket(db, { bucketName: 'fractals' });
    isConnected = true;
    console.log('[WORKER] Successfully connected to MongoDB Atlas');
    console.log(`[WORKER] Using database: ${db.databaseName}`);

    // Start HTTP healthcheck server
    console.log(`[WORKER] Starting HTTP healthcheck server on port ${PORT}...`);
    console.log(`[WORKER]   /healthz endpoint available`);
    console.log(`[WORKER]   /readyz endpoint available`);
    server.listen(PORT, () => {
      console.log(`[WORKER] Healthcheck probe server listening on port ${PORT}`);
    });

    // Continuous polling loop
    console.log(`[WORKER] Poll interval set to: ${POLL_INTERVAL_MS} ms`);
    console.log('[WORKER] Starting task processing loop...');
    setInterval(claimAndProcessTask, POLL_INTERVAL_MS);
  } catch (err) {
    console.error('[WORKER] Fatal startup error:', err);
    process.exit(1);
  }
}







////////////////////////////////////////////////////////////////////////////////
// Start the worker process
console.log('[MAIN   ] Starting worker...');
worker();