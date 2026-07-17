export function initCFTemplate(description = '') {
  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: description,
    Resources: {},
    Parameters: {},
    Metadata: {},
    Conditions: {},
  };
}

export function getRefParameter(parameterName) {
  return {
    Ref: parameterName.replace(/[^0-9a-zA-Z:]/g, ''), //reference always has to be alphanumeric
  };
}

export function mergeCfTemplates(template1, template2) {
  let combinedTemplates = Object.assign({}, template1);
  if (Object.keys(combinedTemplates).length === 0)
    combinedTemplates = initCFTemplate();

  // Resources section
  Object.keys(template2['Resources']).map((resource) => {
    combinedTemplates['Resources'][resource] = template2['Resources'][resource];
  });

  // Parameters section
  Object.keys(template2['Parameters']).map((resource) => {
    combinedTemplates['Parameters'][resource] =
      template2['Parameters'][resource];
  });

  // Conditions Section
  Object.keys(template2['Conditions']).map((resource) => {
    combinedTemplates['Conditions'][resource] =
      template2['Conditions'][resource];
  });

  // Mappings Section
  if (template2['Mappings']) {
    if (combinedTemplates['Mappings']) {
      Object.keys(template2['Mappings']).map((resource) => {
        combinedTemplates['Mappings'][resource] =
          template2['Mappings'][resource];
      });
    } else {
      combinedTemplates['Mappings'] = Object.assign({}, template2['Mappings']);
    }
  }

  // Metadata section

  // if metadata section is empty, copy it over from the new template
  if (Object.keys(combinedTemplates['Metadata']).length === 0)
    combinedTemplates['Metadata'] = template2['Metadata'];
  else if (Object.keys(template2['Metadata']).length !== 0) {
    if (template2['Metadata']['AWS::CloudFormation::Interface'])
      template2['Metadata']['AWS::CloudFormation::Interface'][
        'ParameterGroups'
      ].map((paramGroup) => {
        if (paramGroup['Label']['default'] === 'Required')
          paramGroup['Parameters'].map((param) => {
            combinedTemplates = cfUpdateMetaDataRequiredParameters(
              combinedTemplates,
              param,
              true
            );
          });
        else if (paramGroup['Label']['default'] === 'Optional')
          paramGroup['Parameters'].map((param) => {
            combinedTemplates = cfUpdateMetaDataRequiredParameters(
              combinedTemplates,
              param,
              false
            );
          });
      });
  }

  return combinedTemplates;
}

export function cfUpdateMetaDataRequiredParameters(
  cfTemplate,
  Parameter,
  isRequired
) {
  let newCfTemplate = Object.assign({}, cfTemplate);

  // init metadata section if not intilialized
  if (Object.keys(newCfTemplate['Metadata']).length === 0) {
    newCfTemplate['Metadata'] = {
      'AWS::CloudFormation::Interface': {
        ParameterGroups: [
          {
            Label: {
              default: 'Required',
            },
            Parameters: [],
          },
          {
            Label: {
              default: 'Optional',
            },
            Parameters: [],
          },
        ],
      },
    };
  }
  let paramGroups =
    newCfTemplate['Metadata']['AWS::CloudFormation::Interface'][
      'ParameterGroups'
    ];
  if (isRequired) {
    paramGroups.map((paramGroup) => {
      if (paramGroup['Label']['default'] === 'Required')
        paramGroup['Parameters'].push(Parameter);
    });
  } else {
    paramGroups.map((paramGroup) => {
      if (paramGroup['Label']['default'] === 'Optional')
        paramGroup['Parameters'].push(Parameter);
    });
  }

  return newCfTemplate;
}
