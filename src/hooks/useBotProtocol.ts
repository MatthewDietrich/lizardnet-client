import { useRef } from 'react'
import IRC from 'irc-framework'

const BOT_NICK = 'MediaBot'

interface Options {
  clientRef: React.MutableRefObject<InstanceType<typeof IRC.Client> | null>
}

export function useBotProtocol({ clientRef }: Options) {
  const botRequestsRef = useRef<{ resolve: (msg: string) => void; reject: (e: Error) => void }[]>([])
  const botBufferRef = useRef('')

  // Returns true if the notice was consumed (sent by the bot)
  function handleBotNotice(nick: string | undefined, text: string): boolean {
    if (nick?.toLowerCase() !== BOT_NICK.toLowerCase()) return false
    botBufferRef.current += text
    const buf = botBufferRef.current
    const isPresignOk = buf.startsWith('PRESIGN_OK ') && /https:\/\/lizardnet-media\.s3\.amazonaws\.com\/[0-9a-f-]+\.\w+$/.test(buf)
    const isComplete = isPresignOk || buf === 'DELETE_OK' || /^(PRESIGN_FAIL|DELETE_FAIL)/.test(buf)
    if (!isComplete) return true
    botBufferRef.current = ''
    const pending = botRequestsRef.current.shift()
    if (pending) {
      if (isPresignOk || buf === 'DELETE_OK') {
        pending.resolve(buf)
      } else {
        pending.reject(new Error(buf.replace(/^(PRESIGN_FAIL|DELETE_FAIL)\s*/, '')))
      }
    }
    return true
  }

  function requestFromBot(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = botRequestsRef.current.findIndex(r => r.resolve === resolve)
        if (idx >= 0) botRequestsRef.current.splice(idx, 1)
        reject(new Error('Bot request timed out'))
      }, 15_000)
      botRequestsRef.current.push({
        resolve: (msg: string) => { clearTimeout(timeout); resolve(msg) },
        reject: (e: Error) => { clearTimeout(timeout); reject(e) },
      })
      clientRef.current?.say(BOT_NICK, cmd)
    })
  }

  return { requestFromBot, handleBotNotice }
}
