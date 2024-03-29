import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ScrollDispatcher } from '@angular/cdk/overlay';
import { Store } from '@ngrx/store';
import { concat, Observable, Subscription } from 'rxjs';
import { firestore } from 'firebase/app';
import { debounceTime, filter, first, map, takeWhile, tap, throttleTime, withLatestFrom } from 'rxjs/operators';

import { AuthenticationService } from '../../services/auth/authentication.service';
import { FirebaseMessage, Message, MessageDrawable, MessageDrawableType } from '../../store/messages/message';
import {
  ConversationClosed,
  ConversationMessageAdd,
  ConversationMessageDump,
  ConversationMessageLoad,
  ConversationOpened
} from '../../store/converstions/conversation.actions';
import {
  selectConversationByUid,
  selectConversationFirstMessageUid,
  selectConversationMessages,
  selectOldConversationMessages
} from '../../store/converstions/conversation.selector';

const SCROLL_INTO_VIEW_OPTS: ScrollIntoViewOptions = { behavior: 'auto', block: 'start' };
const SCROLL_INTO_VIEW_TIMEOUT = 50;

interface MessageChanges {
  isFirstMessageBatch: boolean;
  isFromOtherUser: boolean;
}

@Component({
  selector: 'app-conversations-page',
  templateUrl: './conversation.page.html',
  styleUrls: ['./conversation.page.scss'],
})
export class ConversationPageComponent implements OnInit, AfterViewInit, OnDestroy {
  public messages$: Observable<MessageDrawable[]>;
  public oldMessages$: Observable<MessageDrawable[]>;
  public chatVisible = false;
  private messageChanges$: Observable<MessageChanges>;
  private firstConversationMessageUid$: Observable<string>;
  private firstFetchedMessageUid: string;
  private conversationUid: string;
  private subscriptions: Subscription[] = [];

  @ViewChild('conversationPage', { static: true }) conversationPage: ElementRef;
  @ViewChild('messageList', { static: true }) messageList: ElementRef;
  @ViewChild('messagesEnd', { static: true }) messageEnd: ElementRef;

  constructor(private route: ActivatedRoute,
              private auth: AuthenticationService,
              private scrollDispatcher: ScrollDispatcher,
              private store: Store<{ messages: Message[] }>) {}

  ngOnInit(): void {
    this.conversationUid = this.route.snapshot.paramMap.get('uid');
    this.messages$ = this.store.select(selectConversationMessages(), this.conversationUid)
      .pipe(
        debounceTime(200),
        map(this.makeMessagesDrawable)
      );
    this.firstConversationMessageUid$ = this.store.select(selectConversationFirstMessageUid(), this.conversationUid);

    // ensure conversation is in the store before dispatching
    this.store.select(selectConversationByUid(), this.conversationUid)
      .pipe(
        filter(conversation => conversation),
        first()
      )
      .subscribe(() => this.store.dispatch(new ConversationOpened(this.conversationUid)));

    const firstMessageBatch$ = this.messages$.pipe(
      debounceTime(400),
      // set the first fetched message from the first messages batch
      tap(messages => messages.length ? this.firstFetchedMessageUid = messages[0].uid : this.firstFetchedMessageUid = undefined),
      map(_ => {
        return {
          isFirstMessageBatch: true,
          isFromOtherUser: true
        } as MessageChanges;
      }),
      first()
    );
    const nextMessages$ = this.messages$.pipe(
      throttleTime(200),
      map((messages: Message[]) => {
        return {
          isFirstMessageBatch: false,
          isFromOtherUser: messages[messages.length - 1] ? messages[messages.length - 1].from !== this.auth.state.value.uid : false
        } as MessageChanges;
      })
    );
    this.messageChanges$ = concat(firstMessageBatch$, nextMessages$);

    this.oldMessages$ = this.store.select(selectOldConversationMessages(), this.conversationUid)
      .pipe(
        // set the first fetched message whenever oldMessages changes
        tap(messages => messages.length ? this.firstFetchedMessageUid = messages[0].uid : undefined),
        map(this.makeMessagesDrawable)
      );
  }

  ngAfterViewInit(): void {
    this.subscriptions.push(
      this.messageChanges$.subscribe((messageChanges: MessageChanges) => {
        if (messageChanges.isFirstMessageBatch) {
          this.chatVisible = true;
        }
        this.handleMessageReceived(messageChanges);
      }),
      this.scrollDispatcher.scrolled()
        .pipe(
          withLatestFrom(this.firstConversationMessageUid$),
          takeWhile(([_, firstMessageUid]) => {
            return this.firstFetchedMessageUid && firstMessageUid.length && this.firstFetchedMessageUid !== firstMessageUid;
          }),
          debounceTime(400)
        )
        .subscribe(() => {
          if (this.conversationPage.nativeElement.scrollTop < 200) {
            // tell store to load more messages by specifying the currently last message (displayed in descending order)
            this.store.dispatch(new ConversationMessageLoad(
              {
                conversationUid: this.conversationUid,
                lastMessageUid: this.firstFetchedMessageUid
              })
            );
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.store.dispatch(new ConversationMessageDump(this.conversationUid));
    this.store.dispatch(new ConversationClosed(this.conversationUid));
  }

  /* region API */

  handleMessageSend(messageBody): void {
    const firebaseMessage: FirebaseMessage = {
      conversationUid: this.conversationUid,
      body: messageBody,
      from: this.auth.state.value.uid,
      sentAt: firestore.Timestamp.fromDate(new Date())
    };
    this.store.dispatch(new ConversationMessageAdd(firebaseMessage));
  }

  private handleMessageReceived(messageChanges: MessageChanges): void {
    if (messageChanges.isFirstMessageBatch || !messageChanges.isFromOtherUser) {
      this.scrollIntoView(this.messageEnd);
    } else {
      if (this.messageList.nativeElement.offsetHeight - this.conversationPage.nativeElement.scrollTop < 1000) {
        this.scrollIntoView(this.messageEnd);
      } else {
        // experimental vibrate; remove if inconvenient
        window.navigator.vibrate(200);
      }
    }
  }

  private scrollIntoView(element: ElementRef, scrollOpts?: ScrollIntoViewOptions, timeout?: number): void {
    setTimeout(() => element.nativeElement.scrollIntoView(scrollOpts || SCROLL_INTO_VIEW_OPTS), timeout || SCROLL_INTO_VIEW_TIMEOUT);
  }

  /* endregion */

  /* UTILS */
  private makeMessagesDrawable(messages: Message[]): MessageDrawable[] {
    return messages.map((message, idx) => {
        if (idx === 0) {
          return { ...message, type: MessageDrawableType.head };
        } else if (message.from !== messages[idx - 1].from) {
          return { ...message, type: MessageDrawableType.head };
        } else if (idx === messages.length - 1 || message.from !== messages[idx + 1].from) {
          return { ...message, type: MessageDrawableType.tail };
        } else {
          return { ...message, type: MessageDrawableType.none };
        }
      }
    );
  }


}
