import { useI18n } from '../../i18n/index.jsx'
/** Route component for `/` — the shell header plus the campaign map. */
import { AppHeader } from '../workspace/AppHeader.jsx'
import { CampaignMap } from './CampaignMap.jsx'
import { Link } from 'react-router-dom'
import { TUTORIALS } from '../../content/index.js'

export function CampaignPage() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-screen flex-col bg-surface-page">
      <AppHeader />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 pt-6"><Link to="/tutorials" className="block rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800"><strong>{t("Start learning in the tutorial lab →")}</strong><span className="mt-1 block">{TUTORIALS.length}{t(" guided circuits for Arduino, ESP32 and Raspberry Pi, from Easy to Hard.")}</span></Link></div>
        <CampaignMap />
      </main>
    </div>
  )
}

export default CampaignPage
