# Mandelbrok8s

> A cloud-native architecture blueprint for event-driven distributed processing, dynamic auto-scaling (HPA) in Kubernetes, zero-downtime updates, and hybrid storage with MongoDB Atlas GridFS.

---

## Author & Copyright

**Author:** Marc Bonet Bretto  
**Copyright:** © 2026 Marc Bonet Bretto. All rights reserved.

*This mini-project is developed as a technical demonstration showcasing enterprise-grade competencies in CI/CD, Docker, Kubernetes (K8s), REST APIs, Node.js, Python, asynchronous worker patterns, and cloud-native infrastructure design.*

---

## 🚀 Motivation & Objective

In real-world production environments, complex systems are rarely solved with static replicas or monolithic architectures. **Mandelbrok8s** is designed to demonstrate a robust and realistic enterprise design pattern: **an asynchronous batch-processing job/worker system that reacts completely autonomously to actual workloads**.

The project brings key scenarios of modern systems engineering to life:
* **Total decoupling** between task ingestion (Orchestrator) and heavy execution (Workers).
* **Reactive auto-scaling based on native infrastructure (HPA)**, where compute resources grow or shrink organically according to real CPU demand.
* **Cloud-native hybrid persistence**, combining an externally managed database service (MongoDB Atlas) with decentralized binary storage via GridFS.
* **High availability and operational continuity**, ensuring updates occur without service interruptions (*Zero-Downtime*).
* **Cloud-agnostic architecture**, leveraging 100% standard and idempotent Kubernetes manifests portable across any cloud provider.

---

### ⚡ Technology Stack & Polyglot Rationale

The hybrid selection of **Node.js (Orchestrator/Worker Manager)** and **Python + Numba (Rendering Engine)** is an intentional architectural decision driven by four core engineering principles:

1. **Architectural Maturity (Polyglot Pattern):** Node.js excels at asynchronous I/O-bound operations (handling REST API requests, polling MongoDB, and managing file streams), while Python is the industry standard for numerical computation and data processing. Using each runtime where it naturally performs best avoids over-engineering a single language for disparate workloads.
2. **C-Equivalent Execution Speed via Numba JIT:** Rather than relying on standard interpreted Python loops, the core fractal computation uses **Numba JIT (`@jit(nopython=True)`)**. This compiles Python mathematical routines directly into machine code via LLVM at runtime, yielding execution speeds comparable to C/C++ without the operational overhead of C build toolchains.
3. **Pragmatic Cost/Benefit Trade-off:** The stack maximizes developer velocity and maintainability (rapid prototyping in Node.js and Python) while achieving native-level runtime performance where CPU intensity demands it.
4. **HPA Workload Calibration & Demonstrative Value:** For autoscaling to trigger meaningfully in Kubernetes, workload tasks must create a sustained, measurable CPU signature. If the calculation completed in raw microsecond-level C code, multi-task batch requests would terminate too quickly for the Kubernetes Metrics Server to register CPU spikes and trigger HPA scaling events. The Python + Numba engine is calibrated to deliver high performance while sustaining the exact compute profile needed to demonstrate dynamic pod autoscaling under concurrent load.

---

## 🏗️ System Architecture

```text
 [ Client / REST API ] 
         │
         ▼
 ┌───────────────────────────┐
 │ Orchestrator (Kubernetes) │ ──( Inserts Task )──> [ MongoDB Atlas (Cloud) ]
 │ • Node.js (Task Manager)  │                                ▲
 └───────────────────────────┘                                │ (Atomic Polling)
                                                              ▼
                                               ┌─────────────────────────────┐
                                               │ Workers (Kubernetes + HPA)  │
                                               │ • Node.js (Task Poller)     │
                                               │ • Python CLI + Numba JIT    │
                                               └─────────────────────────────┘
                                                             │
                                                   (Stores Image in GridFS)
                                                             ▼
                                                   [ MongoDB Atlas GridFS ]
```

---

## ⚙️ Configuration & Dynamic Control Model

**Mandelbrok8s** decouples static runtime credentials from dynamic operational parameters. Static environment parameters are loaded at startup, while operational behavior (worker polling rates, timeouts, fractal default quality, and Kubernetes HPA triggers) is managed dynamically via MongoDB Atlas without requiring pod restarts.

### 1. Static Configuration Files

* **Orchestrator (`orchestrator-config.json`):**
  ```json
  {
    "port": 3000,
    "dbConnectionString": "mongodb+srv://<user>:<password>@cluster.mongodb.net/mandelbrok8s"
  }
  ```
* **Worker (`worker-config.json`):**
  ```json
  {
    "dbConnectionString": "mongodb+srv://<user>:<password>@cluster.mongodb.net/mandelbrok8s"
  }
  ```

### 2. Dynamic Operational Configuration Collection (`system_config`)

The Orchestrator maintains and updates a single configuration document (`_id: "global_config"`) inside the `system_config` collection in MongoDB Atlas. Worker pods fetch and refresh this document on every polling loop, enabling real-time operational adjustments.

```json
{
  "_id": "global_config",
  "worker": {
    "port": 8080,
    "pollIntervalMs": 1000,
    "taskTimeoutMs": 30000,
    "tasksConcurrency": 1
  },
  "fractalDefaults": {
    "iterations": 1000,
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "zoom": 1.0,
    "center": [-0.5, 0.0]
  },
  "k8sHpa": {
    "minReplicas": 1,
    "maxReplicas": 10,
    "cpuUtilizationPercentage": 50,
    "scaleDownStabilizationWindowSeconds": 300
  },
  "updatedAt": "2026-09-18T11:45:00Z"
}
```

#### Parameter Breakdown:
* **`worker`:** Controls worker execution behavior.
  * `pollIntervalMs`: Interval in milliseconds between MongoDB atomic task queries (`findOneAndUpdate`).
  * `taskTimeoutMs`: Time-To-Live (TTL) in milliseconds before an uncompleted `processing` task is reclaimed.
  * `tasksConcurrency`: Maximum concurrent tasks processed per worker pod.
* **`fractalDefaults`:** Default render parameters (iterations, resolution, zoom, and center coordinates) used when API requests omit explicit payloads.
* **`k8sHpa`:** Live Kubernetes Horizontal Pod Autoscaler tuning parameters patched on-the-fly by the Orchestrator via the Kubernetes API (`autoscaling/v2`).

### 3. Fractal Task Collection (`tasks`)

Each fractal rendering request creates a stateful job document within the `tasks` collection. Workers claim, update progress, attach execution metrics, and link GridFS binary storage upon completion.

```json
{
  "_id": "651a2f3e8f1b2c3d4e5f6a7b",
  "status": "completed",
  "progress": 100,
  "renderConfig": {
    "iterations": 1000,
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "zoom": 1.0,
    "center": [-0.5, 0.0]
  },
  "claimedAt": "2026-09-18T12:00:02Z",
  "claimedBy": "worker-deployment-7f89b9d6c4-x82kz",
  "imageStartedAt": "2026-09-18T12:00:03Z",
  "imageFinishedAt": "2026-09-18T12:00:15Z",
  "image": {
    "$ref": "fs.files",
    "$id": "651a2f4b8f1b2c3d4e5f6a7c"
  },
  "retryCount": 0,
  "error": null,
  "createdAt": "2026-09-18T12:00:00Z",
  "updatedAt": "2026-09-18T12:00:15Z"
}
```

#### Schema Field Breakdown:
* **`_id`**: Unique MongoDB BSON ObjectId for the task.
* **`status`**: Lifecycle state (`pending` | `processing` | `completed` | `failed`).
* **`progress`**: Percentage of rendering completion (`0` to `100`).
* **`renderConfig`**: Effective render parameters (iterations, resolution, zoom, center) inherited from `system_config` defaults or optional API overrides.
* **`claimedAt` / `claimedBy`**: Timestamp and Kubernetes Pod identifier claiming the task atomically.
* **`imageStartedAt` / `imageFinishedAt`**: Exact execution duration metrics for calculation and rendering.
* **`image`**: Object pointer referring to the generated image stored in **MongoDB GridFS** (`fs.files`).
* **`retryCount`**: Counter for handling retries in case a worker pod crashes mid-execution.
* **`error`**: Exception stack trace or failure reason if the rendering fails.
* **`createdAt` / `updatedAt`**: ISO timestamps for creation and status mutations.

---

## 🔄 Task Lifecycle

1. **Creation:** The user sends a request to the Orchestrator specifying the fractal's intensity. A document is generated in MongoDB Atlas with a `pending` status.
2. **Claiming:** A Worker pod detects the available task and claims it atomically (`status: "processing"` via `findOneAndUpdate`).
3. **Execution & Load:** The worker executes the Python script in the background. The container's CPU usage spikes dramatically.
4. **Scaling (HPA):** If multiple tasks are concurrent, the HPA detects the CPU increase and deploys new worker pods within seconds to process them in parallel.
5. **Persistence:** Upon completing the calculation, the worker formats or compresses the generated image and securely stores it in **MongoDB GridFS**, updating the task status to `completed` and linking the resulting file.
6. **Cleanup:** Workers finish their cycle; as the workload drops, Kubernetes automatically reduces active pods.

---

## 🔄 Zero-Downtime Strategy & Deployments

To ensure code updates or security patches do not interrupt task processing or API availability, **Mandelbrok8s** implements native Kubernetes practices:

* **Rolling Update Strategy:** The Orchestrator and Worker Deployments configure a progressive update strategy (`maxSurge: 1`, `maxUnavailable: 0`). This ensures Kubernetes never shuts down an old version without first provisioning and verifying the health (`readinessProbe`) of the new replica.
* **Task Idempotency:** Thanks to the Atomic Polling design in MongoDB, if a worker pod is terminated mid-task during a deployment, the architecture is prepared to handle timeouts or retries without corrupting global state.

---

## 🔐 Secret Management

Credential security (such as the MongoDB Atlas connection URI) is managed across two strictly separated layers:

1. **GitHub Secrets (CI/CD):** 
   * Store credentials for accessing the container registry (GitHub Packages / Docker Hub) and the Kubernetes access token (`KUBE_CONFIG`).
2. **Kubernetes Secrets:**
   * Credentials are never exposed in plain text within repositories. They are injected into the cluster via Kubernetes `Secret` resources and mounted into pods via secure runtime **environment variables**.

---

## 🤖 CI/CD with GitHub Actions

The automated pipeline in `.github/workflows/deploy.yml` handles:
1. **Build & Test:** Executing static checks and compiling multi-runtime images (Node.js + Python).
2. **Registry Push:** Publishing the official image tagged with the commit SHA to the container registry.
3. **Cluster Apply:** Securely connecting to the Kubernetes cluster in DigitalOcean and applying the updated manifests (`kubectl apply -f k8s/`).

---

## 🛠️ Deployment Guide (DigitalOcean DOKS + MongoDB Atlas)

> 💡 **Cloud-Agnostic Architecture Note:**  
> While this guide demonstrates deployment on **DigitalOcean Kubernetes Service (DOKS)** for cost-efficiency and simplicity, all manifests in `k8s/` are **100% standard and idempotent**. The architecture is entirely **cloud-agnostic** and can be deployed seamlessly to AWS EKS, Google Cloud GKE, Azure AKS, or on-premises Kubernetes clusters without modifying any core manifest files.

### Prerequisites
* A **MongoDB Atlas** account with a deployed database and its corresponding Connection String.
* A configured and accessible Kubernetes cluster in **DigitalOcean (DOKS)** via `kubectl`.
* Local tools installed: `git`, `docker`, `kubectl`.

### 1. Clone the Repository
```bash
git clone https://github.com/marcb76/mandelbrok8s.git
cd mandelbrok8s
```

### 2. Configure Kubernetes Secrets
Create the secrets file in your local environment (ensure it is not committed to Git):
```yaml
# k8s/secrets-mongo.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongo-secrets
  namespace: mandelbrok8s
type: Opaque
stringData:
  MONGO_URI: "mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority"
```
```yaml
# k8s/secrets-tls.yaml
apiVersion: v1
kind: Secret
metadata:
  name: tls-secrets
  namespace: mandelbrok8s
type: kubernetes.io/tls
stringData:
  tls.crt: |
    -----BEGIN CERTIFICATE-----
    MIIFLTCCAxWgAwIBAgIU... (Certificate)
    -----END CERTIFICATE-----
    -----BEGIN CERTIFICATE-----
    MIIEADCCAuigAwIBAgIB... (Intermediate certificate / CA Chain)
    -----END CERTIFICATE-----
  tls.key: |
    -----BEGIN PRIVATE KEY-----
    MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
    -----END PRIVATE KEY-----
```
Apply namespace and secrets:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets-mongo.yaml
kubectl apply -f k8s/secrets-tls.yaml
```

### 3. Build and Deploy Base Infrastructure
Deploy Worker, HPA manifests and Orchestrator (pod, service & ingress):
```bash
kubectl apply -f k8s/worker-deploy.yaml
kubectl apply -f k8s/worker-hpa.yaml
kubectl apply -f k8s/orchestrator-deploy.yaml
kubectl apply -f k8s/orchestrator-service.yaml
kubectl apply -f k8s/orchestrator-ingress.yaml
```

### 4. Verify Deployment Status
Check that pods are running properly and the HPA is active:
```bash
kubectl get pods -n mandelbrok8s
kubectl get hpa -n mandelbrok8s
```

---

## 🌐 Orchestrator REST API Specification

The Orchestrator exposes a RESTful API (`/api/v1`) providing complete operational control, dynamic configuration management, task batch injection, Kubernetes cluster observability, and health telemetry.

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/v1/system_config` | Fetches the active operational defaults and runtime configuration from MongoDB. |
| **PUT** | `/api/v1/system_config` | Dynamically updates operational parameters (polling intervals, timeouts, HPA thresholds, fractal defaults). |
| **GET** | `/api/v1/tasks` | Lists rendering task documents with optional pagination and status filtering (`?status=pending`). |
| **POST** | `/api/v1/tasks` | Injects new rendering tasks. Accepts `{ "count": N }` to generate multi-task load bursts for scaling demos. |
| **GET** | `/api/v1/tasks/{id}` | Retrieves execution state, claim metadata, progress, and performance metrics for a specific task. |
| **GET** | `/api/v1/tasks/{id}/image` | Streams the rendered PNG binary directly from MongoDB GridFS binary storage. |
| **DELETE** | `/api/v1/tasks` | Flushes all task records and associated GridFS chunks to reset the environment state. |
| **GET** | `/api/v1/k8s` | Returns overall Kubernetes cluster health, node readiness, and API connectivity status. |
| **GET** | `/api/v1/k8s/pods` | Lists active pod replicas, phase status, node distribution, and individual CPU/memory metrics. |
| **GET** | `/api/v1/k8s/pods/{name}` | Fetches detailed runtime metrics and recent execution logs for a specific pod. |
| **GET** | `/api/v1/k8s/hpa` | Exposes live Horizontal Pod Autoscaler metrics (target vs. actual CPU utilization, replica targets). |
| **GET** | `/healthz` | **Liveness Probe:** Returns `HTTP 200` if the Node.js event loop and MongoDB connection are active. Restarts pod on failure. |
| **GET** | `/readyz` | **Readiness Probe:** Returns `HTTP 200` when ready to serve Ingress traffic. Returns `HTTP 503` if MongoDB is down or during `SIGTERM`. |
| **GET** | `/metrics` | **API Telemetry:** Exposes API execution stats (requests per second, endpoint latencies, injected task counts, memory usage). |

---

## 🌐 Worker REST API Specification

While Worker pods operate as asynchronous background consumers, each replica executes an internal lightweight HTTP server (port `8080`) strictly for Kubernetes probes, graceful termination hooks, and instance-level diagnostic telemetry.

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/healthz` | **Liveness Probe:** Returns `HTTP 200` if the Node.js event loop is responsive and MongoDB connection is active. Restarts pod on failure. |
| **GET** | `/readyz` | **Readiness Probe:** Returns `HTTP 200` when the worker loop is active. Returns `HTTP 503` during graceful shutdown (`SIGTERM`) to halt new polling claims. |
| **GET** | `/metrics` | **Pod Telemetry:** Exposes pod-level execution stats (current active task ID, total tasks processed by instance, process uptime, memory usage). |

---

## 📂 Repository Structure

```text
mandelbrok8s/
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Actions pipeline (CI/CD)
├── .gitignore
├── app/
│   ├── orchestrator/              # Node.js API to inject tasks
│   ├── worker/                    # Node.js worker (Atomic polling + GridFS)
│   └── renderer/                  # Python CLI script with Numba JIT for fractal computation
├── docker/
│   ├── Dockerfile.orchestrator
│   └── Dockerfile.worker          # Multi-runtime image (Node.js + Python/Numba)
├── k8s/
│   ├── namespace.yaml
│   ├── secrets-mongo.yaml         # MongoDB Atlas connection credentials
│   ├── secrets-tls.yaml           # TLS: chain & key
│   ├── orchestrator-deploy.yaml
│   ├── orchestrator-service.yaml
│   ├── orchestrator-ingress.yaml
│   ├── worker-deploy.yaml
│   └── worker-hpa.yaml            # Horizontal Pod Autoscaler configuration
└── README.md
```