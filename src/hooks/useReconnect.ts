import { useState, useRef, useEffect } from 'react'

export type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export function useReconnect() {
  const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected')
  const connStatusRef = useRef<ConnStatus>('disconnected')
  const manualDisconnectRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef(2000)

  useEffect(() => { connStatusRef.current = connStatus }, [connStatus])

  // Schedule a reconnect callback after the current backoff delay.
  // Returns the delay (ms) that was applied so callers can compose log messages.
  function schedule(fn: () => void): number {
    const delay = delayRef.current
    delayRef.current = Math.min(delay * 2, 30000)
    timerRef.current = setTimeout(fn, delay)
    return delay
  }

  function cancel() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  function resetDelay() {
    delayRef.current = 2000
  }

  return { connStatus, setConnStatus, connStatusRef, manualDisconnectRef, schedule, cancel, resetDelay }
}
