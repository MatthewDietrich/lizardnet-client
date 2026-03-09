import { useState, useEffect, useRef } from 'react'
import { useIrcClient } from './hooks/useIrcClient'
import ConnectModal from './components/ConnectModal'
import AdminConsole from './components/AdminConsole'
import UserMenu from './components/UserMenu'
import { parseIrc } from './ircFormat'

export default function App() {
  const { nick, connected, isOper, messages, users, ops, bannedUsers, connect, register, disconnect, sendMessage, sendRaw, whois, kick, ban, unban, op, deop } = useIrcClient()

  const [menuUser, setMenuUser] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  const [showConnectModal, setShowConnectModal] = useState(true)
  const [showAdminConsole, setShowAdminConsole] = useState(false)
  const [input, setInput] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleConnect(chosenNick: string, password: string) {
    connect(chosenNick, password)
    setShowConnectModal(false)
  }

  function handleRegister(chosenNick: string, password: string, email: string) {
    register(chosenNick, password, email)
    setShowConnectModal(false)
  }

  function handleSendMessage(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
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

      <div className="d-flex gap-3 mb-3 flex-grow-1" style={{ minHeight: 0 }}>
        <div
          className="border rounded p-3 bg-light font-monospace flex-grow-1"
          style={{ overflowY: 'auto', fontSize: 13 }}
        >
          {messages.length === 0 && <span className="text-muted">No messages yet.</span>}
          {messages.map((m, i) => (
            m.kind === 'event'
              ? <div key={i} className="fst-italic" style={{ fontSize: 12, color: '#BE9AAE' }}>
                  <span style={{ fontSize: 11, color: '#444' }}>{m.ts.toLocaleTimeString()}</span>{' '}
                  {m.text}
                </div>
              : <div key={i}>
                  <span style={{ fontSize: 11, color: '#444' }}>{m.ts.toLocaleTimeString()}</span>{' '}
                  <strong>{m.from}</strong>: {parseIrc(m.text)}
                </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div
          className="border rounded p-2 bg-light font-monospace flex-shrink-0"
          style={{ width: 160, overflowY: 'auto', fontSize: 12 }}
        >
          <div className="mb-1" style={{ fontSize: 11, fontWeight: 600, color: '#9A9CBE' }}>
            USERS ({users.length})
          </div>
          {users.map(u => (
            <div
              key={u}
              className={`${u === nick ? 'fw-bold' : ''} user-select-none`}
              style={{ cursor: 'pointer', borderRadius: 3, padding: '1px 2px', color: u === nick ? '#9ABEAA' : '#9A9CBE' }}
              onClick={e => { setMenuUser(u); setMenuPos({ x: e.clientX, y: e.clientY }) }}
            >
              {u}{ops.includes(u) && <span style={{ color: '#BEBC9A', fontSize: 10 }}> (Mod)</span>}
            </div>
          ))}
          {users.length === 0 && <span style={{ color: '#9A9CBE' }}>—</span>}
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="d-flex gap-2 flex-shrink-0">
        <input
          className="form-control"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={!connected}
        />
        <button type="submit" className="btn btn-primary" disabled={!connected}>Send</button>
      </form>

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
          onConnect={handleConnect}
          onRegister={handleRegister}
        />
      )}
    </div>
  )
}
