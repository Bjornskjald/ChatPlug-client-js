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

export interface Message {
  body: string
  originId: string
  author: MessageAuthor
}

export default class ChatPlugClient extends EventEmitter {
  private readonly httpLink: HttpLink
  private readonly wsLink: WebSocketLink
  private name: string = process.argv[2]!!

  constructor (uri: string) {
    super()
    // @ts-ignore this fetch is working, TypeScript stop complaining about it
    this.httpLink = new HttpLink({ uri, fetch })
    this.wsLink = new WebSocketLink(
      new SubscriptionClient(uri, undefined, WebSocket)
    )

    this.subscribe()
  }

  send (message: Message)/*: Promise<Message> */ {
    return toPromise(
      execute(this.httpLink, {
        query: gql`
          mutation addMessage ($message: NewMessage!) {
            sendMessage (input: $message) {
              body
              originId
              author {
                username
                originId
              }
            }
          }
        `,
        variables: {
          message: {
            body: message.body,
            originId: message.originId,
            authorName: message.author.username,
            authorOriginId: message.author.originId
          }
        }
      })
    ).then(data => {
      return data
    })
  }

  private subscribe () {
    execute(this.wsLink, {
      query: gql`
        subscription onNewMessage {
          messageReceived (instanceId: "${this.name}") {
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
}
