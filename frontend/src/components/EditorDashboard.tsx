import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  backendReady: boolean
  paths: { videoPath: string; ollamaPath: string }
}

interface ThinkBlock {
  thinking: string
  answer: string
}

function parseThink(raw: string): ThinkBlock {
  const match = raw.match(/<think>([\s\S]*?)<\/think>/)
  if (!match) return { thinking: '', answer: raw }
  return {
    thinking: match[1].trim(),
    answer: raw.replace(/<think>[\s\S]*?<\/think>/, '').trim(),
  }
}

export default function EditorDashboard({ backendReady, paths }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [thinkBlocks, setThinkBlocks] = useState<ThinkBlock[]>([])
  const [dragOver, setDragOver] = useState(false)
  const thinkEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () =>
    thinkEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(scrollToBottom, [thinkBlocks])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('video/')) setFile(f)
  }, [])

  const uploadAndProcess = async () => {
    if (!file || !prompt.trim()) return

    setUploading(true)
    setProcessing(false)
    setThinkBlocks([])
    setVideoUrl(null)

    try {
      // 1. Upload
      const form = new FormData()
      form.append('file', file)
      form.append('video_path', paths.videoPath || '')

      const upRes = await fetch('http://localhost:8000/projects/upload', {
        method: 'POST',
        body: form,
      })
      if (!upRes.ok) throw new Error('Upload failed')
      const { filename } = await upRes.json()

      setUploading(false)
      setProcessing(true)

      // 2. Process (SSE-style streaming)
      const procRes = await fetch('http://localhost:8000/process-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          prompt: prompt.trim(),
          video_path: paths.videoPath || '',
        }),
      })

      if (!procRes.ok) throw new Error('Processing failed')

      const reader = procRes.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE lines are separated by double newlines
          const parts = buffer.split('\n\n')
          buffer = parts.pop() || ''

          for (const part of parts) {
            const line = part.replace(/^data: /, '').trim()
            if (!line) continue
            try {
              const evt = JSON.parse(line)
              if (evt.type === 'think') {
                setThinkBlocks((prev) => [
                  ...prev,
                  parseThink(evt.text),
                ])
              } else if (evt.type === 'done') {
                setVideoUrl(`http://localhost:8000/projects/stream/${evt.output}`)
              }
            } catch { /* ignore malformed lines */ }
          }
        }
      }
    } catch (e: any) {
      setThinkBlocks((prev) => [
        ...prev,
        { thinking: '', answer: `❌ Error: ${e.message}` },
      ])
    } finally {
      setUploading(false)
      setProcessing(false)
    }
  }

  if (!backendReady) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-xl font-semibold">Waiting for your local backend…</h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          If you haven't run the install command yet, go back to Step 3.
          The page checks every 2 seconds automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Edit your video with AI</h2>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer
          ${dragOver ? 'border-cyan-400 bg-cyan-900/20' : 'border-slate-700 hover:border-slate-500'}`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="space-y-2">
            <p className="text-3xl">🎬</p>
            <p className="font-medium">{file.name}</p>
            <p className="text-xs text-slate-400">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-4xl">📥</p>
            <p className="font-medium">Drag & drop a video here</p>
            <p className="text-sm text-slate-400">or click to browse</p>
          </div>
        )}
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium mb-2">
          What should the AI do?
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. Remove filler words (um, uh), cut silences longer than 1 second, and colour‑grade each segment warm."
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:border-cyan-500 resize-none"
        />
      </div>

      {/* Action button */}
      <button
        onClick={uploadAndProcess}
        disabled={!file || !prompt.trim() || uploading || processing}
        className="w-full py-3 rounded-xl font-semibold text-lg transition
          bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {uploading
          ? '📤 Uploading…'
          : processing
          ? '🧠 AI is thinking…'
          : '✨ Edit Video with AI'}
      </button>

      {/* Video preview */}
      {videoUrl && (
        <div className="space-y-2">
          <h3 className="font-medium text-emerald-400">✅ Your edited video is ready</h3>
          <video
            src={videoUrl}
            controls
            className="w-full rounded-xl border border-slate-700 bg-black"
          />
        </div>
      )}

      {/* AI Thinking Window */}
      {thinkBlocks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            AI Thinking Window
          </h3>
          <div className="max-h-80 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {thinkBlocks.map((b, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {b.thinking && (
                  <details className="group">
                    <summary className="px-4 py-2 text-xs font-medium text-purple-400 cursor-pointer
                                        bg-purple-950/30 hover:bg-purple-950/50 transition select-none">
                      💭 Internal reasoning — click to expand
                    </summary>
                    <pre className="px-4 py-3 text-xs text-slate-400 whitespace-pre-wrap font-mono
                                    border-t border-slate-800 max-h-48 overflow-y-auto">
                      {b.thinking}
                    </pre>
                  </details>
                )}
                {b.answer && (
                  <div className="px-4 py-3 text-sm text-slate-200 whitespace-pre-wrap">
                    {b.answer}
                  </div>
                )}
              </div>
            ))}
            <div ref={thinkEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}