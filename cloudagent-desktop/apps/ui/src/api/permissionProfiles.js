import { queryGetPermissionProfilesList } from './eventQueries';

export async function fetchAllPermissionProfiles(
  client,
  { pageSize = 100, hasTeams } = {}
) {
  const profiles = [];
  let nextToken = null;

  do {
    const response = await client.graphql({
      query: queryGetPermissionProfilesList,
      variables: {
        count: pageSize,
        nextToken,
        hasTeams,
      },
    });

    const data = response.data?.getPermissionProfilesList;
    if (Array.isArray(data?.items)) {
      profiles.push(...data.items);
    }

    nextToken = data?.nextToken || null;
  } while (nextToken);

  return profiles;
}

export async function fetchAllPermissionProfilesSafe(
  client,
  { pageSize = 100, fallbackProfiles = [], hasTeams } = {}
) {
  try {
    return await fetchAllPermissionProfiles(client, { pageSize, hasTeams });
  } catch (error) {
    console.error(
      '[permissionProfiles.fetchAllPermissionProfilesSafe] Falling back to inline user data:',
      error
    );

    return Array.isArray(fallbackProfiles) ? [...fallbackProfiles] : [];
  }
}
