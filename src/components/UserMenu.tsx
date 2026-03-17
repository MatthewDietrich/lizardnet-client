import { useEffect, useRef } from 'react'
import { useIrcContext } from '../contexts/IrcContext'

interface Props {
  nick: string
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

export default function UserMenu({ nick, position, onWhois, onMention, onWhisper, onKick, onBan, onOp, onDeop, onClose }: Props) {
  const { nick: currentNick, isOper, ops } = useIrcContext()
  const isSelf = nick === currentNick
  const isTargetOp = ops.includes(nick)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
        if (!items.length) return
        const idx = items.indexOf(document.activeElement as HTMLElement)
        const next = e.key === 'ArrowDown'
          ? items[(idx + 1) % items.length]
          : items[(idx - 1 + items.length) % items.length]
        next.focus()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Focus the first menu item when the menu opens
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]')
    first?.focus()
  }, [])

  function action(fn: () => void) {
    fn()
    onClose()
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={nick}
      className="card shadow"
      style={{ position: 'fixed', top: position.y, left: position.x, zIndex: 1050, minWidth: 130 }}
    >
      <div className="card-header py-1 px-2" style={{ fontSize: 12 }}>
        <strong>{nick}</strong>
      </div>
      <div className="list-group list-group-flush">
        <button
          role="menuitem"
          className="list-group-item list-group-item-action py-1 px-2"
          style={{ fontSize: 13 }}
          onClick={() => action(onWhois)}
        >
          Info
        </button>
        {!isSelf && (<>
          <button
            role="menuitem"
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13 }}
            onClick={() => action(onMention)}
          >
            Mention
          </button>
          <button
            role="menuitem"
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13 }}
            onClick={() => action(onWhisper)}
          >
            Whisper
          </button>
        </>)}
        {isOper && !isSelf && <>
          <button
            role="menuitem"
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13, color: '#9A9CBE' }}
            onClick={() => action(isTargetOp ? onDeop : onOp)}
          >
            {isTargetOp ? 'Deop' : 'Op'}
          </button>
          <button
            role="menuitem"
            className="list-group-item list-group-item-action py-1 px-2"
            style={{ fontSize: 13, color: '#BEBC9A' }}
            onClick={() => action(onKick)}
          >
            Kick
          </button>
          <button
            role="menuitem"
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
