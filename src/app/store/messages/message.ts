import { MessageReceipt } from './message-receipt';
import { firestore } from 'firebase/app';

export const MESSAGES_PATH = 'MESSAGES';

export interface FirebaseMessage {
  conversationUid: string;
  body: string;
  from: string;
  sentAt: firestore.Timestamp;
}

export class Message {

  constructor(public uid: string,
              public conversationUid: string,
              public body: string,
              public from: string,
              public received?: MessageReceipt[],
              public sentAt?: firestore.Timestamp) {
  }
}
