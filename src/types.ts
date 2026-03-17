export interface Message {
  id: string
  from: string
  text: string
  ts: Date
  kind?: 'chat' | 'event' | 'pm' | 'action'
  msgid?: string
  edited?: boolean
  originalText?: string
  deleted?: boolean
}
