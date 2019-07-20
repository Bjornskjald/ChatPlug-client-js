import { EventEmitter } from 'events'
import fetch from 'node-fetch'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { execute, toPromise } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { HttpLink } from 'apollo-link-http'
import gql from 'graphql-tag'
import WebSocket from 'ws'

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
}

export interface MessageInput {
  body: string
  originId: string
  author: MessageAuthorInput
  originThreadId: string
}

export class Client extends EventEmitter {
  private readonly httpLink: HttpLink
  private readonly wsLink: WebSocketLink
  private id: string = process.argv[2]!!

  constructor (host: string = 'localhost', port: number = 2137) {
    super()

    const url = `//${host}:${port.toString()}/query`
    // @ts-ignore That Fetch is NOT incorrect. TypeScript stop whining.
    this.httpLink = new HttpLink({
      uri: `http:${url}`,
      fetch
    })
    this.wsLink = new WebSocketLink(
      new SubscriptionClient(
        `ws:${url}`, 
        undefined,
        WebSocket
      )
    )

    this.initialize()
      .then(() => this.subscribe())
  }

  send (message: MessageInput)/*: Promise<Message> */ {
    return toPromise(
      execute(this.httpLink, {
        query: gql`
          mutation addMessage ($message: MessageInput!) {
            sendMessage (instanceId: "${this.id}", input: $message) {
              body
              originId
              author {
                username
                originId
              }
              originThreadId
            }
          }
        `,
        variables: { message }
      })
    ).then(({ data }) => {
      return data!!.addMessage
    })
  }

  private subscribe () {
    execute(this.wsLink, {
      query: gql`
        subscription onNewMessage {
          messageReceived (instanceId: "${this.id}") {
            targetThreadId
            message {
              body
              author {
                username
                originId
              }
            }
          }
        }
      `
    }).subscribe(({ data }) => {
      this.emit('message', data!!.messageReceived)
    })
  }

  private initialize (): Promise<any> {
    return toPromise(
      execute(this.httpLink, {
        query: gql`
          mutation setStatus {
            setInstanceStatus (instanceId: "${this.id}", status: INITIALIZED) {
              id
            }
          }
        `
      })
    )
  }
}
