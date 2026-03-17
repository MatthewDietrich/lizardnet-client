import { useState } from 'react'
import type { Message } from '../types'
import type { Settings } from './useSettings'
import { playNotificationSound } from '../lib/notification'

const MAX_MESSAGES = 2000

interface Options {
  nickRef: React.MutableRefObject<string>
  focusedRef: React.MutableRefObject<boolean>
  settingsRef: React.MutableRefObject<Settings>
}

export function useIrcMessages({ nickRef, focusedRef, settingsRef }: Options) {
  const [messages, setMessages] = useState<Message[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

  function addMessage(from: string, text: string, kind: Message['kind'] = 'chat', ts?: Date, isHistory = false, msgid?: string) {
    const isMention = !isHistory && (kind === 'chat' || kind === 'action') &&
      !!nickRef.current &&
      from !== nickRef.current &&
      new RegExp(`\\b${escapeRegex(nickRef.current)}\\b`, 'i').test(text)
    if (isMention) {
      if (settingsRef.current.soundMentions) playNotificationSound(settingsRef.current.mentionSound)
      if (!focusedRef.current) {
        setUnreadCount(n => n + 1)
        if (settingsRef.current.desktopNotifications && Notification.permission === 'granted') {
          new Notification(`${from} mentioned you`, { body: text, silent: true })
        }
      }
    }
    setMessages(prev => {
      const next = [...prev, { id: crypto.randomUUID(), from, text, ts: ts ?? new Date(), kind, msgid }]
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
    })
  }

  function editMessageByMsgid(msgid: string, newText: string) {
    setMessages(prev => {
      const idx = prev.reduce((found, m, i) => m.msgid === msgid ? i : found, -1)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], text: newText, edited: true, originalText: next[idx].originalText ?? next[idx].text }
      return next
    })
  }

  function injectChannelMsgid(text: string, msgid: string) {
    setMessages(prev => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].from === nickRef.current && prev[i].text === text && !prev[i].msgid) {
          const next = [...prev]
          next[i] = { ...next[i], msgid }
          return next
        }
      }
      return prev
    })
  }

  function redactChannelUrl(url: string, replace: (text: string) => string) {
    setMessages(prev => prev.map(m => m.text.includes(url) ? { ...m, text: replace(m.text) } : m))
  }

  return { messages, unreadCount, setUnreadCount, addMessage, editMessageByMsgid, injectChannelMsgid, redactChannelUrl }
}
