/** irc-framework does not export typed event payloads, so we define them here. */

export interface IrcMessageEvent {
  nick: string
  target: string
  message: string
  type: string
  tags?: Record<string, string>
  batch?: { type: string }
}

export interface IrcRawEvent {
  line?: string
  from_server?: boolean
}

export interface IrcTopicEvent {
  channel: string
  topic: string
  nick?: string
}

export interface IrcErrorEvent {
  command?: string
}

export interface IrcBanEntry {
  ban: string
}

export interface IrcBanlistEvent {
  channel: string
  bans: IrcBanEntry[]
}

export interface IrcModeChange {
  mode: string
  param?: string
}

export interface IrcModeEvent {
  target?: string
  modes?: IrcModeChange[]
}

export interface IrcNickPresenceEvent {
  nick: string
}

export interface IrcPartEvent {
  nick: string
  channel: string
  message?: string
}

export interface IrcQuitEvent {
  nick: string
  message?: string
}

export interface IrcUserlistUser {
  nick: string
  modes: string[]
}

export interface IrcUserlistEvent {
  channel: string
  users: IrcUserlistUser[]
}

export interface IrcNickEvent {
  nick: string
  new_nick: string
}

export interface IrcNoticeEvent {
  nick?: string
  hostname?: string
  message?: string
  notice?: string
}

export interface IrcTagmsgEvent {
  nick?: string
  target?: string
  tags?: Record<string, string>
}
