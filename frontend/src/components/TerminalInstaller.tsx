import { useState } from 'react'

interface Props {
  onComplete: () => void
  backendReady: boolean
}

// ⚠️ If you fork this project, replace ib3275 below with YOUR GitHub username.
const REPO_URL = 'https://github.com/ib3275/local-video-editor.git'

const WIN_CMD =
  `winget install -e --id Microsoft.PowerShell; ` +
  `winget install -e --id Gyan.FFmpeg; ` +
  `winget install -e --id Ollama.Ollama; ` +
  `git clone ${REPO_URL} local-editor; ` +
  `cd local-editor\\backend; ` +
  `python -m venv .venv; ` +
  `.\\.venv\\Scripts\\Activate.ps1; ` +
  `pip install -r requirements.txt; ` +
  `python main.py`

const MAC_CMD =
  `brew install ffmpeg ollama; ` +
  `git clone ${REPO_URL} local-editor; ` +
  `cd local-editor/backend; ` +
  `python3 -m venv .venv; ` +
  `source .venv/bin/activate; ` +
  `pip3 install -r requirements.txt; ` +
  `python3 main.py`

export default function TerminalInstaller({ onComplete, backendReady }: Props) {
  const [os, setOs] = useState<'windows' | 'mac'>('windows')
  const [copied, setCopied] = useState(false)
  const [showTroubleshoot, setShowTroubleshoot] = useState(false)

  const cmd = os === 'windows' ? WIN_CMD : MAC_CMD

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard API can fail on some browsers; fall back to selection
      const ta = document.createElement('textarea')
      ta.value = cmd
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Install the editor engine</h2>
        <p className="text-slate-400 mt-2">
          Copy the command below, paste it into your terminal, and press Enter.
          It downloads everything you need — including the AI — and starts the engine.
          This is a one-time setup.
        </p>
      </div>

      {/* OS toggle */}
      <div className="flex gap-2">
        {(['windows', 'mac'] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOs(o)}
            className={`px-5 py-2 rounded-lg font-medium transition
              ${os === o ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            {o === 'windows' ? '🪟 Windows' : '🍎 Mac / Linux'}
          </button>
        ))}
      </div>

      {/* Command box */}
      <div className="bg-black rounded-xl p-4 pr-32 font-mono text-xs sm:text-sm overflow-x-auto relative group">
        <pre className="text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">{cmd}</pre>
        <button
          onClick={copy}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold
                     bg-cyan-600 hover:bg-cyan-500 transition shadow-lg"
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>

      {/* Visual guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            n: '1',
            title: 'Open your terminal',
            desc:
              os === 'windows'
                ? 'Press Win + X, then click "Terminal" or "PowerShell".'
                : 'Press Cmd + Space, type "Terminal", press Enter.',
          },
          {
            n: '2',
            title: 'Paste & press Enter',
            desc:
              os === 'windows'
                ? 'Right-click inside the window to paste, then press Enter.'
                : 'Press Cmd + V to paste, then press Enter.',
          },
          {
            n: '3',
            title: 'Keep it open',
            desc:
              'Do not close that window. It is the engine powering this page.',
          },
        ].map((s) => (
          <div key={s.n} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center font-bold mb-2">
              {s.n}
            </div>
            <h4 className="font-medium mb-1 text-sm">{s.title}</h4>
            <p className="text-xs text-slate-400">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Live connection status */}
      <div
        className={`rounded-xl border p-4 transition-colors
          ${backendReady
            ? 'bg-emerald-950/50 border-emerald-700'
            : 'bg-amber-950/40 border-amber-700'}`}
      >
        <div className="flex items-center gap-3">
          {backendReady ? (
            <>
              <span className="text-2xl">🟢</span>
              <div className="flex-1">
                <p className="font-medium text-emerald-200">Engine detected!</p>
                <p className="text-xs text-emerald-300/80">
                  You're all set. Continue to choose your folders.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-200">
                  Waiting for your engine to start…
                </p>
                <p className="text-xs text-amber-300/80">
                  This page checks every 2 seconds. First run downloads ~7 GB — give it a few minutes.
                </p>
              </div>
            </>
          )}
        </div>

        {!backendReady && (
          <button
            onClick={() => setShowTroubleshoot((v) => !v)}
            className="mt-3 text-xs text-amber-300 underline hover:text-amber-100"
          >
            {showTroubleshoot ? 'Hide troubleshooting tips' : 'Taking too long? Click for troubleshooting →'}
          </button>
        )}

        {showTroubleshoot && !backendReady && (
          <ul className="mt-3 space-y-2 text-xs text-amber-100/90 list-disc list-inside border-t border-amber-800/50 pt-3">
            <li>Make sure the terminal window you pasted into is <strong>still open</strong>. Closing it stops the engine.</li>
            <li>Look at that window — if you see a red error, paste it into Google or send it to the person who made this site.</li>
            <li>First-time setup downloads about <strong>7 GB</strong> (AI model + dependencies). It can take 5–15 minutes on slow connections.</li>
            <li>When you see the line <code className="bg-black/50 px-1 rounded">Uvicorn running on http://0.0.0.0:8000</code>, you're live.</li>
            <li>Try refreshing this page once. If the engine is up, the badge below should flip green within 2 seconds.</li>
          </ul>
        )}
      </div>

      {/* Continue button — gated on backend */}
      <button
        onClick={onComplete}
        disabled={!backendReady}
        className={`w-full py-3 rounded-xl font-semibold text-lg transition
          ${backendReady
            ? 'bg-cyan-600 hover:bg-cyan-500'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
      >
        {backendReady ? 'Continue → Choose Folders' : 'Waiting for engine…'}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Already have the engine running from a previous session? This page will
        detect it automatically — no reinstall needed.
      </p>
    </div>
  )
}