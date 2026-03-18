import { useEffect, useRef, useState } from 'react'

export function getBlueskyUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'bsky.app' && /\/profile\/.+\/post\/.+/.test(u.pathname)) return url
  } catch { /* invalid url */ }
  return null
}

export function BlueskyEmbed({ url }: { url: string }) {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [height, setHeight] = useState(300)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const m = new URL(url).pathname.match(/\/profile\/([^/]+)\/post\/([^/]+)/)
    if (!m) return
    const [, handle, rkey] = m

    if (handle.startsWith('did:')) {
      setIframeSrc(`https://embed.bsky.app/embed/${handle}/app.bsky.feed.post/${rkey}`)
      return
    }

    const controller = new AbortController()
    fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.did) setIframeSrc(`https://embed.bsky.app/embed/${data.did}/app.bsky.feed.post/${rkey}`)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [url])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== 'https://embed.bsky.app') return
      if (e.source !== iframeRef.current?.contentWindow) return
      if (typeof e.data?.height === 'number') setHeight(Math.min(Math.max(0, e.data.height), 2000))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!iframeSrc) return null
  return (
    <div style={{ marginTop: '0.5em' }}>
      <iframe ref={iframeRef} src={iframeSrc} width="400" height={height} style={{ border: 'none', display: 'block', borderRadius: 8 }} sandbox="allow-scripts allow-same-origin" />
    </div>
  )
}
