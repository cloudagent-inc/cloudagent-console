/**
 * Onboarding Intent Configuration
 *
 * Maps user role selection to personalized onboarding paths.
 * Used by OnboardingSurveyModal and OnboardingSection to customize
 * the experience based on the user's role.
 */

// Single localStorage key for all onboarding state
const STORAGE_KEY = 'ca_onboarding';

// Role options for survey step 1
export const ROLE_OPTIONS = [
  {
    value: 'engineer',
    label: 'Engineer / Developer',
    description: 'I build, deploy, and operate cloud applications',
  },
  {
    value: 'executive',
    label: 'Executive',
    description: 'I need visibility across cloud operations',
  },
  {
    value: 'sales',
    label: 'Sales',
    description: 'I help customers understand and adopt cloud solutions',
  },
  {
    value: 'student',
    label: 'Student',
    description: 'I want to learn cloud management',
  },
];

export const TOPIC_OPTIONS = [
  {
    value: 'security_compliance',
    label: 'Security & Compliance',
  },
  {
    value: 'infrastructure_deployment_management',
    label: 'Infrastructure Deployment / Management',
  },
  {
    value: 'cost_optimization',
    label: 'Cost Optimization',
  },
  {
    value: 'workload_documentation',
    label: 'Workload Documentation',
  },
  {
    value: 'sales_enablement',
    label: 'Sales Enablement',
  },
];

export const PLATFORM_OPTIONS = [
  { value: 'aws', label: 'AWS', available: true },
  { value: 'aws_org', label: 'AWS Organizations', available: true },
  { value: 'google_workspace', label: 'Google Workspace', available: true },
  { value: 'gcp', label: 'GCP', available: false },
  { value: 'azure', label: 'Azure', available: false },
  { value: 'entra_id', label: 'Entra ID', available: false },
  { value: 'github', label: 'GitHub', available: false },
  { value: 'gitlab', label: 'GitLab', available: false },
];

// Role-to-onboarding mapping
export const ONBOARDING_INTENT_CONFIG = {
  engineer: {
    welcomeMessage: "Let's automate your cloud operations",
    primaryAction: {
      label: 'Browse Automation Agents',
      path: '/libraries/cost_and_billing',
    },
    highlightedSuggestions: [
      { name: 'Create Workflow', path: '/dashboard/workflow-def' },
      { name: 'Browse Agents', path: '/libraries/cost_and_billing' },
    ],
    taskOrder: ['permission', 'agent', 'workflow', 'report', 'workloads'],
  },
  executive: {
    welcomeMessage: "Let's get you visibility across your cloud operations",
    primaryAction: {
      label: 'View Executive Summary',
      path: '/dashboard/overview',
    },
    highlightedSuggestions: [
      { name: 'Cost Overview', path: '/libraries/cost_and_billing' },
      { name: 'Compliance Status', path: '/libraries/all-reports' },
    ],
    taskOrder: ['permission', 'report', 'workloads', 'agent', 'workflow'],
  },
  sales: {
    welcomeMessage: "Let's show you what CloudAgent can do for your customers",
    primaryAction: {
      label: 'View Executive Summary',
      path: '/dashboard/overview',
    },
    highlightedSuggestions: [
      { name: 'Compliance Reports', path: '/libraries/all-reports' },
      { name: 'Cost Optimization', path: '/libraries/cost_and_billing' },
    ],
    taskOrder: ['permission', 'report', 'workloads', 'agent', 'workflow'],
  },
  student: {
    welcomeMessage: "Welcome! Let's explore cloud management together",
    primaryAction: {
      label: 'Discover Workloads',
      path: '/use-cases/workload-documentation',
    },
    highlightedSuggestions: [
      { name: 'Discover Workloads', path: '/use-cases/workload-documentation' },
      { name: 'Browse Agents', path: '/libraries/cost_and_billing' },
    ],
    taskOrder: ['permission', 'workloads', 'agent', 'report', 'workflow'],
  },
};

/**
 * Read the consolidated onboarding state from localStorage
 */
const getState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Write the consolidated onboarding state to localStorage
 */
const setState = (updates) => {
  try {
    const current = getState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...updates }));
  } catch {
    // localStorage unavailable
  }
};

/**
 * Get stored intent data
 */
export const getStoredIntent = () => {
  const state = getState();
  if (!state.role) return null;
  return {
    role: state.role,
    interests: Array.isArray(state.interests) ? state.interests : [],
    platforms: Array.isArray(state.platforms) ? state.platforms : [],
    isConsultant: Boolean(state.isConsultant),
    feedback: state.feedback || '',
    bookedDemo: Boolean(state.bookedDemo),
  };
};

/**
 * Save intent data
 */
export const saveIntent = ({
  role,
  interests = [],
  platforms = [],
  isConsultant = false,
  feedback = '',
  bookedDemo = false,
}) => {
  setState({
    role,
    interests,
    platforms,
    isConsultant,
    feedback: String(feedback || '').trim(),
    bookedDemo,
    completed: true,
    savedAt: new Date().toISOString(),
  });
};

/**
 * Mark survey as skipped
 */
export const markSurveySkipped = () => {
  setState({ skipped: true });
};

const VALID_ROLE_VALUES = new Set(ROLE_OPTIONS.map((r) => r.value));

/**
 * Check if the onboarding survey should be shown.
 * Required: role (must be a current valid option), interests (at least one), platforms (at least one).
 * Optional: feedback text, isConsultant, bookedDemo.
 */
export const shouldShowSurvey = () => {
  const state = getState();

  const hasValidRole = Boolean(state.role) && VALID_ROLE_VALUES.has(state.role);
  const hasInterests = Array.isArray(state.interests) && state.interests.length > 0;
  const hasPlatforms = Array.isArray(state.platforms) && state.platforms.length > 0;

  return !hasValidRole || !hasInterests || !hasPlatforms;
};

/**
 * Get personalized onboarding config based on stored role
 */
export const getPersonalizedConfig = () => {
  const intent = getStoredIntent();
  if (!intent?.role) return null;
  return ONBOARDING_INTENT_CONFIG[intent.role] || null;
};
