import { describe, it, expect } from 'vitest'
import { parseRawLine } from './parseRawLine'

describe('parseRawLine', () => {
  describe('command extraction', () => {
    it('parses a bare command with no prefix', () => {
      expect(parseRawLine('PONG').cmd).toBe('PONG')
    })

    it('strips a server prefix before the command', () => {
      expect(parseRawLine(':server.example.com PONG').cmd).toBe('PONG')
    })

    it('strips IRCv3 tags and a server prefix', () => {
      expect(parseRawLine('@id=abc :server.example.com PONG').cmd).toBe('PONG')
    })

    it('parses a numeric command', () => {
      expect(parseRawLine(':server 332 nick #chat :The topic').cmd).toBe('332')
    })
  })

  describe('parameter parsing', () => {
    it('returns empty params when there are none', () => {
      expect(parseRawLine('PONG').params).toEqual([])
    })

    it('parses a single trailing parameter', () => {
      expect(parseRawLine('PING :server.example.com').params).toEqual(['server.example.com'])
    })

    it('parses multiple positional parameters', () => {
      const { params } = parseRawLine(':server JOIN #chat *')
      expect(params).toEqual(['#chat', '*'])
    })

    it('combines trailing parameter words into a single element', () => {
      const { params } = parseRawLine(':nick!user@host PRIVMSG #chat :hello world from IRC')
      expect(params).toEqual(['#chat', 'hello world from IRC'])
    })

    it('includes everything after the colon as the trailing param', () => {
      const { params } = parseRawLine(':server 332 nick #chat :The topic is: here')
      expect(params).toEqual(['nick', '#chat', 'The topic is: here'])
    })

    it('handles an empty trailing parameter', () => {
      const { params } = parseRawLine(':server TOPIC #chat :')
      expect(params).toEqual(['#chat', ''])
    })

    it('skips empty parts between parameters', () => {
      // Unlikely in real IRC but the parser should not emit empty strings
      const { params } = parseRawLine(':server 001 nick :Welcome')
      expect(params).not.toContain('')
    })
  })

  describe('tags prefix', () => {
    it('strips tags-only prefix before parsing', () => {
      const { cmd, params } = parseRawLine('@server-time=2024-01-01T00:00:00Z :nick!u@h PRIVMSG #chat :hi')
      expect(cmd).toBe('PRIVMSG')
      expect(params).toEqual(['#chat', 'hi'])
    })

    it('handles multiple tags separated by semicolons', () => {
      const { cmd } = parseRawLine('@msgid=abc;+draft/edit=xyz :nick!u@h PRIVMSG #chat :edit')
      expect(cmd).toBe('PRIVMSG')
    })
  })
})
