import type { CSSProperties, ReactNode } from 'react'
import { get as getEmoji } from 'node-emoji'
import { TwitterEmbed, getTwitterInfo } from './components/TwitterEmbed'
import { BlueskyEmbed, getBlueskyUrl } from './components/BlueskyEmbed'
import { InlineImage } from './components/InlineImage'
import { CollapseEmbed } from './components/CollapseEmbed'
import { InlineVideo } from './components/InlineVideo'
import { BUCKET_URL } from './lib/s3Upload'

function replaceEmojis(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/g, (match, name) => getEmoji(name) ?? match)
}

function isImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return /\.(png|jpe?g|gif|webp|avif|svg)$/.test(path)
  } catch { return false }
}

function isVideoUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return /\.(mp4|webm|ogv|mov)$/.test(path)
  } catch { return false }
}

function isS3Url(url: string): boolean {
  try {
    return new URL(url).href.startsWith(BUCKET_URL)
  } catch { return false }
}

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    let id: string | null = null
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('?')[0]
    else if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') id = u.searchParams.get('v')
    return id && YT_ID_RE.test(id) ? id : null
  } catch { /* invalid url */ }
  return null
}

const COLORS: Record<number, string> = {
  0:  '#ffffff', 1:  '#000000', 2:  '#00007f', 3:  '#009300',
  4:  '#ff0000', 5:  '#7f0000', 6:  '#9c009c', 7:  '#fc7f00',
  8:  '#ffff00', 9:  '#00fc00', 10: '#009393', 11: '#00ffff',
  12: '#0000fc', 13: '#ff00ff', 14: '#7f7f7f', 15: '#d2d2d2',
}

interface Style {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  monospace: boolean
  fg: number | null
  bg: number | null
}

const RESET: Style = {
  bold: false, italic: false, underline: false,
  strikethrough: false, monospace: false, fg: null, bg: null,
}

export function parseIrc(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let style: Style = { ...RESET }
  let buffer = ''
  let i = 0
  let key = 0

  function flush() {
    if (!buffer) return
    buffer = replaceEmojis(buffer)
    const css: CSSProperties = {}
    if (style.bold)          css.fontWeight = 'bold'
    if (style.italic)        css.fontStyle = 'italic'
    if (style.monospace)     css.fontFamily = 'monospace'
    if (style.fg !== null)   css.color = COLORS[style.fg]
    if (style.bg !== null)   css.backgroundColor = COLORS[style.bg]

    const decorations: string[] = []
    if (style.underline)     decorations.push('underline')
    if (style.strikethrough) decorations.push('line-through')
    if (decorations.length)  css.textDecoration = decorations.join(' ')

    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = buffer.split(urlRegex)
    const spanStyle = Object.keys(css).length ? css : undefined
    nodes.push(
      <span key={key++} style={spanStyle}>
        {parts.map((part, j) =>
          j % 2 === 1
            ? isS3Url(part) ? null : <a key={j} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
            : part
        )}
      </span>
    )
    for (let j = 1; j < parts.length; j += 2) {
      const videoId = getYouTubeId(parts[j])
      if (videoId) {
        nodes.push(
          <CollapseEmbed key={key++} label="YouTube">
            <iframe
              width="400" height="225"
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 'none', display: 'block' }}
            />
          </CollapseEmbed>
        )
      }
      const twitterInfo = getTwitterInfo(parts[j])
      if (twitterInfo) {
        nodes.push(
          <CollapseEmbed key={key++} label="Twitter">
            <TwitterEmbed {...twitterInfo} />
          </CollapseEmbed>
        )
      }
      const bskyUrl = getBlueskyUrl(parts[j])
      if (bskyUrl) {
        nodes.push(
          <CollapseEmbed key={key++} label="Bluesky">
            <BlueskyEmbed url={bskyUrl} />
          </CollapseEmbed>
        )
      }
      if (isS3Url(parts[j]) && isVideoUrl(parts[j])) {
        nodes.push(<InlineVideo key={key++} src={parts[j]} />)
      } else if (isS3Url(parts[j]) && isImageUrl(parts[j])) {
        nodes.push(<InlineImage key={key++} src={parts[j]} />)
      } else if (isImageUrl(parts[j])) {
        nodes.push(
          <CollapseEmbed key={key++} label="Image">
            <InlineImage src={parts[j]} />
          </CollapseEmbed>
        )
      }
    }
    buffer = ''
  }

  while (i < text.length) {
    const code = text.charCodeAt(i)

    if (code === 0x02) {                        // Bold
      flush(); style = { ...style, bold: !style.bold }; i++
    } else if (code === 0x1d) {                 // Italic
      flush(); style = { ...style, italic: !style.italic }; i++
    } else if (code === 0x1f) {                 // Underline
      flush(); style = { ...style, underline: !style.underline }; i++
    } else if (code === 0x1e) {                 // Strikethrough
      flush(); style = { ...style, strikethrough: !style.strikethrough }; i++
    } else if (code === 0x11) {                 // Monospace
      flush(); style = { ...style, monospace: !style.monospace }; i++
    } else if (code === 0x16) {                 // Reverse fg/bg
      flush(); style = { ...style, fg: style.bg, bg: style.fg }; i++
    } else if (code === 0x0f) {                 // Reset
      flush(); style = { ...RESET }; i++
    } else if (code === 0x03) {                 // Color \x03[fg][,bg]
      flush(); i++
      let fg: number | null = null
      let bg: number | null = null

      if (i < text.length && /\d/.test(text[i])) {
        let s = text[i++]
        if (i < text.length && /\d/.test(text[i])) s += text[i++]
        fg = parseInt(s, 10) % 16
      }
      if (fg !== null && i < text.length && text[i] === ',') {
        const saved = i++
        if (i < text.length && /\d/.test(text[i])) {
          let s = text[i++]
          if (i < text.length && /\d/.test(text[i])) s += text[i++]
          bg = parseInt(s, 10) % 16
        } else {
          i = saved // no digit after comma — don't consume it
        }
      }
      // \x03 with no digits resets color
      style = { ...style, fg, bg }
    } else {
      buffer += text[i++]
    }
  }

  flush()
  return nodes
}
