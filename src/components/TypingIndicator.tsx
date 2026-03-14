export function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return <div style={{ height: 18 }} />
  let text: string
  if (users.length === 1) text = `${users[0]} is typing...`
  else if (users.length === 2) text = `${users[0]} and ${users[1]} are typing...`
  else text = `${users[0]}, ${users[1]}, and ${users.length - 2} other${users.length - 2 > 1 ? 's' : ''} are typing...`
  return (
    <div style={{ height: 18, fontSize: 11, color: 'var(--c-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {text}
    </div>
  )
}
