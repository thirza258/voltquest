# Load balancing track

`/loadbalancer` and `/loadbalancer/:lessonId` provide eight reading-only load-balancing courses
(`content/loadbalancer.json`), rendered by the shared `features/courses/ReadingTrack.jsx` component and
configured by `features/loadbalancer/LoadBalancerPage.jsx`. Each course has four sections with a practice
question, a guided setup lab with an expected result, a complete config or manifest (copied or downloaded),
an applied challenge and a five-question 80% exam using the shared progress and certificate systems. Because
the artifacts differ in type, each course sets its own `codeExt` (`conf`, `cfg` or `yaml`), which
`ReadingTrack` uses for the download filename.

## Courses

`lb-fundamentals`, `lb-algorithms`, `lb-health`, `lb-nginx`, `lb-haproxy`, `lb-kubernetes`, `lb-gateway`,
`lb-capstone` — from L4-vs-L7 fundamentals and balancing algorithms through health/resilience, hands-on
NGINX and HAProxy, Kubernetes Services + MetalLB (L4), the Gateway API (L7), to a load-balanced,
auto-scaling app (Deployment + Service + HPA).

## Current as of the review date (2026-10-12)

- The community **ingress-nginx** controller was **retired/archived in March 2026** (no releases or security
  fixes). The course teaches the **Gateway API** (`gateway.networking.k8s.io/v1`, GA) as the modern L7 path
  and presents Ingress as feature-frozen; it does not stand up ingress-nginx.
- MetalLB uses `metallb.io/v1beta1` (`IPAddressPool` + `L2Advertisement`); the pool must sit inside the node
  network subnet. On kind, `type: LoadBalancer` stays `<pending>` without MetalLB; k3d/k3s ship a built-in
  ServiceLB. NGINX open-source does passive health checks only (active checks are NGINX Plus); HAProxy
  open-source does active checks (`server ... check`).

## Honesty and verification

Nothing runs in the browser. During authoring: the **NGINX** configs (fundamentals, all four algorithm
variants, health and the full reverse proxy) passed `nginx -t` against `traefik/whoami` backends on a Docker
network, and the reverse proxy load-balanced across both (responses alternated); the **HAProxy** config
loaded and balanced the same way (HAProxy requires a trailing newline on the file, which the generator
enforces). For **Kubernetes**, the built-in capstone manifest (Deployment, Service, HPA) passes
`kubectl apply --dry-run=client`; the MetalLB and Gateway API manifests use custom resources whose CRDs are
not installed, so client dry-run reports "no matches for kind" and they are instead YAML-parsed and
structurally checked (apiVersion/kind/name present, Deployment selector == pod labels, Service selector
matches pod labels, `targetPort` == `containerPort`). The hub disclosure states the Docker/cluster
requirements and the macOS reachability caveat. Lab checkboxes verify nothing.

## Wiring

Route in `App.jsx`, nav section in `AppHeader.jsx`, sitemap in `vite-sitemap.js`, directory card in
`coursesDirectory.js` (`systems` domain), certificate catalogue entry (`loadbalancer.json`), Indonesian
chrome in `i18n/id.json`. `features/loadbalancer/loadbalancer.test.jsx` validates the content shape, the
per-course `codeExt` download filenames, and the hub/course/exam behaviour.
