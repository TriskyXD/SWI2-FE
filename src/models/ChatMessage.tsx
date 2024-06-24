export interface ChatMessage {
    type: string;
    chatId: number;
    content: string;
    senderId: number;
}