import { useI18n } from '../../i18n/index.jsx'
export default function CircuitInsights({ level, state }) {
  const { t } = useI18n()
  const evaluation = state?.evaluation
  return <section className="space-y-4 overflow-auto p-3" aria-label={t("Circuit insights")}>
    {level?.learn && <div><h3 className="mb-2 font-semibold">{t(level.learn.title)}</h3><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{t(level.learn.body)}</p>{level.learn.links?.map(link => <a key={link.url} href={link.url} rel="noreferrer" target="_blank" className="text-sm text-brand-700 underline">{link.title ?? link.url}</a>)}</div>}
    <div><h3 className="font-semibold">{t("Supply current")}</h3><p className="text-sm text-slate-600">{((evaluation?.supplyCurrentA ?? 0) * 1000).toFixed(1)}{t(" / 500 mA learning budget")}</p><meter className="w-full" min="0" max="500" value={(evaluation?.supplyCurrentA ?? 0) * 1000} aria-label={t("Supply current in milliamps")} /></div>
    <div><h3 className="mb-2 font-semibold">{t("Warnings")}</h3>{state?.warnings?.length ? state.warnings.map((warning, i) => <p key={i} className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{warning.message} {warning.hint}</p>) : <p className="text-sm text-slate-600">{t("No circuit warnings.")}</p>}</div>
    <div className="overflow-auto"><h3 className="mb-2 font-semibold">{t("Electrical nets")}</h3><table className="w-full text-left text-xs"><thead><tr><th className="p-1">{t("Net")}</th><th className="p-1">{t("Voltage")}</th><th className="p-1">{t("Terminals")}</th></tr></thead><tbody>{state?.compiled?.nets?.map(net => <tr key={net.id} className="border-t border-line"><td className="p-1">{net.label ?? net.id}</td><td className="p-1 font-mono">{(evaluation?.nodeVoltages?.[net.id] ?? 0).toFixed(2)}{t(" V")}</td><td className="p-1">{net.terminals?.length ?? 0}</td></tr>)}</tbody></table></div>
  </section>
}
