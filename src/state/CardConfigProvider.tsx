/**
 * 圖卡欄位勾選設定。不分球季，單場圖卡與季排名圖卡共用同一份。
 *
 * 勾選會立刻反映在預覽上（樂觀更新），再寫回 Firestore；
 * 寫失敗就退回上一個狀態並顯示錯誤，不會讓畫面跟資料庫不一致。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { saveCardConfig, subscribeCardConfig } from '../firebase/repo'
import {
  DEFAULT_CARD_CONFIG,
  normalizeCardConfig,
  toggleBattedField,
  togglePitchField,
} from '../lib/cardConfig'
import type { BattedField, CardConfig, PitchField } from '../types/models'

interface CardConfigContextValue {
  config: CardConfig
  loading: boolean
  error: string | null
  togglePitch: (field: PitchField) => void
  toggleBatted: (field: BattedField) => void
  resetToDefault: () => void
}

const CardConfigContext = createContext<CardConfigContextValue | null>(null)

export function CardConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CardConfig>(DEFAULT_CARD_CONFIG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** 樂觀更新期間先忽略自己寫出去又被推回來的快照 */
  const pendingRef = useRef(false)

  useEffect(() => {
    return subscribeCardConfig(
      (raw) => {
        setLoading(false)
        if (pendingRef.current) return
        setConfig(normalizeCardConfig(raw))
      },
      (e) => {
        setLoading(false)
        setError(`讀取圖卡設定失敗：${e.message}`)
      },
    )
  }, [])

  const commit = useCallback(
    (next: CardConfig) => {
      const previous = config
      setConfig(next)
      setError(null)
      pendingRef.current = true
      saveCardConfig(next)
        .catch((e: Error) => {
          setConfig(previous)
          setError(`儲存圖卡設定失敗：${e.message}`)
        })
        .finally(() => {
          pendingRef.current = false
        })
    },
    [config],
  )

  const value = useMemo<CardConfigContextValue>(
    () => ({
      config,
      loading,
      error,
      togglePitch: (field) => commit(togglePitchField(config, field)),
      toggleBatted: (field) => commit(toggleBattedField(config, field)),
      resetToDefault: () => commit(DEFAULT_CARD_CONFIG),
    }),
    [config, loading, error, commit],
  )

  return <CardConfigContext.Provider value={value}>{children}</CardConfigContext.Provider>
}

export function useCardConfig(): CardConfigContextValue {
  const ctx = useContext(CardConfigContext)
  if (!ctx) throw new Error('useCardConfig 必須在 <CardConfigProvider> 內使用')
  return ctx
}
