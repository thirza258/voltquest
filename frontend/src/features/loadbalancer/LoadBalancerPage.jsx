import content from '@content/loadbalancer.json'
import ReadingTrack from '../courses/ReadingTrack.jsx'

export const LOADBALANCER_COURSES = content.courses

const track = {
  base: '/loadbalancer',
  courses: LOADBALANCER_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'Load balancing',
  codeExt: 'conf',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'load balancer nginx haproxy kubernetes service gateway ingress metallb reverse proxy',
  eyebrow: 'Load balancing & traffic management',
  title: 'Load balancing with NGINX, HAProxy and Kubernetes',
  intro: 'Go from L4 vs L7 fundamentals to a self-scaling Kubernetes service. Learn balancing algorithms, health checks and resilience, then set it up hands-on with NGINX, HAProxy, Kubernetes Services with MetalLB, and the Gateway API — with a real config or manifest for every course.',
  metrics: '8 courses · 32 section checkpoints · 8 exams',
  continueLabel: 'Continue the load-balancing path',
  capstoneId: 'lb-capstone',
  capstoneLabel: 'Jump to the auto-scaling capstone',
  allLabel: 'All load-balancing courses',
  searchLabel: 'Search load-balancing courses',
  disclosure: 'Study and take exams in any browser. Running the examples needs your own environment: Docker for the NGINX and HAProxy labs, and a Kubernetes cluster (kind, k3d or a cloud cluster) for the Kubernetes labs. On bare metal or kind, a Service of type LoadBalancer stays <pending> until MetalLB (or another implementation) assigns an address; k3d/k3s ship a built-in ServiceLB. On Docker Desktop for Mac, cluster-internal IPs may be unreachable from the host, so test from a container on the cluster network or use kubectl port-forward. VoltQuest does not run NGINX, HAProxy or Kubernetes in the browser. Lab step checkboxes record your own observations and verify nothing.',
  codeNote: 'Copy or download this configuration, then apply it in your own environment — Docker for NGINX/HAProxy, or a Kubernetes cluster for the manifests. VoltQuest does not run it in the browser.',
  langNote: 'Load-balancing course narratives, questions and example configuration are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'NGINX, HAProxy and Kubernetes documentation reviewed on {date}. Pin versions to match your cluster; the community ingress-nginx controller was retired in March 2026, so new clusters should use the Gateway API.',
}

export default function LoadBalancerPage() {
  return <ReadingTrack track={track} />
}
