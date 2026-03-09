interface Props {
  users: string[]
  ops: string[]
  nick: string
  onUserClick: (nick: string, pos: { x: number; y: number }) => void
}

export default function UserList({ users, ops, nick, onUserClick }: Props) {
  return (
    <div
      className="border rounded p-2 bg-light font-monospace flex-shrink-0"
      style={{ width: 160, overflowY: 'auto', fontSize: 12 }}
    >
      <div className="mb-1" style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-secondary)' }}>
        USERS ({users.length})
      </div>
      {users.map(u => (
        <div
          key={u}
          className={`${u === nick ? 'fw-bold' : ''} user-select-none`}
          style={{ cursor: 'pointer', borderRadius: 3, padding: '1px 2px', color: u === nick ? 'var(--c-primary)' : 'var(--c-secondary)' }}
          onClick={e => onUserClick(u, { x: e.clientX, y: e.clientY })}
        >
          {u}{ops.includes(u) && <span style={{ color: 'var(--c-quaternary)', fontSize: 10 }}> (Mod)</span>}
        </div>
      ))}
      {users.length === 0 && <span style={{ color: 'var(--c-secondary)' }}>—</span>}
    </div>
  )
}
