// /src/controllers/k8s.controller.ts - Controller for Kubernetes cluster monitoring endpoints of the Mandelbrok8s orchestrator application

// Import required modules
import { Request, Response } from 'express';
import { KubeConfig, CoreV1Api, AppsV1Api, AutoscalingV2Api } from '@kubernetes/client-node';




// Define default Kubernetes namespace and HPA name
const defaultTargetNamespace = `mandelbrok8s`;
const defaultHpaName = `worker-hpa`;
const hpaName = process.env.WORKER_HPA_NAME || defaultHpaName;
const targetNamespace = defaultTargetNamespace;


// Initialize Kubernetes API clients
const kc = new KubeConfig();
// Load configuration from cluster service account (in-cluster) or local kubeconfig file (development)
try {
  kc.loadFromDefault();
} catch (err: any) {
  console.warn(`[K8S_CTRL] Warning: Could not load default Kubernetes config, falling back to empty/mock setup: ${err.message}`);
}
const k8sApi = kc.makeApiClient(CoreV1Api);
//const k8sAppsApi = kc.makeApiClient(AppsV1Api);
const k8sAutoscalingApi = kc.makeApiClient(AutoscalingV2Api);








// K8sController
export class K8sController {
  // GET /api/v1/k8s - Returns overall Kubernetes cluster health and node readiness
  public static async getClusterHealth(req: Request, res: Response): Promise<void> {
    try {
      // Get list of nodes to determine cluster health
      const response = await k8sApi.listNode();
      const nodes = response.items;
      
      // Determine API server connectivity
      const apiServerConnected = !!k8sApi;

      // Response with cluster health information
      res.status(200).json({
        status: `success`,
        cluster: {
          status: `healthy`,
          nodeCount: nodes.length,
          apiServerConnected: apiServerConnected,
          nodes: nodes.map(node => ({
            name: node.metadata?.name,
            status: node.status?.conditions?.find(c => c.type === `Ready`)?.status === `True` ? `Ready` : `NotReady`
          })),
          timestamp: new Date()
        }
      });
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[K8S_CTRL] Error fetching cluster health: ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while fetching cluster health`,
        details: err.message
      });
    }
  }




  // GET /api/v1/k8s/pods - Lists active pod replicas, phase status, and distribution
  public static async listPods(req: Request, res: Response): Promise<void> {
    try {
      // Get all pods in the target namespace
      const response = await k8sApi.listNamespacedPod({ namespace: targetNamespace });
      const pods = response.items.map(pod => ({
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        phase: pod.status?.phase,
        node: pod.spec?.nodeName,
        startTime: pod.status?.startTime
      }));

      // Response with the list of pods
      res.status(200).json({
        status: `success`,
        namespace: targetNamespace,
        total: pods.length,
        pods
      });
    } catch (err: any) {
      // Log the error and respond with a 500 status code
      console.error(`[K8S_CTRL] Error listing pods: ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while listing pods`,
        details: err.message
      });
    }
  }




  // GET /api/v1/k8s/pods/:name - Fetches detailed runtime metrics and execution logs for a specific pod
  public static async getPodDetails(req: Request, res: Response): Promise<void> {
    try {
      // Extract the pod name from the request parameters
      const podName = req.params.name;

      // Fetch pod status/details
      const podResponse = await k8sApi.readNamespacedPod({ name: podName, namespace: targetNamespace });
      const pod = podResponse;

      // Fetch recent pod logs
      let logs: string[] = [];
      try {
        const logResponse = await k8sApi.readNamespacedPodLog({
          name: podName,
          namespace: targetNamespace,
          tailLines: 50
        });
        const logText = typeof logResponse === 'string' ? logResponse : String(logResponse);
        logs = logText.split('\n').filter(Boolean);
      } catch (logErr: any) {
        console.warn(`[K8S_CTRL] Warning: Could not fetch logs for pod ${podName}:`, logErr.message);
        logs = [`[WARNING] Could not retrieve container logs`];
      }

      // Respond with the pod details and recent logs
      res.status(200).json({
        status: `success`,
        pod: {
          name: pod.metadata?.name,
          namespace: pod.metadata?.namespace,
          phase: pod.status?.phase,
          restartCount: pod.status?.containerStatuses?.[0]?.restartCount || 0,
          node: pod.spec?.nodeName,
          recentLogs: logs
        }
      });
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[K8S_CTRL] Error fetching pod details. Pod: ${req.params.name}. Error: ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while fetching pod details. Pod: ${req.params.name}`,
        details: err.message
      });
    }
  }




// GET /api/v1/k8s/hpa - Exposes live Horizontal Pod Autoscaler metrics from the Kubernetes cluster
  public static async getHpaMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Fetch HPA details from the Kubernetes cluster
      const hpaResponse = await k8sAutoscalingApi.readNamespacedHorizontalPodAutoscaler({
        name: hpaName,
        namespace: targetNamespace
      });
      const hpa = hpaResponse;
      
      // Extract CPU metrics from V2 structure safely
      const cpuMetric = hpa.spec?.metrics?.find(m => m.type === `Resource` && m.resource?.name === `cpu`);
      const targetCPU = cpuMetric?.resource?.target?.averageUtilization || null;
      
      // Extract current CPU utilization from currentMetrics with explicit typing for safety
      const currentCpuStatus = hpa.status?.currentMetrics?.find((c: any) => c.type === `Resource` && c.resource?.name === `cpu`);
      const currentCPU = currentCpuStatus?.resource?.current?.averageUtilization || null;

      // Respond with the HPA metrics
      res.status(200).json({
        status: `success`,
        hpa: {
          name: hpa.metadata?.name,
          namespace: hpa.metadata?.namespace,
          minReplicas: hpa.spec?.minReplicas || 1,
          maxReplicas: hpa.spec?.maxReplicas || 1,
          currentReplicas: hpa.status?.currentReplicas || 0,
          desiredReplicas: hpa.status?.desiredReplicas || 0,
          targetCPUUtilizationPercentage: targetCPU,
          currentCPUUtilizationPercentage: currentCPU,
          lastScaleTime: hpa.status?.lastScaleTime || null
        }
      });
    } catch (err: any) {
      // Log the error for debugging purposes
      console.error(`[K8S_CTRL] Error fetching HPA metrics: ${err.message}`);
      res.status(500).json({
        status: `error`,
        message: `Internal server error while fetching HPA metrics`,
        details: err.message
      });
    }
  }
}