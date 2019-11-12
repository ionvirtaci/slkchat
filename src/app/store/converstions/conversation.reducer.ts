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
      return ConversationAdapter.addOne({ ...action.payload, messages: [], messagesLoading: true }, { ...state, loading: false });

    case ConversationActionTypes.ConversationModified:
      return ConversationAdapter.updateOne({
        id: action.payload.uid,
        changes: action.payload
      }, state);

    case ConversationActionTypes.ConversationMessageAdded:
      return ConversationAdapter.updateOne({
        id: action.payload.conversationUid,
        changes: {
          messages: state.entities[action.payload.conversationUid].messages.concat(action.payload),
          messagesLoading: false
        }
      }, state);

    default:
      return state;
  }
}
