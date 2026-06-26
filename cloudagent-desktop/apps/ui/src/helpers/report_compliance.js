import get from 'lodash.get';

const formatReportValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatReportValue).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    if ('Key' in value && 'Value' in value) {
      return `${formatReportValue(value.Key)}: ${formatReportValue(value.Value)}`;
    }
    if ('key' in value && 'value' in value) {
      return `${formatReportValue(value.key)}: ${formatReportValue(value.value)}`;
    }
    if ('name' in value) return formatReportValue(value.name);
    if ('id' in value) return formatReportValue(value.id);
    return JSON.stringify(value);
  }
  return String(value);
};

const normalizeReportResource = (resource = {}) => {
  const displayName = formatReportValue(resource.displayName);
  const region = formatReportValue(resource.region);

  if (
    resource?.displayName &&
    typeof resource.displayName === 'object' ||
    resource?.region &&
    typeof resource.region === 'object'
  ) {
    console.warn('[processReport] Flattened non-scalar resource field', {
      originalDisplayName: resource.displayName,
      originalRegion: resource.region,
      displayName,
      region,
      resource,
    });
  }

  return {
    displayName,
    region,
    resourceType: formatReportValue(resource.resourceType),
    accountId: formatReportValue(resource.accountId),
    resourceArn: formatReportValue(resource.resourceArn),
    resourceId: formatReportValue(resource.resourceId),
  };
};

export const processComplianceReport = (assessmentResults, tags) => {
  console.log('XXXXXX assessmentResults', assessmentResults);
  let complianceResults = [];
  for (const service of Object.keys(assessmentResults)) {
    if (assessmentResults[service].type === 'service') {
      const { results } = assessmentResults[service];
      for (const result of results) {
        if (complianceResults.map((r) => r.id).includes(result.id)) continue;
        complianceResults.push(result);
        // let ruleTags = get(result, 'tags', []).concat(get(result, 'compliance', []));
        // if (ruleTags.some((tag) => tags.includes(tag))) {
        //   if (complianceResults.map((r) => r.id).includes(result.id)) continue;
        
        //   complianceResults.push(result);
        // }
      }
    }
  }
  return complianceResults;
};

export const processReport = (assessmentResults, rules) => {
  let results = {};
  let index;

  console.log('assessmentResults', assessmentResults);

  for (const key of Object.keys(rules)) {
    const { service } = rules[key];
    results[key] = {
      resources: [],
      checks: {},
      title: rules[key]['title'],
    };
    const service_results = get(assessmentResults, [service, 'results'], []);

    for (const rule of Object.keys(get(rules, [key, 'rules'], {}))) {
      index = service_results.findIndex((r) => r.id === rule);
      if (index > -1) {
        const passed = get(
          service_results[index],
          ['result', 'passed'],
          []
        ).map((r) => {
          const resource = normalizeReportResource(r);
          if (
            !results[key]['resources']
              .map((r) => `${r.displayName}.${r.region}`)
              .includes(`${resource.displayName}.${resource.region}`)
          )
            results[key]['resources'].push(resource);

          return resource.displayName;
        });
        const failed = get(
          service_results[index],
          ['result', 'failed'],
          []
        ).map((r) => {
          const resource = normalizeReportResource(r);
          if (
            !results[key]['resources']
              .map((r) => `${r.displayName}.${r.region}`)
              .includes(`${resource.displayName}.${resource.region}`)
          )
            results[key]['resources'].push(resource);
          return resource.displayName;
        });

        results[key]['checks'][rules[key]['rules'][rule]] = {
          passed,
          failed,
        };
        // results['ec2']['resources'] = [
        // 	...new Set(results['ec2']['resources'].concat(passed).concat(failed)),
        // ];
      }
    }
  }

  return results;
};

export const getPriority = (rule, account = '') => {
  const priority_settings = Object.assign({}, rule.n_priority ? rule.n_priority : rule.priority);
  const default_priority =
    'customized_priority' in priority_settings
      ? 'default_priority' in priority_settings['customized_priority']
        ? priority_settings['customized_priority']['default_priority']
        : priority_settings.default_priority
      : priority_settings.default_priority;
  let priority;

  if ('accountType' in priority_settings) {
    if (account in priority_settings['accountType'])
      priority = priority_settings['accountType'][account];
    else priority = default_priority;
  } else priority = default_priority;

  if ('customized_priority' in priority_settings) {
    if ('accountType' in priority_settings['customized_priority'])
      if (account in priority_settings['customized_priority']['accountType'])
        priority =
          priority_settings['customized_priority']['accountType'][account];
  }

  if (priority >= 90) return 'critical';
  else if (priority >= 80) return 'high';
  else if (priority >= 50) return 'medium';
  else if (priority > 0) return 'low';
  else return 'info';
};

export const sortResultsByFailedFirst = (results) => {
  const weight = {
    failed: 1,
    na: 3,
    passed: 2,
    noresults: 4,
  };

  let newResults = results.slice();

  newResults.sort(function (a, b) {
    const weight_a =
      a.failed.length > 0
        ? 'failed'
        : a.notapplicable.length > 0
          ? 'na'
          : a.passed.length > 0
            ? 'passed'
            : 'noresults';

    const weight_b =
      b.failed.length > 0
        ? 'failed'
        : b.notapplicable.length > 0
          ? 'na'
          : b.passed.length > 0
            ? 'passed'
            : 'noresults';
    return weight[weight_a] - weight[weight_b];
  });

  return newResults;
};
