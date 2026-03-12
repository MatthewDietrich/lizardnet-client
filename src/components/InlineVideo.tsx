export function InlineVideo({ src }: { src: string }) {
  return (
    <div style={{ marginTop: '0.5em' }}>
      <video
        src={src}
        controls
        style={{ maxWidth: 400, maxHeight: 300, display: 'block', borderRadius: 8 }}
      />
    </div>
  )
}
