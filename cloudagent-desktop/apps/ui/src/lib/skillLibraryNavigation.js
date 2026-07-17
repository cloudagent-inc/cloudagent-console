export const getDashboardSkillTab = (pathname = '') => {
  if (pathname.includes('/dashboard/skills/library')) return 'library';
  if (pathname.includes('/dashboard/skills')) return 'skills';
  return 'skills';
};

export const shouldDefaultToBrowseLibrary = ({
  requestedDefault = false,
  customSkillsLoaded = false,
  loading = false,
  error = null,
  userSkills = [],
} = {}) =>
  requestedDefault &&
  customSkillsLoaded &&
  !loading &&
  !error &&
  Array.isArray(userSkills) &&
  userSkills.length === 0;
