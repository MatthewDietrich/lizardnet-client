import { useEffect, useRef } from 'react'

interface Props {
  nick: string
  isOper: boolean
  isSelf: boolean
  isTargetOp: boolean
  position: { x: number; y: number }
  onWhois: () => void
  onMention: () => void
  onWhisper: () => void
  onKick: () => void
  onBan: () => void
  onOp: () => void
  onDeop: () => void
  onClose: () => void
}

export default function UserMenu({ nick, isOper, isSelf, isTargetOp, position, onWhois, onMention, onWhisper, onKick, onBan, onOp, onDeop, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function action(fn: () => void) {
    fn()
    onClose()
  }

  return (
    <div
      ref={ref}
      className="card shadow"
      style={{ position: 'fixed', top: position.y, left: position.x, zIndex: 1050, minWidth: 130 }}
    >
      <div className="card-header py-1 px-2" style={{ fontSize: 12 }}>
        <strong>{nick}</strong>
      </div>
      <div className="list-group list-group-flush">
        <button
          className="list-group-item list-group-item-action py-1 px-2"
          style={{ fontSize: 13 }}
          onClick={() => action(onWhois)}
        >
          Info
        </button>
        {!isSelf && (<>
          <button
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13 }}
            onClick={() => action(onMention)}
          >
            Mention
          </button>
          <button
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13 }}
            onClick={() => action(onWhisper)}
          >
            Whisper
          </button>
        </>)}
        {isOper && !isSelf && <>
          <button
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13, color: '#9A9CBE' }}
            onClick={() => action(isTargetOp ? onDeop : onOp)}
          >
            {isTargetOp ? 'Deop' : 'Op'}
          </button>
          <button
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13, color: '#BEBC9A' }}
            onClick={() => action(onKick)}
          >
            Kick
          </button>
          <button
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13, color: '#BE9AAE' }}
            onClick={() => action(onBan)}
          >
            Ban
          </button>
        </>}
      </div>
    </div>
  )
}
