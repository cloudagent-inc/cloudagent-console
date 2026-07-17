import { combineReducers, configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice';
import agentReducer from './features/agent/agentSlice';
import workflowReducer from './features/workflow/workflowSlice';
import skillReducer from './features/skill/skillSlice';
import overviewReducer from './features/overview/overviewSlice';
import workloadReducer from './features/workload/workloadSlice';
import workloadDiscoveryReducer from './features/workload/workloadDiscoverySlice';
import chatReducer from './features/chat/chatSlice';
import commandCenterReducer from './features/commandCenter/commandCenterSlice';
import healthReducer from './features/health/healthSlice';
import costReducer from './features/cost/costSlice';
import threatReducer from './features/threat/threatSlice';
import operationsReducer from './features/operations/operationsSlice';
import workspaceReducer from './features/workspace/workspaceSlice';

const appReducer = combineReducers({
  auth: authReducer,
  agent: agentReducer,
  workflow: workflowReducer,
  overview: overviewReducer,
  skill: skillReducer,
  workload: workloadReducer,
  workloadDiscovery: workloadDiscoveryReducer,
  chat: chatReducer,
  commandCenter: commandCenterReducer,
  health: healthReducer,
  cost: costReducer,
  threat: threatReducer,
  operations: operationsReducer,
  workspace: workspaceReducer,
});

const rootReducer = (state, action) => {
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
});
