import { useState, useEffect, useRef } from 'react'
import lizardIcon from './assets/lizard_icon.svg'
import { useIrcClient } from './hooks/useIrcClient'
import ConnectModal from './components/ConnectModal'
import AdminConsole from './components/AdminConsole'
import UserMenu from './components/UserMenu'
import TopicBar from './components/TopicBar'
import MessageList from './components/MessageList'
import UserList from './components/UserList'
import ChatInput, { type ChatInputHandle } from './components/ChatInput'
import ChangeNickPopup from './components/ChangeNickPopup'
import PmTabs from './components/PmTabs'

export default function App() {
  const { nick, connected, connStatus, isOper, messages, users, ops, bannedUsers, topic, unreadCount, awayUsers, pmConversations, pmUnread, pmPeerRename, connect, register, sendMessage, sendPrivMsg, whois, kick, ban, unban, op, deop, changeTopic, changeNick, sayNickServ, addActive, sendAction, setAway, setBack, clearPmUnread, closePmConversation, setActivePmPeer, sendOper } = useIrcClient()

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Lizardnet` : 'Lizardnet'
  }, [unreadCount])

  const [menuUser, setMenuUser] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [showConnectModal, setShowConnectModal] = useState(true)
  const [showAdminConsole, setShowAdminConsole] = useState(false)
  const [showNickPopup, setShowNickPopup] = useState(false)
  const [showThemePanel, setShowThemePanel] = useState(false)
  const [activeTab, setActiveTab] = useState('#chat')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  const chatInputRef = useRef<ChatInputHandle>(null)

  useEffect(() => {
    setActivePmPeer(activeTab !== '#chat' ? activeTab : null)
  }, [activeTab])

  useEffect(() => {
    if (!pmPeerRename) return
    setActiveTab(prev => prev === pmPeerRename.from ? pmPeerRename.to : prev)
  }, [pmPeerRename])

  function switchTab(tab: string) {
    setActiveTab(tab)
    if (tab !== '#chat') clearPmUnread(tab)
  }

  function closeTab(peer: string) {
    closePmConversation(peer)
    if (activeTab === peer) setActiveTab('#chat')
  }

  const HELP_LINES = [
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
      if (spaceIdx !== -1) {
        const target = rest.slice(0, spaceIdx)
        sendPrivMsg(target, rest.slice(spaceIdx + 1))
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
    if (text.startsWith('/oper ')) {
      const parts = text.slice(6).trim().split(' ')
      if (parts.length >= 2) {
        sendOper(parts[0], parts[1])
        return
      }
    }
    if (text === '/away' || text.startsWith('/away ')) {
      setAway(text.slice(6))
      return
    }
    if (text === '/back') {
      setBack()
      return
    }
    if (text === '/help') {
      for (const line of HELP_LINES) addActive(line)
      return
    }
    if (text.startsWith('/')) {
      addActive('Invalid command. Type /help for a list of commands.')
      return
    }
    if (activeTab !== '#chat') {
      sendPrivMsg(activeTab, text)
      return
    }
    sendMessage(text)
  }

  const activeMessages = activeTab === '#chat' ? messages : (pmConversations.get(activeTab) ?? [])
  const pmPeers = [...pmConversations.keys()]

  return (
    <div className="d-flex flex-column px-4 py-3" style={{ height: '100dvh' }}>
      <div className="d-flex align-items-center gap-3 mb-3">
        <img src={lizardIcon} alt="" style={{ height: 32, filter: theme === 'light' ? 'brightness(0)' : 'none' }} />
        <h4 className="mb-0">Lizardnet</h4>
        <span title={connStatus} style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: connStatus === 'connected' ? 'var(--c-primary)' : connStatus === 'disconnected' ? 'var(--c-tertiary)' : 'var(--c-quaternary)',
          animation: connStatus === 'connecting' || connStatus === 'reconnecting' ? 'pulse 1s ease-in-out infinite' : 'none',
        }} />
        {(isOper || ops.includes(nick)) && (
          <button className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1" onClick={() => setShowAdminConsole(true)}>
            <span className="material-icons" style={{ fontSize: 16 }}>admin_panel_settings</span>
            Moderator Console
          </button>
        )}
        <div className="ms-auto d-flex align-items-center gap-2" style={{ position: 'relative' }}>
          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center"
            onClick={() => setShowThemePanel(v => !v)}
            title="Theme"
          >
            <span className="material-icons" style={{ fontSize: 16 }}>palette</span>
          </button>
          {showThemePanel && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 200,
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 130,
            }}>
              {(['dark', 'light'] as const).map(t => (
                <button
                  key={t}
                  className="btn btn-sm"
                  onClick={() => { setTheme(t); setShowThemePanel(false) }}
                  style={{
                    textAlign: 'left',
                    background: theme === t ? 'rgba(var(--c-primary-rgb), 0.12)' : 'transparent',
                    border: '1px solid ' + (theme === t ? 'var(--c-primary)' : 'var(--c-border)'),
                    color: 'var(--c-primary)',
                  }}
                >
                  {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              ))}
            </div>
          )}
          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={() => connected ? setShowNickPopup(true) : setShowConnectModal(true)}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>account_circle</span>
            {nick ? <><strong>{nick}</strong></> : 'Set nickname'}
          </button>
        </div>
      </div>

      {connected && <TopicBar topic={topic} isOper={isOper} onChangeTopic={changeTopic} />}

      <div className="d-flex gap-3 flex-grow-1" style={{ minHeight: 0 }}>
        <MessageList messages={activeMessages} nick={nick} onNickClick={(u, pos) => { setMenuUser(u); setMenuPos(pos) }} />
        <UserList
          users={users}
          ops={ops}
          awayUsers={awayUsers}
          nick={nick}
          onUserClick={(u, pos) => { setMenuUser(u); setMenuPos(pos) }}
        />
      </div>

      <PmTabs
        activeTab={activeTab}
        pmPeers={pmPeers}
        pmUnread={pmUnread}
        onSwitch={switchTab}
        onClose={closeTab}
      />

      <div className={pmPeers.length > 0 ? 'mt-2' : 'mt-3'}>
        <ChatInput ref={chatInputRef} connected={connected} users={users} commands={HELP_LINES.map(l => l.match(/^(\S+)/)?.[1] ?? '')} onSend={handleSend} />
      </div>

      {menuUser && (
        <UserMenu
          nick={menuUser}
          isOper={isOper}
          isSelf={menuUser === nick}
          isTargetOp={ops.includes(menuUser)}
          position={menuPos}
          onWhois={() => whois(menuUser)}
          onMention={() => chatInputRef.current?.mention(menuUser)}
          onWhisper={() => chatInputRef.current?.setDraft(`/msg ${menuUser} `)}
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
