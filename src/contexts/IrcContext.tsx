import { createContext, useContext } from 'react'
import type { ConnStatus } from '../hooks/useIrcClient'

export interface IrcSession {
  nick: string
  connected: boolean
  connStatus: ConnStatus
  isOper: boolean
  isIdentified: boolean
  ops: string[]
}

const IrcContext = createContext<IrcSession | null>(null)

export function IrcProvider({ value, children }: { value: IrcSession; children: React.ReactNode }) {
  return <IrcContext.Provider value={value}>{children}</IrcContext.Provider>
}

export function useIrcContext(): IrcSession {
  const ctx = useContext(IrcContext)
  if (!ctx) throw new Error('useIrcContext must be used inside IrcProvider')
  return ctx
}
