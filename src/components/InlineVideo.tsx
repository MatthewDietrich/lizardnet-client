export function InlineVideo({ src }: { src: string }) {
  return (
    <div style={{ marginTop: '0.5em', marginBottom: '0.5em' }}>
      <video
        src={src}
        controls
        style={{ maxWidth: 'min(400px, 100%)', maxHeight: 300, display: 'block', borderRadius: 8 }}
      />
    </div>
  )
}
