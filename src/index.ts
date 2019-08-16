import { EventEmitter } from 'events'
import fetch from 'node-fetch'
import fs from 'fs-extra'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { execute, toPromise } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { HttpLink } from 'apollo-link-http'
import gql from 'graphql-tag'
import WebSocket from 'ws'
import StrictEventEmitter from 'strict-event-emitter-types'
import {
  Message,
  MessageInput,
  MessagePayload,
  ConfigurationRequest,
  ConfigurationResponse,
  SearchRequest, ThreadSearchResult
} from './types'

interface Events {
  message: (targetThreadId: string, message: Message) => void;
  config: (config: ConfigurationResponse) => void;
  ready: void;
}

type Emitter = StrictEventEmitter<EventEmitter, Events>

export class Client extends (EventEmitter as { new (): Emitter }) {
  private readonly httpLink: HttpLink
  private readonly wsLink: WebSocketLink
  private readonly id: string = process.env.INSTANCE_ID!!
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

  constructor () {
    super()

    if (!process.env.ACCESS_TOKEN) {
      console.error('ChatPlug Client is not meant to run from command line, but as a ChatPlug service by the core.')
      process.exit(1)
    }

    // @ts-ignore That Fetch is NOT incorrect. TypeScript stop whining.
    this.httpLink = new HttpLink({
      uri: process.env.HTTP_ENDPOINT,
      fetchOptions: {
        headers: {
          Authorization: process.env.ACCESS_TOKEN
        }
      },
      fetch
    })
    this.wsLink = new WebSocketLink(
      new SubscriptionClient(
        process.env.WS_ENDPOINT!!,
        { connectionParams: { accessToken: process.env.ACCESS_TOKEN } },
        WebSocket
      )
    )
  }

  connect (config?: ConfigurationRequest) {
    return this.initialize()
      .then(() => this.subscribe())
      .then(() => config ? this.requestConfig(config) : '')
      .then(() => this.emit('ready'))
  }

  send (message: MessageInput): Promise<Message> {
    return toPromise(
      execute(this.httpLink, {
        query: gql`
          mutation sendMessage ($message: MessageInput!) {
            sendMessage (input: $message) {
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

  handleSearch (listener: (request: SearchRequest) => Promise<ThreadSearchResult[]>) {
    execute(this.wsLink, {
      query: gql`
        subscription subscribeToSearchRequests {
          subscribeToSearchRequests {
            query
          }
        }
      `
    }).subscribe(async ({ data }) => {
      const query = data!!.subscribeToSearchRequests as SearchRequest
      const res = await listener(query)
      execute(this.httpLink, {
        query: gql`
          mutation setSearchResponse ($forQuery: String!, $threads: [ThreadSearchResultInput!]!) {
            setSearchResponse(forQuery: $forQuery, threads: $threads) {
              forQuery
              threads {
                iconUrl
                name
                originId
              }
            }
          }
        `,
        variables: {
          forQuery: query.query,
          threads: res
        }
      })
    })
  }

  private subscribe () {
    execute(this.wsLink, {
      query: gql`
        subscription onNewMessage {
          messageReceived {
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
            setInstanceStatus (status: INITIALIZED) {
              id
            }
          }
        `
      })
    )
  }

  private requestConfig (config: ConfigurationRequest) {
    execute(this.wsLink, {
      query: gql`
        subscription onConfigChange ($config: ConfigurationRequest!) {
          configurationReceived (configuration: $config) {
            fieldValues {
              name
              value
            }
          }
        }
      `,
      variables: { config }
    }).subscribe(({ data }) => {
      const payload = data!!.configurationReceived
      this.emit('config', payload)
      return this.saveConfig(payload)
    })
  }

  get configPath () {
    return `config.${this.id}.json`
  }

  async getConfig (): Promise<any> {
    if (await fs.pathExists(this.configPath)) {
      return fs.readJSON(this.configPath)
    }

    return new Promise(resolve => this.once('config', resolve))
  }

  private saveConfig (config: any): Promise<void> {
    return fs.writeJSON(this.configPath, config)
  }
}
