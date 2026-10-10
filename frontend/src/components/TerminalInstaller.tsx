import { useState, useMemo } from 'react'

interface Props {
  onComplete: () => void
  backendReady: boolean
}

// ⚠️ Replace ib3275 with your GitHub username if you fork this project.
const REPO_URL = 'https://github.com/ib3275/local-video-editor.git'

// ──────────────────────────────────────────────────────────────
//  Path quoting — protects against spaces and special characters
// ──────────────────────────────────────────────────────────────
function quotePath(p: string, os: 'windows' | 'mac'): string {
  if (!p) return p
  if (os === 'windows') {
    // PowerShell: single-quote anything with spaces or shell-sensitive chars
    if (/[\s'"`$(){}[\]]/.test(p)) return `'${p.replace(/'/g, "''")}'`
    return p
  }
  // Bash: double-quote anything risky
  if (/[\s'"`$(){}[\]&|;<>]/.test(p)) return `"${p.replace(/"/g, '\\"')}"`
  return p
}

function buildCommands(installPath: string, os: 'windows' | 'mac') {
  const p = (installPath || 'local-editor').replace(/[/\\]+$/, '')
  const q = quotePath(p, os)

  if (os === 'windows') {
    return {
      full:
        `git clone ${REPO_URL} ${q}; ` +
        `cd ${q}\\backend; ` +
        `python -m venv .venv; ` +
        `.\\.venv\\Scripts\\Activate.ps1; ` +
        `pip install -r requirements.txt; ` +
        `python main.py`,
      restart:
        `cd ${q}\\backend; ` +
        `.\\.venv\\Scripts\\Activate.ps1; ` +
        `python main.py`,
    }
  }
  return {
    full:
      `brew install ffmpeg ollama; ` +
      `git clone ${REPO_URL} ${q}; ` +
      `cd ${q}/backend; ` +
      `python3 -m venv .venv; ` +
      `source .venv/bin/activate; ` +
      `pip3 install -r requirements.txt; ` +
      `python3 main.py`,
    restart:
      `cd ${q}/backend; ` +
      `source .venv/bin/activate; ` +
      `python3 main.py`,
  }
}

// ──────────────────────────────────────────────────────────────
//  Component
// ──────────────────────────────────────────────────────────────
export default function TerminalInstaller({ onComplete, backendReady }: Props) {
  const [os, setOs] = useState<'windows' | 'mac'>('windows')
  const [installPath, setInstallPath] = useState('local-editor')
  const [copied, setCopied] = useState<'full' | 'restart' | null>(null)
  const [showTroubleshoot, setShowTroubleshoot] = useState(false)
  const [showInfoBox, setShowInfoBox] = useState(true)
  const [showRestart, setShowRestart] = useState(false)

  const cmds = useMemo(() => buildCommands(installPath, os), [installPath, os])

  const copy = async (text: string, which: 'full' | 'restart') => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(which)
    setTimeout(() => setCopied(null), 2500)
  }

  const pasteFromClipboard = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) setInstallPath(text.replace(/[/\\]+$/, ''))
    } catch {
      // Permission denied or unsupported — user can Ctrl+V manually
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Install the editor engine</h2>
        <p className="text-slate-400 mt-2">
          Copy the command below, paste it into your terminal, and press Enter.
          This is a one-time setup. The engine runs quietly in the background
          afterwards.
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

      {/* Install location */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Where should the engine live?</label>
          <span
            className="text-cyan-400 cursor-help"
            title="The folder where the engine's code and its AI runtime are stored. Defaults to a 'local-editor' folder inside your current terminal directory."
          >
            ❓
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={installPath}
            onChange={(e) => setInstallPath(e.target.value)}
            placeholder="e.g. D:\Apps\local-editor  or  ~/Apps/local-editor"
            spellCheck={false}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono
                       focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={pasteFromClipboard}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium
                       whitespace-nowrap transition"
            title="Paste a path you copied from your file explorer"
          >
            📋 Paste
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Leave as-is for a simple install. Or copy a folder path from File
          Explorer (Windows: click the address bar, Ctrl+C) / Finder (Mac: right‑click
          the folder → <em>Copy as Pathname</em>) and click Paste above.
        </p>
      </div>

      {/* Why-no-Browse info box */}
      {showInfoBox && (
        <div className="bg-cyan-950/40 border border-cyan-800 rounded-xl p-4 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">💡</span>
            <div className="flex-1">
              <p className="text-cyan-100 font-medium mb-1">
                Why isn't there a Browse button here?
              </p>
              <p className="text-cyan-200/80 text-xs leading-relaxed">
                Your browser can't open a native folder picker until the engine
                is running — that's a security rule every browser enforces. Type
                or paste the path above instead. Once installation finishes, all
                future folder pickers (like the next step) will be the real
                native ones.
              </p>
            </div>
            <button
              onClick={() => setShowInfoBox(false)}
              className="text-cyan-400 hover:text-cyan-200 text-xs"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Command box */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Your install command</span>
          <button
            onClick={() => copy(cmds.full, 'full')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold
                       bg-cyan-600 hover:bg-cyan-500 transition"
          >
            {copied === 'full' ? '✓ Copied!' : '📋 Copy full command'}
          </button>
        </div>
        <div className="bg-black rounded-xl p-4 font-mono text-xs sm:text-sm overflow-x-auto">
          <pre className="text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
            {cmds.full}
          </pre>
        </div>
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

      {/* Restart shortcut for returning users */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRestart((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300
                     hover:bg-slate-900 transition text-left"
        >
          <span>
            <span className="text-slate-500 mr-2">↻</span>
            Already installed before? Get a shorter restart command
          </span>
          <span className="text-slate-500">{showRestart ? '▲' : '▼'}</span>
        </button>
        {showRestart && (
          <div className="px-4 pb-4 border-t border-slate-800 bg-slate-900/50">
            <p className="text-xs text-slate-400 my-3">
              Use this if you've already run the install once and just need to
              start the engine again.
            </p>
            <div className="bg-black rounded-lg p-3 font-mono text-xs overflow-x-auto relative">
              <pre className="text-emerald-400 whitespace-pre-wrap break-all pr-24">
                {cmds.restart}
              </pre>
              <button
                onClick={() => copy(cmds.restart, 'restart')}
                className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold
                           bg-slate-700 hover:bg-slate-600 transition"
              >
                {copied === 'restart' ? '✓' : '📋'}
              </button>
            </div>
          </div>
        )}
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
            {showTroubleshoot
              ? 'Hide troubleshooting tips'
              : 'Taking too long? Click for troubleshooting →'}
          </button>
        )}

        {showTroubleshoot && !backendReady && (
          <ul className="mt-3 space-y-2 text-xs text-amber-100/90 list-disc list-inside border-t border-amber-800/50 pt-3">
            <li>
              Make sure the terminal window you pasted into is{' '}
              <strong>still open</strong>. Closing it stops the engine.
            </li>
            <li>
              Look at that window — if you see a red error, copy the last few
              lines and search them online.
            </li>
            <li>
              First-time setup downloads about <strong>7 GB</strong> (AI model +
              dependencies). It can take 5–15 minutes on slow connections.
            </li>
            <li>
              When you see{' '}
              <code className="bg-black/50 px-1 rounded">
                Uvicorn running on http://0.0.0.0:8000
              </code>
              , you're live.
            </li>
            <li>
              Try refreshing this page once. If the engine is up, the badge
              below should flip green within 2 seconds.
            </li>
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
        Already running from a previous session? This page detects it
        automatically — no reinstall needed.
      </p>
    </div>
  )
}