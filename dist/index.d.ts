/// <reference types="node" />
import { EventEmitter } from 'events';
export interface MessageAuthor {
    username: string;
    originId: string;
}
export interface Message {
    body: string;
    originId: string;
    author: MessageAuthor;
}
export default class ChatPlugClient extends EventEmitter {
    private readonly httpLink;
    private readonly wsLink;
    constructor(uri: string);
    send(message: Message): Promise<Message>;
    private subscribe;
}
