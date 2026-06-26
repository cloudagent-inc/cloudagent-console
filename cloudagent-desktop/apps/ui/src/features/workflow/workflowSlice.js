import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { workflowsClient } from '@/api/clients/workflowsClient';
import { updateUserProfile } from '../auth/authSlice';
const getKnownHasTeamsValue = () => false;

const safeStringify = (value) => {
  const seen = new WeakSet();

  try {
    return JSON.stringify(
      value,
      (key, nestedValue) => {
        if (typeof nestedValue === 'object' && nestedValue !== null) {
          if (seen.has(nestedValue)) {
            return '[Circular]';
          }
          seen.add(nestedValue);
        }

        if (nestedValue instanceof Error) {
          return {
            name: nestedValue.name,
            message: nestedValue.message,
            stack: nestedValue.stack,
          };
        }

        return nestedValue;
      },
      2
    );
  } catch (stringifyError) {
    return `Unable to serialize value: ${stringifyError?.message || stringifyError}`;
  }
};

const getAppSyncErrorDetails = (error) => {
  const appSyncErrors = Array.isArray(error?.errors) ? error.errors : [];
  const messages = appSyncErrors
    .map((appSyncError) => appSyncError?.message)
    .filter(Boolean);

  return {
    message:
      messages.join(' | ') ||
      error?.message ||
      (typeof error === 'string' ? error : '') ||
      'Unknown AppSync error',
    appSyncErrors,
    data: error?.data,
    name: error?.name,
    stack: error?.stack,
    raw: safeStringify(error),
  };
};

export const createWorkflow = createAsyncThunk(
  'workflow/createWorkflow',
  async (
    { nodes, title, description, schedule },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const workflow = await workflowsClient.create({
        nodes,
        title,
        description,
        schedule,
      });

      if (workflow) {
        dispatch(
          updateUserProfile({
            workflows: workflow,
          })
        );
      }

      return workflow;
    } catch (error) {
      console.log('Error creating workflow:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const updateWorkflow = createAsyncThunk(
  'workflow/updateWorkflow',
  async (
    { workflowId, nodes, title, description, schedule },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const workflow = await workflowsClient.update({
        workflowId,
        nodes,
        title,
        description,
        schedule,
      });

      if (workflow) {
        dispatch(
          updateUserProfile({
            workflows: workflow,
          })
        );
      }

      return workflow;
    } catch (error) {
      console.log('Error updating workflow:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const getWorkflows = createAsyncThunk(
  'workflow/getWorkflows',
  async (
    {
      count = 10,
      nextToken = null,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      workflowType = null,
      monthsOffset = 0,
      startDateOverride = null,
      endDateOverride = null,
    } = {},
    { getState, rejectWithValue }
  ) => {
    try {
      const resolvedEndDate = endDateOverride || (() => {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() - monthsOffset);
        return endDate.toISOString();
      })();

      const resolvedStartDate = startDateOverride || (() => {
        const startDate = new Date(resolvedEndDate);
        startDate.setMonth(startDate.getMonth() - 3);
        return startDate.toISOString();
      })();
      const variables = {
        count,
        nextToken,
        sortBy,
        sortOrder,
        workflowType,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
        hasTeams: getKnownHasTeamsValue(getState()),
      };

      console.info('[workflowSlice.getWorkflows] Loading workflows', {
        variables,
      });

      const workflowResponse = await workflowsClient.listRuns(variables);
      console.info('[workflowSlice.getWorkflows] getWorkFlows response', {
        hasData: Boolean(workflowResponse),
        hasGetWorkFlows: Boolean(workflowResponse),
        itemCount: Array.isArray(workflowResponse?.items)
          ? workflowResponse.items.length
          : null,
        nextToken: workflowResponse?.nextToken ?? null,
        response: workflowResponse,
      });

      return {
        ...workflowResponse,
        requestedNextToken: nextToken,
        monthsOffset,
        startDate: variables.startDate,
        endDate: variables.endDate,
      };
    } catch (error) {
      const errorDetails = getAppSyncErrorDetails(error);

      console.error('[workflowSlice.getWorkflows] AppSync getWorkFlows failed', {
        variables: {
          count,
          nextToken,
          sortBy,
          sortOrder,
          workflowType,
          monthsOffset,
        },
        message: errorDetails.message,
        appSyncErrors: errorDetails.appSyncErrors,
        data: errorDetails.data,
        name: errorDetails.name,
        stack: errorDetails.stack,
        raw: errorDetails.raw,
        error,
      });

      return rejectWithValue(errorDetails.message);
    }
  }
);

export const getWorkflowById = createAsyncThunk(
  'workflow/getWorkflowById',
  async (workflowRunId, { getState, rejectWithValue }) => {
    try {
      const workflow = await workflowsClient.getRun(workflowRunId, {
        hasTeams: getKnownHasTeamsValue(getState()),
      });

      if (!workflow) {
        return rejectWithValue('Workflow not found');
      }

      return workflow;
    } catch (error) {
      console.error('Error fetching workflow:', error);
      return rejectWithValue(error.message || 'Failed to fetch workflow');
    }
  }
);

export const deleteWorkflow = createAsyncThunk(
  'workflow/deleteWorkflow',
  async (workflowId, { dispatch, rejectWithValue }) => {
    try {
      const deletedWorkflow = await workflowsClient.delete(workflowId);
      dispatch(updateUserProfile({ removeWorkflowId: workflowId }));
      return { workflowId, ...deletedWorkflow };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const workflowSlice = createSlice({
  name: 'workflow',
  initialState: {
    loading: false,
    error: null,
    userWorkflows: [],
    currentWorkflow: null,
    runStatus: null,
    runResults: null,
    runLoading: false,
    selectedWorkflow: null,
    selectedWorkflowLoading: false,
    selectedWorkflowError: null,
    nextToken: null,
    hasMoreWorkflows: false,
    currentMonthsOffset: 0,
    hasMoreTimeWindows: true,
    isLoadingAllData: false,
    loadedTimeWindows: [],
  },
  reducers: {
    setCurrentWorkflow: (state, action) => {
      state.currentWorkflow = action.payload;
    },
    clearRunResults: (state) => {
      state.runResults = null;
      state.runStatus = null;
    },
    addWorkflow: (state, action) => {
      state.userWorkflows.push(action.payload);
    },
    clearSelectedWorkflow: (state) => {
      state.selectedWorkflow = null;
      state.selectedWorkflowError = null;
    },
    setSelectedWorkflow: (state, action) => {
      state.selectedWorkflow = action.payload;
    },
    resetWorkflows: (state) => {
      state.userWorkflows = [];
      state.currentMonthsOffset = 0;
      state.hasMoreTimeWindows = true;
      state.loadedTimeWindows = [];
      state.nextToken = null;
      state.hasMoreWorkflows = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createWorkflow.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWorkflow.fulfilled, (state, action) => {
        state.loading = false;
        if (!action.payload.isLibrary) {
          state.userWorkflows.push(action.payload);
        }
        state.currentWorkflow = action.payload;
      })
      .addCase(createWorkflow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })

      .addCase(updateWorkflow.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateWorkflow.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.userWorkflows.findIndex(
          (wf) =>
            wf.workflowId === action.payload.workflowId ||
            wf.id === action.payload.id
        );
        if (index !== -1) {
          state.userWorkflows[index] = action.payload;
        }
        state.currentWorkflow = action.payload;
      })
      .addCase(updateWorkflow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(getWorkflows.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getWorkflows.fulfilled, (state, action) => {
        const payload = action.payload || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        const nextToken = payload.nextToken ?? null;
        const monthsOffset = Number.isFinite(payload.monthsOffset)
          ? payload.monthsOffset
          : 0;
        const startDate = payload.startDate || null;
        const endDate = payload.endDate || null;
        const requestedNextToken = payload.requestedNextToken ?? null;
        const isContinuation = Boolean(requestedNextToken);
        const existingWindowIndex = state.loadedTimeWindows.findIndex(
          (window) => window?.monthsOffset === monthsOffset
        );

        if (monthsOffset === 0 && !isContinuation) {
          state.userWorkflows = items;
          state.loadedTimeWindows = [
            { monthsOffset, startDate, endDate, count: items.length },
          ];
        } else if (isContinuation) {
          state.userWorkflows = [...state.userWorkflows, ...items];

          if (existingWindowIndex === -1) {
            state.loadedTimeWindows.push({
              monthsOffset,
              startDate,
              endDate,
              count: items.length,
            });
          } else {
            state.loadedTimeWindows[existingWindowIndex] = {
              ...state.loadedTimeWindows[existingWindowIndex],
              startDate,
              endDate,
              count:
                (state.loadedTimeWindows[existingWindowIndex]?.count || 0) +
                items.length,
            };
          }
        } else {
          state.userWorkflows = [...state.userWorkflows, ...items];
          if (existingWindowIndex === -1) {
            state.loadedTimeWindows.push({
              monthsOffset,
              startDate,
              endDate,
              count: items.length,
            });
          } else {
            state.loadedTimeWindows[existingWindowIndex] = {
              ...state.loadedTimeWindows[existingWindowIndex],
              startDate,
              endDate,
              count: items.length,
            };
          }
        }

        state.currentMonthsOffset = monthsOffset;
        state.nextToken = nextToken;
        state.hasMoreWorkflows = !!nextToken;

        state.hasMoreTimeWindows =
          Boolean(nextToken) ||
          isContinuation ||
          items.length > 0 ||
          monthsOffset === 0;

        state.loading = false;
        state.error = null;
      })
      .addCase(getWorkflows.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(getWorkflowById.pending, (state) => {
        state.selectedWorkflowLoading = true;
        state.selectedWorkflowError = null;
      })
      .addCase(getWorkflowById.fulfilled, (state, action) => {
        state.selectedWorkflowLoading = false;
        state.selectedWorkflow = action.payload;
        state.selectedWorkflowError = null;
      })
      .addCase(getWorkflowById.rejected, (state, action) => {
        state.selectedWorkflowLoading = false;
        state.selectedWorkflowError = action.payload || action.error.message;
        state.selectedWorkflow = null;
      })
      .addCase(deleteWorkflow.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteWorkflow.fulfilled, (state, action) => {
        state.loading = false;
        state.userWorkflows = state.userWorkflows.filter(
          (wf) => wf.workflowId !== action.payload.workflowId
        );
      })
      .addCase(deleteWorkflow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const {
  setCurrentWorkflow,
  clearRunResults,
  addWorkflow,
  clearSelectedWorkflow,
  setSelectedWorkflow,
  resetWorkflows,
} = workflowSlice.actions;
export default workflowSlice.reducer;
