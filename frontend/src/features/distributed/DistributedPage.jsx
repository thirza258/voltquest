import content from '@content/distributed.json'
import ReadingTrack from '../courses/ReadingTrack.jsx'

export const DISTRIBUTED_COURSES = content.courses

const track = {
  base: '/distributed',
  courses: DISTRIBUTED_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'Distributed systems',
  codeExt: 'py',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'distributed systems consensus raft replication consistency cap sharding partitioning quorum',
  eyebrow: 'Distributed systems',
  title: 'Build reliable distributed systems',
  intro: 'Go from partial failure and the fallacies to a sharded, replicated key-value store. Learn logical and vector clocks, replication and quorums, consistency models and CAP, Raft consensus, partitioning, fault tolerance, distributed transactions and coordination — each with a small, runnable Python simulation.',
  metrics: '10 courses · 40 section checkpoints · 10 exams',
  continueLabel: 'Continue the distributed-systems path',
  capstoneId: 'ds-capstone',
  capstoneLabel: 'Jump to the key-value store capstone',
  allLabel: 'All distributed-systems courses',
  searchLabel: 'Search distributed-systems courses',
  disclosure: 'Study and take exams in any browser. The examples are small, self-contained Python 3 programs that model distributed-systems mechanisms (they simulate nodes and messages in one process; they are teaching models, not production systems). Run them with python3 in your own environment — they use only the standard library. VoltQuest does not run them in the browser. Lab step checkboxes record your own observations and verify nothing.',
  codeNote: 'Read, copy or download this complete, self-contained Python program, then run it with python3 in your own environment (standard library only). VoltQuest does not run it in the browser.',
  langNote: 'Distributed-systems course narratives, questions and example source are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'Distributed-systems references (Designing Data-Intensive Applications, the Raft paper, Jepsen) reviewed on {date}.',
}

export default function DistributedPage() {
  return <ReadingTrack track={track} />
}
