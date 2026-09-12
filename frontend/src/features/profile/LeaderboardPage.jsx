import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAsyncResource } from '../../hooks/useAsyncResource.js'
import { Button } from '../../ui/index.js'
import { AppHeader } from '../workspace/AppHeader.jsx'

const fetchLeaders = () => api.leaderboard(50)
export default function LeaderboardPage() {
  const { data, loading, error, reload } = useAsyncResource(fetchLeaders)
  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-4xl space-y-5 px-4 py-8"><h1 className="text-2xl font-semibold">Leaderboard</h1><p className="text-slate-600">Complete campaign quests to earn XP. Improving your stars earns the remaining reward.</p>{loading ? <p role="status">Loading leaderboard…</p> : error ? <div><p role="alert">{error.message}</p><Button onClick={reload}>Try again</Button></div> : !data?.items.length ? <p>No completed quests yet. <Link className="text-brand-700 underline" to="/">Start the campaign</Link></p> : <div className="overflow-x-auto rounded-lg border border-line bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">Top players by experience points</caption><thead className="bg-slate-50"><tr>{['Rank', 'Player', 'XP', 'Level', 'Stars', 'Quests'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.items.map((entry, index) => <tr key={index} className="border-t border-line"><td className="p-3">{index + 1}</td><th scope="row" className="p-3 font-medium">{entry.display_name}</th><td className="p-3">{entry.xp}</td><td className="p-3">{entry.level}</td><td className="p-3">{entry.total_stars}</td><td className="p-3">{entry.levels_completed}</td></tr>)}</tbody></table></div>}<Link className="inline-block text-brand-700 underline" to="/profile">Your profile</Link></main></div>
}
