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

// Returns the same map if the key is absent, otherwise a clone with the key removed.
function mapWithout<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  if (!map.has(key)) return map
  const next = new Map(map)
  next.delete(key)
  return next
}

interface Options {
  focusedRef: React.MutableRefObject<boolean>
  settingsRef: React.MutableRefObject<Settings>
  onChannelUnread: () => void
}

export function usePmConversations({ focusedRef, settingsRef, onChannelUnread }: Options) {
  const [pmConversations, setPmConversations] = useState<Map<string, Message[]>>(new Map())
  const [pmUnread, setPmUnread] = useState<Map<string, number>>(new Map())
  const [pmPeerRename, setPmPeerRename] = useState<{ from: string; to: string } | null>(null)
  const activePmPeerRef = useRef<string | null>(null)

  function setActivePmPeer(peer: string | null) {
    activePmPeerRef.current = peer
    if (peer && focusedRef.current) {
      setPmUnread(prev => mapWithout(prev, peer))
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
      if (settingsRef.current.soundPm) playNotificationSound(settingsRef.current.pmSound)
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
    setPmConversations(prev => mapWithout(prev, peer))
    setPmUnread(prev => mapWithout(prev, peer))
  }

  function clearPmUnread(peer: string) {
    setPmUnread(prev => mapWithout(prev, peer))
  }

  // Clear unread count for the currently active PM peer (called on window focus).
  function clearActivePeerUnread() {
    const peer = activePmPeerRef.current
    if (!peer) return
    setPmUnread(prev => mapWithout(prev, peer))
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
