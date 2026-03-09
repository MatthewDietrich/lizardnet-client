declare module 'irc-framework' {
  interface ConnectOptions {
    host: string
    port?: number
    nick: string
    tls?: boolean
    encoding?: string
    [key: string]: unknown
  }

  interface MessageEvent {
    nick: string
    message: string
    target: string
  }

  interface JoinEvent {
    nick: string
    channel: string
  }

  interface WhoisEvent {
    nick: string
    ident?: string
    hostname?: string
    real_name?: string
    server?: string
    server_info?: string
    idle?: number
    channels?: string[]
    operator?: boolean
  }

  class Client {
    connect(options: ConnectOptions): void
    join(channel: string): void
    say(target: string, message: string): void
    quit(message?: string): void
    raw(command: string): void
    on(event: 'raw', listener: (event: { command: string; params: string[] }) => void): this
    on(event: 'registered', listener: () => void): this
    on(event: 'message', listener: (event: MessageEvent) => void): this
    on(event: 'join', listener: (event: JoinEvent) => void): this
    on(event: 'kick', listener: (event: { kicked: string; nick: string; channel: string; message?: string }) => void): this
    on(event: 'whois', listener: (event: WhoisEvent) => void): this
    on(event: 'notice', listener: (...args: unknown[]) => void): this
    on(event: 'close', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  const irc: { Client: typeof Client }
  export default irc
}
