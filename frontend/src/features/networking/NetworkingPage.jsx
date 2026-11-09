import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import content from '@content/networking.json'
import { useI18n } from '../../i18n/index.jsx'
import ReadingTrack from '../courses/ReadingTrack.jsx'
import SecurityBridges from '../courses/SecurityBridges.jsx'
import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'
import { labProject } from '../../engine/network/lab.js'
import NetworkLab from './NetworkLab.jsx'

export const NETWORKING_COURSES = content.courses

/** The bench opens on a small working LAN so a first ping succeeds before anything is built. */
export const STARTER_TOPOLOGY = {
  devices: [
    { name: 'PC1', type: 'pc', x: 120, y: 300, host: { ip: '192.168.1.10', mask: '255.255.255.0', gateway: '192.168.1.1' } },
    { name: 'PC2', type: 'pc', x: 380, y: 300, host: { ip: '192.168.1.11', mask: '255.255.255.0', gateway: '192.168.1.1' } },
    { name: 'S1', type: 'switch', x: 250, y: 170 },
    { name: 'R1', type: 'router', x: 520, y: 170 },
  ],
  links: ['PC1 Fa0 S1 Fa0/1', 'PC2 Fa0 S1 Fa0/2', 'S1 Gi0/1 R1 Gi0/0'],
}

function CourseLab({ course }) {
  const { t } = useI18n()
  const project = useMemo(() => labProject(course.lab.topology, course.lab.title).project, [course])
  return <div className="space-y-3 border-t border-line pt-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Interactive lab')}</p>
    <h3 className="text-lg font-semibold text-ink">{course.lab.title}</h3>
    <p className="text-sm leading-6 text-ink-secondary">{course.lab.brief}</p>
    <NetworkLab key={course.id} initialProject={project} lab={course.lab} />
    <p className="text-sm"><Link className="font-medium text-brand-700 underline" to={`/sandbox?bench=network&lesson=${course.id}`} target="_blank" rel="noopener noreferrer">{t('Open a sandbox copy in a new tab')}</Link></p>
  </div>
}

const track = {
  base: '/networking',
  courses: NETWORKING_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'Networking',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'network networking switch router vlan trunk subnet ipv4 cidr arp mac ospf static route dhcp dns acl access list nat pat packet ping traceroute',
  eyebrow: 'Networking · Switching, routing and services',
  title: 'Computer Networking with a Network Simulator',
  intro: 'Build and troubleshoot networks from the ground up: IPv4 addressing and subnetting, Ethernet switching and ARP, VLANs and trunks, static and OSPF routing, DHCP and DNS, access lists and NAT. Every course ends in a lab you configure from the command line and check against its goals.',
  metrics: '10 courses · 40 section checkpoints · 10 interactive labs · 10 exams',
  continueLabel: 'Continue the networking path',
  capstoneId: 'net-nat',
  capstoneLabel: 'Jump to the branch network capstone',
  allLabel: 'All networking courses',
  searchLabel: 'Search networking courses',
  benchHref: '/sandbox?bench=network',
  benchLabel: 'Open the network simulator',
  disclosure: 'The labs run a teaching model of switches, routers, PCs and servers in this browser. Commands follow the widely used router/switch command-line style, but the model is simplified: no Spanning Tree, IPv6, passwords or real timers, OSPF is a single area without elections, and nothing is sent to a real network.',
  labNote: 'Follow the steps in the lab below. Step checks record your own progress for this visit; the lab’s Check results button tests the network itself.',
  langNote: 'Networking course narratives, questions and lab text are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'Networking content reviewed on {date}. Protocol behaviour follows the cited RFCs and IEEE standards within the documented simplifications.',
  Lab: CourseLab,
  hubExtra: <SecurityBridges current="networking" />,
}

export default function NetworkingPage({ sandbox = false }) {
  const { t } = useI18n()
  const [search] = useSearchParams()
  const lesson = sandbox ? NETWORKING_COURSES.find(item => item.id === search.get('lesson')) : null
  const project = useMemo(() => lesson ? labProject(lesson.lab.topology, lesson.lab.title).project : labProject(STARTER_TOPOLOGY, 'My network').project, [lesson])
  if (sandbox) {
    return <SandboxBenchLayout bench="network"
      description={t('Build networks of PCs, servers, switches and routers, configure them from the command line, and replay every frame step by step. A teaching model that runs entirely in this browser.')}
      courseLink={lesson ? `/networking/${lesson.id}` : '/networking'} courseLinkLabel={t(lesson ? 'Back to the course' : 'All networking courses')}>
      <NetworkLab key={lesson?.id ?? 'free'} initialProject={project} lab={lesson?.lab ?? null} editable />
    </SandboxBenchLayout>
  }
  return <ReadingTrack track={track} />
}
