import {DisplayedMessage} from "./DisplayedMessage";
import {ChatRoom} from "./ChatRoom";

export interface ChatObject {
    chat: ChatRoom;
    queues: string[];
    messages: DisplayedMessage[];
    seen: boolean
}