import { ConversationAdapter } from './conversation.adapter';
import { ConversationActions, ConversationActionTypes } from './conversation.actions';
import { ConversationState } from './conversation.state';

const initialState = ConversationAdapter.getInitialState({
  loading: false
});

export function conversationReducer(state = initialState,
                                    action: ConversationActions): ConversationState {
  switch (action.type) {

    case ConversationActionTypes.ConversationQuery:
      return { ...state, loading: true };

    case ConversationActionTypes.ConversationAdded:
      return ConversationAdapter.addOne({ ...action.payload }, { ...state, loading: false });

    case ConversationActionTypes.ConversationModified:
      return ConversationAdapter.updateOne({
        id: action.payload.uid,
        changes: action.payload
      }, state);

    case ConversationActionTypes.ConversationOpened:
      return ConversationAdapter.updateOne({
        id: action.payload,
        changes: { opened: true }
      }, state);

    case ConversationActionTypes.ConversationClosed:
      return ConversationAdapter.updateOne({
        id: action.payload,
        changes: { opened: false }
      }, state);

    case ConversationActionTypes.ConversationMessageLoadSuccess:
      return ConversationAdapter.updateOne({
        id: action.payload.conversationUid,
        changes: {
          oldMessages: action.payload.messages
            .concat(state.entities[action.payload.conversationUid].oldMessages)
            .sort((msgA, msgB) => msgA.sentAt.seconds - msgB.sentAt.seconds)
        }
      }, state);

    case ConversationActionTypes.ConversationMessageDump:
      return ConversationAdapter.updateOne({
        id: action.payload,
        changes: {
          oldMessages: []
        }
      }, state);

    case ConversationActionTypes.ConversationMessageAdded:
      return ConversationAdapter.updateOne({
        id: action.payload.conversationUid,
        changes: {
          messages: [action.payload]
            .concat(state.entities[action.payload.conversationUid].messages)
            .sort((msgA, msgB) => msgA.sentAt.seconds - msgB.sentAt.seconds)
        }
      }, state);

    default:
      return state;
  }
}
