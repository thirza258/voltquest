# Kubernetes track

`/kubernetes` and `/kubernetes/:lessonId` provide ten reading-only Kubernetes architecture and DevOps courses
(`content/kubernetes.json`), rendered by the shared `features/courses/ReadingTrack.jsx` component and
configured by `features/kubernetes/KubernetesPage.jsx`. Each course has four sections with a practice
question, a guided setup lab with an expected result, a complete, self-contained, valid Kubernetes YAML
manifest (copied or downloaded as `.yaml`), an applied challenge and a five-question 80% exam using the shared
progress and certificate systems.

## Courses

1. `k8s-architecture`: **1. Kubernetes architecture & control plane** — kube-apiserver, etcd (Raft consensus),
   kube-scheduler, kube-controller-manager, kubelet, kube-proxy, declarative reconciliation loops, Namespaces,
   ResourceQuotas and LimitRanges.
2. `k8s-pods-workloads`: **2. Pods, ReplicaSets & Deployments** — The Pod lifecycle, multi-container init and
   sidecar patterns, ReplicaSet controllers, and zero-downtime rolling updates with `maxSurge` and `maxUnavailable`.
3. `k8s-config-secrets`: **3. ConfigMaps, Secrets & Environment Injection** — Decoupling config from code,
   Secret types (Opaque, TLS), base64 encoding vs encryption, env vars vs volume mounts, and immutable ConfigMaps.
4. `k8s-services-networking`: **4. Services, CoreDNS & Cluster Networking** — The IP-per-Pod network model, CNI
   plugins, ClusterIP, NodePort, LoadBalancer, Headless Services (`clusterIP: None`), CoreDNS discovery, and
   EndpointSlices.
5. `k8s-ingress-gateway`: **5. Ingress & the Gateway API** — Layer-7 HTTP routing, TLS termination, why Ingress is
   feature-frozen, the retirement of community ingress-nginx in March 2026, and the modern Gateway API
   (`gateway.networking.k8s.io/v1`) with canary traffic splitting.
6. `k8s-storage-persistence`: **6. Storage, PVs, PVCs & StorageClasses** — Ephemeral storage (`emptyDir`,
   `hostPath`) vs persistent storage, PersistentVolumes, PersistentVolumeClaims, StorageClasses, CSI drivers, and
   `volumeBindingMode: WaitForFirstConsumer`.
7. `k8s-statefulsets-daemonsets`: **7. StatefulSets, DaemonSets, Jobs & CronJobs** — StatefulSet ordinals, stable
   network identities, `volumeClaimTemplates`, node-wide DaemonSets, batch Jobs, and CronJobs with `concurrencyPolicy`.
8. `k8s-scheduling-resilience`: **8. Scheduling, Health Probes & Resource Management** — Scheduler filtering and
   scoring, node affinity, pod anti-affinity, taints, tolerations, `kubectl drain`, health probes (startup,
   liveness, readiness), QoS classes, and OOM prevention.
9. `k8s-security-rbac`: **9. Security: RBAC, NetworkPolicies & Pod Hardening** — Role-Based Access Control
   (least-privilege verbs/resources), workload ServiceAccounts, default-deny NetworkPolicies, Pod Security Standards
   (Restricted), and container hardening with `securityContext`.
10. `k8s-capstone`: **10. Production capstone: GitOps, Helm, CRDs & Auto-scaling** — Horizontal Pod Autoscaler
    (HPA v2), PodDisruptionBudgets (PDB), Helm packaging, Custom Resource Definitions (CRDs), the Operator Pattern,
    and GitOps delivery workflows (ArgoCD / Flux).

## Current as of the review date (2026-10-20)

- Aligns with modern Kubernetes GA APIs (1.28-1.31) and the **Gateway API v1** (`gateway.networking.k8s.io/v1`).
- The course explicitly notes that the community **ingress-nginx** controller was **retired/archived in March 2026**,
  and teaches Gateway API as the standard modern L7 routing approach.
- Demonstrates HorizontalPodAutoscaler under `autoscaling/v2` (GA) with CPU/memory targets and scaling behaviors.
- Enforces modern Pod Security Standards (`pod-security.kubernetes.io/enforce: restricted`) and seccomp `RuntimeDefault`.
- Emphasizes `WaitForFirstConsumer` volume binding in multi-zone clusters to prevent cross-zone attachment failures.

## Certification Alignment (CKA, CKAD, CKS)

The 10 courses map directly to the Linux Foundation & Cloud Native Computing Foundation (CNCF) professional certification curricula:

1. **CKA (Certified Kubernetes Administrator)**:
   - *Cluster Architecture, Installation & Configuration (25%)*: Course 1 (`k8s-architecture`).
   - *Workloads & Scheduling (15%)*: Course 2 (`k8s-pods-workloads`), Course 8 (`k8s-scheduling-resilience`).
   - *Services & Networking (20%)*: Course 4 (`k8s-services-networking`), Course 5 (`k8s-ingress-gateway`).
   - *Storage (10%)*: Course 6 (`k8s-storage-persistence`), Course 7 (`k8s-statefulsets-daemonsets`).
   - *Troubleshooting & Node Maintenance (30%)*: Course 8 (`kubectl drain`, probes, QoS), Course 10 (`k8s-capstone`).

2. **CKAD (Certified Kubernetes Application Developer)**:
   - *Application Design & Build (20%)*: Course 2 (`initContainers`, sidecars).
   - *Application Deployment (20%)*: Course 2 (RollingUpdate, rollback strategies), Course 10 (Helm, GitOps).
   - *Application Observability & Maintenance (15%)*: Course 8 (startup, liveness, readiness probes).
   - *Application Environment, Configuration & Security (25%)*: Course 3 (ConfigMaps, Secrets, volume mounts), Course 9 (securityContext).
   - *Services & Networking (20%)*: Course 4 (ClusterIP, Headless), Course 5 (Gateway API HTTPRoutes).

3. **CKS (Certified Kubernetes Security Specialist)**:
   - *Cluster Setup & Hardening (15%)*: Course 1 (ResourceQuotas, LimitRanges), Course 9 (RBAC least privilege).
   - *System & Workload Hardening (30%)*: Course 9 (`runAsNonRoot`, `readOnlyRootFilesystem`, `capabilities.drop: [ALL]`, Restricted PSS).
   - *Microservice Vulnerabilities & Network Security (20%)*: Course 9 (default-deny NetworkPolicies, ingress/egress microsegmentation).
   - *Supply Chain & Config Security (20%)*: Course 3 (immutable ConfigMaps and Secrets), Course 10 (declarative GitOps reconciliation).

### VoltQuest Course Certificates
Every course includes a five-question 80% passing exam. Learners who score ≥80% can issue a signed, tamper-evident
PDF certificate with a permanent public verification URL at `/certificates/:certificateId` and automatic portfolio
tracking under `/certificates`.

## Honesty and verification

Nothing runs in the browser. VoltQuest does not simulate or run a Kubernetes cluster in client JavaScript.
During authoring, every YAML manifest was parsed and structurally validated:
- `backend/tests/test_kubernetes_content.py` parses all multi-document YAML manifests using PyYAML, asserting valid
  `apiVersion`, `kind`, `metadata.name`, matching label selectors for Deployments/StatefulSets/Services, valid container
  specs, and proper probe/resource definitions.
- All 10 courses provide 4 lessons with questions and a 5-question 80% passing exam (9 unique questions per course).
- All 10 courses are registered in the backend certificate catalogue (`kubernetes.json`), issuing and verifying exact PDFs.
- The hub disclosure clearly states that taking exams and studying works in any browser, while applying manifests requires
  the learner's own Kubernetes cluster (kind, k3d, minikube, or a cloud provider).
- Lab step checkboxes record user self-checks for this visit only and verify nothing.

## Wiring

- Route in `frontend/src/App.jsx` (`/kubernetes` and `/kubernetes/:lessonId`).
- Nav active section in `frontend/src/features/workspace/AppHeader.jsx`.
- Landing page footer in `frontend/src/features/landing/LandingPage.jsx`.
- Course directory card in `frontend/src/features/courses/coursesDirectory.js` (`systems` domain).
- Sitemap generation in `frontend/vite-sitemap.js` and regenerated `frontend/public/sitemap.xml` (517 URLs).
- Certificate catalogue entry in `backend/app/services/certificates.py` (`kubernetes.json`, 224 total courses).
- Indonesian translations in `frontend/src/i18n/id.json`.
- Test suites: `frontend/src/features/kubernetes/kubernetes.test.jsx`, `backend/tests/test_kubernetes_content.py`,
  `frontend/src/features/sandbox/sandboxNav.test.jsx`, and `frontend/vite-sitemap.test.js`.
