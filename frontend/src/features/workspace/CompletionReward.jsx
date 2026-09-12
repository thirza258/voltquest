import { useI18n } from '../../i18n/index.jsx'
import { useEffect, useState } from 'react'

export default function CompletionReward({ xp = 0, unlocked }) {
  const { t } = useI18n()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(xp); return }
    let frame
    let start
    const tick = time => {
      start ??= time
      const fraction = Math.min(1, (time - start) / 650)
      setShown(Math.round(xp * (1 - (1 - fraction) ** 3)))
      if (fraction < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [xp])
  const items = [...(unlocked?.skins ?? []), ...(unlocked?.wirePalettes ?? [])]
  return <div><p className="font-semibold text-brand-700" aria-label={`${xp} XP earned`}><span aria-hidden="true">+{shown}{t(" XP")}{xp === 0 ? t(" (already earned)") : ''}</span></p>{items.length > 0 && <p className="mt-2 text-sm">{t("Unlocked: ")}{items.map(item => item.name).join(', ')}{t(". Choose them in your profile.")}</p>}</div>
}
