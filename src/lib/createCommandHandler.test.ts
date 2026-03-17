import { describe, it, expect, vi } from 'vitest'
import { createCommandHandler, HELP_LINES, RULES_LINES } from './createCommandHandler'
import { CHANNEL } from './constants'

function makeOptions(activeTab = CHANNEL) {
  return {
    activeTab,
    sendMessage: vi.fn(),
    sendPrivMsg: vi.fn(),
    sendAction: vi.fn(),
    changeNick: vi.fn(),
    openPmConversation: vi.fn(),
    switchTab: vi.fn(),
    sayNickServ: vi.fn(),
    sendOper: vi.fn(),
    setAway: vi.fn(),
    setBack: vi.fn(),
    addActive: vi.fn(),
  }
}

describe('createCommandHandler', () => {
  describe('plain text', () => {
    it('calls sendMessage in #chat', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('hello there')
      expect(opts.sendMessage).toHaveBeenCalledWith('hello there')
    })

    it('calls sendPrivMsg in a PM tab', () => {
      const opts = makeOptions('Alice')
      createCommandHandler(opts)('hey')
      expect(opts.sendPrivMsg).toHaveBeenCalledWith('Alice', 'hey')
    })
  })

  describe('/say', () => {
    it('sends the literal text after /say in #chat', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/say /nick notacommand')
      expect(opts.sendMessage).toHaveBeenCalledWith('/nick notacommand')
    })

    it('sends via sendPrivMsg in a PM tab', () => {
      const opts = makeOptions('Bob')
      createCommandHandler(opts)('/say hello')
      expect(opts.sendPrivMsg).toHaveBeenCalledWith('Bob', 'hello')
    })
  })

  describe('/me', () => {
    it('sends an action in #chat', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/me waves')
      expect(opts.sendAction).toHaveBeenCalledWith('waves', CHANNEL)
    })

    it('sends an action targeted at the PM peer', () => {
      const opts = makeOptions('Carol')
      createCommandHandler(opts)('/me nods')
      expect(opts.sendAction).toHaveBeenCalledWith('nods', 'Carol')
    })
  })

  describe('/nick', () => {
    it('calls changeNick with the new nick', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/nick CoolName')
      expect(opts.changeNick).toHaveBeenCalledWith('CoolName')
    })

    it('does nothing when no nick is provided', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/nick ')
      expect(opts.changeNick).not.toHaveBeenCalled()
    })
  })

  describe('/msg', () => {
    it('opens a PM conversation, sends the message, and switches tab', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/msg Alice hello there')
      expect(opts.openPmConversation).toHaveBeenCalledWith('Alice')
      expect(opts.sendPrivMsg).toHaveBeenCalledWith('Alice', 'hello there')
      expect(opts.switchTab).toHaveBeenCalledWith('Alice')
    })

    it('opens without sending when no message body is given', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/msg Alice')
      expect(opts.openPmConversation).toHaveBeenCalledWith('Alice')
      expect(opts.sendPrivMsg).not.toHaveBeenCalled()
      expect(opts.switchTab).toHaveBeenCalledWith('Alice')
    })
  })

  describe('/identify', () => {
    it('sends IDENTIFY to NickServ', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/identify mypassword')
      expect(opts.sayNickServ).toHaveBeenCalledWith('IDENTIFY mypassword')
    })
  })

  describe('/register', () => {
    it('sends REGISTER to NickServ', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/register pass123 me@example.com')
      expect(opts.sayNickServ).toHaveBeenCalledWith('REGISTER pass123 me@example.com')
    })

    it('does nothing with fewer than two arguments', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/register onlyonearg')
      expect(opts.sayNickServ).not.toHaveBeenCalled()
    })
  })

  describe('/ghost', () => {
    it('sends GHOST to NickServ', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/ghost OldNick pass')
      expect(opts.sayNickServ).toHaveBeenCalledWith('GHOST OldNick pass')
    })
  })

  describe('/oper', () => {
    it('calls sendOper with name and password', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/oper admin secret')
      expect(opts.sendOper).toHaveBeenCalledWith('admin', 'secret')
    })

    it('does nothing with fewer than two arguments', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/oper justname')
      expect(opts.sendOper).not.toHaveBeenCalled()
    })
  })

  describe('/away', () => {
    it('calls setAway with the message', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/away Gone fishing')
      expect(opts.setAway).toHaveBeenCalledWith('Gone fishing')
    })

    it('calls setAway with empty string when no message is given', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/away')
      expect(opts.setAway).toHaveBeenCalledWith('')
    })
  })

  describe('/back', () => {
    it('calls setBack', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/back')
      expect(opts.setBack).toHaveBeenCalled()
    })
  })

  describe('/rules', () => {
    it('calls addActive for each rules line', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/rules')
      expect(opts.addActive).toHaveBeenCalledTimes(RULES_LINES.length)
      expect(opts.addActive).toHaveBeenNthCalledWith(1, RULES_LINES[0])
    })
  })

  describe('/help', () => {
    it('calls addActive for each help line', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/help')
      expect(opts.addActive).toHaveBeenCalledTimes(HELP_LINES.length)
      expect(opts.addActive).toHaveBeenNthCalledWith(1, HELP_LINES[0])
    })
  })

  describe('unknown command', () => {
    it('calls addActive with an error hint', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/nonsense')
      expect(opts.addActive).toHaveBeenCalledWith(
        expect.stringContaining('/help')
      )
    })

    it('does not send a message for unknown commands', () => {
      const opts = makeOptions()
      createCommandHandler(opts)('/nonsense')
      expect(opts.sendMessage).not.toHaveBeenCalled()
    })
  })
})
