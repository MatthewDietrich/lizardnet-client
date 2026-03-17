interface Props {
  activeTab: string
  pmPeers: string[]
  pmUnread: Map<string, number>
  onSwitch: (tab: string) => void
  onClose: (peer: string) => void
}

export default function PmTabs({ activeTab, pmPeers, pmUnread, onSwitch, onClose }: Props) {
  if (pmPeers.length === 0) return null
  return (
    <div className="d-flex gap-1 mt-2" style={{ flexShrink: 0 }}>
      <button
        className={`btn btn-sm ${activeTab === '#chat' ? 'btn-secondary' : 'btn-outline-secondary'}`}
        style={{ fontSize: 12, padding: '2px 10px' }}
        onClick={() => onSwitch('#chat')}
      >
        #chat
      </button>
      {pmPeers.map(peer => {
        const unread = pmUnread.get(peer) ?? 0
        return (
          <div key={peer} className="d-flex align-items-center" style={{ gap: 0 }}>
            <button
              className={`btn btn-sm ${activeTab === peer ? 'btn-secondary' : 'btn-outline-secondary'}`}
              style={{ fontSize: 12, padding: '2px 10px', borderRadius: '4px 0 0 4px' }}
              aria-label={`${peer}${unread > 0 ? `, ${unread} unread message${unread > 1 ? 's' : ''}` : ''}`}
              onClick={() => onSwitch(peer)}
            >
              {peer}
              {unread > 0 && (
                <span aria-hidden="true" className="badge ms-1" style={{ fontSize: 9, background: 'var(--c-tertiary)', color: 'var(--c-surface)'}}>{unread}</span>
              )}
            </button>
            <button
              className={`btn btn-sm ${activeTab === peer ? 'btn-secondary' : 'btn-outline-secondary'}`}
              style={{ fontSize: 12, padding: '2px 5px', borderRadius: '0 4px 4px 0', borderLeft: 'none' }}
              onClick={() => onClose(peer)}
              title={`Close conversation with ${peer}`}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
