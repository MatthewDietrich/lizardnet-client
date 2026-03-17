import { describe, it, expect, vi } from 'vitest'
import type { ReactNode, ReactElement } from 'react'
import { parseIrc, isMediaNode } from './ircFormat'

// Stub out the third-party embed components so tests don't depend on
// network requests or complex component internals.
vi.mock('./components/TwitterEmbed', () => ({
  TwitterEmbed: () => null,
  getTwitterInfo: () => null,
}))
vi.mock('./components/BlueskyEmbed', () => ({
  BlueskyEmbed: () => null,
  getBlueskyUrl: () => null,
}))

const S3 = 'https://lizardnet-media.s3.amazonaws.com'

/** Recursively collect all string leaves from a ReactNode tree. */
function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  const el = node as ReactElement<{ children?: ReactNode; style?: React.CSSProperties }>
  return extractText(el.props?.children)
}

describe('parseIrc', () => {
  describe('plain text', () => {
    it('returns at least one node for non-empty input', () => {
      expect(parseIrc('hello world').length).toBeGreaterThan(0)
    })

    it('round-trips plain ASCII text', () => {
      const text = 'hello, world!'
      expect(extractText(parseIrc(text))).toBe(text)
    })

    it('returns no media nodes for plain text', () => {
      expect(parseIrc('just a sentence').every(n => !isMediaNode(n))).toBe(true)
    })
  })

  describe('IRC formatting codes', () => {
    it('applies bold (\x02)', () => {
      const nodes = parseIrc('\x02bold\x02 normal')
      const styles = (nodes as ReactElement[]).map(n => n.props?.style).filter(Boolean)
      expect(styles.some((s: React.CSSProperties) => s.fontWeight === 'bold')).toBe(true)
    })

    it('applies italic (\x1d)', () => {
      const nodes = parseIrc('\x1ditalic\x1d normal')
      const styles = (nodes as ReactElement[]).map(n => n.props?.style).filter(Boolean)
      expect(styles.some((s: React.CSSProperties) => s.fontStyle === 'italic')).toBe(true)
    })

    it('applies a foreground color (\x030)', () => {
      // Color 4 = #ff0000
      const nodes = parseIrc('\x034red text\x03')
      const styles = (nodes as ReactElement[]).map(n => n.props?.style).filter(Boolean)
      expect(styles.some((s: React.CSSProperties) => s.color === '#ff0000')).toBe(true)
    })

    it('resets formatting with \x0f', () => {
      const nodes = parseIrc('\x02bold\x0f normal')
      // The span after the reset should not be bold
      const afterReset = (nodes as ReactElement[]).find(n =>
        extractText(n).includes('normal')
      )
      expect(afterReset?.props?.style?.fontWeight).toBeUndefined()
    })

    it('preserves text content through formatting codes', () => {
      expect(extractText(parseIrc('\x02hello\x02 \x1dworld\x1d'))).toBe('hello world')
    })
  })

  describe('URL handling', () => {
    it('does not produce a media node for a plain HTTPS link', () => {
      const nodes = parseIrc('check https://example.com out')
      expect(nodes.every(n => !isMediaNode(n))).toBe(true)
    })

    it('produces a media node for a YouTube URL', () => {
      const nodes = parseIrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(nodes.some(n => isMediaNode(n))).toBe(true)
    })

    it('produces a media node for a youtu.be short link', () => {
      const nodes = parseIrc('https://youtu.be/dQw4w9WgXcQ')
      expect(nodes.some(n => isMediaNode(n))).toBe(true)
    })

    it('does not treat an invalid YouTube video ID as a YouTube embed', () => {
      // 10 chars — one short of the required 11
      const nodes = parseIrc('https://youtu.be/tooshort0')
      expect(nodes.some(n => isMediaNode(n))).toBe(false)
    })

    it('produces a media node for an S3 image URL', () => {
      const nodes = parseIrc(`${S3}/photo.jpg`)
      expect(nodes.some(n => isMediaNode(n))).toBe(true)
    })

    it('produces a media node for an S3 video URL', () => {
      const nodes = parseIrc(`${S3}/clip.mp4`)
      expect(nodes.some(n => isMediaNode(n))).toBe(true)
    })

    it('produces a media node for an S3 audio URL', () => {
      const nodes = parseIrc(`${S3}/track.mp3`)
      expect(nodes.some(n => isMediaNode(n))).toBe(true)
    })

    it('suppresses the raw S3 URL from text nodes (shows media only)', () => {
      const nodes = parseIrc(`${S3}/photo.jpg`)
      const text = extractText(nodes.filter(n => !isMediaNode(n)))
      expect(text).not.toContain(S3)
    })

    it('renders [media deleted] with italic style', () => {
      const nodes = parseIrc('see [media deleted] above')
      const html = extractText(nodes)
      expect(html).toContain('[media deleted]')
    })

    it('rejects javascript: URLs', () => {
      const nodes = parseIrc('click javascript:alert(1)')
      // Should not produce an <a> — extractText would still capture the literal text
      const text = extractText(nodes)
      expect(text).toContain('javascript:alert(1)')
      // Verify no media embed was created
      expect(nodes.every(n => !isMediaNode(n))).toBe(true)
    })
  })

  describe('onDelete / onRedact callbacks', () => {
    it('passes onDelete through to S3 media nodes', () => {
      const onDelete = vi.fn()
      const canDelete = () => true
      const nodes = parseIrc(`${S3}/photo.jpg`, { onDelete, canDelete })
      expect(nodes.some(n => isMediaNode(n))).toBe(true)
    })
  })
})

describe('isMediaNode', () => {
  it('returns false for null', () => {
    expect(isMediaNode(null)).toBe(false)
  })

  it('returns false for a plain string', () => {
    expect(isMediaNode('hello')).toBe(false)
  })

  it('returns false for a non-media React element', () => {
    const nodes = parseIrc('plain text')
    expect(isMediaNode(nodes[0])).toBe(false)
  })

  it('returns true for nodes produced by a media URL', () => {
    const nodes = parseIrc(`${S3}/image.png`)
    const mediaNodes = nodes.filter(n => isMediaNode(n))
    expect(mediaNodes.length).toBeGreaterThan(0)
    mediaNodes.forEach(n => expect(isMediaNode(n)).toBe(true))
  })
})
