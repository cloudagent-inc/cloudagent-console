export const getAnalyticsRoute = () => (
  typeof window !== 'undefined' ? window.location.pathname : ''
);

/**
 * Analytics hook for tracking user events and identification
 * Desktop builds do not include hosted product analytics.
 */
export const useAnalytics = () => {
  return {
    identifyUser: () => {},
    resetUser: () => {},
    trackEvent: () => {},
    trackPageView: () => {},
    usermaven: null,
  };
};

// Export singleton instance for use outside React components
export const analytics = {
  identify: () => {},
  reset: () => {},
  track: () => {},
  pageview: () => {},
};

// Pre-defined event names for consistency
export const ANALYTICS_EVENTS = {
  // Authentication
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',

  // Cloud Environment
  CLOUD_ENVIRONMENT_CONNECTED: 'cloud_environment_connected',

  // Workloads
  WORKLOAD_DISCOVERY_STARTED: 'workload_discovery_started',
  WORKLOAD_ADDED: 'workload_added',

  // Reports
  REPORT_RUN: 'report_run',

  // Blueprints
  CUSTOM_BLUEPRINT_CREATED: 'custom_blueprint_created',

  // Agents
  AGENT_RUN: 'agent_run',

  // Workflows
  WORKFLOW_CREATED: 'workflow_created',

  // Onboarding Survey
  ONBOARDING_SURVEY_COMPLETED: 'onboarding_survey_completed',

  // Command Center
  COMMAND_CENTER_MESSAGE_SENT: 'command_center_message_sent',
  COMMAND_CENTER_SUMMARY_CARD_CLICKED: 'command_center_summary_card_clicked',
  COMMAND_CENTER_SUGGESTION_CARD_CLICKED: 'command_center_suggestion_card_clicked',

  // Recommendations
  RECOMMENDATION_CLICKED: 'recommendation_clicked',

  // Marketing Videos
  MARKETING_VIDEO_INTERACTED: 'marketing_video_interacted',

  // Cloud Setup
  CLOUD_SETUP_PROVIDER_MODAL_OPENED: 'cloud_setup_provider_modal_opened',
  CLOUD_SETUP_PROVIDER_SELECTED: 'cloud_setup_provider_selected',
  CLOUD_SETUP_WIZARD_OPENED: 'cloud_setup_wizard_opened',
  CLOUD_SETUP_WIZARD_CLOSED: 'cloud_setup_wizard_closed',

  // Friction
  ERR_SIGN_UP: 'err_sign_up',
  ERR_SIGN_IN: 'err_sign_in',
  ERR_ENVIRONMENT_CONNECTION_FAILED: 'err_environment_connection_failed',
  ERR_PERMISSION_VALIDATION_FAILED: 'err_permission_validation_failed',
  ERR_REPORT_FAILED: 'err_report_failed',
  ERR_COMMAND_CENTER_OPENED_BUT_NO_MESSAGE: 'err_command_center_opened_but_no_message',
};

export default useAnalytics;




