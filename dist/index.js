"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const subscriptions_transport_ws_1 = require("subscriptions-transport-ws");
const apollo_link_1 = require("apollo-link");
const apollo_link_ws_1 = require("apollo-link-ws");
const apollo_link_http_1 = require("apollo-link-http");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
class ChatPlugClient extends events_1.EventEmitter {
    constructor(uri) {
        super();
        // @ts-ignore this fetch is working, TypeScript stop complaining about it
        this.httpLink = new apollo_link_http_1.HttpLink({ uri, fetch: node_fetch_1.default });
        this.wsLink = new apollo_link_ws_1.WebSocketLink(new subscriptions_transport_ws_1.SubscriptionClient(uri, undefined, ws_1.default));
        this.subscribe();
    }
    send(message) {
        return apollo_link_1.toPromise(apollo_link_1.execute(this.httpLink, {
            query: graphql_tag_1.default `
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
        })).then(data => {
            return data;
        });
    }
    subscribe() {
        apollo_link_1.execute(this.wsLink, {
            query: graphql_tag_1.default `
        subscription onNewMessage {
          messageReceived (threadId: "ayy") {
            body
            author {
              username
              originId
            }
          }
        }
      `
        }).subscribe(({ data }) => {
            this.emit('message', data.messageReceived);
        });
    }
}
exports.default = ChatPlugClient;
