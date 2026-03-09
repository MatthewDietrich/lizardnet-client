import type { CSSProperties, ReactNode } from 'react'

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

    nodes.push(<span key={key++} style={Object.keys(css).length ? css : undefined}>{buffer}</span>)
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
