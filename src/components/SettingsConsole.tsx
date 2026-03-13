import { useState } from 'react'
import type { Settings } from '../hooks/useSettings'
import { playNotificationSound } from '../lib/notification'

interface Props {
  onClose: () => void
  settings: Settings
  onChangeSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  theme: 'dark' | 'light'
  onChangeTheme: (t: 'dark' | 'light') => void
}

export default function SettingsConsole({ onClose, settings, onChangeSetting, theme, onChangeTheme }: Props) {
  const [tab, setTab] = useState<'notifications' | 'theme'>('notifications')

  async function handleDesktopToggle(enabled: boolean) {
    if (!enabled) {
      onChangeSetting('desktopNotifications', false)
      return
    }
    if (Notification.permission === 'granted') {
      onChangeSetting('desktopNotifications', true)
    } else if (Notification.permission === 'denied') {
      alert('Notifications are blocked by your browser. Enable them in your browser site settings and try again.')
    } else {
      const result = await Notification.requestPermission()
      if (result === 'granted') onChangeSetting('desktopNotifications', true)
    }
  }

  return (
    <>
      <div className="modal show d-block" tabIndex={-1} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h6 className="modal-title">Settings</h6>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                  <button
                    className={`nav-link${tab === 'notifications' ? ' active' : ''}`}
                    onClick={() => setTab('notifications')}
                  >
                    Notifications
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link${tab === 'theme' ? ' active' : ''}`}
                    onClick={() => setTab('theme')}
                  >
                    Theme
                  </button>
                </li>
              </ul>

              {tab === 'notifications' && (
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex align-items-center justify-content-between">
                    <p className="small mb-0" style={{ color: 'var(--c-tertiary)' }}>Sound</p>
                    <button
                      className="btn btn-sm btn-outline-secondary py-0"
                      style={{ fontSize: 11 }}
                      onClick={playNotificationSound}
                    >
                      Test sound
                    </button>
                  </div>
                  <Toggle
                    label="Sound on mention"
                    checked={settings.soundMentions}
                    onChange={v => onChangeSetting('soundMentions', v)}
                  />
                  <Toggle
                    label="Sound on private message"
                    checked={settings.soundPm}
                    onChange={v => onChangeSetting('soundPm', v)}
                  />
                  <p className="small mb-0 mt-1" style={{ color: 'var(--c-tertiary)' }}>Desktop</p>
                  <Toggle
                    label="Desktop notifications"
                    description={Notification.permission === 'denied' ? 'Blocked by browser' : undefined}
                    checked={settings.desktopNotifications}
                    onChange={handleDesktopToggle}
                  />
                </div>
              )}

              {tab === 'theme' && (
                <div className="d-flex flex-column gap-2">
                  {(['dark', 'light'] as const).map(t => (
                    <button
                      key={t}
                      className="btn btn-sm text-start"
                      onClick={() => onChangeTheme(t)}
                      style={{
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
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" onClick={onClose} />
    </>
  )
}

function Toggle({ label, description, checked, onChange }: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3">
      <div>
        <div style={{ fontSize: 14 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--c-tertiary)' }}>{description}</div>}
      </div>
      <div className="form-check form-switch mb-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
      </div>
    </div>
  )
}
