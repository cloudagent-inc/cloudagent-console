import { createSlice } from '@reduxjs/toolkit';

const commandCenterSlice = createSlice({
  name: 'commandCenter',
  initialState: {
    suggestionCards: [],
    suggestionPage: 0,
    briefing: null,
  },
  reducers: {
    setSuggestionCards(state, action) {
      state.suggestionCards = Array.isArray(action.payload) ? action.payload : [];
    },
    setSuggestionPage(state, action) {
      const page = Number(action.payload);
      state.suggestionPage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    },
    setBriefing(state, action) {
      state.briefing = action.payload && typeof action.payload === 'object'
        ? action.payload
        : null;
    },
    setSuggestionsState(state, action) {
      const { cards, suggestionPage, briefing } = action.payload || {};
      if (Array.isArray(cards)) state.suggestionCards = cards;
      const page = Number(suggestionPage);
      if (Number.isFinite(page) && page >= 0) state.suggestionPage = Math.floor(page);
      if (briefing !== undefined) {
        state.briefing = briefing && typeof briefing === 'object' ? briefing : null;
      }
    },
    clearSuggestions(state) {
      state.suggestionCards = [];
      state.suggestionPage = 0;
      state.briefing = null;
    },
  },
});

export const {
  setSuggestionCards,
  setSuggestionPage: setSuggestionPageAction,
  setBriefing,
  setSuggestionsState,
  clearSuggestions,
} = commandCenterSlice.actions;

export default commandCenterSlice.reducer;
