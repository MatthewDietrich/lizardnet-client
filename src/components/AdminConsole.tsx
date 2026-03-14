import { useFocusTrap } from '../hooks/useFocusTrap'

interface Props {
  onClose: () => void
  bannedUsers: string[]
  onUnban: (mask: string) => void
}

export default function AdminConsole({ onClose, bannedUsers, onUnban }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose)
  return (
    <>
      <div ref={trapRef} className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-label="Moderator Console" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h6 className="modal-title">Moderator Console</h6>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              <p className="small mb-2" style={{ color: 'var(--c-tertiary)' }}>Banned users</p>
              <div
                className="border rounded p-2 font-monospace"
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
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" onClick={onClose} />
    </>
  )
}
