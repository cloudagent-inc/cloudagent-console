export const AGENT_LIST_URL =
  'https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/agent_list.json';

const addCacheBuster = (url) => {
  const latestUrl = new URL(url);
  latestUrl.searchParams.set('_', `${Date.now()}`);
  return latestUrl.toString();
};

export const fetchAgentList = (options = {}) =>
  fetch(addCacheBuster(AGENT_LIST_URL), {
    ...options,
    cache: 'no-store',
  });
