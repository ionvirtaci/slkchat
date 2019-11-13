import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ChatDispatcherService } from '../../services/chat-dispatcher/chat-dispatcher.service';
import { FirebaseMessage, Message } from '../../store/messages/message';
import { ActivatedRoute } from '@angular/router';
import { AuthenticationService } from '../../services/auth/authentication.service';
import { firestore } from 'firebase/app';
import { Store } from '@ngrx/store';
import {
  ConversationMessageAdd,
  ConversationMessageLoad,
  ConversationMessageQuery,
  ConversationMessageQueryStop
} from '../../store/converstions/conversation.actions';
import { selectConversationMessages, selectConversationMessagesLoading } from '../../store/converstions/conversation.selector';

const SCROLL_INTO_VIEW_OPTS: ScrollIntoViewOptions = { behavior: 'auto', block: 'start' };
const SCROLL_INTO_VIEW_TIMEOUT = 50;

@Component({
  selector: 'app-conversations-page',
  templateUrl: './conversation.page.html',
  styleUrls: ['./conversation.page.scss'],
})
export class ConversationPageComponent implements OnInit, AfterViewInit, OnDestroy {
  public messages$: Observable<Message[]>;
  public messagesLoading$: Observable<boolean>;
  public chatVisible = false;
  private conversationUid: string;
  private subscriptions: Subscription[] = [];

  @ViewChild('conversationPage', { static: true }) conversationPage: ElementRef;
  @ViewChild('messageList', { static: true }) messageList: ElementRef;
  @ViewChild('messagesEnd', { static: true }) messageEnd: ElementRef;

  constructor(private route: ActivatedRoute,
              private chatDispatcher: ChatDispatcherService,
              private auth: AuthenticationService,
              private renderer: Renderer2,
              private store: Store<{ messages: Message[] }>) {
  }

  ngOnInit(): void {
    this.conversationUid = this.route.snapshot.paramMap.get('uid');
    this.messagesLoading$ = this.store.select(selectConversationMessagesLoading(), this.conversationUid);
    this.messages$ = this.store.select(selectConversationMessages(), this.conversationUid);
    this.store.dispatch(new ConversationMessageLoad({ conversationUid: this.conversationUid }));
    this.store.dispatch(new ConversationMessageQuery(this.conversationUid));
    this.subscriptions.push(
      this.chatDispatcher.messageFromOtherUser$
        .subscribe(isFromOtherUser => {
          this.handleMessageReceived(isFromOtherUser);
        }));
  }

  ngAfterViewInit(): void {
    this.subscriptions.push(
      this.messagesLoading$
        .subscribe((loading: boolean) => {
          if (!loading) {
            setTimeout(() => {
              this.renderer.setProperty(this.conversationPage.nativeElement, 'scrollTop', this.messageList.nativeElement.offsetHeight);
              this.chatVisible = true;
            }, 0);
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.store.dispatch(new ConversationMessageQueryStop());
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

  private handleMessageReceived(isFromOtherUser: boolean): void {
    if (!isFromOtherUser) {
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


}
