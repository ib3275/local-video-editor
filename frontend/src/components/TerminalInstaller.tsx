import { useState } from 'react'

interface Props { onComplete: () => void }

const WIN_CMD = `winget install -e --id Microsoft.PowerShell; winget install -e --id Gyan.FFmpeg; winget install -e --id Ollama.Ollama; git clone https://github.com/ib3275/local-video-editor.git local-editor; cd local-editor\\backend; pip install -r requirements.txt; python main.py`

const MAC_CMD = `brew install ffmpeg ollama; git clone https://github.com/ib3275/local-video-editor.git local-editor; cd local-editor/backend; pip3 install -r requirements.txt; python3 main.py`

export default function TerminalInstaller({ onComplete }: Props) {
  const [os, setOs] = useState<'windows' | 'mac'>('windows')
  const [copied, setCopied] = useState(false)

  const cmd = os === 'windows' ? WIN_CMD : MAC_CMD

  const copy = async () => {
    await navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">One‑click installation</h2>
      <p className="text-slate-400">
        Copy the command, paste it into your terminal, and press Enter. That's it.
      </p>

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
      <div className="bg-black rounded-xl p-4 font-mono text-sm overflow-x-auto relative group">
        <pre className="text-emerald-400 whitespace-pre-wrap break-all">{cmd}</pre>
        <button
          onClick={copy}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold
                     bg-cyan-600 hover:bg-cyan-500 transition"
        >
          {copied ? '✓ Copied!' : '📋 Copy Setup Command'}
        </button>
      </div>

      {/* Visual guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { n: '1', title: 'Open your terminal', desc: os === 'windows' ? 'Press Win + X, then click "Terminal" or "PowerShell".' : 'Press Cmd + Space, type "Terminal", press Enter.' },
          { n: '2', title: 'Paste the command', desc: os === 'windows' ? 'Right‑click inside the window to paste, then press Enter.' : 'Press Cmd + V to paste, then press Enter.' },
          { n: '3', title: 'Wait for "Ready"', desc: 'It will download tools and the AI model. This takes a few minutes the first time.' },
        ].map((s) => (
          <div key={s.n} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center font-bold mb-2">
              {s.n}
            </div>
            <h4 className="font-medium mb-1">{s.title}</h4>
            <p className="text-xs text-slate-400">{s.desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full py-3 rounded-xl font-semibold text-lg transition bg-slate-700 hover:bg-slate-600"
      >
        I've run the command — Skip to Editor
      </button>
      <p className="text-xs text-slate-500 text-center">
        The editor will unlock automatically as soon as the backend is detected.
      </p>
    </div>
  )
}