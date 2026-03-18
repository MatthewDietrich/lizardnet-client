import { useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface Props {
  currentNick: string
  onConfirm: (nick: string) => void
  onClose: () => void
}

export default function ChangeNickPopup({ currentNick, onConfirm, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose)
  const [value, setValue] = useState(currentNick)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
    onClose()
  }

  return (
    <>
      <div ref={trapRef} className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-label="Change nickname" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header py-2">
              <h6 className="modal-title mb-0">Change nickname</h6>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body py-2">
                <input
                  className="form-control"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  autoFocus
                  maxLength={30}

                />
              </div>
              <div className="modal-footer py-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={!value.trim()}>
                  Change
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  )
}
