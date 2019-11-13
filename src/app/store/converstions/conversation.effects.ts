import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentChangeAction } from '@angular/fire/firestore';
import { Action } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { ChatDispatcherService, START_OF_TODAY } from '../../services/chat-dispatcher/chat-dispatcher.service';
import { first, map, mergeMap, switchMap, takeUntil, tap } from 'rxjs/operators';
import { combineLatest, from, Observable, of } from 'rxjs';

import { CONVERSATIONS_PATH, FirebaseConversation } from './conversation';
import {
  ConversationActionTypes,
  ConversationAdd,
  ConversationAddSuccess,
  ConversationMessageAdd,
  ConversationMessageAdded,
  ConversationMessageAddSuccess,
  ConversationMessageLoad,
  ConversationMessageLoadSuccess,
  ConversationMessageNoop,
  ConversationMessageQuery, ConversationMessageQueryStop,
  ConversationQuery,
} from './conversation.actions';
import { AuthenticationService } from '../../services/auth/authentication.service';
import { FirebaseMessage, Message, MESSAGES_PATH } from '../messages/message';

@Injectable()
export class ConversationEffects {

  constructor(private readonly afs: AngularFirestore,
              private readonly auth: AuthenticationService,
              private actions$: Actions,
              private chatDispatcher: ChatDispatcherService) {}

  /* region CONVERSATIONS */

  @Effect()
  query$: Observable<Action> = this.actions$.pipe(
    ofType(ConversationActionTypes.ConversationQuery as string),
    switchMap((action: ConversationQuery) => {
      return this.afs.collection<FirebaseConversation>(
        CONVERSATIONS_PATH,
        ref => ref.where('userUids', 'array-contains', this.auth.state.value.uid)
      ).stateChanges();
    }),
    mergeMap(actions => actions),
    map(action => {
      return {
        type: `conversation.${action.type}`,
        payload: {
          uid: action.payload.doc.id,
          ...action.payload.doc.data(),
          messages: [],
          messagesLoading: true
        }
      };
    })
  );

  @Effect()
  addConversation = this.actions$
    .pipe(
      ofType(ConversationActionTypes.ConversationAdd as string),
      switchMap((action: ConversationAdd) => {
        const ref = this.afs.collection<FirebaseConversation>(CONVERSATIONS_PATH);
        const firebaseConversation = {
          userUids: action.payload.userUids
            .concat(this.auth.state.value.uid)
        };
        return from(ref.add(firebaseConversation));
      }),
      map(() => new ConversationAddSuccess())
    );

  /* endregion */

  /* region MESSAGES */

  @Effect()
  messageLoad$: Observable<Action> = this.actions$.pipe(
    ofType(ConversationActionTypes.ConversationMessageLoad as string),
    switchMap((action: ConversationMessageLoad) => {
      const snapshotChanges = this.afs.collection<FirebaseMessage>(
        `${CONVERSATIONS_PATH}/${action.payload.conversationUid}/${MESSAGES_PATH}`,
        ref => {
          return ref.where('sentAt', '<=', START_OF_TODAY)
            .orderBy('sentAt')
            .limit(20);
        }
      ).snapshotChanges(['added']).pipe(first());

      return combineLatest([snapshotChanges, of(action.payload.conversationUid)]);
    }),
    map(([messageChangeActions, conversationUid]) => {
      const messages = messageChangeActions.map((messageChangeAction: DocumentChangeAction<FirebaseMessage>) => {
        const messageData: FirebaseMessage = messageChangeAction.payload.doc.data();
        return new Message(
          messageChangeAction.payload.doc.id,
          messageData.conversationUid,
          messageData.body,
          messageData.from,
          undefined,
          messageData.sentAt);
      });
      return new ConversationMessageLoadSuccess({
        conversationUid: conversationUid,
        messages: messages
      });
    })
  );

  @Effect()
  messageQueryStop$: Observable<Action> = this.actions$.pipe(
    ofType(ConversationActionTypes.ConversationMessageQueryStop as string),
    map(() => {
      return new ConversationMessageNoop();
    })
  );

  @Effect()
  messageQuery$: Observable<Action> = this.actions$.pipe(
    ofType(ConversationActionTypes.ConversationMessageQuery as string),
    switchMap((action: ConversationMessageQuery) => {
      return this.afs.collection<FirebaseMessage>(
        `${CONVERSATIONS_PATH}/${action.payload}/${MESSAGES_PATH}`,
        ref => {
          return ref.where('sentAt', '>=', START_OF_TODAY).orderBy('sentAt');
        }
      ).stateChanges()
        .pipe(takeUntil(this.messageQueryStop$));
    }),
    mergeMap(actions => actions),
    map(action => {
      return {
        type: `conversation.message.${action.type}`,
        payload: { uid: action.payload.doc.id, ...action.payload.doc.data() }
      };
    })
  );

  @Effect()
  conversationMessageAdded = this.actions$
    .pipe(
      ofType(ConversationActionTypes.ConversationMessageAdded as string),
      tap((action: ConversationMessageAdded) => {
        this.chatDispatcher.messageFromOtherUser$.next(action.payload && action.payload.from !== this.auth.state.value.uid);
      }),
      map(() => {
        return new ConversationMessageNoop();
      })
    );

  @Effect()
  addMessage = this.actions$
    .pipe(
      ofType(ConversationActionTypes.ConversationMessageAdd as string),
      switchMap((action: ConversationMessageAdd) => {
        const ref = this.afs.collection<FirebaseMessage>(`${CONVERSATIONS_PATH}/${action.payload.conversationUid}/${MESSAGES_PATH}`);
        return from(ref.add(action.payload));
      }),
      map(() => {
        return new ConversationMessageAddSuccess();
      })
    );

  /* endregion */
}
