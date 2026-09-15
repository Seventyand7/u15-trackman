/**
 * 圖卡欄位勾選面板。主數據欄位鎖定不可取消，滑過去會說明為什麼。
 */

import { useCardConfig } from '../../state/CardConfigProvider'
import {
  BATTED_FIELD_LABELS,
  BATTED_FIELD_ORDER,
  PITCH_FIELD_LABELS,
  PITCH_FIELD_ORDER,
  isBattedFieldLocked,
  isPitchFieldLocked,
} from '../../lib/cardConfig'
import { Panel } from '../ui'

function Checkbox({
  label,
  checked,
  locked,
  lockReason,
  onToggle,
}: {
  label: string
  checked: boolean
  locked: boolean
  lockReason: string
  onToggle: () => void
}) {
  return (
    <label
      title={locked ? lockReason : undefined}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        locked
          ? 'cursor-default border-white/5 bg-white/[0.02] text-slate-400'
          : 'cursor-pointer border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={onToggle}
        className="h-4 w-4 accent-amber1"
      />
      {label}
      {locked && <span className="text-xs text-slate-600">🔒</span>}
    </label>
  )
}

export function FieldPicker() {
  const { config, togglePitch, toggleBatted, resetToDefault, error } = useCardConfig()

  return (
    <Panel
      title="圖卡欄位"
      right={
        <button type="button" className="btn-ghost !py-1 text-xs" onClick={resetToDefault}>
          恢復預設
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <div className="space-y-3">
        <div>
          <p className="label">投球區（最快球速／最快轉速）</p>
          <div className="flex flex-wrap gap-2">
            {PITCH_FIELD_ORDER.map((f) => (
              <Checkbox
                key={f}
                label={PITCH_FIELD_LABELS[f]}
                checked={config.pitchFields.includes(f)}
                locked={isPitchFieldLocked(f)}
                lockReason="投球兩個區共用同一組欄位，球速與轉速分別是各自的主數據，不能取消"
                onToggle={() => togglePitch(f)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="label">擊球區（最快擊球初速／最遠擊球距離）</p>
          <div className="flex flex-wrap gap-2">
            {BATTED_FIELD_ORDER.map((f) => (
              <Checkbox
                key={f}
                label={BATTED_FIELD_LABELS[f]}
                checked={config.battedFields.includes(f)}
                locked={isBattedFieldLocked(f)}
                lockReason="擊球兩個區共用同一組欄位，初速與距離分別是各自的主數據，不能取消"
                onToggle={() => toggleBatted(f)}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        設定會存起來，單場圖卡與季排名圖卡共用。
      </p>
    </Panel>
  )
}
