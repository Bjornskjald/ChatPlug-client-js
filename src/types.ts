export interface MessageAuthorInput {
  originId: string
  username: string
  avatarUrl: string
}

export type AttachmentType =
  'FILE' |
  'IMAGE' |
  'AUDIO' |
  'VIDEO'

export interface AttachmentInput {
  originId: string
  type: AttachmentType
  sourceUrl: string
}

export interface ConfigurationRequest {
  fields: ConfigurationField[]
}

export interface ConfigurationField {
  name: string
  type: 'BOOLEAN' | 'STRING' | 'NUMBER'
  defaultValue: string
  optional: boolean
  hint: string
  mask: boolean
}

export interface ConfigurationResponse {
  fieldValues: { name: string, value: string }[]
}

export interface MessageInput {
  body: string
  originId: string
  author: MessageAuthorInput
  attachments: AttachmentInput[]
  originThreadId: string
}

export interface MessageAuthor {
  id: string
  originId: string
  username: string
  avatarUrl: string
}

export interface Thread {
  id: string
  name: string
  originId: string
  messages?: Message[]
  threadGroupId: string
  serviceInstanceId: string
}

export interface Attachment {
  id: string
  originId: string
  type: AttachmentType
  sourceUrl: string
}

export interface Message {
  id: string
  originId: string
  author: MessageAuthor
  thread: Thread
  body: string
  threadGroupId: string
  attachments: Attachment[]
}

export interface MessagePayload {
  targetThreadId: string
  message: Message
}

export interface SearchRequest {
  query: string
}

export interface ThreadSearchResult {
  name: string
  iconUrl: string
  originId: string
}
