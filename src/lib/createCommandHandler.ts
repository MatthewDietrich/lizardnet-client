export const HELP_LINES = [
  '/say <message>               — send message literally (useful for text starting with /)',
  '/me <action>                 — send an action message',
  '/nick <nick>                 — change your nickname',
  '/msg <nick> <message>        — send a private message',
  '/identify <password>         — identify a registered nickname (log in)',
  '/register <password> <email> — register nickname',
  '/ghost <nick> <password>     — disconnect a ghost using your nickname',
  '/away [message]              — set yourself as away',
  '/back                        — return from away',
  '/oper <name> <password>      — authenticate as a server operator',
  '/help                        — show this help',
]

interface Options {
  activeTab: string
  sendMessage: (msg: string) => void
  sendPrivMsg: (target: string, msg: string) => void
  sendAction: (action: string, target: string) => void
  changeNick: (nick: string) => void
  openPmConversation: (nick: string) => void
  switchTab: (tab: string) => void
  sayNickServ: (msg: string) => void
  sendOper: (name: string, pass: string) => void
  setAway: (msg: string) => void
  setBack: () => void
  addActive: (msg: string) => void
}

export function createCommandHandler({
  activeTab, sendMessage, sendPrivMsg, sendAction, changeNick,
  openPmConversation, switchTab, sayNickServ, sendOper, setAway, setBack, addActive,
}: Options) {
  function handleSend(text: string) {
    if (text.startsWith('/say ')) {
      const msg = text.slice(5)
      if (msg) { activeTab === '#chat' ? sendMessage(msg) : sendPrivMsg(activeTab, msg); return }
    }
    if (text.startsWith('/me ')) {
      const action = text.slice(4).trim()
      if (action) { sendAction(action, activeTab !== '#chat' ? activeTab : '#chat'); return }
    }
    if (text.startsWith('/nick ')) {
      const newNick = text.slice(6).trim()
      if (newNick) { changeNick(newNick); return }
    }
    if (text.startsWith('/msg ')) {
      const rest = text.slice(5)
      const spaceIdx = rest.indexOf(' ')
      const target = spaceIdx === -1 ? rest.trim() : rest.slice(0, spaceIdx)
      const body = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1)
      if (target) {
        openPmConversation(target)
        if (body.trim()) sendPrivMsg(target, body)
        switchTab(target)
        return
      }
    }
    if (text.startsWith('/identify ')) {
      sayNickServ(`IDENTIFY ${text.slice(10).trim()}`)
      return
    }
    if (text.startsWith('/register ')) {
      const parts = text.slice(10).trim().split(' ')
      if (parts.length >= 2) { sayNickServ(`REGISTER ${parts[0]} ${parts[1]}`); return }
    }
    if (text.startsWith('/ghost ')) {
      const parts = text.slice(7).trim().split(' ')
      if (parts.length >= 2) { sayNickServ(`GHOST ${parts[0]} ${parts[1]}`); return }
    }
    if (text.startsWith('/oper ')) {
      const parts = text.slice(6).trim().split(' ')
      if (parts.length >= 2) { sendOper(parts[0], parts[1]); return }
    }
    if (text === '/away' || text.startsWith('/away ')) {
      setAway(text.slice(6))
      return
    }
    if (text === '/back') { setBack(); return }
    if (text === '/help') { for (const line of HELP_LINES) addActive(line); return }
    if (text.startsWith('/')) { addActive('Invalid command. Type /help for a list of commands.'); return }
    if (activeTab !== '#chat') { sendPrivMsg(activeTab, text); return }
    sendMessage(text)
  }

  return handleSend
}
