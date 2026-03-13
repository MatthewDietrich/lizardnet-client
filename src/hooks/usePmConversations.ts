import { useState, useRef } from 'react'
import type { Message } from '../types'
import type { Settings } from './useSettings'
import { playNotificationSound } from '../lib/notification'

function resolveKey(map: Map<string, unknown>, peer: string): string {
  const lower = peer.toLowerCase()
  for (const key of map.keys()) {
    if (key.toLowerCase() === lower) return key
  }
  return peer
}

interface Options {
  focusedRef: React.MutableRefObject<boolean>
  settingsRef: React.MutableRefObject<Settings>
  nickRef: React.MutableRefObject<string>
  onChannelUnread: () => void
}

export function usePmConversations({ focusedRef, settingsRef, nickRef, onChannelUnread }: Options) {
  const [pmConversations, setPmConversations] = useState<Map<string, Message[]>>(new Map())
  const [pmUnread, setPmUnread] = useState<Map<string, number>>(new Map())
  const [pmPeerRename, setPmPeerRename] = useState<{ from: string; to: string } | null>(null)
  const activePmPeerRef = useRef<string | null>(null)

  function setActivePmPeer(peer: string | null) {
    activePmPeerRef.current = peer
    if (peer && focusedRef.current) {
      setPmUnread(prev => {
        if (!prev.get(peer)) return prev
        const next = new Map(prev)
        next.delete(peer)
        return next
      })
    }
  }

  function addPmMessage(peer: string, from: string, text: string, isIncoming: boolean, kind: Message['kind'] = 'chat') {
    setPmConversations(prev => {
      const key = resolveKey(prev, peer)
      const next = new Map(prev)
      next.set(key, [...(next.get(key) ?? []), { from, text, ts: new Date(), kind }])
      return next
    })
    if (isIncoming && !(focusedRef.current && activePmPeerRef.current?.toLowerCase() === peer.toLowerCase())) {
      if (settingsRef.current.soundPm) playNotificationSound()
      if (!focusedRef.current) {
        onChannelUnread()
        if (settingsRef.current.desktopNotifications && Notification.permission === 'granted') {
          new Notification(`PM from ${from}`, { body: text, silent: true })
        }
      }
      setPmUnread(prev => {
        const key = resolveKey(prev, peer)
        const next = new Map(prev)
        next.set(key, (next.get(key) ?? 0) + 1)
        return next
      })
    }
  }

  // Append an event-kind message to a specific PM peer's conversation.
  function addEventToPm(peer: string, text: string) {
    setPmConversations(prev => {
      const key = resolveKey(prev, peer)
      const next = new Map(prev)
      next.set(key, [...(next.get(key) ?? []), { from: '*', text, ts: new Date(), kind: 'event' as const }])
      return next
    })
  }

  // Route an event message: sends to the active PM peer if one is open, otherwise calls fallback.
  function addActiveEvent(text: string, fallback: () => void) {
    const peer = activePmPeerRef.current
    if (peer) {
      addEventToPm(peer, text)
    } else {
      fallback()
    }
  }

  function openPmConversation(peer: string) {
    setPmConversations(prev => {
      if (prev.has(peer)) return prev
      const next = new Map(prev)
      next.set(peer, [])
      return next
    })
  }

  function closePmConversation(peer: string) {
    setPmConversations(prev => { const next = new Map(prev); next.delete(peer); return next })
    setPmUnread(prev => {
      if (!prev.has(peer)) return prev
      const next = new Map(prev); next.delete(peer); return next
    })
  }

  function clearPmUnread(peer: string) {
    setPmUnread(prev => {
      if (!prev.get(peer)) return prev
      const next = new Map(prev); next.delete(peer); return next
    })
  }

  // Clear unread count for the currently active PM peer (called on window focus).
  function clearActivePeerUnread() {
    const peer = activePmPeerRef.current
    if (!peer) return
    setPmUnread(prev => {
      if (!prev.get(peer)) return prev
      const next = new Map(prev); next.delete(peer); return next
    })
  }

  // Update PM state when a user changes their nick.
  function handlePeerRename(oldNick: string, newNick: string) {
    setPmConversations(prev => {
      if (!prev.has(oldNick)) return prev
      const next = new Map(prev)
      next.set(newNick, next.get(oldNick)!)
      next.delete(oldNick)
      return next
    })
    setPmUnread(prev => {
      if (!prev.has(oldNick)) return prev
      const next = new Map(prev)
      next.set(newNick, next.get(oldNick)!)
      next.delete(oldNick)
      return next
    })
    if (activePmPeerRef.current === oldNick) {
      activePmPeerRef.current = newNick
      setPmPeerRename({ from: oldNick, to: newNick })
    }
  }

  function redactInPmConversations(url: string, replace: (text: string) => string) {
    setPmConversations(prev => {
      let changed = false
      const next = new Map(prev)
      for (const [peer, msgs] of next) {
        const updated = msgs.map(m => m.text.includes(url) ? { ...m, text: replace(m.text) } : m)
        if (updated.some((m, i) => m !== msgs[i])) { next.set(peer, updated); changed = true }
      }
      return changed ? next : prev
    })
  }

  return {
    pmConversations, pmUnread, pmPeerRename,
    activePmPeerRef,
    setActivePmPeer, addPmMessage, addEventToPm, addActiveEvent,
    openPmConversation, closePmConversation, clearPmUnread, clearActivePeerUnread,
    handlePeerRename, redactInPmConversations,
  }
}
