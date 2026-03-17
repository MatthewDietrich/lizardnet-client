import { useState, useEffect, useRef } from 'react'
import { deleteFromS3, hasUploadedUrl } from './lib/s3Upload'
import { useIrcClient } from './hooks/useIrcClient'
import { useSettings } from './hooks/useSettings'
import { createCommandHandler, HELP_LINES } from './lib/createCommandHandler'
import { IrcProvider } from './contexts/IrcContext'
import ChatHeader from './components/ChatHeader'
import ConnectModal from './components/ConnectModal'
import AdminConsole from './components/AdminConsole'
import SettingsConsole from './components/SettingsConsole'
import UserMenu from './components/UserMenu'
import TopicBar from './components/TopicBar'
import MessageList from './components/MessageList'
import UserList from './components/UserList'
import ChatInput, { type ChatInputHandle } from './components/ChatInput'
import ChangeNickPopup from './components/ChangeNickPopup'
import PmTabs from './components/PmTabs'
import ErrorBoundary from './components/ErrorBoundary'
import { TypingIndicator } from './components/TypingIndicator'

export default function App() {
  const { settings, setSetting } = useSettings()
  const { nick, connected, connStatus, isOper, isIdentified, messages, users, ops, bannedUsers, topic, unreadCount, awayUsers, typingUsers, pmTypingPeers, pmConversations, pmUnread, pmPeerRename, connect, register, sendMessage, sendPrivMsg, whois, kick, ban, unban, op, deop, changeTopic, changeNick, sayNickServ, addActive, sendAction, setAway, setBack, clearPmUnread, openPmConversation, closePmConversation, setActivePmPeer, sendOper, redactMediaUrl, sendMediaDelete, sendTyping, sendEdit, requestFromBot } = useIrcClient(settings)

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Lizardnet` : 'Lizardnet'
  }, [unreadCount])

  const [menuUser, setMenuUser] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [showConnectModal, setShowConnectModal] = useState(true)
  const [showAdminConsole, setShowAdminConsole] = useState(false)
  const [showSettingsConsole, setShowSettingsConsole] = useState(false)
  const [showNickPopup, setShowNickPopup] = useState(false)
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
    requestAnimationFrame(() => chatInputRef.current?.focus())
  }

  function closeTab(peer: string) {
    closePmConversation(peer)
    if (activeTab === peer) setActiveTab('#chat')
  }

  const handleSend = createCommandHandler({
    activeTab, sendMessage, sendPrivMsg, sendAction, changeNick,
    openPmConversation, switchTab, sayNickServ, sendOper, setAway, setBack, addActive,
  })

  const activeMessages = activeTab === '#chat' ? messages : (pmConversations.get(activeTab) ?? [])
  const pmPeers = [...pmConversations.keys()]

  return (
    <IrcProvider value={{ nick, connected, connStatus, isOper, isIdentified, ops }}>
    <div className="d-flex flex-column px-4 py-3" style={{ height: '100dvh' }}>
      <ChatHeader
        theme={theme}
        onShowAdmin={() => setShowAdminConsole(true)}
        onShowSettings={() => setShowSettingsConsole(true)}
        onShowNickOrConnect={() => connected ? setShowNickPopup(true) : setShowConnectModal(true)}
      />

      {connected && <TopicBar topic={topic} onChangeTopic={changeTopic} />}

      <div className="d-flex gap-3 flex-grow-1" style={{ minHeight: 0 }}>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ErrorBoundary>
            <MessageList
              messages={activeMessages}
              onNickClick={(u, pos) => { setMenuUser(u); setMenuPos(pos) }}
              canDeleteUrl={url => isIdentified && (hasUploadedUrl(url) || isOper || ops.includes(nick))}
              onDeleteMedia={url => deleteFromS3(url, requestFromBot).then(() => { redactMediaUrl(url) }).catch(err => addActive(`Failed to delete: ${err.message.includes('identified') ? 'Logged in as guest. Please /register or /identify. Type /help for help' : err.message}`))}
              canRedactUrl={() => isOper || ops.includes(nick)}
              onRedactMedia={url => { redactMediaUrl(url); sendMediaDelete(url) }}
              onEdit={isIdentified ? (msgid, newText) => sendEdit(msgid, newText, activeTab === '#chat' ? '#chat' : activeTab) : undefined}
            />
          </ErrorBoundary>
        </div>
        <UserList
          users={users}
          awayUsers={awayUsers}
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

      <div className={pmPeers.length > 0 ? 'mt-2' : 'mt-1'}>
        <TypingIndicator users={activeTab === '#chat' ? typingUsers : pmTypingPeers.has(activeTab) ? [activeTab] : []} />
        <ChatInput ref={chatInputRef} users={users} commands={HELP_LINES.map(l => l.match(/^(\S+)/)?.[1] ?? '')} onSend={handleSend} botRequest={requestFromBot} onTyping={connected ? state => sendTyping(state, activeTab) : undefined} />
      </div>

      {menuUser && (
        <UserMenu
          nick={menuUser}
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

      {showSettingsConsole && (
        <SettingsConsole
          onClose={() => setShowSettingsConsole(false)}
          settings={settings}
          onChangeSetting={setSetting}
          theme={theme}
          onChangeTheme={setTheme}
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
    </IrcProvider>
  )
}
