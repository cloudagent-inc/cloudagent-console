import { expandAccountScans } from '@/helpers/accountScans';

const THREE_MONTHS_MS = 1000 * 60 * 60 * 24 * 90;
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

const safeParseJson = (value) => {
  if (value == null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  const couldBeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));

  if (!couldBeJson) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const toArray = (value) => {
  if (value == null) {
    return [];
  }

  const parsed = safeParseJson(value);

  if (Array.isArray(parsed)) {
    return parsed.slice();
  }

  if (parsed == null) {
    return [];
  }

  if (typeof parsed === 'object') {
    if (Array.isArray(parsed.active)) {
      return parsed.active.slice();
    }

    if (Array.isArray(parsed.resources)) {
      return parsed.resources.slice();
    }

    const nestedArrays = Object.values(parsed).filter(Array.isArray);
    if (nestedArrays.length) {
      return nestedArrays.flat();
    }

    return [{ ...parsed }];
  }

  if (typeof parsed === 'string' && parsed.length > 0) {
    return [parsed];
  }

  return [parsed];
};

const extractRuleId = (recommendation) => {
  if (!recommendation || typeof recommendation !== 'object') {
    return null;
  }

  if (typeof recommendation.ruleId === 'string') {
    return recommendation.ruleId;
  }

  const metadata = safeParseJson(recommendation.metadata);
  if (metadata && typeof metadata === 'object') {
    if (typeof metadata.ruleId === 'string') {
      return metadata.ruleId;
    }
    if (typeof metadata.localRuleId === 'string') {
      return metadata.localRuleId;
    }
  }

  const source = safeParseJson(recommendation.source);
  const sourceArray = Array.isArray(source) ? source : [source];

  for (const entry of sourceArray) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof entry.ruleId === 'string'
    ) {
      return entry.ruleId;
    }
  }

  return null;
};

const normalizeAgentHistory = (userProfile) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return [];
  }

  return toArray(userProfile.agentHistory)
    .map((record) => {
      if (!record) {
        return null;
      }

      if (typeof record === 'string') {
        const parsed = safeParseJson(record);
        if (parsed && typeof parsed === 'object') {
          return { ...parsed };
        }
        return null;
      }

      if (typeof record === 'object') {
        return { ...record };
      }

      return null;
    })
    .filter(Boolean);
};

const normalizePermissionProfiles = (userProfile) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return [];
  }

  return toArray(userProfile.agentPermissionProfiles)
    .map((profile) => {
      if (!profile) {
        return null;
      }

      if (typeof profile === 'string') {
        const parsed = safeParseJson(profile);
        if (parsed && typeof parsed === 'object') {
          return { ...parsed };
        }
        return null;
      }

      if (typeof profile === 'object') {
        return { ...profile };
      }

      return null;
    })
    .filter(Boolean);
};

const normalizeAccountScans = (userProfile) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return [];
  }

  return expandAccountScans(
    toArray(userProfile.reportHistory)
    .map((scan) => {
      if (!scan) {
        return null;
      }

      if (typeof scan === 'string') {
        const parsed = safeParseJson(scan);
        if (parsed && typeof parsed === 'object') {
          return { ...parsed };
        }
        return null;
      }

      if (typeof scan === 'object') {
        return { ...scan };
      }

      return null;
    })
    .filter(Boolean)
  );
};

export {
  THREE_MONTHS_MS,
  THIRTY_DAYS_MS,
  safeParseJson,
  toArray,
  extractRuleId,
  normalizeAgentHistory,
  normalizePermissionProfiles,
  normalizeAccountScans,
};
