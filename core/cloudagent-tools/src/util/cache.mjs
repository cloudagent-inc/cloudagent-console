const DEFAULT_WORKLOADS_TTL = Number(process.env.WORKLOADS_CACHE_TTL_MS ?? 600_000);
const DEFAULT_ACCOUNTS_TTL = Number(process.env.ACCOUNTS_CACHE_TTL_MS ?? 600_000);

function readFromCache(map, key, ttlMs) {
  if (!map || !map.size) return null;
  const hit = map.get(key);
  if (!hit) return null;
  if (ttlMs !== Number.POSITIVE_INFINITY && Date.now() - hit.ts > ttlMs) {
    map.delete(key);
    return null;
  }
  return hit.items;
}

function writeToCache(map, key, items) {
  map.set(key, { ts: Date.now(), items });
}

function invalidateCache(map, key) {
  if (!map) return;
  if (key) map.delete(key);
  else map.clear();
}

export function createCloudAgentCache({
  workloadsTtlMs = DEFAULT_WORKLOADS_TTL,
  accountsTtlMs = DEFAULT_ACCOUNTS_TTL
} = {}) {
  const memoryCache = {
    workloads: new Map(),
    accounts: new Map()
  };

  const ttls = { workloadsMs: workloadsTtlMs, accountsMs: accountsTtlMs };

  return {
    memoryCache,
    ttls,
    getWorkloads(userId, { ttlMs } = {}) {
      return readFromCache(memoryCache.workloads, userId, ttlMs ?? ttls.workloadsMs);
    },
    getWorkloadsSnapshot(userId) {
      return readFromCache(memoryCache.workloads, userId, Number.POSITIVE_INFINITY);
    },
    setWorkloads(userId, items) {
      writeToCache(memoryCache.workloads, userId, items);
    },
    invalidateWorkloads(userId) {
      invalidateCache(memoryCache.workloads, userId);
    },
    getAccounts(userId, { ttlMs } = {}) {
      return readFromCache(memoryCache.accounts, userId, ttlMs ?? ttls.accountsMs);
    },
    setAccounts(userId, payload) {
      writeToCache(memoryCache.accounts, userId, payload);
    },
    invalidateAccounts(userId) {
      invalidateCache(memoryCache.accounts, userId);
    }
  };
}
