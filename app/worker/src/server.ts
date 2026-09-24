// /src/server.ts - Main entry point for the Mandelbrok8s worker application

// Import required modules
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB, getDB } from './config/database';
import healthRoutes from './routes/health.routes';
import metricsRoutes from './routes/metrics.routes';
import { refreshGlobalConfig, getGlobalConfig, claimAndProcessTask } from './services/worker.service';




// Variable to track server and graceful shutdown state for readiness checks
let server: any = null;
let isShuttingDown = false;




// Welcome banner
console.log('[MAIN    ]');
console.log('[MAIN    ]');
console.log('[MAIN    ] ====================================================');
console.log('[MAIN    ] Welcome to Mandelbrok8s Worker Application');
console.log('[MAIN    ]   A cloud-native architecture blueprint for event-driven distributed processing, dynamic auto-scaling (HPA) in');
console.log('[MAIN    ]   Kubernetes, zero-downtime updates, and hybrid storage with MongoDB Atlas GridFS.');
console.log('[MAIN    ] Author: Marc Bonet Bretto');
console.log('[MAIN    ] Copyright: 2026 Marc Bonet Bretto. All rights reserved.');
console.log('[MAIN    ] ====================================================');
console.log('[MAIN    ]');
console.log('[MAIN    ]');


// Load environment variables and configuration
console.log('[MAIN    ] Loading environment variables and configuration...');
dotenv.config();
const defaultMongoUri = 'mongodb://localhost:27017/mandelbrok8s';
const defaultPythonBin = 'python3';
const defaultPythonScriptPath = '../../renderer/mandelbrok8s.py';
const MONGO_URI = process.env.MONGO_URI || defaultMongoUri;
const PYTHON_BIN = process.env.PYTHON_BIN || defaultPythonBin;
const PYTHON_SCRIPT_PATH__ = process.env.PYTHON_SCRIPT_PATH || defaultPythonScriptPath
const PYTHON_SCRIPT_PATH = path.join(__dirname, PYTHON_SCRIPT_PATH__);
console.log('[MAIN    ]   Configuration loaded:');
console.log(`[MAIN    ]     MONGO_URI:          ${MONGO_URI ? '[PRESENT]' : '[MISSING]'}`);
console.log(`[MAIN    ]     PYTHON_BIN:         ${PYTHON_BIN}`);
console.log(`[MAIN    ]     PYTHON_SCRIPT_PATH: ${PYTHON_SCRIPT_PATH}`);
console.log('[MAIN    ]');
console.log('[MAIN    ]');




// Initialize Express application and register routes
console.log('[MAIN    ] Initializing Express application...');
const app = express();
app.use(express.json());
app.use('/', healthRoutes);
app.use('/', metricsRoutes);
console.log('[MAIN    ] Express application initialized and routes registered: ');
healthRoutes.stack.forEach((route: any) => {
  console.log(`[MAIN    ]   ${route.route?.methods ? Object.keys(route.route?.methods).join(', ') : ''} ${route.route?.path}`);
});
metricsRoutes.stack.forEach((route: any) => {
  console.log(`[MAIN    ]   ${route.route?.methods ? Object.keys(route.route?.methods).join(', ') : ''} ${route.route?.path}`);
});
console.log('[MAIN    ]');
console.log('[MAIN    ]');




// Schedule the next task polling based on the configured interval
async function scheduleNextPoll() {
  await claimAndProcessTask(PYTHON_BIN, PYTHON_SCRIPT_PATH);
  await refreshGlobalConfig();
  const globalConfig = getGlobalConfig();
  const nextInterval = globalConfig?.worker?.pollIntervalMs;
  setTimeout(scheduleNextPoll, nextInterval);
}




// Helper to check shutdown status (can be exported or used in health controller if desired)
export function getIsShuttingDown(): boolean {
  return isShuttingDown;
}




// Graceful shutdown handler for the worker
const gracefulWorkerShutdown = async (signal: string) => {
  console.log(`[WORKER  ] Received ${signal}. Starting graceful shutdown...`);
  console.log('[WORKER  ] Worker is gracefully shutting down...');
  isShuttingDown = true;

  // Forceful shutdown timer in case things hang
  const forceTimeout = setTimeout(() => {
    console.error('[WORKER  ] Could not complete graceful shutdown in time...');
    console.error('[WORKER  ] Forcefully shutting down now.');
    process.exit(1);
  }, 10000).unref();

  try {
    // Stop the HTTP healthcheck server if running
    if (server) {
      console.log('[WORKER  ] Stopping HTTP healthcheck server...');
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('[WORKER  ] HTTP healthcheck server stopped.');
          resolve();
        });
      });
    }

    // Close the MongoDB connection
    console.log('[WORKER  ] Closing MongoDB connection...');
    try {
      const DB = getDB();
      if (DB && DB.db && DB.db.client) {
        await DB.db.client.close();
        console.log('[WORKER  ] MongoDB connection closed.');
      }
    } catch (err) {
      console.error('[WORKER  ] Error closing MongoDB connection:', err);
    }
    console.log('[WORKER  ] Graceful shutdown completed. Exiting process.');
    clearTimeout(forceTimeout);
    process.exit(0);
  } catch (err) {
    console.error('[WORKER  ] Error during graceful shutdown:', err);
    console.error('[WORKER  ] Forcefully shutting down now.');
    clearTimeout(forceTimeout);
    process.exit(1);
  }
};




// Listen for termination signals to initiate graceful shutdown
console.log('[MAIN    ] Listening for termination signals (SIGTERM, SIGINT) to initiate graceful shutdown.');
process.on('SIGTERM', () => gracefulWorkerShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulWorkerShutdown('SIGINT'));




// Worker startup and initialization logic
async function startWorker() {
  try {
    // Connect to the MongoDB database and initialize global configuration
    console.log('[WORKER  ] Connecting to MongoDB Atlas...');
    await connectDB(MONGO_URI);
    console.log('[WORKER  ] Successfully connected to MongoDB Atlas');

    // Fetch and refresh the global configuration from the database
    console.log('[WORKER  ] Fetching global_config from database...');
    let globalConfigLoaded = await refreshGlobalConfig();
    while (!globalConfigLoaded) {
      console.warn('[WORKER  ]   global_config not found. Waiting for orchestrator initialization (retrying in 3s)...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      globalConfigLoaded = await refreshGlobalConfig();
    }
    
    // Retrieve the global configuration after it has been successfully loaded
    const globalConfig = getGlobalConfig();
    console.log('[WORKER  ]   global_config loaded successfully. Worker:', JSON.stringify(globalConfig.worker));

    // Start the HTTP healthcheck server based on the configured port
    const port = globalConfig.worker.port;
    console.log(`[WORKER  ] Starting HTTP healthcheck server on port ${port}...`);
    server = app.listen(port, () => {
      console.log(`[WORKER  ] Healthcheck probe server listening on port ${port}`);
    });

    // Start the task processing loop based on the configured polling interval
    console.log(`[WORKER  ] Starting task processing loop (polling every ${globalConfig?.worker?.pollIntervalMs} ms)...`);
    scheduleNextPoll();
  } catch (err) {
    // Handle any errors that occur during worker startup
    console.error('[WORKER  ]   Fatal startup error:', err);
    process.exit(1);
  }
}




// Start the worker application
console.log('[MAIN    ] Starting worker TypeScript application...');
startWorker();
