import { useState, useRef, useEffect } from 'react'

export function useIrcUsers() {
  const [users, setUsers] = useState<string[]>([])
  const [ops, setOps] = useState<string[]>([])
  const opsRef = useRef<string[]>([])
  useEffect(() => { opsRef.current = ops }, [ops])
  const [bannedUsers, setBannedUsers] = useState<string[]>([])
  const [awayUsers, setAwayUsers] = useState<Set<string>>(new Set())
  const [isOper, setIsOper] = useState(false)
  const [topic, setTopicState] = useState('')
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [pmTypingPeers, setPmTypingPeers] = useState<Set<string>>(new Set())
  const pmTypingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  function handleTypingUser(who: string, state: string | undefined) {
    const timers = typingTimersRef.current
    clearTimeout(timers.get(who))
    timers.delete(who)
    if (!state || state === 'done') {
      setTypingUsers(prev => prev.filter(u => u !== who))
      return
    }
    setTypingUsers(prev => prev.includes(who) ? prev : [...prev, who])
    timers.set(who, setTimeout(() => {
      timers.delete(who)
      setTypingUsers(prev => prev.filter(u => u !== who))
    }, 6_000))
  }

  function handlePmTyping(who: string, state: string | undefined) {
    const timers = pmTypingTimersRef.current
    clearTimeout(timers.get(who))
    timers.delete(who)
    if (!state || state === 'done') {
      setPmTypingPeers(prev => { const s = new Set(prev); s.delete(who); return s })
      return
    }
    setPmTypingPeers(prev => new Set([...prev, who]))
    timers.set(who, setTimeout(() => {
      timers.delete(who)
      setPmTypingPeers(prev => { const s = new Set(prev); s.delete(who); return s })
    }, 6_000))
  }

  function clearAllTyping() {
    for (const t of typingTimersRef.current.values()) clearTimeout(t)
    typingTimersRef.current.clear()
    setTypingUsers([])
    for (const t of pmTypingTimersRef.current.values()) clearTimeout(t)
    pmTypingTimersRef.current.clear()
    setPmTypingPeers(new Set())
  }

  function resetUsers() {
    setUsers([])
    setOps([])
    setBannedUsers([])
    setAwayUsers(new Set())
    setIsOper(false)
    clearAllTyping()
  }

  return {
    users, setUsers,
    ops, setOps,
    bannedUsers, setBannedUsers,
    awayUsers, setAwayUsers,
    isOper, setIsOper,
    topic, setTopicState,
    typingUsers, handleTypingUser,
    pmTypingPeers, handlePmTyping,
    resetUsers,
  }
}
