import { useState } from 'react'

interface Props { onComplete: () => void }

const OPTIONS = [
  {
    id: 'gpu',
    label: 'Graphics Card (GPU)',
    tooltip: 'Your GPU does the heavy AI lifting. Most modern computers have one.',
    choices: [
      { value: 'nvidia', label: 'NVIDIA GTX 10‑series or newer (6 GB+ VRAM)', ok: true },
      { value: 'apple', label: 'Apple Silicon (M1 / M2 / M3 / M4)', ok: true },
      { value: 'other', label: 'Other / Integrated graphics only', ok: false },
    ],
  },
  {
    id: 'ram',
    label: 'System Memory (RAM)',
    tooltip: 'RAM is your computer\'s short‑term memory. More is better for AI.',
    choices: [
      { value: '16', label: '16 GB or more', ok: true },
      { value: '8', label: '8 GB', ok: false },
      { value: '4', label: '4 GB or less', ok: false },
    ],
  },
]

export default function HardwareCheck({ onComplete }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  const allOk =
    answers.gpu &&
    answers.ram &&
    OPTIONS.every((o) => o.choices.find((c) => c.value === answers[o.id])?.ok)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Let's check if your computer is ready</h2>
      <p className="text-slate-400">
        Don't worry if you're not sure — just click what sounds closest. Hover the
        <span className="text-cyan-400"> ❓ </span> for plain‑English explanations.
      </p>

      {OPTIONS.map((opt) => (
        <div key={opt.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium text-lg">{opt.label}</h3>
            <span
              className="cursor-help text-cyan-400 relative"
              onMouseEnter={() => setShowTooltip(opt.id)}
              onMouseLeave={() => setShowTooltip(null)}
            >
              ❓
              {showTooltip === opt.id && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-700 text-xs p-3 rounded-lg shadow-xl z-10">
                  {opt.tooltip}
                </div>
              )}
            </span>
          </div>
          <div className="space-y-2">
            {opt.choices.map((c) => (
              <label
                key={c.value}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition
                  ${answers[opt.id] === c.value ? 'bg-cyan-900/50 border border-cyan-600' : 'bg-slate-800 hover:bg-slate-750 border border-transparent'}`}
              >
                <input
                  type="radio"
                  name={opt.id}
                  value={c.value}
                  checked={answers[opt.id] === c.value}
                  onChange={() => setAnswers((a) => ({ ...a, [opt.id]: c.value }))}
                  className="accent-cyan-500"
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {answers.gpu && answers.ram && !allOk && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 text-amber-200 text-sm">
          ⚠️ Your computer may struggle with the full model. You can still try —
          the editor will work but might be slower.
        </div>
      )}

      <button
        onClick={onComplete}
        disabled={!answers.gpu || !answers.ram}
        className="w-full py-3 rounded-xl font-semibold text-lg transition
          bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {allOk ? '✓ My computer is ready — Continue' : 'Continue anyway'}
      </button>
    </div>
  )
}