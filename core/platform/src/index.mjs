export const CLOUDAGENT_RUNTIME_MODES = Object.freeze({
  CLOUD: 'cloud',
  LOCAL: 'local',
});

export function normalizeRuntimeMode(value) {
  return String(value || '').trim().toLowerCase() === CLOUDAGENT_RUNTIME_MODES.LOCAL
    ? CLOUDAGENT_RUNTIME_MODES.LOCAL
    : CLOUDAGENT_RUNTIME_MODES.CLOUD;
}

