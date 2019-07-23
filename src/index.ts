import { EventEmitter } from 'events'
import fetch from 'node-fetch'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { execute, toPromise } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { HttpLink } from 'apollo-link-http'
import gql from 'graphql-tag'
import WebSocket from 'ws'
import StrictEventEmitter from 'strict-event-emitter-types'
import { Message, MessageInput, MessagePayload } from './types'

interface Events {
  message: (targetThreadId: string, message: Message) => void;
  ready: void;
}

type Emitter = StrictEventEmitter<EventEmitter, Events>

export class Client extends (EventEmitter as { new(): Emitter }) {
  private readonly httpLink: HttpLink
  private readonly wsLink: WebSocketLink
  private id: string = process.argv[2]!!
  private readonly messageQuery = `
    id
    originId
    author {
      id
      originId
      username
      avatarUrl
    }
    thread {
      id
      name
      originId
      threadGroupId
      serviceInstanceId
    }
    body
    threadGroupId
    attachments {
      id
      originId
      type
      sourceUrl
    }
  `

  constructor (host: string = 'localhost', port: number = 2137) {
    super()

    if (process.argv.length < 3) {
      console.error('ChatPlug Client is not meant to run from command line, but as a ChatPlug service by the core.')
      process.exit(1)
    }

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
      .then(() => this.emit('ready'))
  }

  send (message: MessageInput): Promise<Message> {
    return toPromise(
      execute(this.httpLink, {
        query: gql`
          mutation sendMessage ($message: MessageInput!) {
            sendMessage (instanceId: "${this.id}", input: $message) {
              ${this.messageQuery}
            }
          }
        `,
        variables: { message }
      })
    ).then(({ data }) => {
      return data!!.sendMessage
    })
  }

  private subscribe () {
    execute(this.wsLink, {
      query: gql`
        subscription onNewMessage {
          messageReceived (instanceId: "${this.id}") {
            targetThreadId
            message { ${this.messageQuery} }
          }
        }
      `
    }).subscribe(({ data }) => {
      const payload: MessagePayload = data!!.messageReceived
      this.emit('message', payload.targetThreadId, payload.message)
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
