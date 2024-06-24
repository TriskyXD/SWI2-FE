import {ChatUser} from "./ChatUser";
import {ChatUsers} from "./ChatUsers";

export interface ChatRoom {
    id: number;
    exchange: string;
    chatName: string;
    owner: ChatUser;
    userQueues: ChatUsers[];
}