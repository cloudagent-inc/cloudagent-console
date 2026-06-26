export const queryGetUserInfo = `query getUserInfo($hasTeams: Boolean) {
    getUserInfo{
      userId
      email
      name
      groupName
      mcpToken
      allowOverages
      settings
      subscription { maxStacks maxParameters maxEnvironments tier status maxScans maxAccounts renewalDate startDate accountsOngoing accountsOneTime accountsFreeTrial listAccountsFreeTrial listAccountsOngoing listAccountsOneTime marketplaceCustomerId enableComplianceReports enableRemediationTemplates enableAssessmentDetails enableWellArchitected enableSubscriptionDetails enableAccountManagement enableCustomReportMgmt enableConfigurationModules enableLaunchAssessments enableAwsSupport enableAzureSupport enableGcpSupport stripe_customerId stripe_subscriptionId }
      active
      reportHistory { userId scanId cloudProvider reportId title createdAt updatedAt latestAssessmentDate status scanDataUrls assessmentResultsUrl targetDetails summary creditsUsed creditUnitsUsed creditsUpdatedAt creditSource creditResourceType creditResourceId lastCreditTransactionId }
      firstSignIn
      apiKeys { apiKey }
      agentHistory(hasTeams: $hasTeams) { userId recordId itemId agentType status purchaseDate log parentId scanId authProfile creditsUsed creditUnitsUsed creditsUpdatedAt creditSource creditResourceType creditResourceId lastCreditTransactionId } 
      workflowHistory(hasTeams: $hasTeams) { userId workflowRunId executionHistory workflowDefinition workflowStatus updatedAt creditsUsed creditUnitsUsed creditsUpdatedAt creditSource creditResourceType creditResourceId lastCreditTransactionId} 
      workFlowDefs(hasTeams: $hasTeams) { userId title description nodes workflowId schedule } 
      agentCredits
      workloads(hasTeams: $hasTeams) { workloadId workloadName description environments deploymentPreferences securityRules trackedResources diagram summary}
    }
  }`;

export const queryGetPermissionProfilesList = `query getPermissionProfilesList($count: Int, $nextToken: String, $hasTeams: Boolean) {
  getPermissionProfilesList(count: $count, nextToken: $nextToken, hasTeams: $hasTeams) {
    items {
      userId
      recordId
      name
      type
      description
      authProfile
      deploymentPreferences
      securityRules
      summary
    }
    nextToken
  }
}`;

export const queryGetStoredAnalysisArtifactAccess = `query getStoredAnalysisArtifactAccess(
  $reportType: String!
  $permissionProfileId: ID
  $workloadId: ID
  $targetType: String
) {
  getStoredAnalysisArtifactAccess(
    reportType: $reportType
    permissionProfileId: $permissionProfileId
    workloadId: $workloadId
    targetType: $targetType
  ) {
    ok
    pending
    reportType
    targetType
    targetId
    generatedAt
    fileName
    bucket
    objectKey
    expiresAt
    downloadUrl
  }
}`;

export const recordAgentConnectionMutation = `
  mutation recordAgentConnection(
    $itemId: String!,
    $agentType: String!,
    $status: String!
    $parentId: AWSJSON,
    $authProfile: AWSJSON,
    $log: String,
    $title: String,
  ) {
    recordAgentConnection(
      itemId: $itemId,
      agentType: $agentType,
      status: $status
      parentId: $parentId
      authProfile: $authProfile
      log: $log
      title: $title
    ) {
      userId
      recordId
      itemId
      agentType
      status
      purchaseDate
      parentId
      authProfile
      log
      title
    }
  }
`;

export const updateAgentConnectionMutation = `
  mutation updateAgentConnection(
    $recordId: ID!,
    $status: String,
    $log: String,
    $scanId: String,
    $authProfile: AWSJSON,
  ) {
    updateAgentConnection(
      recordId: $recordId,
      status: $status,
      log: $log,
      scanId: $scanId,
      authProfile: $authProfile,
    ) {
      userId
      recordId
      itemId
      agentType
      status
      purchaseDate
      parentId
      log
      scanId
      authProfile
      title
    }
  }
`;

export const updateAgentConnectionWithoutAuthProfileMutation = `
  mutation updateAgentConnection(
    $recordId: ID!,
    $status: String,
    $log: String,
    $scanId: String,
  ) {
    updateAgentConnection(
      recordId: $recordId,
      status: $status,
      log: $log,
      scanId: $scanId,
    ) {
      userId
      recordId
      itemId
      agentType
      status
      purchaseDate
      parentId
      log
      scanId
      authProfile
      title
    }
  }
`;

export const cancelAgentConnectionMutation = `
  mutation cancelAgentConnection(
    $recordId: ID!,
    $log: String,
  ) {
    cancelAgentConnection(
      recordId: $recordId,
      log: $log,
    ) {
      userId
      recordId
      itemId
      agentType
      status
      purchaseDate
      parentId
      log
      scanId
      authProfile
      title
      updatedAt
    }
  }
`;

export const queryGetAgentConnection = `
  query getAgentConnection(
    $recordId: ID!,
    $hasTeams: Boolean,
  ) {
    getAgentConnection(
      recordId: $recordId,
      hasTeams: $hasTeams,
    ) {
      userId
      recordId
      itemId
      agentType
      status
      purchaseDate
      parentId
      log
      scanId
      authProfile
      title
    }
  }
`;

export const purchaseCreditsMutation = `
  mutation purchaseCredits($credits: Int!) {
    purchaseCredits(credits: $credits) {
      agentCredits
    }
  }
`;

export const updateUserCreditsMutation = `
  mutation updateUserCredits(
    $monthlyBaseCredits: Int, 
    $adhocCredits: Int
  ) {
    updateUserCredits(
      monthlyBaseCredits: $monthlyBaseCredits,
      adhocCredits: $adhocCredits
    ) {
      agentCredits
    }
  }
`;

export const createAgentPermissionProfileMutation = `
  mutation createAgentPermissionProfile(
    $name: String!
    $type: String!
    $description: String!
    $authProfile: AWSJSON
    $deploymentPreferences: AWSJSON
    $securityRules: AWSJSON
  ) {
    createAgentPermissionProfile(
      name: $name
      type: $type
      description: $description
      authProfile: $authProfile
      deploymentPreferences: $deploymentPreferences
      securityRules: $securityRules
    ) {
      recordId
      userId
      name
      type
      description
      authProfile
      deploymentPreferences
      securityRules
      summary 
    }
  }
`;

export const updateAgentPermissionProfileMutation = `
mutation updateAgentPermissionProfile(
  $recordId: ID!
  $name: String
  $type: String
  $description: String
  $authProfile: AWSJSON
  $deploymentPreferences: AWSJSON
  $securityRules: AWSJSON
) {
  updateAgentPermissionProfile(
    recordId: $recordId
    name: $name
    type: $type
    description: $description
    authProfile: $authProfile
    deploymentPreferences: $deploymentPreferences
    securityRules: $securityRules
  ) {
    userId
    recordId
    name
    type
    description
    authProfile
    deploymentPreferences
    securityRules
    summary 
  }
}
`;

export const deleteAgentPermissionProfileMutation = `
  mutation deleteAgentPermissionProfile($recordId: ID!) {
    deleteAgentPermissionProfile(recordId: $recordId) {
      userId
      recordId
      name
      type
      description
    }
  }
`;

export const updateAvailableCreditsMutation = `mutation updateAvailableCredits ($credits: Int!) {
    updateAvailableCredits( credits: $credits ){
    userId
    subscription {
      availableCredits
    }
  }
}`;

export const onUpdateReportHistoryStatus = `
subscription onUpdateReportHistoryStatus($userId: String!) {
  onUpdateReportHistoryStatus(userId: $userId) {
    status
    scanId
  }
}
`;

export const onUpdateReportHistoryAssessmentResults = `
subscription onUpdateReportHistoryAssessmentResults($userId: String!) {
  onUpdateReportHistoryAssessmentResults(userId: $userId) {
    scanId
    status
    assessmentResultsUrl
  }
}
`;

export const queryGetLatestAssessmentResultWithUser = `query __getLatestAssessmentResult($groupId: String, $scanId: String!, $userId: String!, $accountId: String) {
  __getLatestAssessmentResult(groupId: $groupId, scanId: $scanId, userId: $userId, accountId: $accountId)
}`;

export const queryGetLatestReportHistoryAssessmentResult = `query __getLatestReportHistoryAssessmentResult($scanId: String!, $userId: String!) {
  __getLatestReportHistoryAssessmentResult(scanId: $scanId, userId: $userId)
}`;

export const createWorkflowMutation = `
  mutation createWorkflow(
    $nodes: String!,
    
    $title: String,
    $description: String,
    $schedule: AWSJSON
  ) {
    createWorkflow(
      nodes: $nodes,
      title: $title,
      description: $description,
      schedule: $schedule
    ) {
      workflowId
      userId
      title
      description
      nodes
      schedule
    }
  }
`;

export const updateWorkflowMutation = `
  mutation updateWorkflow(
    $workflowId: String!,
    $nodes: String,
    $title: String,
    $description: String,
    $schedule: AWSJSON
  ) {
    updateWorkflow(
      workflowId: $workflowId,
      nodes: $nodes,
      title: $title,
      description: $description,
      schedule: $schedule
    ) {
      workflowId
      userId
      title
      description
      nodes
      schedule
    }
  }
`;

export const queryGetWorkFlows = `query getWorkFlows(
  $count: Int, 
  $nextToken: String, 
  $sortBy: String, 
  $sortOrder: String, 
  $startDate: String, 
  $endDate: String,
  $hasTeams: Boolean
) {
  getWorkFlows(
    count: $count, 
    nextToken: $nextToken, 
    sortBy: $sortBy, 
    sortOrder: $sortOrder, 
    startDate: $startDate, 
    endDate: $endDate,
    hasTeams: $hasTeams
  ) {
    items {
      workflowRunId
      userId
      executionHistory
      workflowDefinition
      workflowStatus
      updatedAt
      currentExecutions
    }
    nextToken
  }
}`;

export const queryGetAgentHistory = `query getAgentHistory($count: Int, $nextToken: String, $sortBy: String, $sortOrder: String, $agentType: String, $startDate: String, $endDate: String, $hasTeams: Boolean) {
  getAgentHistory(count: $count, nextToken: $nextToken, sortBy: $sortBy, sortOrder: $sortOrder, agentType: $agentType, startDate: $startDate, endDate: $endDate, hasTeams: $hasTeams) {
    items {
      recordId
      userId
      itemId
      agentType
      purchaseDate
      log
      parentId
      packageId
      scanId
      authProfile
      status
      updatedAt
      title
      creditsUsed
      creditUnitsUsed
      creditsUpdatedAt
      creditSource
      creditResourceType
      creditResourceId
      lastCreditTransactionId
    }
    nextToken
  }
}`;

export const queryGetAgentCount = `query getAgentCount {
  getAgentCount {
    totalCount
  }
}`;

export const queryGetWorkflow = `query getWorkflow($workflowRunId: String!, $hasTeams: Boolean) {
  getWorkflow(workflowRunId: $workflowRunId, hasTeams: $hasTeams) {
    workflowRunId
    userId
    executionHistory
    workflowDefinition
    workflowStatus
    updatedAt
    currentExecutions
    creditsUsed
    creditUnitsUsed
    creditsUpdatedAt
    creditSource
    creditResourceType
    creditResourceId
    lastCreditTransactionId
  }
}`;

export const queryGetOverviewData = `query getUserInfo($hasTeams: Boolean) {
  getUserInfo{
    userId
    settings
    agentHistory(hasTeams: $hasTeams) { 
      userId 
      recordId 
      itemId 
      agentType 
      status 
      purchaseDate 
      log 
      parentId 
      scanId 
      creditsUsed
      creditUnitsUsed
      creditsUpdatedAt
      creditSource
      creditResourceType
      creditResourceId
      lastCreditTransactionId
    } 
    reportHistory { userId scanId cloudProvider reportId title createdAt updatedAt latestAssessmentDate status scanDataUrls assessmentResultsUrl targetDetails summary creditsUsed creditUnitsUsed creditsUpdatedAt creditSource creditResourceType creditResourceId lastCreditTransactionId }
    workflowHistory(hasTeams: $hasTeams) { 
      userId 
      workflowRunId 
      executionHistory 
      workflowDefinition 
      workflowStatus 
      updatedAt
      creditsUsed
      creditUnitsUsed
      creditsUpdatedAt
      creditSource
      creditResourceType
      creditResourceId
      lastCreditTransactionId
    } 
    workFlowDefs(hasTeams: $hasTeams) { 
      userId 
      title 
      description 
      nodes 
      workflowId 
      schedule
    }
  }
}`;

export const deleteWorkflowMutation = `
  mutation deleteWorkflow(
    $workflowId: String!
  ) {
    deleteWorkflow(
      workflowId: $workflowId
    ) {
      workflowId
      userId
      title
      description
      nodes
    }
  }
`;

export const createBlueprintMutation = `
  mutation createBlueprint(
    $title: String!
    $description: [String]
    $credits: Int
    $plan: AWSJSON
    $requiredPermissions: AWSJSON
    $planSettings: AWSJSON
    $cloudProvider: String
  ) {
    createBlueprint(
      title: $title
      description: $description
      credits: $credits
      plan: $plan
      requiredPermissions: $requiredPermissions
      planSettings: $planSettings
      cloudProvider: $cloudProvider
    ) {
      recordId
      userId
      title
      description
      credits
      cloudProvider
      plan
      requiredPermissions
      planSettings
    }
  }
`;

export const getBlueprintsQuery = `
  query getBlueprints($count: Int, $nextToken: String, $hasTeams: Boolean) {
    getBlueprints(count: $count, nextToken: $nextToken, hasTeams: $hasTeams) {
      items {
        recordId
        title
        description
        credits
        cloudProvider
        plan
        requiredPermissions
        planSettings
        userId
        status
        updatedAt
      }
      nextToken
    }
  }
`;

export const deleteBlueprintMutation = `
  mutation deleteBlueprint($recordId: String!) {
    deleteBlueprint(recordId: $recordId) {
      userId
    }
  }
`;

export const getBlueprintQuery = `
  query getBlueprint($recordId: String!, $hasTeams: Boolean) {
    getBlueprint(recordId: $recordId, hasTeams: $hasTeams) {
        recordId
        title
        description
      credits
      cloudProvider
      plan
        requiredPermissions
        planSettings
        userId
        status
        updatedAt
    }
  }
`;

// Workload Definition Mutations
export const createWorkloadDefinitionMutation = `
  mutation createWorkloadDefinition($input: CreateWorkloadDefinitionInput!) {
    createWorkloadDefinition(input: $input) {
      workloadId
      workloadName
      description
      environments
      deploymentPreferences
      securityRules
      trackedResources
      
    }
  }
`;

export const updateWorkloadDefinitionMutation = `
  mutation updateWorkloadDefinition($input: UpdateWorkloadDefinitionInput!) {
    updateWorkloadDefinition(input: $input) {
      workloadId
      workloadName
      description
      environments
      deploymentPreferences
      securityRules
      trackedResources
      
    }
  }
`;

export const deleteWorkloadDefinitionMutation = `
  mutation deleteWorkloadDefinition($workloadId: ID!) {
    deleteWorkloadDefinition(workloadId: $workloadId)
  }
`;

export const updateUserAgentMutation = `
  mutation updateUserAgent($userId: ID!, $allowOverages: Boolean, $mcpToken: String) {
    updateUserAgent(userId: $userId, allowOverages: $allowOverages, mcpToken: $mcpToken) {
      userId
      allowOverages
      mcpToken
    }
  }
`;

export const updateUserSettingsMutation = `
  mutation updateUserSettings($settings: AWSJSON!) {
    updateUserSettings(settings: $settings) {
      userId
      settings
    }
  }
`;

// Chat: Queries & Mutations
export const queryGetChatRecord = `
  query getChatRecord($recordId: ID!) {
    getChatRecord(recordId: $recordId) {
      recordId
      sessionId
      title
      messages { role content createdAt }
      metadata
      createdAt
      updatedAt
    }
  }
`;

export const queryListChatRecordsByUpdatedAt = `
  query listChatRecordsByUpdatedAt($limit: Int) {
    listChatRecordsByUpdatedAt(limit: $limit) {
      recordId
      sessionId
      title
      messages { role content createdAt }
      metadata
      createdAt
      updatedAt
    }
  }
`;

export const upsertChatRecordMutation = `
  mutation upsertChatRecord(
    $recordId: ID,
    $sessionId: String!,
    $title: String,
    $metadata: AWSJSON
  ) {
    upsertChatRecord(
      recordId: $recordId,
      sessionId: $sessionId,
      title: $title,
      metadata: $metadata
    ) {
      recordId
      sessionId
      title
      messages { role content createdAt }
      metadata
      createdAt
      updatedAt
    }
  }
`;

export const appendChatMessagesMutation = `
  mutation appendChatMessages(
    $recordId: ID!,
    $messages: [ChatMessageEntryInput!]!,
    $metadata: AWSJSON
  ) {
    appendChatMessages(
      recordId: $recordId,
      messages: $messages,
      metadata: $metadata
    ) {
      recordId
      sessionId
      title
      messages { role content createdAt }
      metadata
      createdAt
      updatedAt
    }
  }
`;

// Recommendations Queries
export const queryGetRecommendations = `query getRecommendations($count: Int, $nextToken: String) {
  getRecommendations(count: $count, nextToken: $nextToken) {
    items {
      userId
      recordKey
      itemType
      recommendationId
      title
      dedupeKey
      status
      statusReason
      recommendedAction
      targetResources
      source
      action
      priority
      createdAt
      updatedAt
      metadata
    }
    nextToken
  }
}`;

export const queryGetExceptions = `query getExceptions($count: Int, $nextToken: String) {
  getExceptions(count: $count, nextToken: $nextToken) {
    items {
      userId
      recordKey
      itemType
      exceptionId
      recommendationId
      recommendationTitle
      scope
      reason
      notes
      expiresAt
      status
      createdAt
      createdBy
    }
    nextToken
  }
}`;

export const queryGetRecommendationsHistory = `query getRecommendationsHistory($count: Int, $nextToken: String) {
  getRecommendationsHistory(count: $count, nextToken: $nextToken) {
    items {
      userId
      recordKey
      itemType
      historyId
      status
      input
      output
      createdAt
      updatedAt
    }
    nextToken
  }
}`;

export const queryGetReportHistoryList = `query getReportHistoryList($count: Int, $nextToken: String) {
  getReportHistoryList(count: $count, nextToken: $nextToken) {
    items {
      userId
      scanId
      cloudProvider
      reportId
      title
      createdAt
      updatedAt
      latestAssessmentDate
      status
      scanDataUrls
      assessmentResultsUrl
      targetDetails
      summary
      creditsUsed
      creditUnitsUsed
      creditsUpdatedAt
      creditSource
      creditResourceType
      creditResourceId
      lastCreditTransactionId
    }
    nextToken
  }
}`;

// Recommendations Mutations
export const mutationUpdateRecommendationHistory = `mutation updateRecommendationHistory(
  $historyId: String!
  $recordKey: String
  $updates: AWSJSON!
) {
  updateRecommendationHistory(
    historyId: $historyId
    recordKey: $recordKey
    updates: $updates
  ) {
    userId
    recordKey
    itemType
    historyId
    status
    input
    output
    createdAt
    updatedAt
  }
}`;

export const mutationUpdateRecommendation = `mutation updateRecommendation(
  $recommendationId: String!
  $recordKey: String
  $updates: AWSJSON!
) {
  updateRecommendation(
    recommendationId: $recommendationId
    recordKey: $recordKey
    updates: $updates
  ) {
    userId
    recordKey
    itemType
    recommendationId
    title
    status
    targetResources
    updatedAt
  }
}`;

export const mutationCreateException = `mutation createException(
  $recommendationId: String!
  $recommendationTitle: String!
  $scope: AWSJSON!
  $reason: String
  $notes: String
  $expiresAt: AWSDateTime
) {
  createException(
    recommendationId: $recommendationId
    recommendationTitle: $recommendationTitle
    scope: $scope
    reason: $reason
    notes: $notes
    expiresAt: $expiresAt
  ) {
    userId
    recordKey
    itemType
    exceptionId
    recommendationId
    recommendationTitle
    scope
    reason
    notes
    expiresAt
    status
    createdAt
    createdBy
  }
}`;

export const mutationUpdateException = `mutation updateException(
  $exceptionId: String!
  $recordKey: String
  $updates: AWSJSON!
) {
  updateException(
    exceptionId: $exceptionId
    recordKey: $recordKey
    updates: $updates
  ) {
    userId
    recordKey
    itemType
    exceptionId
    recommendationId
    recommendationTitle
    scope
    reason
    notes
    expiresAt
    status
    updatedAt
  }
}`;

export const mutationDeleteException = `mutation deleteException($exceptionId: String!, $recordKey: String) {
  deleteException(exceptionId: $exceptionId, recordKey: $recordKey)
}`;

// Recommendations Subscriptions
export const subscriptionOnUpdateRecommendationsHistory = `subscription onUpdateRecommendationsHistory($userId: String!) {
  onUpdateRecommendationsHistory(userId: $userId) {
    userId
    recordKey
    itemType
    historyId
    status
    input
    output
    createdAt
    updatedAt
  }
}`;
