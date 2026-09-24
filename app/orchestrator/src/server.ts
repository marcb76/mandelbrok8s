// /src/server.ts - Main entry point for the Mandelbrok8s orchestrator application

// Import required modules
import express from 'express';
import dotenv from 'dotenv';
import { connectDB, getDB, globalConfigId } from './config/database';
import globalConfigRoutes from './routes/globalConfig.routes';
import healthRoutes from './routes/health.routes';
import k8sRoutes from './routes/k8s.routes';
import metricsRoutes from './routes/metrics.routes';
import taskRoutes from './routes/task.routes';




// Variable to track server and graceful shutdown state for readiness checks
let server: any = null;
let isShuttingDown = false;




// Define a default global configuration for the Mandelbrok8s
const defaultGlobalConfig = {
  _id: globalConfigId,
  orchestrator: {
    port: 8080,
    taskTimeoutMs: 30000
  },
  worker: {
    port: 8081,
    pollIntervalMs: 1000,
    tasksConcurrency: 1
  },
  fractalDefaults: {
    iterations: 1000,
    resolution: {
      width: 1920,
      height: 1080
    },
    zoom: 1.0,
    center: [-0.5, 0.0]
  },
  k8sHpa: {
    minReplicas: 1,
    maxReplicas: 10,
    cpuUtilizationPercentage: 50,
    scaleDownStabilizationWindowSeconds: 300
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};




// Welcome banner
console.log('[MAIN        ]');
console.log('[MAIN        ]');
console.log('[MAIN        ] ====================================================');
console.log('[MAIN        ] Welcome to Mandelbrok8s Orchestrator Application');
console.log('[MAIN        ]   A cloud-native architecture blueprint for event-driven distributed processing, dynamic auto-scaling (HPA) in');
console.log('[MAIN        ]   Kubernetes, zero-downtime updates, and hybrid storage with MongoDB Atlas GridFS.');
console.log('[MAIN        ] Author: Marc Bonet Bretto');
console.log('[MAIN        ] Copyright: 2026 Marc Bonet Bretto. All rights reserved.');
console.log('[MAIN        ] ====================================================');
console.log('[MAIN        ]');
console.log('[MAIN        ]');


// Load environment variables and configuration
console.log('[MAIN        ] Loading environment variables and configuration...');
dotenv.config();
const defaultMongoUri = 'mongodb://localhost:27017/mandelbrok8s';
const defaultWorkerHpaName = 'worker-hpa';
const MONGO_URI = process.env.MONGO_URI || defaultMongoUri;
const WORKER_HPA_NAME = process.env.WORKER_HPA_NAME || defaultWorkerHpaName;
console.log('[MAIN        ]   Configuration loaded:');
console.log(`[MAIN        ]     MONGO_URI:       ${MONGO_URI ? '[PRESENT]' : '[MISSING]'}`);
console.log(`[MAIN        ]     WORKER_HPA_NAME: ${WORKER_HPA_NAME}`);
console.log('[MAIN        ]');
console.log('[MAIN        ]');




// Initialize Express application and register routes
console.log('[MAIN        ] Initializing Express application...');
const app = express();
app.use(express.json());
app.use('/', healthRoutes);
app.use('/', metricsRoutes);
app.use('/', globalConfigRoutes);
app.use('/', taskRoutes);
app.use('/', k8sRoutes);
console.log('[MAIN        ] Express application initialized and routes registered:');
healthRoutes.stack.forEach((route: any) => {
  console.log(`[MAIN        ]   ${route.route?.methods ? Object.keys(route.route?.methods).join(', ') : ''} ${route.route?.path}`);
});
metricsRoutes.stack.forEach((route: any) => {
  console.log(`[MAIN        ]   ${route.route?.methods ? Object.keys(route.route?.methods).join(', ') : ''} ${route.route?.path}`);
});
globalConfigRoutes.stack.forEach((route: any) => {
  console.log(`[MAIN        ]   ${route.route?.methods ? Object.keys(route.route?.methods).join(', ') : ''} ${route.route?.path}`);
});
taskRoutes.stack.forEach((route: any) => {
  console.log(`[MAIN        ]   ${route.route?.methods ? Object.keys(route.route?.methods).join(', ') : ''} ${route.route?.path}`);
});
k8sRoutes.stack.forEach((route: any) => {
  console.log(`[MAIN        ]   ${route.route?.methods ? Object.keys(route.route?.methods).join(', ') : ''} ${route.route?.path}`);
});
console.log('[MAIN        ]');
console.log('[MAIN        ]');




// Helper to check shutdown status (can be exported or used in health controller if desired)
export function getIsShuttingDown(): boolean {
  return isShuttingDown;
}




// Graceful shutdown handler
const gracefulOrchestratorShutdown = async (signal: string) => {
  // Log the received shutdown signal and mark the orchestrator as shutting down
  console.log(`[ORCHESTRATOR] Received ${signal}. Starting graceful shutdown...`);
  console.log('[ORCHESTRATOR] Orchestrator is gracefully shutting down...');
  isShuttingDown = true;

  // Forceful shutdown if graceful shutdown takes too long
  const forceTimeout = setTimeout(() => {
    console.error('[ORCHESTRATOR] Could not complete graceful shutdown in time...');
    console.error('[ORCHESTRATOR] Forcefully shutting down now.');
    process.exit(1);
  }, 10000).unref();

  try {
    // Stop the HTTP server if it has been started
    if (server) {
      console.log('[ORCHESTRATOR] Stopping HTTP server...');
      await new Promise<void>((resolve) => {
        server.close(async () => {
          console.log('[ORCHESTRATOR] HTTP server stopped.');
          resolve();
        });
      });
    }

    // Close the MongoDB connection
    console.log('[ORCHESTRATOR] Closing MongoDB connection...');
    try {
      const DB = getDB();
      if (DB && DB.db && DB.db.client) {
        await DB.db.client.close();
        console.log('[ORCHESTRATOR] MongoDB connection closed.');
      }
    } catch (err) {
      console.error('[ORCHESTRATOR] Error closing MongoDB connection:', err);
    }
    console.log('[ORCHESTRATOR] Graceful shutdown completed. Exiting process.');
    clearTimeout(forceTimeout);
    process.exit(0);
  } catch (err) {
    console.error('[ORCHESTRATOR] Error during graceful shutdown:', err);
    console.error('[ORCHESTRATOR] Forcefully shutting down now.');
    clearTimeout(forceTimeout);
    process.exit(1);
  }
};




// Listen for termination signals to initiate graceful shutdown
console.log('[MAIN        ] Listening for termination signals (SIGTERM, SIGINT) to initiate graceful shutdown.');
process.on('SIGTERM', () => gracefulOrchestratorShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulOrchestratorShutdown('SIGINT'));    




// Orchestrator startup and initialization logic
async function startOrchestrator() {
  try {
    // Connect to the MongoDB database
    console.log('[ORCHESTRATOR] Connecting to MongoDB...');
    await connectDB(MONGO_URI, defaultGlobalConfig);
    console.log('[ORCHESTRATOR] Successfully connected to MongoDB');

    // Fetch the global configuration from the database
    console.log('[ORCHESTRATOR] Fetching global_config from database...');
    const globalConfig = await getDB().globalConfigCollection.findOne({ _id: globalConfigId as any });
    console.log('[ORCHESTRATOR]   global_config loaded successfully. Orchestrator:    ', JSON.stringify(globalConfig?.orchestrator));
    console.log('[ORCHESTRATOR]                                      Worker:          ', JSON.stringify(globalConfig?.worker));
    console.log('[ORCHESTRATOR]                                      fractalDefaults: ', JSON.stringify(globalConfig?.fractalDefaults));
    console.log('[ORCHESTRATOR]                                      k8sHpa:          ', JSON.stringify(globalConfig?.k8sHpa));

    // Start the HTTP orchestrator API http server based on the configured port
    const port = globalConfig?.orchestrator.port;
    console.log(`[ORCHESTRATOR] Starting API HTTP server on port ${port}...`);
    server = app.listen(port, () => {
      console.log(`[ORCHESTRATOR] API HTTP server listening on port ${port}`);
    });
  } catch (err) {
    // Handle any errors that occur during orchestrator startup
    console.error('[ORCHESTRATOR]   Fatal startup error:', err);
    process.exit(1);
  }
}




// Start the orchestrator application
console.log('[MAIN        ] Starting orchestrator TypeScript application...');
startOrchestrator();
