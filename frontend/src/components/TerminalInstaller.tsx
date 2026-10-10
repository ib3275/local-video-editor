import { useState, useMemo } from 'react'

interface Props {
  onComplete: () => void
  backendReady: boolean
}

// ⚠️ Replace ib3275 with your GitHub username if you fork this project.
const REPO_URL = 'https://github.com/ib3275/local-video-editor.git'
const MODEL_NAME = 'deepseek-r1:8b'

function quotePath(p: string, os: 'windows' | 'mac'): string {
  if (!p) return p
  if (os === 'windows') {
    if (/[\s'"`$(){}[\]]/.test(p)) return `'${p.replace(/'/g, "''")}'`
    return p
  }
  if (/[\s'"`$(){}[\]&|;<>]/.test(p)) return `"${p.replace(/"/g, '\\"')}"`
  return p
}

function buildCommands(installPath: string, os: 'windows' | 'mac') {
  const p = (installPath || 'local-editor').replace(/[/\\]+$/, '')

  if (os === 'windows') {
    const repoQuoted = quotePath(p, 'windows')
    const backendQuoted = quotePath(`${p}\\backend`, 'windows')
    const modelsQuoted = quotePath(`${p}\\ollama-models`, 'windows')

    return {
      full:
        // 1. Prerequisites
        `winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements; ` +
        `winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements; ` +
        `winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements; ` +

        // 2. PATH refresh
        `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User"); ` +

        // 3. ExecutionPolicy for venv activation
        `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; ` +

        // 4. Refresh code if no .git present. Preserve ollama-models at all costs.
        //    git clone refuses a non-empty destination, so we clone to a temp
        //    sibling then move files in — ollama-models is never touched.
        `if (-not (Test-Path (Join-Path ${repoQuoted} '.git'))) { ` +
          `if (Test-Path ${repoQuoted}) { ` +
            `Get-ChildItem ${repoQuoted} -Exclude 'ollama-models' -Force | Remove-Item -Recurse -Force; ` +
          `} else { ` +
            `New-Item -ItemType Directory -Force -Path ${repoQuoted} | Out-Null; ` +
          `}; ` +
          `$tmp = "${repoQuoted}.tmp-clone"; ` +
          `if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }; ` +
          `git clone ${REPO_URL} $tmp; ` +
          `Get-ChildItem $tmp -Force | Move-Item -Destination ${repoQuoted}; ` +
          `Remove-Item -Recurse -Force $tmp ` +
        `}; ` +

        // 5. Models folder + env var
        `$modelsPath = ${modelsQuoted}; ` +
        `New-Item -ItemType Directory -Force -Path $modelsPath | Out-Null; ` +
        `[Environment]::SetEnvironmentVariable('OLLAMA_MODELS', $modelsPath, 'User'); ` +
        `$env:OLLAMA_MODELS = $modelsPath; ` +

        // 6. Restart Ollama hidden so it inherits OLLAMA_MODELS
        `Get-Process -Name 'ollama*' -ErrorAction SilentlyContinue | Stop-Process -Force; ` +
        `Start-Sleep -Milliseconds 800; ` +
        `Start-Process -WindowStyle Hidden -FilePath 'ollama' -ArgumentList 'serve' -ErrorAction SilentlyContinue; ` +
        `Start-Sleep -Seconds 5; ` +

        // 7. Model (instant no-op if already present)
        `ollama pull ${MODEL_NAME}; ` +

        // 8. Backend
        `cd ${backendQuoted}; ` +
        `py -3 -m venv .venv; ` +
        `.\\.venv\\Scripts\\Activate.ps1; ` +
        `python -m pip install --upgrade pip; ` +
        `python -m pip install -r requirements.txt; ` +

        // 9. Launch
        `python main.py`,

      restart:
        `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; ` +
        `$env:OLLAMA_MODELS = ${modelsQuoted}; ` +
        `Start-Process -WindowStyle Hidden -FilePath 'ollama' -ArgumentList 'serve' -ErrorAction SilentlyContinue; ` +
        `Start-Sleep -Seconds 3; ` +
        `cd ${backendQuoted}; ` +
        `.\\.venv\\Scripts\\Activate.ps1; ` +
        `python main.py`,
    }
  }

  // macOS / Linux — full replacement, preserving models on re-clone
  const repoQuoted = quotePath(p, 'mac')
  const backendQuoted = quotePath(`${p}/backend`, 'mac')
  const modelsQuoted = quotePath(`${p}/ollama-models`, 'mac')

  return {
    full:
      `brew install ffmpeg ollama python@3.12; ` +
      `if [ ! -d ${repoQuoted}/.git ]; then ` +
        `if [ -d ${repoQuoted} ]; then ` +
          `find ${repoQuoted} -mindepth 1 -maxdepth 1 ! -name 'ollama-models' -exec rm -rf {} +; ` +
        `else ` +
          `mkdir -p ${repoQuoted}; ` +
        `fi; ` +
        `tmp="${repoQuoted}.tmp-clone"; ` +
        `rm -rf "$tmp"; ` +
        `git clone ${REPO_URL} "$tmp"; ` +
        `mv "$tmp"/* "$tmp"/.[!.]* ${repoQuoted}/ 2>/dev/null || true; ` +
        `rm -rf "$tmp"; ` +
      `fi; ` +
      `mkdir -p ${modelsQuoted}; ` +
      `export OLLAMA_MODELS=${modelsQuoted}; ` +
      `grep -q "OLLAMA_MODELS" ~/.zshrc 2>/dev/null || echo 'export OLLAMA_MODELS='${modelsQuoted} >> ~/.zshrc; ` +
      `pkill -f "ollama serve" 2>/dev/null || true; ` +
      `sleep 1; ` +
      `nohup ollama serve > /dev/null 2>&1 & disown; ` +
      `sleep 4; ` +
      `ollama pull ${MODEL_NAME}; ` +
      `cd ${backendQuoted}; ` +
      `python3 -m venv .venv; ` +
      `source .venv/bin/activate; ` +
      `python3 -m pip install --upgrade pip; ` +
      `python3 -m pip install -r requirements.txt; ` +
      `python3 main.py`,

    restart:
      `export OLLAMA_MODELS=${modelsQuoted}; ` +
      `nohup ollama serve > /dev/null 2>&1 & disown; ` +
      `sleep 3; ` +
      `cd ${backendQuoted}; ` +
      `source .venv/bin/activate; ` +
      `python3 main.py`,
  }
}

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
      // Permission denied or unsupported
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Install the editor engine</h2>
        <p className="text-slate-400 mt-2">
          Copy the command below, paste it into your terminal, and press Enter.
          That's the whole setup — Python, FFmpeg, Ollama, the AI model, and the
          engine all install themselves in one go. One-time only.
        </p>
      </div>

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

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Where should the engine and its AI live?</label>
          <span
            className="text-cyan-400 cursor-help"
            title="The folder that will hold the engine's code plus the AI model files (about 5 GB). Pick a drive with plenty of free space."
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
          Everything — engine code and ~5 GB of AI — lands here. Defaults to a
          <code className="text-slate-400 mx-1">local-editor</code> folder in
          your current terminal directory.
        </p>
      </div>

      {showInfoBox && (
        <div className="bg-cyan-950/40 border border-cyan-800 rounded-xl p-4 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">💡</span>
            <div className="flex-1">
              <p className="text-cyan-100 font-medium mb-1">
                Why isn't there a Browse button here?
              </p>
              <p className="text-cyan-200/80 text-xs leading-relaxed">
                Browsers can't open a native folder picker until the engine is
                running — that's a security rule every browser enforces. Paste
                a path above instead. Once installation finishes, later folder
                pickers in this wizard will be real native ones.
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

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Your one-line installer</span>
          <button
            onClick={() => copy(cmds.full, 'full')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold
                       bg-cyan-600 hover:bg-cyan-500 transition"
          >
            {copied === 'full' ? '✓ Copied!' : '📋 Copy full command'}
          </button>
        </div>
        <div className="bg-black rounded-xl p-4 font-mono text-xs sm:text-sm overflow-x-auto max-h-64 overflow-y-auto">
          <pre className="text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
            {cmds.full}
          </pre>
        </div>
      </div>

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
            title: 'Wait ~10 minutes',
            desc:
              'It installs tools, downloads ~5 GB of AI, and starts the engine. Do not close the window.',
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
              Use this if the install is already done and you just need to start
              the engine again.
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
                  This page checks every 2 seconds. First run downloads ~5 GB — give it a few minutes.
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
              If you saw <em>"Python was not found"</em>, close and reopen the
              terminal, then re-run the same command.
            </li>
            <li>
              First-time setup downloads about <strong>5 GB</strong> — the AI
              model. Slow connections can take 15+ minutes.
            </li>
            <li>
              When you see{' '}
              <code className="bg-black/50 px-1 rounded">
                Uvicorn running on http://0.0.0.0:8000
              </code>
              , you're live.
            </li>
          </ul>
        )}
      </div>

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