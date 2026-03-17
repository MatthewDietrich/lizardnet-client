import { useRef } from 'react'
import IRC from 'irc-framework'

interface Options {
  clientRef: React.MutableRefObject<InstanceType<typeof IRC.Client> | null>
}

export function useIrcModeration({ clientRef }: Options) {
  const pendingBansRef = useRef<Set<string>>(new Set())
  const silentWhoisRef = useRef<Set<string>>(new Set())
  const maskToNickRef = useRef<Map<string, string>>(new Map())

  function sanitize(s: string) { return s.replace(/[\r\n]/g, '') }

  // Called with parsed params from a raw 311 (WHOIS) reply.
  // Completes a pending ban initiated by ban(). Returns true if it handled the event.
  function handleWhoisForBan(p: string[]): boolean {
    if (!p[1] || !pendingBansRef.current.has(p[1])) return false
    const mask = `*!${p[2]}@${p[3]}`
    pendingBansRef.current.delete(p[1])
    maskToNickRef.current.set(mask, p[1])
    clientRef.current?.raw(`MODE #chat +b ${mask}`)
    clientRef.current?.raw(`KICK #chat ${p[1]}`)
    return true
  }

  function kick(target: string) { clientRef.current?.raw(`KICK #chat ${sanitize(target)}`) }
  function ban(target: string) {
    const safe = sanitize(target)
    pendingBansRef.current.add(safe)
    silentWhoisRef.current.add(safe)
    clientRef.current?.raw(`WHOIS ${safe}`)
  }
  function unban(mask: string) { clientRef.current?.raw(`MODE #chat -b ${sanitize(mask)}`) }
  function op(target: string) { clientRef.current?.raw(`MODE #chat +o ${sanitize(target)}`) }
  function deop(target: string) { clientRef.current?.raw(`MODE #chat -o ${sanitize(target)}`) }

  return { silentWhoisRef, maskToNickRef, handleWhoisForBan, kick, ban, unban, op, deop }
}
