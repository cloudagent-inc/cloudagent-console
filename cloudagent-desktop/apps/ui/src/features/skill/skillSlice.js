import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { skillsClient } from '@/api/clients/skillsClient';

const getKnownHasTeamsValue = () => false;

const stripSkillRunnerFields = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { executionMode: _executionMode, runner: _runner, ...rest } = value;
  return rest;
};

export const createSkill = createAsyncThunk(
  'skill/createSkill',
  async (
    { title, description, plan, requiredPermissions, planSettings, cloudProvider },
    { rejectWithValue }
  ) => {
    try {
      const planPayload = stripSkillRunnerFields(plan);
      return await skillsClient.create({
        title,
        description: JSON.stringify(description),
        plan: JSON.stringify(planPayload),
        requiredPermissions: JSON.stringify(requiredPermissions),
        planSettings: JSON.stringify(planSettings),
        cloudProvider: cloudProvider || planPayload?.cloudProvider || planPayload?.plan?.[0]?.tasks?.[0]?.cloudProvider || 'aws',
      });
    } catch (error) {
      console.error('Error creating skill:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSkills = createAsyncThunk(
  'skill/fetchSkills',
  async ({ count = 50, nextToken = null }, { getState, rejectWithValue }) => {
    try {
      const hasTeams = getKnownHasTeamsValue(getState());
      let result = await skillsClient.list({ count, nextToken, hasTeams });
      const resultItems = Array.isArray(result?.items) ? result.items : [];
      const resultNextToken = result?.nextToken;

      // Workaround for backend pagination bug: if we get empty items but have a nextToken,
      // automatically fetch the next page to get the actual items
      if (
        resultItems.length === 0 &&
        resultNextToken &&
        !nextToken // Only do this for the initial fetch, not for "Load More"
      ) {
        console.log('[fetchSkills] Empty first page with nextToken - fetching next page automatically');
        result = await skillsClient.list({
          count,
          nextToken: resultNextToken,
          hasTeams,
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching skills:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const deleteSkill = createAsyncThunk(
  'skill/deleteSkill',
  async (recordId, { rejectWithValue }) => {
    try {
      return await skillsClient.delete(recordId);
    } catch (error) {
      console.error('Error deleting skill:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSkillById = createAsyncThunk(
  'skill/fetchSkillById',
  async (recordId, { getState, rejectWithValue }) => {
    try {
      return await skillsClient.get(recordId, {
        hasTeams: getKnownHasTeamsValue(getState()),
      });
    } catch (error) {
      console.error('Error fetching skill by ID:', error);
      return rejectWithValue(error.message);
    }
  }
);

const skillSlice = createSlice({
  name: 'skill',
  initialState: {
    loading: false,
    error: null,
    userSkills: [],
    currentSkill: null,
    nextToken: null,
    hasMore: false,
  },
  reducers: {
    setCurrentSkill: (state, action) => {
      state.currentSkill = action.payload;
    },
    resetSkills: (state) => {
      state.userSkills = [];
      state.currentSkill = null;
      state.nextToken = null;
      state.hasMore = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSkill.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSkill.fulfilled, (state, action) => {
        state.loading = false;
        state.userSkills.unshift(action.payload);
        state.currentSkill = action.payload;
      })
      .addCase(createSkill.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })

      .addCase(fetchSkills.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSkills.fulfilled, (state, action) => {
        state.loading = false;
        state.userSkills = action.payload?.items || [];
        state.nextToken = action.payload?.nextToken || null;
        state.hasMore = !!action.payload?.nextToken;
      })
      .addCase(fetchSkills.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })

      .addCase(deleteSkill.pending, (state) => {
        state.error = null;
      })
      .addCase(deleteSkill.fulfilled, (state, action) => {
        const recordId = action.payload?.recordId;
        if (!recordId) return;
        state.userSkills = state.userSkills.filter(
          (skill) => skill.recordId !== recordId
        );
        if (state.currentSkill?.recordId === recordId) {
          state.currentSkill = null;
        }
      })
      .addCase(deleteSkill.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchSkillById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSkillById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSkill = action.payload;
      })
      .addCase(fetchSkillById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { setCurrentSkill, resetSkills, clearError } =
  skillSlice.actions;

export const createBlueprint = createSkill;
export const fetchBlueprints = fetchSkills;
export const deleteBlueprint = deleteSkill;
export const fetchBlueprintById = fetchSkillById;
export const setCurrentBlueprint = setCurrentSkill;
export const resetBlueprints = resetSkills;

export default skillSlice.reducer;
