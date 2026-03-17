import { overlayButtonStyle } from '../lib/styles'

interface Props {
  src: string
  onDelete?: (url: string) => void
  onRedact?: (url: string) => void
}

export function MediaOverlayActions({ src, onDelete, onRedact }: Props) {
  if (onDelete) return (
    <button aria-label="Delete media" onClick={() => { if (confirm('Delete this media permanently?')) onDelete(src) }} title="Delete media" style={overlayButtonStyle}>
      <span aria-hidden="true" className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>delete</span>
    </button>
  )
  if (onRedact) return (
    <button aria-label="Hide media" onClick={() => { if (confirm('Hide this media from chat?')) onRedact(src) }} title="Hide media" style={overlayButtonStyle}>
      <span aria-hidden="true" className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>visibility_off</span>
    </button>
  )
  return null
}
