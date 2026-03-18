import { useState, useEffect, useRef, useMemo } from 'react'
import { deleteFromS3, hasUploadedUrl } from './lib/s3Upload'
import { useIrcClient } from './hooks/useIrcClient'
import { useSettings } from './hooks/useSettings'
import { createCommandHandler, HELP_LINES } from './lib/createCommandHandler'
import { CHANNEL } from './lib/constants'
import { IrcProvider } from './contexts/IrcContext'
import ChatHeader from './components/ChatHeader'
import type { MessageActions } from './components/MessageList'
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
  const irc = useIrcClient(settings)
  const { nick, connected, connStatus, isIdentified, connect, register, changeNick, sayNickServ, setAway, setBack, sendOper, whois } = irc.connection
  const { messages, unreadCount, topic, typingUsers, sendMessage, sendAction, sendEdit, addActive, changeTopic, sendTyping } = irc.channel
  const { pmConversations, pmUnread, pmPeerRename, pmTypingPeers, sendPrivMsg, clearPmUnread, openPmConversation, closePmConversation, setActivePmPeer } = irc.pm
  const { users, ops, bannedUsers, awayUsers, isOper, kick, ban, unban, op, deop } = irc.users
  const { redactMediaUrl, sendMediaDelete, sendMsgDelete, requestFromBot } = irc.media

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Lizardnet` : 'Lizardnet'
  }, [unreadCount])

  const [menuUser, setMenuUser] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [showConnectModal, setShowConnectModal] = useState(true)
  const [showAdminConsole, setShowAdminConsole] = useState(false)
  const [showSettingsConsole, setShowSettingsConsole] = useState(false)
  const [showNickPopup, setShowNickPopup] = useState(false)
  const [activeTab, setActiveTab] = useState(CHANNEL)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  const chatInputRef = useRef<ChatInputHandle>(null)

  useEffect(() => {
    if (!pmPeerRename) return
    setActiveTab(prev => {
      if (prev !== pmPeerRename.from) return prev
      setActivePmPeer(pmPeerRename.to)
      return pmPeerRename.to
    })
  }, [pmPeerRename, setActivePmPeer])

  function switchTab(tab: string) {
    setActiveTab(tab)
    setActivePmPeer(tab !== CHANNEL ? tab : null)
    if (tab !== CHANNEL) clearPmUnread(tab)
    requestAnimationFrame(() => chatInputRef.current?.focus())
  }

  function closeTab(peer: string) {
    closePmConversation(peer)
    if (activeTab === peer) setActiveTab(CHANNEL)
  }

  const handleSend = useMemo(() => createCommandHandler({
    activeTab, sendMessage, sendPrivMsg, sendAction, changeNick,
    openPmConversation, switchTab, sayNickServ, sendOper, setAway, setBack, addActive,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeTab, sendMessage, sendPrivMsg, sendAction, changeNick, openPmConversation, sayNickServ, sendOper, setAway, setBack, addActive])

  const activeMessages = activeTab === CHANNEL ? messages : (pmConversations.get(activeTab) ?? [])
  const pmPeers = useMemo(() => [...pmConversations.keys()], [pmConversations])
  const messageActions: MessageActions = useMemo(() => ({
    canDeleteUrl: url => isIdentified && (hasUploadedUrl(url) || isOper || ops.includes(nick)),
    onDeleteMedia: url => deleteFromS3(url, requestFromBot).then(() => { redactMediaUrl(url) }).catch(err => addActive(`Failed to delete: ${err.message.includes('identified') ? 'Logged in as guest. Please /register or /identify. Type /help for help' : err.message}`)),
    canRedactUrl: () => isOper || ops.includes(nick),
    onRedactMedia: url => { redactMediaUrl(url); sendMediaDelete(url) },
    onEdit: isIdentified ? (msgid, newText) => sendEdit(msgid, newText, activeTab === CHANNEL ? CHANNEL : activeTab) : undefined,
    onDeleteMsg: activeTab === CHANNEL && (isOper || ops.includes(nick)) ? msgid => sendMsgDelete(msgid) : undefined,
  }), [isIdentified, isOper, ops, nick, requestFromBot, redactMediaUrl, addActive, sendMediaDelete, sendEdit, sendMsgDelete, activeTab])

  const ircContextValue = useMemo(
    () => ({ nick, connected, connStatus, isOper, isIdentified, ops }),
    [nick, connected, connStatus, isOper, isIdentified, ops]
  )

  return (
    <IrcProvider value={ircContextValue}>
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
              actions={messageActions}
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
        <TypingIndicator users={activeTab === CHANNEL ? typingUsers : pmTypingPeers.has(activeTab) ? [activeTab] : []} />
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
