import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { blueprintsClient } from '@/api/clients/blueprintsClient';

const getKnownHasTeamsValue = () => false;

const stripBlueprintRunnerFields = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { executionMode: _executionMode, runner: _runner, ...rest } = value;
  return rest;
};

export const createBlueprint = createAsyncThunk(
  'blueprint/createBlueprint',
  async (
    { title, description, credits, plan, requiredPermissions, planSettings, cloudProvider },
    { rejectWithValue }
  ) => {
    try {
      const planPayload = stripBlueprintRunnerFields(plan);
      return await blueprintsClient.create({
        title,
        description: JSON.stringify(description),
        credits,
        plan: JSON.stringify(planPayload),
        requiredPermissions: JSON.stringify(requiredPermissions),
        planSettings: JSON.stringify(planSettings),
        cloudProvider: cloudProvider || planPayload?.cloudProvider || planPayload?.plan?.[0]?.tasks?.[0]?.cloudProvider || 'aws',
      });
    } catch (error) {
      console.error('Error creating blueprint:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchBlueprints = createAsyncThunk(
  'blueprint/fetchBlueprints',
  async ({ count = 50, nextToken = null }, { getState, rejectWithValue }) => {
    try {
      const hasTeams = getKnownHasTeamsValue(getState());
      let result = await blueprintsClient.list({ count, nextToken, hasTeams });
      const resultItems = Array.isArray(result?.items) ? result.items : [];
      const resultNextToken = result?.nextToken;

      // Workaround for backend pagination bug: if we get empty items but have a nextToken,
      // automatically fetch the next page to get the actual items
      if (
        resultItems.length === 0 &&
        resultNextToken &&
        !nextToken // Only do this for the initial fetch, not for "Load More"
      ) {
        console.log('[fetchBlueprints] Empty first page with nextToken - fetching next page automatically');
        result = await blueprintsClient.list({
          count,
          nextToken: resultNextToken,
          hasTeams,
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching blueprints:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const deleteBlueprint = createAsyncThunk(
  'blueprint/deleteBlueprint',
  async (recordId, { rejectWithValue }) => {
    try {
      return await blueprintsClient.delete(recordId);
    } catch (error) {
      console.error('Error deleting blueprint:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchBlueprintById = createAsyncThunk(
  'blueprint/fetchBlueprintById',
  async (recordId, { getState, rejectWithValue }) => {
    try {
      return await blueprintsClient.get(recordId, {
        hasTeams: getKnownHasTeamsValue(getState()),
      });
    } catch (error) {
      console.error('Error fetching blueprint by ID:', error);
      return rejectWithValue(error.message);
    }
  }
);

const blueprintSlice = createSlice({
  name: 'blueprint',
  initialState: {
    loading: false,
    error: null,
    userBlueprints: [],
    currentBlueprint: null,
    nextToken: null,
    hasMore: false,
  },
  reducers: {
    setCurrentBlueprint: (state, action) => {
      state.currentBlueprint = action.payload;
    },
    resetBlueprints: (state) => {
      state.userBlueprints = [];
      state.currentBlueprint = null;
      state.nextToken = null;
      state.hasMore = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createBlueprint.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBlueprint.fulfilled, (state, action) => {
        state.loading = false;
        state.userBlueprints.unshift(action.payload);
        state.currentBlueprint = action.payload;
      })
      .addCase(createBlueprint.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })

      .addCase(fetchBlueprints.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBlueprints.fulfilled, (state, action) => {
        state.loading = false;
        state.userBlueprints = action.payload?.items || [];
        state.nextToken = action.payload?.nextToken || null;
        state.hasMore = !!action.payload?.nextToken;
      })
      .addCase(fetchBlueprints.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })

      .addCase(deleteBlueprint.pending, (state) => {
        state.error = null;
      })
      .addCase(deleteBlueprint.fulfilled, (state, action) => {
        const recordId = action.payload?.recordId;
        if (!recordId) return;
        state.userBlueprints = state.userBlueprints.filter(
          (blueprint) => blueprint.recordId !== recordId
        );
        if (state.currentBlueprint?.recordId === recordId) {
          state.currentBlueprint = null;
        }
      })
      .addCase(deleteBlueprint.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchBlueprintById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBlueprintById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentBlueprint = action.payload;
      })
      .addCase(fetchBlueprintById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { setCurrentBlueprint, resetBlueprints, clearError } =
  blueprintSlice.actions;
export default blueprintSlice.reducer;
