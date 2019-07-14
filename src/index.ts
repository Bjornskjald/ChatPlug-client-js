import { SubscriptionClient } from 'subscriptions-transport-ws'
import { execute, toPromise } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { HttpLink } from 'apollo-link-http'
import gql from 'graphql-tag'
import fetch from 'node-fetch'
import WebSocket from 'ws'
import { EventEmitter } from 'events'

export interface MessageAuthor {
  username: string
  originId: string
}

export interface NewMessage {
  body: string
  originId: string
  author: MessageAuthor
  originThreadId: string
}

export default class ChatPlugClient extends EventEmitter {
  private readonly httpLink: HttpLink
  private readonly wsLink: WebSocketLink
  private id: string = process.argv[2]!!

  constructor (host: string = 'localhost', port: number = 2137) {
    super()

    const url = `//${host}:${port.toString()}/query`

    // @ts-ignore this fetch is working, TypeScript stop complaining about it
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

  send (message: NewMessage)/*: Promise<Message> */ {
    return toPromise(
      execute(this.httpLink, {
        query: gql`
          mutation addMessage ($message: NewMessage!) {
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
    ).then(data => {
      // TODO: add parsing and returning as Message
      return data
    })
  }

  private subscribe () {
    execute(this.wsLink, {
      query: gql`
        subscription onNewMessage {
          messageReceived (instanceId: "${this.id}") {
            body
            author {
              username
              originId
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
