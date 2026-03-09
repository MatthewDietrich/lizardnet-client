export interface Message {
  from: string
  text: string
  ts: Date
  kind?: 'chat' | 'event' | 'pm'
}
