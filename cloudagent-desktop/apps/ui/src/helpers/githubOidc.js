export const buildGithubOidcTemplate = ({
  owner,
  repo,
  branch,
  roleName,
  stateBucketName,
  createStateBucket,
}) => {
  const repository = [owner, repo].filter(Boolean).join('/');
  const safeBranch = branch || 'main';
  const safeRoleName = roleName || 'cloudagent-github-actions';
  const safeStateBucketName = stateBucketName || '';
  const stateBucketEnabled = createStateBucket ? 'true' : 'false';

  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'CloudAgent GitHub Actions OIDC provider and IAM role',
    Parameters: {
      Repository: {
        Type: 'String',
        Default: repository,
        Description: 'GitHub repository in owner/repo format',
      },
      Branch: {
        Type: 'String',
        Default: safeBranch,
        Description: 'GitHub branch allowed to assume the role',
      },
      RoleName: {
        Type: 'String',
        Default: safeRoleName,
        Description: 'IAM role name for GitHub Actions',
      },
      ManagedPolicyArn: {
        Type: 'String',
        Default: 'arn:aws:iam::aws:policy/AdministratorAccess',
        Description: 'Managed policy attached to the role (adjust to least privilege)',
      },
      EnvironmentName: {
        Type: 'String',
        Default: 'cloudagent-approval',
        Description: 'GitHub Environment name used in the workflow (optional)',
      },
      CreateStateBucket: {
        Type: 'String',
        AllowedValues: ['true', 'false'],
        Default: stateBucketEnabled,
        Description: 'Create an S3 bucket for Terraform/OpenTofu state',
      },
      StateBucketName: {
        Type: 'String',
        Default: safeStateBucketName,
        Description: 'S3 bucket name for Terraform/OpenTofu state',
      },
    },
    Conditions: {
      CreateStateBucketCondition: {
        'Fn::Equals': [{ Ref: 'CreateStateBucket' }, 'true'],
      },
    },
    Resources: {
      GitHubOidcProvider: {
        Type: 'AWS::IAM::OIDCProvider',
        Properties: {
          Url: 'https://token.actions.githubusercontent.com',
          ClientIdList: ['sts.amazonaws.com'],
          ThumbprintList: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
        },
      },
      GitHubActionsRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: { Ref: 'RoleName' },
          Description: 'IAM role used by GitHub Actions for CloudAgent deployments',
          ManagedPolicyArns: [{ Ref: 'ManagedPolicyArn' }],
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Federated: { Ref: 'GitHubOidcProvider' },
                },
                Action: 'sts:AssumeRoleWithWebIdentity',
                Condition: {
                  StringEquals: {
                    'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                  },
                  StringLike: {
                    'token.actions.githubusercontent.com:sub': [
                      {
                        'Fn::Sub': 'repo:${Repository}:ref:refs/heads/${Branch}',
                      },
                      {
                        'Fn::Sub': 'repo:${Repository}:environment:${EnvironmentName}',
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
      TerraformStateBucket: {
        Type: 'AWS::S3::Bucket',
        Condition: 'CreateStateBucketCondition',
        Properties: {
          BucketName: { Ref: 'StateBucketName' },
          VersioningConfiguration: {
            Status: 'Enabled',
          },
          BucketEncryption: {
            ServerSideEncryptionConfiguration: [
              {
                ServerSideEncryptionByDefault: {
                  SSEAlgorithm: 'AES256',
                },
              },
            ],
          },
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            BlockPublicPolicy: true,
            IgnorePublicAcls: true,
            RestrictPublicBuckets: true,
          },
        },
      },
    },
    Outputs: {
      RoleArn: {
        Description: 'IAM Role ARN for GitHub Actions',
        Value: { 'Fn::GetAtt': ['GitHubActionsRole', 'Arn'] },
      },
      OidcProviderArn: {
        Description: 'OIDC provider ARN',
        Value: { Ref: 'GitHubOidcProvider' },
      },
      StateBucketName: {
        Description: 'S3 bucket name for Terraform/OpenTofu state',
        Value: { Ref: 'StateBucketName' },
      },
    },
  };
};
