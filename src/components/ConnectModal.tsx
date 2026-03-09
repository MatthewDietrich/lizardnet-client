import { useState } from 'react'

interface Props {
  onConnect: (nick: string, password: string) => void
  onRegister: (nick: string, password: string, email: string) => void
}

export default function ConnectModal({ onConnect, onRegister }: Props) {
  const [tab, setTab] = useState<'connect' | 'register'>('connect')
  const [nickInput, setNickInput] = useState(() => localStorage.getItem('lastNick') ?? '')
  const [passwordInput, setPasswordInput] = useState('')
  const [regNick, setRegNick] = useState(() => localStorage.getItem('lastNick') ?? '')
  const [regPassword, setRegPassword] = useState('')
  const [regEmail, setRegEmail] = useState('')

  function handleConnect(e: { preventDefault(): void }) {
    e.preventDefault()
    const nick = nickInput.trim()
    if (!nick) return
    localStorage.setItem('lastNick', nick)
    onConnect(nick, passwordInput)
  }

  function handleRegister(e: { preventDefault(): void }) {
    e.preventDefault()
    const nick = regNick.trim()
    const password = regPassword.trim()
    const email = regEmail.trim()
    if (!nick || !password || !email) return
    localStorage.setItem('lastNick', nick)
    onRegister(nick, password, email)
  }

  return (
    <>
      <div className="modal show d-block" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h6 className="modal-title">Before you connect...</h6>
            </div>

            <div className="modal-body">
              <h4>RULES</h4>
              <ol className="mb-4">
                <li>You must be 18 or over to use this server</li>
                <li>Treat others the way you would want to be treated</li>
                <li>Don't be racist, sexist, homophobic, transphobic, etc.</li>
                <li>Don't spam</li>
                <li>Use your common sense</li>
              </ol>

              <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'connect' ? 'active' : ''}`}
                    onClick={() => setTab('connect')}
                  >
                    Connect
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'register' ? 'active' : ''}`}
                    onClick={() => setTab('register')}
                  >
                    Register
                  </button>
                </li>
              </ul>

              {tab === 'connect' && (
                <form id="connect-form" onSubmit={handleConnect}>
                  <input
                    className="form-control mb-2"
                    placeholder="Nickname (e.g. reptile42)"
                    value={nickInput}
                    onChange={e => setNickInput(e.target.value)}
                    autoFocus
                    maxLength={30}
                  />
                  <input
                    className="form-control"
                    type="password"
                    placeholder="Password (optional)"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                  />
                </form>
              )}

              {tab === 'register' && (
                <form id="register-form" onSubmit={handleRegister}>
                  <input
                    className="form-control mb-2"
                    placeholder="Nickname"
                    value={regNick}
                    onChange={e => setRegNick(e.target.value)}
                    autoFocus
                    maxLength={30}
                  />
                  <input
                    className="form-control mb-2"
                    type="password"
                    placeholder="Password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                  />
                  <input
                    className="form-control"
                    type="email"
                    placeholder="Email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                  />
                </form>
              )}
            </div>

            <div className="modal-footer">
              {tab === 'connect' && (
                <button form="connect-form" type="submit" className="btn btn-primary" disabled={!nickInput.trim()}>
                  Let's go
                </button>
              )}
              {tab === 'register' && (
                <button
                  form="register-form"
                  type="submit"
                  className="btn btn-primary"
                  disabled={!regNick.trim() || !regPassword.trim() || !regEmail.trim()}
                >
                  Register & connect
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  )
}
