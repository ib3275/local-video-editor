import { useState } from 'react'

interface Props {
  onComplete: (paths: { videoPath: string; ollamaPath: string }) => void
  backendReady: boolean
}

const FIELDS = [
  {
    key: 'videoPath' as const,
    label: 'Video Storage Folder',
    tooltip:
      'Where your raw and edited videos will be saved. Pick a folder with plenty of free space.',
    placeholder: 'e.g. D:\\Videos\\Projects',
  },
  {
    key: 'ollamaPath' as const,
    label: 'AI Model Storage Folder',
    tooltip:
      'Where the DeepSeek AI model files live. These are large (5–10 GB). Use an external SSD if your main drive is full.',
    placeholder: 'e.g. E:\\OllamaModels',
  },
]

export default function DirectorySelector({ onComplete, backendReady }: Props) {
  const [paths, setPaths] = useState({ videoPath: '', ollamaPath: '' })
  const [browsing, setBrowsing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const browse = async (key: 'videoPath' | 'ollamaPath') => {
    setBrowsing(key)
    setError(null)
    try {
      const res = await fetch('http://localhost:8000/utils/browse-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Select ${FIELDS.find((f) => f.key === key)?.label}`,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.path) {
        setPaths((p) => ({ ...p, [key]: data.path }))
      }
    } catch (e: any) {
      setError(
        'Could not open the folder picker. The engine may have stopped — go back to Step 2 to restart it.'
      )
    } finally {
      setBrowsing(null)
    }
  }

  const ready = paths.videoPath && paths.ollamaPath

  // ── Guard: if the engine disconnected mid-wizard, show a friendly panel ──
  if (!backendReady) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl">🔌</div>
        <h2 className="text-xl font-semibold">Engine disconnected</h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          The local engine has stopped responding. Go back to Step 2 to restart it,
          then come back here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Where should we put things?</h2>
        <p className="text-slate-400 mt-2">
          Click <strong className="text-slate-200">Browse</strong> to open your
          computer's native folder picker. The engine will open the dialog for you.
        </p>
      </div>

      {FIELDS.map((f) => (
        <div
          key={f.key}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <label className="font-medium">{f.label}</label>
            <span className="text-cyan-400 cursor-help" title={f.tooltip}>
              ❓
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={paths[f.key]}
              onChange={(e) =>
                setPaths((p) => ({ ...p, [f.key]: e.target.value }))
              }
              placeholder={f.placeholder}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => browse(f.key)}
              disabled={browsing === f.key}
              className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium
                         disabled:opacity-50 whitespace-nowrap transition"
            >
              {browsing === f.key ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                  Opening…
                </span>
              ) : (
                '📁 Browse'
              )}
            </button>
          </div>
        </div>
      ))}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={() => onComplete(paths)}
        disabled={!ready}
        className="w-full py-3 rounded-xl font-semibold text-lg transition
          bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {ready ? 'Continue to Editor →' : 'Fill in both folders to continue'}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Both fields can be the same folder. Nothing is uploaded — everything stays on your PC.
      </p>
    </div>
  )
}