import { useState, useEffect, useCallback } from 'react'
import HardwareCheck from './HardwareCheck'
import DirectorySelector from './DirectorySelector'
import TerminalInstaller from './TerminalInstaller'
import EditorDashboard from './EditorDashboard'

const STEPS = [
  { id: 1, title: 'Check Your Computer', icon: '💻' },
  { id: 2, title: 'Install the Engine', icon: '⚡' },
  { id: 3, title: 'Choose Folders', icon: '📁' },
  { id: 4, title: 'Start Editing', icon: '🎬' },
]

export default function WizardLayout() {
  const [currentStep, setCurrentStep] = useState(1)
  const [backendReady, setBackendReady] = useState(false)
  const [paths, setPaths] = useState({ videoPath: '', ollamaPath: '' })

  // ── Auto-connection pings ──────────────────────────────────
  // Both checks hit :8000. The backend proxies Ollama internally,
  // so the browser never sends a cross-origin request to :11434.
  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const [statusRes, ollamaRes] = await Promise.all([
          fetch('http://localhost:8000/status', { signal: AbortSignal.timeout(1500) }),
          fetch('http://localhost:8000/ollama/tags', { signal: AbortSignal.timeout(1500) }),
        ])
        if (!cancelled && statusRes.ok && ollamaRes.ok) {
          setBackendReady(true)
        }
      } catch {
        if (!cancelled) setBackendReady(false)
      }
    }

    check()
    const interval = setInterval(check, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const handleHardwareComplete = useCallback(() => setCurrentStep(2), [])
  const handleInstallComplete = useCallback(() => setCurrentStep(3), [])
  const handleDirectoryComplete = useCallback(
    (p: { videoPath: string; ollamaPath: string }) => {
      setPaths(p)
      setCurrentStep(4)
    },
    []
  )

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Local Video Editor
        </h1>
        <p className="text-slate-400 mt-2 max-w-lg">
          Your videos never leave your computer. Everything runs locally with AI.
        </p>
      </header>

      <nav className="flex gap-2 mb-10 flex-wrap justify-center">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${currentStep === s.id ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-800 text-slate-400'}
              ${currentStep > s.id ? 'bg-emerald-800 text-emerald-200' : ''}`}
          >
            <span>{currentStep > s.id ? '✓' : s.icon}</span>
            <span className="hidden sm:inline">{s.title}</span>
          </div>
        ))}
      </nav>

      <main className="w-full max-w-3xl">
        {currentStep === 1 && <HardwareCheck onComplete={handleHardwareComplete} />}
        {currentStep === 2 && (
          <TerminalInstaller
            onComplete={handleInstallComplete}
            backendReady={backendReady}
          />
        )}
        {currentStep === 3 && (
          <DirectorySelector
            onComplete={handleDirectoryComplete}
            backendReady={backendReady}
          />
        )}
        {currentStep === 4 && (
          <EditorDashboard backendReady={backendReady} paths={paths} />
        )}
      </main>

      <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs bg-slate-900/80 backdrop-blur px-3 py-2 rounded-full border border-slate-800">
        <span
          className={`w-2 h-2 rounded-full ${
            backendReady ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
          }`}
        />
        <span className="text-slate-400">
          {backendReady ? 'Backend Connected' : 'Waiting for local backend…'}
        </span>
      </div>
    </div>
  )
}