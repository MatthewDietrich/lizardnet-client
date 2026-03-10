import { useState, useEffect } from 'react'
import lizardIcon from './assets/lizard_icon.png'
import { useIrcClient } from './hooks/useIrcClient'
import ConnectModal from './components/ConnectModal'
import AdminConsole from './components/AdminConsole'
import UserMenu from './components/UserMenu'
import TopicBar from './components/TopicBar'
import MessageList from './components/MessageList'
import UserList from './components/UserList'
import ChatInput from './components/ChatInput'
import ChangeNickPopup from './components/ChangeNickPopup'

export default function App() {
  const { nick, connected, connStatus, isOper, messages, users, ops, bannedUsers, topic, unreadCount, connect, register, sendMessage, sendPrivMsg, sendRaw, whois, kick, ban, unban, op, deop, changeTopic, changeNick, sayNickServ, addMessage, sendAction } = useIrcClient()

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Lizardnet` : 'Lizardnet'
  }, [unreadCount])

  const [menuUser, setMenuUser] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [showConnectModal, setShowConnectModal] = useState(true)
  const [showAdminConsole, setShowAdminConsole] = useState(false)
  const [showNickPopup, setShowNickPopup] = useState(false)

  const HELP_LINES = [
    '/me <action>                 — send an action message',
    '/nick <nick>                 — change your nickname',
    '/msg <nick> <message>        — send a private message',
    '/identify <password>         — identify a registered nickname (log in)',
    '/register <password> <email> — register nickname',
    '/ghost <nick> <password>     — disconnect a ghost using your nickname',
    '/help                        — show this help',
  ]

  function handleSend(text: string) {
    if (text.startsWith('/me ')) {
      const action = text.slice(4).trim()
      if (action) { sendAction(action); return }
    }
    if (text.startsWith('/nick ')) {
      const newNick = text.slice(6).trim()
      if (newNick) { changeNick(newNick); return }
    }
    if (text.startsWith('/msg ')) {
      const rest = text.slice(5)
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx !== -1) {
        sendPrivMsg(rest.slice(0, spaceIdx), rest.slice(spaceIdx + 1))
        return
      }
    }
    if (text.startsWith('/identify ')) {
      sayNickServ(`IDENTIFY ${text.slice(10).trim()}`)
      return
    }
    if (text.startsWith('/register ')) {
      const parts = text.slice(10).trim().split(' ')
      if (parts.length >= 2) {
        sayNickServ(`REGISTER ${parts[0]} ${parts[1]}`)
        return
      }
    }
    if (text.startsWith('/ghost ')) {
      const parts = text.slice(7).trim().split(' ')
      if (parts.length >= 2) {
        sayNickServ(`GHOST ${parts[0]} ${parts[1]}`)
        return
      }
    }
    if (text === '/help') {
      for (const line of HELP_LINES) addMessage('*', line, 'event')
      return
    }
    sendMessage(text)
  }

  return (
    <div className="d-flex flex-column px-4 py-3" style={{ height: '100dvh' }}>
      <div className="d-flex align-items-center gap-3 mb-3">
        <img src={lizardIcon} alt="" style={{ height: 32 }} />
        <h4 className="mb-0">Lizardnet</h4>
        <span title={connStatus} style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: connStatus === 'connected' ? 'var(--c-primary)' : connStatus === 'disconnected' ? 'var(--c-tertiary)' : 'var(--c-quaternary)',
          animation: connStatus === 'connecting' || connStatus === 'reconnecting' ? 'pulse 1s ease-in-out infinite' : 'none',
        }} />
        {(isOper || ops.includes(nick)) && <button className="btn btn-sm btn-outline-warning" onClick={() => setShowAdminConsole(true)}>Moderator Console</button>}
        <button
          className="btn btn-sm btn-outline-secondary ms-auto"
          onClick={() => connected ? setShowNickPopup(true) : setShowConnectModal(true)}
        >
          {nick ? <>Nick: <strong>{nick}</strong></> : 'Set nickname'}
        </button>
      </div>

      {connected && <TopicBar topic={topic} isOper={isOper} onChangeTopic={changeTopic} />}

      <div className="d-flex gap-3 mb-3 flex-grow-1" style={{ minHeight: 0 }}>
        <MessageList messages={messages} nick={nick} />
        <UserList
          users={users}
          ops={ops}
          nick={nick}
          onUserClick={(u, pos) => { setMenuUser(u); setMenuPos(pos) }}
        />
      </div>

      <ChatInput connected={connected} users={users} onSend={handleSend} />

      {menuUser && (
        <UserMenu
          nick={menuUser}
          isOper={isOper}
          isSelf={menuUser === nick}
          isTargetOp={ops.includes(menuUser)}
          position={menuPos}
          onWhois={() => whois(menuUser)}
          onOp={() => op(menuUser)}
          onDeop={() => deop(menuUser)}
          onKick={() => kick(menuUser)}
          onBan={() => ban(menuUser)}
          onClose={() => setMenuUser(null)}
        />
      )}

      {showAdminConsole && (
        <AdminConsole
          onClose={() => setShowAdminConsole(false)}
          onSendRaw={sendRaw}
          bannedUsers={bannedUsers}
          onUnban={unban}
        />
      )}

      {showConnectModal && (
        <ConnectModal
          onConnect={(n, p) => { connect(n, p); setShowConnectModal(false) }}
          onRegister={(n, p, e) => { register(n, p, e); setShowConnectModal(false) }}
        />
      )}

      {showNickPopup && (
        <ChangeNickPopup
          currentNick={nick}
          onConfirm={changeNick}
          onClose={() => setShowNickPopup(false)}
        />
      )}
    </div>
  )
}
