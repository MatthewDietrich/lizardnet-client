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

  // Called from the whois event handler when a pending ban is in flight.
  // Returns true if the ban was handled (caller should suppress the normal whois display).
  function handleWhoisForBan(e: { nick: string; ident?: string; hostname?: string }): boolean {
    if (!e.nick || !pendingBansRef.current.has(e.nick)) return false
    const mask = `*!${e.ident ?? '*'}@${e.hostname ?? '*'}`
    pendingBansRef.current.delete(e.nick)
    maskToNickRef.current.set(mask, e.nick)
    clientRef.current?.raw(`MODE #chat +b ${mask}`)
    clientRef.current?.raw(`KICK #chat ${e.nick}`)
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
