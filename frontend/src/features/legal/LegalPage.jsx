import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppHeader } from '../workspace/AppHeader';
import { Shield, FileText, Server, Cpu, ExternalLink, ArrowLeft } from 'lucide-react';

export function LegalPage() {
  const location = useLocation();
  const initialTab = location.pathname.includes('terms') ? 'terms' : 'privacy';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors mb-4"
          >
            <ArrowLeft size={16} /> Back to VoltQuest
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                {activeTab === 'privacy' ? <Shield className="text-cyan-400" size={32} /> : <FileText className="text-cyan-400" size={32} />}
                {activeTab === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Last updated: November 2026 · VoltQuest Hardware & Software Lab
              </p>
            </div>

            <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'privacy'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'terms'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'privacy' ? (
          <div className="space-y-8 text-slate-300 leading-relaxed text-sm">
            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Server className="text-cyan-400" size={20} />
                1. 100% Self-Hosted & Local Data Retention
              </h2>
              <p className="mb-3">
                VoltQuest is deployed as a fully self-hosted hardware and software simulation platform.
                All user accounts, progress tracking, circuit schematics, assembly code, spreadsheet simulations,
                and execution logs reside exclusively on your dedicated self-hosted server instances.
              </p>
              <p>
                We do not collect telemetry, track browsing behavior across websites, sell personal information,
                nor transfer your database records to third-party data brokers or marketing services.
              </p>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Cpu className="text-cyan-400" size={20} />
                2. AI Assistant & OpenRouter Third-Party Provider
              </h2>
              <p className="mb-3">
                VoltQuest incorporates AI-assisted mentoring for circuit troubleshooting, assembly analysis, and code advice.
                AI capabilities in VoltQuest are powered through <strong>OpenRouter</strong> as the upstream LLM inference provider.
              </p>
              <p className="mb-3">
                When you explicitly submit a prompt or code snippet to the VoltQuest AI Assistant:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 mb-4 text-slate-300">
                <li>Only the contextual prompt and code necessary to fulfill your query are transmitted to OpenRouter.</li>
                <li>No database credentials, underlying server configurations, or unrelated private files are shared.</li>
              </ul>
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700/80 space-y-2">
                <p className="text-xs text-slate-400 font-mono">OpenRouter Legal Policies:</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <a
                    href="https://openrouter.ai/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-cyan-400 hover:underline"
                  >
                    OpenRouter Privacy Policy <ExternalLink size={12} />
                  </a>
                  <a
                    href="https://openrouter.ai/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-cyan-400 hover:underline"
                  >
                    OpenRouter Terms of Service <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">3. Local Storage & Session Data</h2>
              <p>
                VoltQuest utilizes browser storage (such as <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">localStorage</code> and cookies)
                solely for essential session authentication, theme preferences, and local circuit editor caching.
                These are never shared across external origins.
              </p>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">4. Data Deletion & Export</h2>
              <p>
                Because this installation is self-hosted, you or your server administrator retain absolute control over
                all stored data. Deleting accounts or resetting project volumes permanently purges records from the server storage.
              </p>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">5. Privacy Contact</h2>
              <p>
                For any privacy inquiries, data questions, or support, please contact us at:{" "}
                <a href="mailto:nevatalapp@gmail.com" className="text-cyan-400 hover:underline font-mono">
                  nevatalapp@gmail.com
                </a>
              </p>
            </section>
          </div>
        ) : (
          <div className="space-y-8 text-slate-300 leading-relaxed text-sm">
            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">1. Agreement to Terms</h2>
              <p>
                By accessing or using the self-hosted VoltQuest environment, you agree to these Terms of Service.
                If you are hosting or utilizing this installation within an institution or organization, you confirm that you have
                the authority to bind your organization to these terms.
              </p>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">2. Educational & Simulation Use</h2>
              <p className="mb-2">
                VoltQuest provides simulation engines for hardware, embedded systems, AVR/RISC-V architectures, and spreadsheets.
                Simulations are intended for educational, experimental, and research purposes.
              </p>
              <p>
                Simulated execution timings and electronic behaviors may differ from physical silicon or electrical characteristics;
                do not rely on simulation outputs as the sole verification for high-risk physical hardware deployments.
              </p>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">3. AI Services & Third-Party APIs</h2>
              <p className="mb-3">
                Users interacting with AI assistant features acknowledge that inference is handled via <strong>OpenRouter</strong>.
                You agree not to submit malicious prompts, prompt injections designed to violate third-party model safeguards,
                or unlawful content. Review the <a href="https://openrouter.ai/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">OpenRouter Terms of Service</a> for provider requirements.
              </p>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">4. Disclaimer of Warranty</h2>
              <p>
                VoltQuest is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis, without warranties of any kind,
                either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose,
                or non-infringement.
              </p>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">5. Limitation of Liability</h2>
              <p>
                In no event shall the maintainers or hosts of VoltQuest be liable for any indirect, incidental, special,
                consequential, or punitive damages arising from the use of or inability to use this software.
              </p>
            </section>

            <section className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3">6. Terms Contact</h2>
              <p>
                For questions regarding these Terms of Service, contact:{" "}
                <a href="mailto:nevatalapp@gmail.com" className="text-cyan-400 hover:underline font-mono">
                  nevatalapp@gmail.com
                </a>
              </p>
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>VoltQuest · Self-Hosted Laboratory · Privacy &amp; Terms</p>
      </footer>
    </div>
  );
}

export default LegalPage;
