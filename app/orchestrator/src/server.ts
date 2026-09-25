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
// Hardcode / web page
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mandelbrok8s | Enterprise Distributed Fractal Rendering</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --accent-color: #38bdf8;
            --accent-hover: #0ea5e9;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --border-color: #334155;
        }
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            padding: 2rem;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            box-sizing: border-box;
        }
        .container {
            max-width: 900px;
            width: 100%;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 2.5rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        header h1 {
            margin: 0 0 0.5rem 0;
            font-size: 2.2rem;
            color: var(--accent-color);
        }
        header p.subtitle {
            color: var(--text-muted);
            margin-top: 0;
            font-size: 1.1rem;
        }
        .section {
            margin-top: 2rem;
        }
        .section h3 {
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 0.5rem;
            color: var(--text-main);
        }
        ul {
            padding-left: 1.2rem;
            color: var(--text-muted);
        }
        ul li {
            margin-bottom: 0.5rem;
        }
        ul li strong {
            color: var(--text-main);
        }
        a.endpoint-link {
            color: var(--accent-color);
            text-decoration: none;
            font-weight: 600;
        }
        a.endpoint-link:hover {
            text-decoration: underline;
            color: var(--accent-hover);
        }
        .form-group {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
        }
        input[type="number"] {
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-main);
            padding: 0.75rem 1rem;
            font-size: 1rem;
            width: 160px;
        }
        button {
            background: var(--accent-color);
            color: var(--bg-color);
            border: none;
            border-radius: 6px;
            padding: 0.75rem 1.5rem;
            font-weight: bold;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover {
            background: var(--accent-hover);
        }
        #response-output {
            margin-top: 1rem;
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 1rem;
            font-family: monospace;
            font-size: 0.9rem;
            white-space: pre-wrap;
            display: none;
        }
        footer {
            margin-top: 2.5rem;
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-muted);
            border-top: 1px solid var(--border-color);
            padding-top: 1.5rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Mandelbrok8s</h1>
            <p class="subtitle">Cloud-native enterprise architecture for distributed JIT fractal rendering</p>
        </header>

        <div class="section">
            <h3>About the Project</h3>
            <p style="color: var(--text-muted); line-height: 1.6;">
                <strong>Mandelbrok8s</strong> is a cloud-native platform designed to demonstrate event-driven distributed processing architectures, horizontal pod auto-scaling (HPA) in Kubernetes, zero-downtime updates, and hybrid storage using MongoDB Atlas GridFS.
            </p>
        </div>

        <div class="section">
            <h3>Direct Links (Parameterless GET Endpoints)</h3>
            <ul>
                <li><a class="endpoint-link" href="/healthz" target="_blank">GET /healthz</a> — Kubernetes liveness probe endpoint.</li>
                <li><a class="endpoint-link" href="/readyz" target="_blank">GET /readyz</a> — Kubernetes readiness probe endpoint.</li>
                <li><a class="endpoint-link" href="/metrics" target="_blank">GET /metrics</a> — Expose operational metrics for the orchestration cluster.</li>
                <li><a class="endpoint-link" href="/api/v1/global_config" target="_blank">GET /api/v1/global_config</a> — Retrieve global configuration document from MongoDB.</li>
                <li><a class="endpoint-link" href="/api/v1/tasks" target="_blank">GET /api/v1/tasks</a> — Query the list of rendering tasks and their current state.</li>
                <li><a class="endpoint-link" href="/api/v1/k8s" target="_blank">GET /api/v1/k8s</a> — Retrieve Kubernetes cluster status and integration overview.</li>
                <li><a class="endpoint-link" href="/api/v1/k8s/pods" target="_blank">GET /api/v1/k8s/pods</a> — List managed worker pods in the Kubernetes cluster.</li>
                <li><a class="endpoint-link" href="/api/v1/k8s/hpa" target="_blank">GET /api/v1/k8s/hpa</a> — Retrieve HPA metrics and scaling status.</li>
            </ul>
        </div>

        <div class="section">
            <h3>Parameterized & Administrative Endpoints</h3>
            <ul>
                <li><strong>PATCH /api/v1/global_config</strong> — Update global system configuration parameters.</li>
                <li><strong>GET /api/v1/tasks/{:id}</strong> — Query state and details of a specific rendering task by ID.</li>
                <li><strong>GET /api/v1/tasks/{:id}/image</strong> — Download or view the rendered fractal image from GridFS for a given task ID.</li>
                <li><strong>DELETE /api/v1/tasks/{:id}</strong> — Delete a specific rendering task by ID.</li>
                <li><strong>DELETE /api/v1/tasks</strong> — Delete all rendering tasks in the system.</li>
                <li><strong>GET /api/v1/k8s/pods/{:name}</strong> — Retrieve telemetry and status for a specific pod name.</li>
                <li><strong>POST /api/v1/tasks</strong> — Create and distribute a batch of new fractal rendering tasks asynchronously.</li>
            </ul>
        </div>

        <div class="section">
            <h3>Quick Task Dispatcher (POST /api/v1/tasks)</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem;">Select how many rendering tasks you want to dispatch into the distribution queue (1 to 1000):</p>
            <div class="form-group">
                <input type="number" id="task-count" min="1" max="1000" value="5">
                <button onclick="submitTasks()">Generate Batch</button>
            </div>
            <div id="response-output"></div>
        </div>

        <footer>
            Copyright &copy; 2026 Marc Bonet Bretto. All rights reserved.
        </footer>
    </div>

    <script>
        async function submitTasks() {
            const count = document.getElementById('task-count').value;
            const output = document.getElementById('response-output');
            output.style.display = 'block';
            output.textContent = 'Sending POST request to /api/v1/tasks...';

            try {
                const res = await fetch('/api/v1/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: parseInt(count, 10) })
                });
                const data = await res.json();
                output.textContent = JSON.stringify(data, null, 2);
            } catch (err) {
                output.textContent = 'Error executing request: ' + err.message;
            }
        }
    </script>
</body>
</html>`);
});
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
