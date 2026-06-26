import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { workloadsClient } from '@/api/clients/workloadsClient';
import { normalizeWorkloadRecord, normalizeWorkloadsCollection } from './workloadNormalizer';
import { removeSingleWorkloadFromUserProfile } from '@/features/auth/authSlice';

export const createWorkloadDefinition = createAsyncThunk(
    'workload/createWorkloadDefinition',
    async (workloadData, { rejectWithValue, dispatch }) => {
      try {
        const payload = {
          ...workloadData,
          deploymentPreferences: JSON.stringify(workloadData.deploymentPreferences ?? {}),
          securityRules: JSON.stringify(workloadData.securityRules ?? {}),
          trackedResources: JSON.stringify(workloadData.trackedResources ?? {})
        
        };

        const { workload: newWorkload } = normalizeWorkloadRecord(
          await workloadsClient.create(payload),
          { source: 'workload.createWorkloadDefinition' }
        );
        if (!newWorkload?.workloadId) {
          throw new Error('createWorkloadDefinition returned an invalid workload record.');
        }
        
        dispatch(addWorkloadToState(newWorkload));
        return newWorkload;
      } catch (error) {
        console.error('[workloadSlice] Error creating workload:', error);
        console.error('[workloadSlice] Error details:', {
          message: error.message,
          errors: error.errors,
          error: error,
          stack: error.stack,
        });
        return rejectWithValue(error.message);
      }
    }
  );

export const updateWorkloadDefinition = createAsyncThunk(
  'workload/updateWorkloadDefinition',
  async (workloadData, { rejectWithValue, dispatch }) => {
    try {
      // Build a partial update payload - include ONLY fields provided by caller
      const inputData = { };
      // Always require workloadId for update
      if (workloadData.workloadId) inputData.workloadId = workloadData.workloadId;
      if (workloadData.workloadName !== undefined) inputData.workloadName = workloadData.workloadName;
      if (workloadData.description !== undefined) inputData.description = workloadData.description;
      if (workloadData.environments !== undefined) inputData.environments = workloadData.environments;
      if (workloadData.deploymentPreferences !== undefined) {
        inputData.deploymentPreferences = JSON.stringify(workloadData.deploymentPreferences ?? {});
      }
      if (workloadData.securityRules !== undefined) {
        inputData.securityRules = JSON.stringify(workloadData.securityRules ?? {});
      }
      if (workloadData.trackedResources !== undefined) {
        inputData.trackedResources = JSON.stringify(workloadData.trackedResources ?? {});
      }
      
      // Debug: log workload update details when trackedResources is part of the update.
      if (inputData.trackedResources !== undefined) {
        try {
          const tracked = workloadData.trackedResources || {};
          const resourcesCount = Array.isArray(tracked.resources) ? tracked.resources.length : 0;
          const stacksCount = Array.isArray(tracked.stacks) ? tracked.stacks.length : 0;
          console.info('[workloadSlice.updateWorkloadDefinition] workloadsClient.update', {
            operation: 'updateWorkloadDefinition',
            workloadId: inputData.workloadId,
            trackedResources: {
              resourcesCount,
              stacksCount,
              jsonLength: inputData.trackedResources.length,
            },
          });
        } catch (_) {
          // ignore logging failures
        }
      }

      const { workload: updatedWorkload } = normalizeWorkloadRecord(
        await workloadsClient.update(inputData),
        { source: 'workload.updateWorkloadDefinition' }
      );
      if (!updatedWorkload?.workloadId) {
        throw new Error('updateWorkloadDefinition returned an invalid workload record.');
      }
      // Update workload in local state
      dispatch(updateWorkloadInState(updatedWorkload));

      return updatedWorkload;
    } catch (error) {
      console.error('[workloadSlice.updateWorkloadDefinition] Error updating workload:', error);
      console.error('[workloadSlice.updateWorkloadDefinition] Error details:', {
        message: error.message,
        errors: error.errors,
        error,
        stack: error.stack,
      });
      return rejectWithValue(error.message);
    }
  }
);

export const deleteWorkloadDefinition = createAsyncThunk(
  'workload/deleteWorkloadDefinition',
  async ({ workloadId }, { rejectWithValue, dispatch }) => {
    try {
      const deletedWorkload = await workloadsClient.delete(workloadId);
      if (deletedWorkload) {
        dispatch(removeSingleWorkloadFromUserProfile(workloadId));
      }
      // Return the workloadId so we can remove it from state in the reducer
      return { workloadId, success: deletedWorkload };
    } catch (error) {
      console.error('Error deleting workload definition:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const loadWorkloadsFromUserProfile = createAsyncThunk(
  'workload/loadWorkloadsFromUserProfile',
  async (workloads, { dispatch }) => {
    try {
      if (workloads && Array.isArray(workloads)) {
        const normalizedWorkloads = normalizeWorkloadsCollection(workloads, {
          source: 'workload.loadWorkloadsFromUserProfile',
        });
        // Clear existing workloads and add the ones from user profile
        dispatch(clearWorkloads());
        normalizedWorkloads.forEach(workload => {
          dispatch(addWorkloadToState(workload));
        });
        return normalizedWorkloads;
      }
      
      return workloads || [];
    } catch (error) {
      console.error('Error loading workloads from user profile:', error);
      return [];
    }
  }
);

// Slice: Workload
const workloadSlice = createSlice({
  name: 'workload',
  initialState: {
    loading: false,
    error: null,
    workloads: [],
    createLoading: false,
    updateLoading: false,
    deleteLoading: false,
    currentWorkload: null,
  },
  reducers: {
    setCurrentWorkload: (state, action) => {
      state.currentWorkload = action.payload;
    },
    clearCurrentWorkload: (state) => {
      state.currentWorkload = null;
    },
    addWorkloadToState: (state, action) => {
      const { workload } = normalizeWorkloadRecord(action.payload, {
        source: 'workload.addWorkloadToState',
      });
      if (!workload?.workloadId) return;
      const index = state.workloads.findIndex((entry) => entry.workloadId === workload.workloadId);
      if (index !== -1) {
        state.workloads[index] = {
          ...state.workloads[index],
          ...workload,
        };
        return;
      }
      state.workloads.push(workload);
    },
    updateWorkloadInState: (state, action) => {
      const { workload } = normalizeWorkloadRecord(action.payload, {
        source: 'workload.updateWorkloadInState',
      });
      if (!workload?.workloadId) return;
      const index = state.workloads.findIndex(w => w.workloadId === workload.workloadId);
      if (index !== -1) {
        state.workloads[index] = {
          ...state.workloads[index],
          ...workload,
        };
      } else {
        state.workloads.push(workload);
      }
    },
    updateWorkloadSummary: (state, action) => {
      const { workloadId, summary } = action.payload;
      const index = state.workloads.findIndex(w => w.workloadId === workloadId);
      if (index !== -1) {
        // Store summary as stringified JSON (AWSJSON format)
        state.workloads[index].summary = 
          typeof summary === 'string' ? summary : JSON.stringify(summary);
      }
    },
    removeWorkloadFromState: (state, action) => {
      state.workloads = state.workloads.filter(w => w.workloadId !== action.payload);
    },
    clearWorkloads: (state) => {
      state.workloads = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Workload
      .addCase(createWorkloadDefinition.pending, (state) => {
        state.createLoading = true;
        state.error = null;
      })
      .addCase(createWorkloadDefinition.fulfilled, (state) => {
        state.createLoading = false;
      })
      .addCase(createWorkloadDefinition.rejected, (state, action) => {
        state.createLoading = false;
        state.error = action.payload || action.error.message;
      })
      
      // Update Workload
      .addCase(updateWorkloadDefinition.pending, (state) => {
        state.updateLoading = true;
        state.error = null;
      })
      .addCase(updateWorkloadDefinition.fulfilled, (state) => {
        state.updateLoading = false;
      })
      .addCase(updateWorkloadDefinition.rejected, (state, action) => {
        state.updateLoading = false;
        state.error = action.payload || action.error.message;
      })
      
      // Delete Workload
      .addCase(deleteWorkloadDefinition.pending, (state) => {
        state.deleteLoading = true;
      })
      .addCase(deleteWorkloadDefinition.fulfilled, (state, action) => {
        state.deleteLoading = false;
        state.error = null;
        
        // Remove the workload from state if deletion was successful
        if (action.payload.success) {
          state.workloads = state.workloads.filter(w => w.workloadId !== action.payload.workloadId);
        }
      })
      .addCase(deleteWorkloadDefinition.rejected, (state, action) => {
        state.deleteLoading = false;
        state.error = action.payload;
      })
      
      // Load Workloads from User Profile
      .addCase(loadWorkloadsFromUserProfile.fulfilled, (state, action) => {
        // Workloads are already added to state via the thunk dispatching addWorkloadToState
      });
  },
});

export const {
  setCurrentWorkload,
  clearCurrentWorkload,
  addWorkloadToState,
  updateWorkloadInState,
  updateWorkloadSummary,
  removeWorkloadFromState,
  clearWorkloads,
} = workloadSlice.actions;

export default workloadSlice.reducer; 
