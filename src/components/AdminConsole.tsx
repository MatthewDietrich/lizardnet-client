import { useState } from 'react'

interface Props {
  onClose: () => void
  onSendRaw: (command: string) => void
  bannedUsers: string[]
  onUnban: (mask: string) => void
}

export default function AdminConsole({ onClose, onSendRaw, bannedUsers, onUnban }: Props) {
  const [input, setInput] = useState('')

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!input.trim()) return
    onSendRaw(input.trim())
    setInput('')
  }

  return (
    <>
      <div className="modal show d-block" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h6 className="modal-title">Moderator Console</h6>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              <p className="small mb-2" style={{ color: '#BE9AAE' }}>Banned users</p>
              <div
                className="border rounded p-2 mb-3 font-monospace"
                style={{ minHeight: 48, maxHeight: 160, overflowY: 'auto', fontSize: 12 }}
              >
                {bannedUsers.length === 0
                  ? <span className="text-muted">No bans.</span>
                  : bannedUsers.map(mask => (
                    <div key={mask} className="d-flex align-items-center justify-content-between gap-2">
                      <span>{mask}</span>
                      <button
                        className="btn btn-sm btn-outline-secondary py-0"
                        style={{ fontSize: 11 }}
                        onClick={() => onUnban(mask)}
                      >
                        Unban
                      </button>
                    </div>
                  ))
                }
              </div>

              <p className="small mb-2" style={{ color: '#9A9CBE' }}>Raw command</p>
              <form onSubmit={handleSubmit}>
                <div className="input-group">
                  <input
                    className="form-control font-monospace"
                    placeholder="e.g. KICK #chat user :reason"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-warning" disabled={!input.trim()}>
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" onClick={onClose} />
    </>
  )
}
