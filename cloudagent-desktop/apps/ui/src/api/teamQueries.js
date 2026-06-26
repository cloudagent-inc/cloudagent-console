export const listMyTeamsQuery = `
  query listMyTeams($limit: Int, $nextToken: String) {
    listMyTeams(limit: $limit, nextToken: $nextToken) {
      items {
        teamId
        teamName
        createdBy
        role
        status
        memberCount
        subscriptionId
        stripeSubscriptionId
        subscriptionPlanType
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const listPendingTeamInvitesQuery = `
  query listPendingTeamInvites($limit: Int, $nextToken: String) {
    listPendingTeamInvites(limit: $limit, nextToken: $nextToken) {
      items {
        teamId
        email
        teamName
        role
        status
        invitedBy
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const listTeamMembersQuery = `
  query listTeamMembers($teamId: ID!, $limit: Int, $nextToken: String) {
    listTeamMembers(teamId: $teamId, limit: $limit, nextToken: $nextToken) {
      items {
        teamId
        userId
        email
        role
        status
        invitedBy
        createdAt
        updatedAt
        joinedAt
      }
      nextToken
    }
  }
`;

export const listTeamResourceSharesQuery = `
  query listTeamResourceShares($teamId: ID, $resourceType: String, $limit: Int, $nextToken: String) {
    listTeamResourceShares(teamId: $teamId, resourceType: $resourceType, limit: $limit, nextToken: $nextToken) {
      items {
        teamId
        teamName
        resourceType
        resourceId
        ownerUserId
        permissions
        shareAll
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

export const createTeamMutation = `
  mutation createTeam($teamName: String!) {
    createTeam(teamName: $teamName) {
      teamId
      teamName
      createdBy
      role
      status
      memberCount
      subscriptionId
      stripeSubscriptionId
      subscriptionPlanType
      createdAt
      updatedAt
    }
  }
`;

export const updateTeamMutation = `
  mutation updateTeam($teamId: ID!, $teamName: String) {
    updateTeam(teamId: $teamId, teamName: $teamName) {
      teamId
      teamName
      createdBy
      role
      status
      memberCount
      subscriptionId
      stripeSubscriptionId
      subscriptionPlanType
      createdAt
      updatedAt
    }
  }
`;

export const deleteTeamMutation = `
  mutation deleteTeam($teamId: ID!) {
    deleteTeam(teamId: $teamId) {
      teamId
      teamName
    }
  }
`;

export const inviteTeamMemberMutation = `
  mutation inviteTeamMember($teamId: ID!, $email: String!, $role: String) {
    inviteTeamMember(teamId: $teamId, email: $email, role: $role) {
      teamId
      email
      teamName
      role
      status
      invitedBy
      createdAt
      updatedAt
    }
  }
`;

export const acceptTeamInviteMutation = `
  mutation acceptTeamInvite($teamId: ID!) {
    acceptTeamInvite(teamId: $teamId) {
      teamId
      userId
      email
      role
      status
      invitedBy
      createdAt
      updatedAt
      joinedAt
    }
  }
`;

export const removeTeamMemberMutation = `
  mutation removeTeamMember($teamId: ID!, $username: String!) {
    removeTeamMember(teamId: $teamId, username: $username) {
      teamId
      teamName
      createdBy
      role
      status
      memberCount
      subscriptionId
      stripeSubscriptionId
      subscriptionPlanType
      createdAt
      updatedAt
    }
  }
`;

export const removePendingInviteMutation = `
  mutation removePendingInvite($teamId: ID!, $email: String!) {
    removePendingInvite(teamId: $teamId, email: $email) {
      teamId
      teamName
      createdBy
      role
      status
      memberCount
      subscriptionId
      stripeSubscriptionId
      subscriptionPlanType
      createdAt
      updatedAt
    }
  }
`;

export const updateTeamResourceShareMutation = `
  mutation updateTeamResourceShare($input: TeamResourceShareInput!) {
    updateTeamResourceShare(input: $input) {
      teamId
      teamName
      resourceType
      resourceId
      ownerUserId
      permissions
      shareAll
      createdAt
      updatedAt
    }
  }
`;

export const deleteTeamResourceShareMutation = `
  mutation deleteTeamResourceShare($teamId: ID!, $resourceType: String!, $resourceId: String!) {
    deleteTeamResourceShare(teamId: $teamId, resourceType: $resourceType, resourceId: $resourceId) {
      teamId
      resourceType
      resourceId
      ownerUserId
      permissions
      shareAll
      createdAt
      updatedAt
    }
  }
`;
