"""Static checks for the Kubernetes manifests versioned in this repository."""

from pathlib import Path
import unittest

import yaml


K8S_DIR = Path(__file__).resolve().parents[1]
APP_NAMESPACE = "mandelbrok8s"

# Keep this list explicit: local Secret files are ignored by Git, and templates
# are examples rather than deployable resources.
MANIFEST_FILES = (
    "namespace.yaml",
    "orchestrator-deploy.yaml",
    "orchestrator-ingress.yaml",
    "orchestrator-rbac.yaml",
    "orchestrator-service.yaml",
    "worker-deploy.yaml",
    "worker-hpa.yaml",
)


def load_versioned_resources():
    """Read deployable manifests, supporting multi-document YAML files."""
    resources = []
    for filename in MANIFEST_FILES:
        path = K8S_DIR / filename
        with path.open(encoding="utf-8") as manifest_file:
            for resource in yaml.safe_load_all(manifest_file):
                if resource is not None:
                    resources.append((filename, resource))
    return resources


class KubernetesManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        missing = [
            filename
            for filename in MANIFEST_FILES
            if not (K8S_DIR / filename).is_file()
        ]
        if missing:
            raise FileNotFoundError(
                "Missing Kubernetes manifest files before YAML loading: "
                + ", ".join(missing)
            )

        cls.resources = load_versioned_resources()
        cls.documents = [resource for _, resource in cls.resources]

    def find_resource(self, kind, name, namespace=APP_NAMESPACE):
        for resource in self.documents:
            metadata = resource.get("metadata", {})
            if resource.get("kind") != kind or metadata.get("name") != name:
                continue
            if kind == "Namespace" or metadata.get("namespace") == namespace:
                return resource
        return None

    def test_expected_manifests_exist(self):
        missing = [filename for filename in MANIFEST_FILES if not (K8S_DIR / filename).is_file()]
        self.assertEqual(missing, [], f"Missing Kubernetes manifest files: {missing}")

    def test_manifests_have_valid_yaml_and_required_metadata(self):
        self.assertTrue(self.resources, "No Kubernetes resources were loaded")
        identities = set()

        for filename, resource in self.resources:
            with self.subTest(manifest=filename, name=resource.get("metadata", {}).get("name")):
                self.assertIsInstance(resource, dict)
                self.assertIsInstance(resource.get("apiVersion"), str)
                self.assertIsInstance(resource.get("kind"), str)
                metadata = resource.get("metadata", {})
                self.assertIsInstance(metadata.get("name"), str)

                if resource["kind"] not in ("Namespace", "ClusterRole", "ClusterRoleBinding"):
                    self.assertEqual(metadata.get("namespace"), APP_NAMESPACE)

                identity = (
                    resource["apiVersion"],
                    resource["kind"],
                    metadata.get("namespace"),
                    metadata["name"],
                )
                self.assertNotIn(identity, identities, f"Duplicate Kubernetes resource in {filename}")
                identities.add(identity)

    def test_namespace_and_application_resources_exist(self):
        expected_resources = (
            ("Namespace", APP_NAMESPACE),
            ("Deployment", "orchestrator-deployment"),
            ("Deployment", "worker-deployment"),
            ("Service", "orchestrator-service"),
            ("Ingress", "orchestrator-ingress"),
            ("HorizontalPodAutoscaler", "worker-hpa"),
        )
        for kind, name in expected_resources:
            with self.subTest(kind=kind, name=name):
                self.assertIsNotNone(self.find_resource(kind, name))

    def test_deployment_selectors_match_pod_labels(self):
        for deployment_name in ("orchestrator-deployment", "worker-deployment"):
            deployment = self.find_resource("Deployment", deployment_name)
            self.assertIsNotNone(deployment)
            pod_labels = deployment["spec"]["template"]["metadata"]["labels"]
            selector = deployment["spec"]["selector"]["matchLabels"]
            self.assertTrue(selector, f"{deployment_name} must define a pod selector")
            for key, value in selector.items():
                with self.subTest(deployment=deployment_name, label=key):
                    self.assertEqual(pod_labels.get(key), value)

    def test_service_selects_orchestrator_pods(self):
        deployment = self.find_resource("Deployment", "orchestrator-deployment")
        service = self.find_resource("Service", "orchestrator-service")
        self.assertIsNotNone(deployment)
        self.assertIsNotNone(service)

        pod_labels = deployment["spec"]["template"]["metadata"]["labels"]
        service_selector = service["spec"]["selector"]
        self.assertTrue(service_selector, "Service must define a selector")
        for key, value in service_selector.items():
            with self.subTest(label=key):
                self.assertEqual(pod_labels.get(key), value)

    def test_ingress_backend_references_service_and_port(self):
        ingress = self.find_resource("Ingress", "orchestrator-ingress")
        service = self.find_resource("Service", "orchestrator-service")
        self.assertIsNotNone(ingress)
        self.assertIsNotNone(service)

        paths = [
            path
            for rule in ingress["spec"].get("rules", [])
            for path in rule.get("http", {}).get("paths", [])
        ]
        self.assertTrue(paths, "Ingress must define at least one HTTP path")
        service_ports = service["spec"].get("ports", [])

        for path in paths:
            backend = path["backend"]["service"]
            self.assertEqual(backend["name"], service["metadata"]["name"])
            backend_port = backend["port"].get("number", backend["port"].get("name"))
            self.assertTrue(any(
                port.get("port") == backend_port or port.get("name") == backend_port
                for port in service_ports
            ), f"Ingress backend port {backend_port} does not exist on the Service")

    def test_hpa_targets_worker_deployment(self):
        hpa = self.find_resource("HorizontalPodAutoscaler", "worker-hpa")
        self.assertIsNotNone(hpa)
        target = hpa["spec"]["scaleTargetRef"]
        self.assertEqual(target["kind"], "Deployment")
        self.assertIsNotNone(self.find_resource("Deployment", target["name"]))

    def test_orchestrator_service_account_and_rbac_references_match(self):
        deployment = self.find_resource("Deployment", "orchestrator-deployment")
        self.assertEqual(
            deployment["spec"]["template"]["spec"].get("serviceAccountName"),
            "orchestrator-sa",
        )
        self.assertIsNotNone(self.find_resource("ServiceAccount", "orchestrator-sa"))

        role = self.find_resource("Role", "orchestrator-read")
        role_binding = self.find_resource("RoleBinding", "orchestrator-read")
        cluster_role = self.find_resource("ClusterRole", "orchestrator-node-read", namespace=None)
        cluster_binding = self.find_resource("ClusterRoleBinding", "orchestrator-node-read", namespace=None)
        for resource in (role, role_binding, cluster_role, cluster_binding):
            self.assertIsNotNone(resource)

        def allows(rules, api_group, resource_name, verb):
            return any(
                api_group in rule.get("apiGroups", [])
                and resource_name in rule.get("resources", [])
                and verb in rule.get("verbs", [])
                for rule in rules
            )

        self.assertTrue(allows(role["rules"], "", "pods", "list"))
        self.assertTrue(allows(role["rules"], "", "pods", "get"))
        self.assertTrue(allows(role["rules"], "", "pods/log", "get"))
        self.assertTrue(allows(role["rules"], "autoscaling", "horizontalpodautoscalers", "get"))
        self.assertTrue(allows(cluster_role["rules"], "", "nodes", "list"))

        service_account_subject = {
            "kind": "ServiceAccount",
            "name": "orchestrator-sa",
            "namespace": APP_NAMESPACE,
        }
        self.assertIn(service_account_subject, role_binding.get("subjects", []))
        self.assertEqual(role_binding["roleRef"].get("kind"), "Role")
        self.assertEqual(role_binding["roleRef"].get("name"), "orchestrator-read")
        self.assertIn(service_account_subject, cluster_binding.get("subjects", []))
        self.assertEqual(cluster_binding["roleRef"].get("kind"), "ClusterRole")
        self.assertEqual(cluster_binding["roleRef"].get("name"), "orchestrator-node-read")


if __name__ == "__main__":
    unittest.main()
