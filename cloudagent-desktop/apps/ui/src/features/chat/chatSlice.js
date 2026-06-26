import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { generateClient } from 'aws-amplify/api';
import {
  queryGetChatRecord,
  queryListChatRecordsByUpdatedAt,
  upsertChatRecordMutation,
  appendChatMessagesMutation,
} from '../../api/eventQueries';

const client = generateClient();

// Thunks
export const startChat = createAsyncThunk(
  'chat/startChat',
  async ({ sessionId, title, metadata, recordId }, { rejectWithValue }) => {
    try {
      const response = await client.graphql({
        query: upsertChatRecordMutation,
        variables: {
          recordId,
          sessionId,
          title,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });
      return response.data.upsertChatRecord;
    } catch (error) {
      console.log('[chat/startChat] error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const appendChatMessages = createAsyncThunk(
  'chat/appendChatMessages',
  async ({ recordId, messages, metadata }, { rejectWithValue }) => {
    try {
      const variables = { 
        recordId, 
        messages, 
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      };
      const response = await client.graphql({ query: appendChatMessagesMutation, variables });
      return response.data.appendChatMessages;
    } catch (error) {
      console.log('[chat/appendChatMessages] error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const getChatRecord = createAsyncThunk(
  'chat/getChatRecord',
  async ({ recordId }, { rejectWithValue }) => {
    try {
      const response = await client.graphql({
        query: queryGetChatRecord,
        variables: { recordId },
      });
      return response.data.getChatRecord;
    } catch (error) {
      console.log('[chat/getChatRecord] error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const listRecentChats = createAsyncThunk(
  'chat/listRecentChats',
  async ({ limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const response = await client.graphql({
        query: queryListChatRecordsByUpdatedAt,
        variables: { limit },
      });
      return response.data.listChatRecordsByUpdatedAt || [];
    } catch (error) {
      console.log('[chat/listRecentChats] error', error);
      return rejectWithValue(error.message);
    }
  }
);

// Slice
const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    chatsById: {},
    recentChatIds: [],
    currentChatId: null,
    listLoading: false,
    getLoading: false,
    startLoading: false,
    appendLoading: false,
    error: null,
  },
  reducers: {
    setCurrentChatId: (state, action) => {
      state.currentChatId = action.payload;
    },
    clearChatState: (state) => {
      state.chatsById = {};
      state.recentChatIds = [];
      state.currentChatId = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Start chat
      .addCase(startChat.pending, (state) => {
        state.startLoading = true;
        state.error = null;
      })
      .addCase(startChat.fulfilled, (state, action) => {
        state.startLoading = false;
        const chat = action.payload;
        const recordId = chat?.recordId;
        if (!recordId) {
          state.error = 'Failed to start chat: missing recordId in response';
          return;
        }
        state.chatsById[recordId] = chat;
        state.currentChatId = recordId;
        // maintain recent list (dedupe & unshift)
        state.recentChatIds = [recordId, ...state.recentChatIds.filter(id => id !== recordId)];
      })
      .addCase(startChat.rejected, (state, action) => {
        state.startLoading = false;
        state.error = action.payload || action.error.message;
      })

      // Append messages
      .addCase(appendChatMessages.pending, (state) => {
        state.appendLoading = true;
        state.error = null;
      })
      .addCase(appendChatMessages.fulfilled, (state, action) => {
        state.appendLoading = false;
        const chat = action.payload;
        const recordId = chat?.recordId;
        if (!recordId) {
          state.error = 'Failed to append chat messages: missing recordId in response';
          return;
        }
        const existing = state.chatsById[recordId] || {};
        state.chatsById[recordId] = {
          ...existing,
          ...chat,
          // Preserve existing title if server returns null/undefined
          title: chat.title ?? existing.title,
        };
        // bump to top of recent
        state.recentChatIds = [recordId, ...state.recentChatIds.filter(id => id !== recordId)];
      })
      .addCase(appendChatMessages.rejected, (state, action) => {
        state.appendLoading = false;
        state.error = action.payload || action.error.message;
      })

      // Get chat
      .addCase(getChatRecord.pending, (state) => {
        state.getLoading = true;
        state.error = null;
      })
      .addCase(getChatRecord.fulfilled, (state, action) => {
        state.getLoading = false;
        const chat = action.payload;
        const recordId = chat?.recordId;
        if (recordId) {
          state.chatsById[recordId] = chat;
          state.currentChatId = recordId;
          state.recentChatIds = [recordId, ...state.recentChatIds.filter(id => id !== recordId)];
        }
      })
      .addCase(getChatRecord.rejected, (state, action) => {
        state.getLoading = false;
        state.error = action.payload || action.error.message;
      })

      // List recent
      .addCase(listRecentChats.pending, (state) => {
        state.listLoading = true;
        state.error = null;
      })
      .addCase(listRecentChats.fulfilled, (state, action) => {
        state.listLoading = false;
        const chats = Array.isArray(action.payload) ? action.payload : [];
        const validChats = chats.filter((chat) => chat?.recordId);
        validChats.forEach((chat) => {
          state.chatsById[chat.recordId] = chat;
        });
        state.recentChatIds = validChats.map((chat) => chat.recordId);
      })
      .addCase(listRecentChats.rejected, (state, action) => {
        state.listLoading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { setCurrentChatId, clearChatState } = chatSlice.actions;

export default chatSlice.reducer;
