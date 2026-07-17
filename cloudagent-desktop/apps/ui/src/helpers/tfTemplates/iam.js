import {
  stringDoubleQuotes,
  tfGetReturnFromResource,
  tfResourceTemplate,
} from './baseFunctions';

export function tfIamRole(configurationVariables, addRandomString, tfVersion) {
  const randomString =
    'resourceNameSuffix' in configurationVariables
      ? configurationVariables.resourceNameSuffix
      : '';
  const iamRoleResourceName = Object.keys(
    configurationVariables.resourceNames
  ).includes('IamRole')
    ? configurationVariables.resourceNames.IamRole
    : 'IamRole' + randomString;
  const managedPolicyAttachResourceName =
    iamRoleResourceName + 'ManagedPolicyRoleAttachment';
  const inlinePolicyAttachResourceName =
    iamRoleResourceName + 'InlinePolicyRoleAttachment';
  const ec2InstanceProfileResourceName = Object.keys(
    configurationVariables.resourceNames
  ).includes('Ec2InstanceProfile')
    ? configurationVariables.resourceNames.Ec2InstanceProfile
    : 'Ec2InstanceProfile' + randomString;

  const exports = {
    [`${iamRoleResourceName}.iam-role.name`]: tfGetReturnFromResource(
      'aws_iam_role',
      iamRoleResourceName,
      'name',
      tfVersion
    ),
    [`${iamRoleResourceName}.iam-role.arn`]: tfGetReturnFromResource(
      'aws_iam_role',
      iamRoleResourceName,
      'arn',
      tfVersion
    ),
    [`${iamRoleResourceName}.iam-role.roleId`]: tfGetReturnFromResource(
      'aws_iam_role',
      iamRoleResourceName,
      'unique_id',
      tfVersion
    ),
  };

  let tfTemplate = '';
  let properties = {};

  if (configurationVariables.roleName) {
    properties['name'] = stringDoubleQuotes(configurationVariables.roleName);
  }

  if (configurationVariables.description) {
    properties['description'] = stringDoubleQuotes(
      configurationVariables.description
    );
  }

  properties['assume_role_policy'] =
    'jsonencode(\n' +
    (configurationVariables.externalId
      ? getAssumeRolePolicy(
          null,
          configurationVariables.trustPolicy['AWS'],
          configurationVariables.externalId
        )
      : getAssumeRolePolicy(
          configurationVariables.assumeRoleServices,
          null,
          null
        )) +
    ')';

  if (configurationVariables.path) {
    properties['path'] = stringDoubleQuotes(configurationVariables.path);
  }

  tfTemplate += tfResourceTemplate(
    'aws_iam_role',
    iamRoleResourceName,
    properties
  );

  tfTemplate += '\n\n';

  if (configurationVariables.ec2InstanceProfile) {
    exports[
      `${ec2InstanceProfileResourceName}.iam-role-ec2-instance-profile.name`
    ] = tfGetReturnFromResource(
      'aws_iam_instance_profile',
      ec2InstanceProfileResourceName,
      'name',
      tfVersion
    );
    exports[
      `${tfEc2InstanceProfileResourceName}.iam-role-ec2-instance-profile.arn`
    ] = tfGetReturnFromResource(
      'aws_iam_instance_profile',
      ec2InstanceProfileResourceName,
      'arn',
      tfVersion
    );

    let ec2InstanceProfileProperties = {
      role: tfGetReturnFromResource(
        'aws_iam_role',
        iamRoleResourceName,
        'name',
        tfVersion
      ),
    };
    if (configurationVariables.roleName.length > 0)
      ec2InstanceProfileProperties['name'] = stringDoubleQuotes(
        configurationVariables.roleName
      );

    tfTemplate += tfResourceTemplate(
      'aws_iam_instance_profile',
      ec2InstanceProfileResourceName,
      ec2InstanceProfileProperties
    );

    tfTemplate += '\n';
  }

  if (
    Object.keys(configurationVariables).includes('managedPolicies') &&
    configurationVariables.managedPolicies.length > 0
  ) {
    configurationVariables.managedPolicies.map((policy, index) => {
      let policyAttachProperties = {
        role: tfGetReturnFromResource(
          'aws_iam_role',
          iamRoleResourceName,
          'name',
          tfVersion
        ),
        policy_arn: stringDoubleQuotes(policy),
      };

      tfTemplate += tfResourceTemplate(
        'aws_iam_role_policy_attachment',
        managedPolicyAttachResourceName + index,
        policyAttachProperties
      );
      tfTemplate += '\n\n';
    });
  }

  if (
    Object.keys(configurationVariables).includes('inlinePolicies') &&
    configurationVariables.inlinePolicies.length > 0
  ) {
    configurationVariables.inlinePolicies.map((policy, index) => {
      let policyAttachProperties = {
        name: stringDoubleQuotes(policy.PolicyName),
        role: tfGetReturnFromResource(
          'aws_iam_role',
          iamRoleResourceName,
          'id',
          tfVersion
        ),
        policy:
          'jsonencode(\n' +
          JSON.stringify(policy.PolicyDocument, null, '    ') +
          '\n)',
      };

      tfTemplate += tfResourceTemplate(
        'aws_iam_role_policy',
        inlinePolicyAttachResourceName + index,
        policyAttachProperties
      );
      tfTemplate += '\n\n';
    });
  }

  return { tfTemplate, exports };
}

export function tfIamPolicy(
  configurationVariables,
  addRandomString,
  tfVersion
) {
  const randomString =
    'resourceNameSuffix' in configurationVariables
      ? configurationVariables.resourceNameSuffix
      : '';

  const tfResourceName = 'IamPolicy' + randomString;

  const exports = {
    [`${tfResourceName}.iam-policy.arn`]: tfGetReturnFromResource(
      'aws_iam_policy',
      tfResourceName,
      'arn',
      tfVersion
    ),
  };

  const properties = {};
  if (configurationVariables.policyName.length > 0)
    properties['name'] = stringDoubleQuotes(configurationVariables.policyName);

  if (configurationVariables.policyDescription.length > 0)
    properties['description'] = stringDoubleQuotes(
      configurationVariables.policyDescription
    );
  // const policyName = (configurationVariables.policyName.length > 0) ? configurationVariables.policyName : 'iam_policy'

  const policyContent =
    'jsonencode(\n' +
    JSON.stringify(configurationVariables.policy, null, 2) +
    '\n' +
    ')\n';
  properties['policy'] = policyContent.replace(/\${/g, '$${'); //Terraform cannot process ${ and should be replaced with $${

  return {
    tfTemplate: tfResourceTemplate(
      'aws_iam_policy',
      tfResourceName,
      properties
    ),
    exports,
  };
}

function getAssumeRolePolicy(services, accountId = null, externalId = null) {
  if (accountId) {
    if (externalId)
      return `{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Action": "sts:AssumeRole",
          "Principal": {
            "AWS": "${accountId}"
          },
          "Effect": "Allow",
          "Sid": "",
          "Condition": {
            "StringEquals": {
                "sts:ExternalId": "${externalId}"
            }
        }
        }
      ]
    }
`;
    else
      return `{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Action": "sts:AssumeRole",
          "Principal": {
            "AWS": "${accountId}"
          },
          "Effect": "Allow",
          "Sid": ""
        }
      ]
    }
`;
  } else
    return `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": ${JSON.stringify(services)}
      },
      "Effect": "Allow",
    }
  ]
}
`;
}
