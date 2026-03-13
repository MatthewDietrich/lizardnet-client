import { useState, useEffect } from 'react'

interface Props {
  users: string[]
  ops: string[]
  awayUsers: Set<string>
  nick: string
  onUserClick: (nick: string, pos: { x: number; y: number }) => void
}

function isSmallViewport() {
  return window.innerWidth < 768
}

export default function UserList({ users, ops, awayUsers, nick, onUserClick }: Props) {
  const [collapsed, setCollapsed] = useState(isSmallViewport)

  useEffect(() => {
    function onResize() {
      if (isSmallViewport()) setCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (collapsed) {
    return (
      <div
        className="border rounded bg-light font-monospace flex-shrink-0 d-flex align-items-start"
        style={{ width: 36 }}
      >
        <button
          className="btn btn-sm w-100 py-2 px-0 d-flex flex-column align-items-center gap-1"
          style={{ color: 'var(--c-secondary)' }}
          title={`${users.length} users — click to expand`}
          onClick={() => setCollapsed(false)}
        >
          <span className="material-icons" style={{ fontSize: 18 }}>groups</span>
          <span style={{ fontSize: 11, lineHeight: 1 }}>{users.length}</span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="border rounded p-2 bg-light font-monospace flex-shrink-0"
      style={{ width: 160, overflowY: 'auto', fontSize: 12 }}
    >
      <div
        className="mb-1 d-flex align-items-center justify-content-between"
        style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-secondary)' }}
      >
        <span className="d-flex align-items-center gap-1">
          <span className="material-icons" style={{ fontSize: 14 }}>groups</span>
          USERS ({users.length})
        </span>
        <button
          className="btn btn-sm py-0 px-1"
          style={{ fontSize: 11, color: 'var(--c-secondary)', lineHeight: 1 }}
          title="Collapse user list"
          aria-label="Collapse user list"
          onClick={() => setCollapsed(true)}
        >
          ›
        </button>
      </div>
      {users.map(u => {
        const isAway = awayUsers.has(u)
        return (
          <button
            key={u}
            className={`${u === nick ? 'fw-bold' : ''} user-select-none`}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', padding: '1px 2px', borderRadius: 3,
              font: 'inherit', cursor: 'pointer',
              color: u === nick ? 'var(--c-primary)' : 'var(--c-secondary)',
              opacity: isAway ? 0.45 : 1,
              fontStyle: isAway ? 'italic' : 'normal',
            }}
            title={isAway ? `${u} is away` : undefined}
            aria-label={`${u}${ops.includes(u) ? ', moderator' : ''}${isAway ? ', away' : ''}`}
            onClick={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onUserClick(u, { x: e.clientX || rect.right, y: e.clientY || rect.top })
            }}
          >
            {u}{ops.includes(u) && <span style={{ color: 'var(--c-quaternary)', fontSize: 10 }}> (Mod)</span>}
          </button>
        )
      })}
      {users.length === 0 && <span style={{ color: 'var(--c-secondary)' }}>—</span>}
    </div>
  )
}
