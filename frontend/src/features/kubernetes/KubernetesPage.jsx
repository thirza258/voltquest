import content from '@content/kubernetes.json'
import ReadingTrack from '../courses/ReadingTrack.jsx'

export const KUBERNETES_COURSES = content.courses

const track = {
  base: '/kubernetes',
  courses: KUBERNETES_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'Kubernetes',
  codeExt: 'yaml',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'kubernetes k8s cka ckad cks certification pod deployment service ingress gateway storage rbac hpa helm gitops cni csi operator',
  eyebrow: 'Cloud-native container orchestration · CKA / CKAD / CKS certification prep',
  title: 'Production Kubernetes Architecture & DevOps',
  intro: 'Master Kubernetes for production and professional certification (aligned with CNCF CKA, CKAD, and CKS curriculum domains). Cover control-plane architecture, workload design, Gateway API, persistent storage, security hardening, and GitOps automation — with verified YAML manifests and course certificates for every exam passed.',
  metrics: '10 courses · 40 section checkpoints · 10 exams',
  continueLabel: 'Continue the Kubernetes path',
  capstoneId: 'k8s-capstone',
  capstoneLabel: 'Jump to the production capstone',
  allLabel: 'All Kubernetes courses',
  searchLabel: 'Search Kubernetes courses',
  disclosure: 'Study and take exams in any browser. Applying the manifests needs your own Kubernetes cluster — such as kind, k3d, minikube, or a managed cloud cluster (EKS, GKE, AKS) with kubectl configured. On local kind clusters, Services of type LoadBalancer require MetalLB, and Ingress or Gateway resources require an active controller. VoltQuest does not run Kubernetes or apply manifests in the browser. Lab step checkboxes record your own observations and verify nothing.',
  codeNote: 'Copy or download this complete Kubernetes manifest, then inspect or apply it in your own cluster using kubectl apply -f. VoltQuest does not run Kubernetes in the browser.',
  langNote: 'Kubernetes course narratives, questions and example manifests are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'Kubernetes API and documentation reviewed on {date}. Manifests adhere to Kubernetes 1.28-1.31 GA standards and Gateway API v1.',
}

export default function KubernetesPage() {
  return <ReadingTrack track={track} />
}
