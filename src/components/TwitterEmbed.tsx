import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    twttr?: { widgets: { createTweet(id: string, el: HTMLElement, opts?: object): Promise<HTMLElement> } }
  }
}

export function getTwitterInfo(url: string): { username: string; statusId: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'twitter.com' || host === 'x.com') {
      const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/)
      if (m) return { username: m[1], statusId: m[2] }
    }
  } catch { /* invalid url */ }
  return null
}

export function TwitterEmbed({ username, statusId }: { username: string; statusId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const embeddedIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Skip if we already embedded this tweet — guards against StrictMode double-invoke
    if (embeddedIdRef.current === statusId) return
    embeddedIdRef.current = statusId

    function embed() {
      if (!containerRef.current || !window.twttr) return
      containerRef.current.replaceChildren()
      window.twttr.widgets.createTweet(statusId, containerRef.current, { theme: 'dark', dnt: true })
    }

    if (window.twttr) {
      embed()
    } else if (!document.getElementById('twitter-widgets-js')) {
      const script = document.createElement('script')
      script.id = 'twitter-widgets-js'
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.addEventListener('load', embed)
      document.head.appendChild(script)
    } else {
      // Script tag exists but not loaded yet — wait for it
      document.getElementById('twitter-widgets-js')!.addEventListener('load', embed)
    }
  }, [username, statusId])

  return <div ref={containerRef} style={{ marginTop: '0.5em', maxWidth: 400 }} />
}
