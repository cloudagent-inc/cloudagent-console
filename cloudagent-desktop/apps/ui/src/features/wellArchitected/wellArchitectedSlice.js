import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

// Slice for Well-Architected workloads (local state only)
const wellArchitectedSlice = createSlice({
  name: 'wellArchitected',
  initialState: {
    workloads: [],
    currentWorkload: null,
    selectedAccountId: null,
    loading: false,
    createLoading: false,
    updateLoading: false,
    error: null,
  },
  reducers: {
    // Create a new workload
    createWellArchitectedWorkload: (state, action) => {
      const workloadData = action.payload;
      const newWorkload = {
        workloadId: workloadData.workloadId || uuidv4(),
        workloadName: workloadData.workloadName,
        environments: workloadData.environments || [],
        deploymentPreferences: JSON.stringify({
          type: 'well-architected',
          lenses: workloadData.lenses || ['wellarchitected'],
          workloadScope: workloadData.workloadScope || 'all',
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.workloads.push(newWorkload);
    },

    // Update an existing workload
    updateWellArchitectedWorkload: (state, action) => {
      const { workloadId, ...updates } = action.payload;
      const index = state.workloads.findIndex((w) => w.workloadId === workloadId);
      if (index !== -1) {
        state.workloads[index] = {
          ...state.workloads[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    // Delete a workload
    deleteWellArchitectedWorkload: (state, action) => {
      const { workloadId } = action.payload;
      state.workloads = state.workloads.filter((w) => w.workloadId !== workloadId);
    },

    // Set current workload
    setCurrentWorkload: (state, action) => {
      state.currentWorkload = action.payload;
    },

    // Clear current workload
    clearCurrentWorkload: (state) => {
      state.currentWorkload = null;
    },

    // Clear all workloads
    clearWorkloads: (state) => {
      state.workloads = [];
      state.currentWorkload = null;
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Set selected account
    setSelectedAccount: (state, action) => {
      state.selectedAccountId = action.payload;
    },
  },
});

export const {
  createWellArchitectedWorkload,
  updateWellArchitectedWorkload,
  deleteWellArchitectedWorkload,
  setCurrentWorkload,
  clearCurrentWorkload,
  clearWorkloads,
  clearError,
  setSelectedAccount,
} = wellArchitectedSlice.actions;

export default wellArchitectedSlice.reducer;
