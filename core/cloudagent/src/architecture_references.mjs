export const templates = {
  static_website: {
    title: "Static Website (S3 + CloudFront, OAC, default index)",
    recommendedStackName: "static-website",
    yaml: `AWSTemplateFormatVersion: '2010-09-09'
Description: Static site on S3 with self-logging, Block Public Access, and CloudFront (OAI + ForwardedValues)

Parameters:
  BucketName:
    Type: String
    Description: Globally unique name for the S3 bucket
  DefaultRootObject:
    Type: String
    Default: index.html
    Description: Default object served by CloudFront

Resources:
  SiteBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref BucketName
      OwnershipControls:
        Rules:
          - ObjectOwnership: BucketOwnerPreferred
      AccessControl: LogDeliveryWrite
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      LoggingConfiguration:
        DestinationBucketName: !Ref BucketName
        LogFilePrefix: logs/
      VersioningConfiguration:
        Status: Enabled

  CloudFrontOAI:
    Type: AWS::CloudFront::CloudFrontOriginAccessIdentity
    Properties:
      CloudFrontOriginAccessIdentityConfig:
        Comment: !Sub OAI for \${AWS::StackName}

  SiteBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref SiteBucket
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: AllowCloudFrontOAIRead
            Effect: Allow
            Principal:
              AWS: !Sub arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity \${CloudFrontOAI}
            Action: s3:GetObject
            Resource: !Sub arn:\${AWS::Partition}:s3:::\${BucketName}/*

  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        Comment: !Sub Static site for \${AWS::StackName}
        DefaultRootObject: !Ref DefaultRootObject
        Origins:
          - Id: s3-origin
            DomainName: !GetAtt SiteBucket.RegionalDomainName
            S3OriginConfig:
              OriginAccessIdentity: !Sub origin-access-identity/cloudfront/\${CloudFrontOAI}
        DefaultCacheBehavior:
          TargetOriginId: s3-origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods:
            - GET
            - HEAD
          CachedMethods:
            - GET
            - HEAD
          ForwardedValues:
            QueryString: false
            Cookies:
              Forward: none
            Headers: []
          Compress: true
        PriceClass: PriceClass_100
        ViewerCertificate:
          CloudFrontDefaultCertificate: true
        HttpVersion: http2

Outputs:
  SiteBucketName:
    Description: S3 bucket name for hosting and logging
    Value: !Ref SiteBucket
  DistributionDomainName:
    Description: CloudFront distribution domain
    Value: !GetAtt CloudFrontDistribution.DomainName
  DistributionId:
    Description: CloudFront distribution ID
    Value: !Ref CloudFrontDistribution
`
  },

  web_app_ecs_fargate: {
    title: "Web App (ECS Fargate + ALB + minimal VPC)",
    recommendedStackName: "webapp-ecs-fargate",
    yaml: `AWSTemplateFormatVersion: "2010-09-09"
Description: ECS Fargate service behind ALB (minimal VPC).
Parameters:
  ImageUri:
    Type: String
    Description: ECR image URI (e.g., 123456789012.dkr.ecr.us-east-1.amazonaws.com/app:latest)
  ContainerPort:
    Type: Number
    Default: 80
Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties: { CidrBlock: 10.0.0.0/16, EnableDnsHostnames: true, EnableDnsSupport: true }
  SubnetA:
    Type: AWS::EC2::Subnet
    Properties: { VpcId: !Ref Vpc, CidrBlock: 10.0.1.0/24, AvailabilityZone: !Select [0, !GetAZs ""] }
  SubnetB:
    Type: AWS::EC2::Subnet
    Properties: { VpcId: !Ref Vpc, CidrBlock: 10.0.2.0/24, AvailabilityZone: !Select [1, !GetAZs ""] }
  IGW:
    Type: AWS::EC2::InternetGateway
  VpcGWA:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties: { VpcId: !Ref Vpc, InternetGatewayId: !Ref IGW }
  RT:
    Type: AWS::EC2::RouteTable
    Properties: { VpcId: !Ref Vpc }
  R:
    Type: AWS::EC2::Route
    Properties: { RouteTableId: !Ref RT, DestinationCidrBlock: 0.0.0.0/0, GatewayId: !Ref IGW }
  AAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties: { SubnetId: !Ref SubnetA, RouteTableId: !Ref RT }
  BAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties: { SubnetId: !Ref SubnetB, RouteTableId: !Ref RT }
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties: { Subnets: [!Ref SubnetA, !Ref SubnetB] }
  TG:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Port: !Ref ContainerPort
      Protocol: HTTP
      VpcId: !Ref Vpc
      TargetType: ip
      HealthCheckPath: /
  Listener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions: [{ Type: forward, TargetGroupArn: !Ref TG }]
      LoadBalancerArn: !Ref ALB
      Port: 80
      Protocol: HTTP
  Cluster:
    Type: AWS::ECS::Cluster
  TaskRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement: [{ Effect: Allow, Principal: { Service: ecs-tasks.amazonaws.com }, Action: sts:AssumeRole }]
  TaskExecRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement: [{ Effect: Allow, Principal: { Service: ecs-tasks.amazonaws.com }, Action: sts:AssumeRole }]
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  TaskDef:
    Type: AWS::ECS::TaskDefinition
    Properties:
      RequiresCompatibilities: [FARGATE]
      Cpu: "256"
      Memory: "512"
      NetworkMode: awsvpc
      ExecutionRoleArn: !GetAtt TaskExecRole.Arn
      TaskRoleArn: !GetAtt TaskRole.Arn
      ContainerDefinitions:
        - Name: app
          Image: !Ref ImageUri
          PortMappings: [{ ContainerPort: !Ref ContainerPort }]
  Service:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref Cluster
      DesiredCount: 1
      LaunchType: FARGATE
      TaskDefinition: !Ref TaskDef
      NetworkConfiguration:
        AwsvpcConfiguration:
          AssignPublicIp: ENABLED
          Subnets: [!Ref SubnetA, !Ref SubnetB]
      LoadBalancers:
        - ContainerName: app
          ContainerPort: !Ref ContainerPort
          TargetGroupArn: !Ref TG
Outputs:
  LoadBalancerDNSName:
    Value: !GetAtt ALB.DNSName
`
  },

  rds_mysql_with_secret: {
    title: "RDS MySQL with AWS Secrets Manager",
    recommendedStackName: "rds-mysql-with-secret",
    yaml: `AWSTemplateFormatVersion: "2010-09-09"
Description: RDS MySQL with a generated secret in Secrets Manager (demo minimal).
Parameters:
  DBName:
    Type: String
    Default: appdb
  DBUser:
    Type: String
    Default: admin
Resources:
  DBSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      GenerateSecretString:
        SecretStringTemplate: !Sub '{"username":"\${DBUser}"}'
        GenerateStringKey: password
        ExcludePunctuation: true
        PasswordLength: 20
  DBInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBName: !Ref DBName
      Engine: mysql
      EngineVersion: "8.0"
      DBInstanceClass: db.t3.micro
      AllocatedStorage: "20"
      MasterUsername: !Ref DBUser
      MasterUserPassword: !Sub '{{resolve:secretsmanager:\${DBSecret}::password}}'
      PubliclyAccessible: false
Outputs:
  SecretArn:
    Value: !Ref DBSecret
  DbEndpoint:
    Value: !GetAtt DBInstance.Endpoint.Address
`
  },

  vpc_two_az: {
    title: "VPC Baseline (2 public subnets)",
    recommendedStackName: "vpc-two-az",
    yaml: `AWSTemplateFormatVersion: "2010-09-09"
Description: Minimal VPC with 2 public subnets in 2 AZs.
Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties: { CidrBlock: 10.1.0.0/16, EnableDnsHostnames: true, EnableDnsSupport: true }
  SubnetA:
    Type: AWS::EC2::Subnet
    Properties: { VpcId: !Ref Vpc, CidrBlock: 10.1.1.0/24, AvailabilityZone: !Select [0, !GetAZs ""] }
  SubnetB:
    Type: AWS::EC2::Subnet
    Properties: { VpcId: !Ref Vpc, CidrBlock: 10.1.2.0/24, AvailabilityZone: !Select [1, !GetAZs ""] }
  IGW:
    Type: AWS::EC2::InternetGateway
  VpcGWA:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties: { VpcId: !Ref Vpc, InternetGatewayId: !Ref IGW }
  RT:
    Type: AWS::EC2::RouteTable
    Properties: { VpcId: !Ref Vpc }
  R:
    Type: AWS::EC2::Route
    Properties: { RouteTableId: !Ref RT, DestinationCidrBlock: 0.0.0.0/0, GatewayId: !Ref IGW }
  AAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties: { SubnetId: !Ref SubnetA, RouteTableId: !Ref RT }
  BAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties: { SubnetId: !Ref SubnetB, RouteTableId: !Ref RT }
Outputs:
  VpcId: { Value: !Ref Vpc }
  SubnetAId: { Value: !Ref SubnetA }
  SubnetBId: { Value: !Ref SubnetB }
`
  }
}

export default { templates };
