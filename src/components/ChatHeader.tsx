import lizardIcon from '../assets/lizard_icon.svg'
import { useIrcContext } from '../contexts/IrcContext'

interface Props {
  theme: 'dark' | 'light'
  onShowAdmin: () => void
  onShowSettings: () => void
  onShowNickOrConnect: () => void
}

export default function ChatHeader({ theme, onShowAdmin, onShowSettings, onShowNickOrConnect }: Props) {
  const { nick, connStatus, isOper, ops } = useIrcContext()
  return (
    <div className="d-flex align-items-center gap-3 mb-3">
      <img src={lizardIcon} alt="" style={{ height: 32, filter: theme === 'light' ? 'brightness(0)' : 'none' }} />
      <h4 className="mb-0">Lizardnet</h4>
      <span
        title={connStatus}
        role="status"
        aria-label={`Connection status: ${connStatus}`}
        style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: connStatus === 'connected' ? 'var(--c-primary)' : connStatus === 'disconnected' ? 'var(--c-tertiary)' : 'var(--c-quaternary)',
          animation: connStatus === 'connecting' || connStatus === 'reconnecting' ? 'pulse 1s ease-in-out infinite' : 'none',
        }}
      />
      {(isOper || ops.includes(nick)) && (
        <button className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1" onClick={onShowAdmin}>
          <span className="material-icons" style={{ fontSize: 16 }}>admin_panel_settings</span>
          Moderator Console
        </button>
      )}
      <div className="ms-auto d-flex align-items-center gap-2" style={{ position: 'relative' }}>
        <button
          className="btn btn-sm btn-outline-secondary d-flex align-items-center"
          onClick={onShowSettings}
          title="Settings"
          aria-label="Settings"
        >
          <span className="material-icons" style={{ fontSize: 16 }}>settings</span>
        </button>
        <button
          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
          onClick={onShowNickOrConnect}
        >
          <span className="material-icons" style={{ fontSize: 16 }}>account_circle</span>
          {nick ? <><strong>{nick}</strong></> : 'Set nickname'}
        </button>
      </div>
    </div>
  )
}
