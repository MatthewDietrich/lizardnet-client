import { useState } from 'react'

interface Props {
  currentNick: string
  onConfirm: (nick: string) => void
  onClose: () => void
}

export default function ChangeNickPopup({ currentNick, onConfirm, onClose }: Props) {
  const [value, setValue] = useState(currentNick)

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
    onClose()
  }

  return (
    <>
      <div className="modal show d-block" tabIndex={-1} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header py-2">
              <h6 className="modal-title mb-0">Change nickname</h6>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body py-2">
                <input
                  className="form-control"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  autoFocus
                  maxLength={30}
                  onKeyDown={e => e.key === 'Escape' && onClose()}
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
