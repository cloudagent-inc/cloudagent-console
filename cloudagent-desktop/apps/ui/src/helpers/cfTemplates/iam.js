import { getRefParameter, initCFTemplate } from './baseFunctions';

export function createCfResourceIamRole(
  roleName,
  assumeRoleServices,
  managedPolicies = [],
  inlinePolicies = [],
  description = '',
  externalId = null,
  path = ''
) {
  let cfResource = {
    Type: 'AWS::IAM::Role',
    Properties: {},
  };

  if (roleName?.length > 0) {
    cfResource['Properties']['RoleName'] = roleName;
  }

  if (description.length > 0) {
    cfResource['Properties']['Description'] = description;
  }

  cfResource['Properties'] = {
    ...cfResource['Properties'],
    AssumeRolePolicyDocument: {
      Version: '2012-10-17',
      Statement: [],
    },
  };

  if (managedPolicies.length > 0) {
    cfResource['Properties']['ManagedPolicyArns'] = managedPolicies;
  }

  if (inlinePolicies.length > 0) {
    cfResource['Properties']['Policies'] = inlinePolicies;
  }

  let trustPolicy = {
    Effect: 'Allow',
    Principal: Array.isArray(assumeRoleServices)
      ? { Service: assumeRoleServices }
      : assumeRoleServices,
    Action: ['sts:AssumeRole'],
  };

  if (externalId)
    trustPolicy['Condition'] = {
      StringEquals: {
        'sts:ExternalId': externalId,
      },
    };

  cfResource.Properties.AssumeRolePolicyDocument.Statement.push(trustPolicy);

  if (path) {
    cfResource['Properties']['Path'] = path;
  }

  return cfResource;
}

export function createCfResourceInstanceRole(profileName, roles) {
  let cfResource = {
    Type: 'AWS::IAM::InstanceProfile',
    Properties: {
      InstanceProfileName: profileName,
      Roles: roles,
    },
  };

  return cfResource;
}

export function cfTemplateIamRole(configurationVariables, description = '') {
  let cfTemplate = initCFTemplate(description);

  const randomString =
    'resourceNameSuffix' in configurationVariables
      ? configurationVariables.resourceNameSuffix
      : '';

  const iamRoleResourceName = Object.keys(
    configurationVariables.resourceNames
  ).includes('IamRole')
    ? configurationVariables.resourceNames.IamRole
    : 'IamRole' + randomString;
  const ec2InstanceProfileResourceName = Object.keys(
    configurationVariables.resourceNames
  ).includes('Ec2InstanceProfile')
    ? configurationVariables.resourceNames.Ec2InstanceProfile
    : 'Ec2InstanceProfile' + randomString;

  let exports = {
    [`${iamRoleResourceName}.iam-role.name`]: {
      Ref: iamRoleResourceName,
    },
    [`${iamRoleResourceName}.iam-role.arn`]: {
      'Fn::GetAtt': [iamRoleResourceName, 'Arn'],
    },
    [`${iamRoleResourceName}.iam-role.roleId`]: {
      'Fn::GetAtt': [iamRoleResourceName, 'RoleId'],
    },
  };

  const templateMetadata = {
    resourceName: iamRoleResourceName,
  };

  cfTemplate['Resources'][iamRoleResourceName] = createCfResourceIamRole(
    configurationVariables.roleName,
    configurationVariables.trustPolicy,
    configurationVariables.managedPolicies,
    configurationVariables.inlinePolicies,
    configurationVariables.description,
    configurationVariables.externalId,
    configurationVariables.path
  );

  if (configurationVariables.ec2InstanceProfile) {
    exports[
      `${ec2InstanceProfileResourceName}.iam-role-ec2-instance-profile.name`
    ] = { Ref: ec2InstanceProfileResourceName };
    exports[
      `${ec2InstanceProfileResourceName}.iam-role-ec2-instance-profile.arn`
    ] = { 'Fn::GetAtt': [ec2InstanceProfileResourceName, 'Arn'] };

    cfTemplate['Resources'][ec2InstanceProfileResourceName] =
      createCfResourceInstanceRole(configurationVariables.roleName, [
        getRefParameter(iamRoleResourceName),
      ]);
  }

  return { cfTemplate, exports, templateMetadata };
}

export function cfTemplateIamPolicy(configurationVariables) {
  let cfTemplate = initCFTemplate();

  const randomString =
    'resourceNameSuffix' in configurationVariables
      ? configurationVariables.resourceNameSuffix
      : '';
  const cfResourceName = 'IamPolicy' + randomString;

  const exports = {
    [`${cfResourceName}.iam-policy.arn`]: {
      Ref: cfResourceName,
    },
  };

  const templateMetadata = {
    resourceName: cfResourceName,
  };

  cfTemplate['Resources'][cfResourceName] = {
    Type: 'AWS::IAM::ManagedPolicy',
    Properties: {
      PolicyDocument: configurationVariables.policy,
      Description: configurationVariables.policyDescription,
    },
  };

  if (configurationVariables.policyName.length > 0)
    cfTemplate['Resources'][cfResourceName]['Properties']['ManagedPolicyName'] =
      configurationVariables.policyName;

  return { cfTemplate, exports, templateMetadata };
}
