import { useState } from 'react'
import { useIrcClient } from './hooks/useIrcClient'
import ConnectModal from './components/ConnectModal'
import AdminConsole from './components/AdminConsole'
import UserMenu from './components/UserMenu'
import TopicBar from './components/TopicBar'
import MessageList from './components/MessageList'
import UserList from './components/UserList'
import ChatInput from './components/ChatInput'

export default function App() {
  const { nick, connected, isOper, messages, users, ops, bannedUsers, topic, connect, register, disconnect, sendMessage, sendPrivMsg, sendRaw, whois, kick, ban, unban, op, deop, changeTopic } = useIrcClient()

  const [menuUser, setMenuUser] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [showConnectModal, setShowConnectModal] = useState(true)
  const [showAdminConsole, setShowAdminConsole] = useState(false)

  function handleSend(text: string) {
    if (text.startsWith('/msg ')) {
      const rest = text.slice(5)
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx !== -1) {
        sendPrivMsg(rest.slice(0, spaceIdx), rest.slice(spaceIdx + 1))
        return
      }
    }
    sendMessage(text)
  }

  return (
    <div className="d-flex flex-column px-4 py-3" style={{ height: '100dvh' }}>
      <div className="d-flex align-items-center gap-3 mb-3">
        <h4 className="mb-0">Lizardnet</h4>
        {connected && <button className="btn btn-sm btn-outline-danger" onClick={disconnect}>Disconnect</button>}
        {isOper && <button className="btn btn-sm btn-outline-warning" onClick={() => setShowAdminConsole(true)}>Admin console</button>}
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => setShowConnectModal(true)}>
          {nick ? <>Nick: <strong>{nick}</strong></> : 'Set nickname'}
        </button>
      </div>

      {connected && <TopicBar topic={topic} isOper={isOper} onChangeTopic={changeTopic} />}

      <div className="d-flex gap-3 mb-3 flex-grow-1" style={{ minHeight: 0 }}>
        <MessageList messages={messages} />
        <UserList
          users={users}
          ops={ops}
          nick={nick}
          onUserClick={(u, pos) => { setMenuUser(u); setMenuPos(pos) }}
        />
      </div>

      <ChatInput connected={connected} onSend={handleSend} />

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
    </div>
  )
}
