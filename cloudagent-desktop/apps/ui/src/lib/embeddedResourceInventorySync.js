export const getResourceInventorySignature = (resources = []) =>
  JSON.stringify(Array.isArray(resources) ? resources : []);

export const getEmbeddedResourceInventorySyncAction = ({
  previous,
  workloadKey,
  externalSignature,
  localSignature,
}) => {
  const current = {
    workloadKey: workloadKey || 'embedded',
    externalSignature: externalSignature || '[]',
    localSignature: localSignature || '[]',
  };

  if (!previous) {
    return { direction: 'none', next: current };
  }

  const workloadChanged = previous.workloadKey !== current.workloadKey;
  const externalChanged =
    workloadChanged || previous.externalSignature !== current.externalSignature;

  if (externalChanged) {
    return {
      direction: current.externalSignature === current.localSignature
        ? 'none'
        : 'external-to-local',
      next: {
        ...current,
        localSignature: current.externalSignature,
      },
    };
  }

  if (previous.localSignature !== current.localSignature) {
    return {
      direction: current.externalSignature === current.localSignature
        ? 'none'
        : 'local-to-external',
      next: {
        ...current,
        externalSignature: current.localSignature,
      },
    };
  }

  return { direction: 'none', next: current };
};
