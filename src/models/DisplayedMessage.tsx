import {ChatUser} from "./ChatUser";

export interface DisplayedMessage {
    type: string;
    content: string;
    sender: ChatUser;
}