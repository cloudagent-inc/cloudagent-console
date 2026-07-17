import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDashboardSkillTab,
  shouldDefaultToBrowseLibrary,
} from '../src/lib/skillLibraryNavigation.js';

test('skill library routes select the expected tab', () => {
  assert.equal(getDashboardSkillTab('/dashboard/skills'), 'skills');
  assert.equal(getDashboardSkillTab('/dashboard/skills/library'), 'library');
});

test('an initially empty custom skill list defaults to Browse Library', () => {
  assert.equal(shouldDefaultToBrowseLibrary({
    requestedDefault: true,
    customSkillsLoaded: true,
    userSkills: [],
  }), true);

  assert.equal(shouldDefaultToBrowseLibrary({
    requestedDefault: true,
    customSkillsLoaded: true,
    userSkills: [{ recordId: 'skill-1' }],
  }), false);

  assert.equal(shouldDefaultToBrowseLibrary({
    requestedDefault: false,
    customSkillsLoaded: true,
    userSkills: [],
  }), false);
});
