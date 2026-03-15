export interface Message {
  from: string
  text: string
  ts: Date
  kind?: 'chat' | 'event' | 'pm' | 'action'
  msgid?: string
  edited?: boolean
  originalText?: string
}
