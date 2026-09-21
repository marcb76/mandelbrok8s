// mandelbrok8s-worker.js - Main entry point for the Mandelbrok8s worker application

// Import required modules
const dotenv = require("dotenv");
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { MongoClient, GridFSBucket } = require('mongodb');




// Main variables for database connection and global configuration
let db, tasksCollection, configCollection, gridFSBucket;
let isConnected = false;
let globalConfig = null;




// Load environment variables and configuration
console.log('[MAIN   ] Loading environment variables and configuration...');
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mandelbrok8s';
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const PYTHON_SCRIPT_PATH = process.env.PYTHON_SCRIPT_PATH || path.join(__dirname, '../renderer/mandelbrok8s.py');
console.log('[MAIN   ] Configuration loaded:');
console.log(`[MAIN   ]   MONGO_URI: ${MONGO_URI ? '[PRESENT]' : '[MISSING]'}`);
console.log(`[MAIN   ]   PYTHON_BIN: ${PYTHON_BIN}`);
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








// Fetch or refresh global configuration document from MongoDB
async function refreshGlobalConfig() {
  try {
    console.log('[CONFIG  ] Refreshing global configuration from MongoDB...');
    const doc = await configCollection.findOne({ _id: 'global_config' });
    if (doc) {
      globalConfig = doc;
      console.log('[CONFIG  ] Global configuration refreshed successfully.');
      return true;
    } else {
      console.error('[CONFIG  ] Global configuration document not found.');
    }
  } catch (err) {
    console.error('[CONFIG  ] Error reading global_config:', err.message);
  }
  return false;
}








// Python CLI renderer execution wrapper reading parameters from task.renderConfig
function runRenderer(task) {
  return new Promise((resolve, reject) => {
    const tempOutputPath = path.join(__dirname, `temp_${task._id}.png`);

    // Extract rendering parameters directly from task.renderConfig
    const renderConfig = task.renderConfig || {};
    const resolution = renderConfig.resolution || {};
    const center = renderConfig.center || [-0.5, 0.0];

    const width = resolution.width || 1920;
    const height = resolution.height || 1080;
    const iterations = renderConfig.iterations || 1000;
    const zoom = renderConfig.zoom || 1.0;
    const centerX = center[0] !== undefined ? center[0] : -0.5;
    const centerY = center[1] !== undefined ? center[1] : 0.0;

    const args = [
      PYTHON_SCRIPT_PATH,
      '--width', width,
      '--height', height,
      '--iterations', iterations,
      '--center-x', centerX,
      '--center-y', centerY,
      '--zoom', zoom,
      '--output', tempOutputPath
    ];
    console.log(`[RENDERER] Running Python renderer for task ID: ${task._id} with args: ${args.join(' ')}`);
    execFile(PYTHON_BIN, args, (error, stdout, stderr) => {
      if (error) {
        console.error(`[RENDERER] Python execution failed for task ID: ${task._id}: ${stderr || error.message}`);
        return reject(new Error(`Python execution failed: ${stderr || error.message}`));
      }
      console.log(`[RENDERER] Python execution succeeded for task ID: ${task._id}`);
      resolve({ tempOutputPath, stdout });
    });
  });
}








// Upload PNG stream to MongoDB GridFS
function saveToGridFS(filename, filePath) {
  console.log(`[WORKER  ] Saving file to GridFS: ${filename}`);
  return new Promise((resolve, reject) => {
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      contentType: 'image/png'
    });

    fs.createReadStream(filePath)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        console.log(`[WORKER  ] File saved to GridFS with ID: ${uploadStream.id}`);
        resolve(uploadStream.id);
      });
  });
}








// Main task claiming and processing routine
async function claimAndProcessTask() {
  let task = null;
  let tempFilePath = null;

  try {
    // Atomic lock: find a pending task and mark it as processing
    console.log('[CLAIMER ] Attempting to acquire next pending task...');
    const claimTime = new Date();
    task = await tasksCollection.findOneAndUpdate(
      { status: 'pending' },
      { 
        $set: { 
          status: 'processing', 
          claimedAt: claimTime,
          claimedBy: process.env.HOSTNAME || 'local-worker',
          updatedAt: claimTime
        } 
      },
      { returnDocument: 'after' }
    );
    if (!task) {
      console.log('[CLAIMER ] No pending tasks found.');
      return;
    }
    console.log(`[CLAIMER ] Task acquired. ID: ${task._id}`);


    // Track image rendering execution timeframe
    const imageStartedAt = new Date();
    await tasksCollection.updateOne(
      { _id: task._id },
      { $set: { imageStartedAt: imageStartedAt, updatedAt: imageStartedAt } }
    );


    // Execute Numba Python rendering engine
    console.log(`[CLAIMER ] Executing renderer for task ID: ${task._id}`);
    const { tempOutputPath, stdout } = await runRenderer(task);
    tempFilePath = tempOutputPath;
    console.log(`[CLAIMER ] Renderer execution completed for task ID: ${task._id}`);


    // Save rendered image artifact to GridFS
    console.log(`[CLAIMER ] Saving rendered image (${tempFilePath}) to GridFS for task ID: ${task._id}`);
    const gridFsFileId = await saveToGridFS(`fractal_${task._id}.png`, tempFilePath);
    const imageFinishedAt = new Date();
    console.log(`[CLAIMER ] Rendered image saved to GridFS with ID: ${gridFsFileId} for task ID: ${task._id}`);

    // Parse timing metrics and update task completion details in database
    console.log(`[CLAIMER ] Updating task completion details for task ID: ${task._id}`);
    const match = stdout.match(/render_time_sec=([\d.]+)/);
    const renderTimeSec = match ? parseFloat(match[1]) : null;
    await tasksCollection.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'completed',
          progress: 100,
          imageFinishedAt: imageFinishedAt,
          image: {
            $ref: 'fs.files',$id: gridFsFileId
          },
          renderTimeSec: renderTimeSec,
          updatedAt: imageFinishedAt
        }
      }
    );
    console.log(`[CLAIMER ] Task ${task._id} COMPLETED successfully. GridFS ID: ${gridFsFileId}`);
  } catch (err) {
    // Mark task as failed in database if an exception occurs
    console.error(`[CLAIMER ] Error processing task ID: ${task ? task._id : 'unknown'}:`, err.message);
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
      ).catch(dbErr => console.error('[CLAIMER ] Failed to update task status to failed:', dbErr));
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








// Recursive function supporting dynamic polling interval updates from global_config
async function scheduleNextPoll() {
  // Claim and process the next available task
  await claimAndProcessTask();

  // Refresh global configuration to capture dynamic pollIntervalMs updates
  await refreshGlobalConfig();

  const nextInterval = globalConfig?.worker?.pollIntervalMs || POLL_INTERVAL_MS;
  setTimeout(scheduleNextPoll, nextInterval);
}








// Database connection and initialization workflow... main worker
async function worker() {
  try {
    console.log('[WORKER  ] Connecting to MongoDB Atlas...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();

    db = client.db();
    tasksCollection = db.collection('tasks');
    configCollection = db.collection('config');
    gridFSBucket = new GridFSBucket(db, { bucketName: 'fs' });
    isConnected = true;

    console.log('[WORKER  ] Successfully connected to MongoDB Atlas');
    console.log(`[WORKER  ] Using database: ${db.databaseName}`);

    // Wait until orchestrator initializes the global_config document
    console.log('[WORKER  ] Fetching global_config from database...');
    let configLoaded = await refreshGlobalConfig();
    while (!configLoaded) {
      console.warn('[WORKER  ] global_config not found. Waiting for orchestrator initialization (retrying in 3s)...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      configLoaded = await refreshGlobalConfig();
    }
    console.log('[WORKER  ] global_config loaded successfully:', JSON.stringify(globalConfig.worker));

    // Start HTTP healthcheck probe server once DB and configuration are confirmed
    const port = globalConfig.worker.port || 8080;
    console.log(`[WORKER  ] Starting HTTP healthcheck server on port ${port}...`);
    console.log(`[WORKER  ]   /healthz endpoint available`);
    console.log(`[WORKER  ]   /readyz endpoint available`);
    server.listen(port, () => {
      console.log(`[WORKER  ] Healthcheck probe server listening on port ${port}`);
    });

    // Start continuous adaptive polling loop
    console.log('[WORKER  ] Starting task processing loop...');
    scheduleNextPoll();

  } catch (err) {
    console.error('[WORKER  ] Fatal startup error:', err);
    process.exit(1);
  }
}








// Start the worker process
console.log('[MAIN   ] Starting worker...');
worker();
