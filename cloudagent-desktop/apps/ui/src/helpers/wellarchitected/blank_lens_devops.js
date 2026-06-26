const questions = [
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'AG_SAD_1',
				Title:
					'AG.SAD.1: Centralize and federate access with temporary credential vending',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'By implementing a federated access solution, you can leverage your existing identity systems, provide single sign-on (SSO) capabilities, and avoid the need to maintain separate user identities across multiple systems which makes scaling in a DevOps model more tenable. By applying the least privilege principle, you can minimize the risk of unauthorized access and reduce the potential damage from compromised keys while retaining full control over access to resources and environments. Implement a centralized subsystem for federated access and temporary credential vending to maintain secure and controlled access to your environments, workloads, and resources. Grant users and services fine-grained access to help ensure secure, granular control as they interact with resources and systems. To reduce the likelihood of keys being compromised, always vend short-lived, temporary credentials that are scoped for specific tasks to help ensure that privileges are granted only for the duration needed. Centralizing identity onboarding and permission management eliminate the inefficiencies of manual processes, reduce human error, and enable scalability as your organization grows.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.1-centralize-and-federate-access-with-temporary-credential-vending',
				},
				ImprovementPlan: {
					DisplayText:
						'By implementing a federated access solution, you can leverage your existing identity systems, provide single sign-on (SSO) capabilities, and avoid the need to maintain separate user identities across multiple systems which makes scaling in a DevOps model more tenable. By applying the least privilege principle, you can minimize the risk of unauthorized access and reduce the potential damage from compromised keys while retaining full control over access to resources and environments. Refer to AG.SAD.1: Centralize and federate access with temporary credential vending in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.1-centralize-and-federate-access-with-temporary-credential-vending',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST02-BP04 Implement groups and roles',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_groups_roles.html',
							},
							{
								DisplayText: 'Security best practices in IAM',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC02-BP04 Rely on a centralized identity provider',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_identity_provider.html',
							},
							{
								DisplayText: 'IAM Identity Center',
								Url:
									'https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html',
							},
							{
								DisplayText: 'What is SSO (Single-Sign-On)?',
								Url: 'https://aws.amazon.com/what-is/sso',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_SAD_2',
				Title:
					'AG.SAD.2: Delegate identity and access management responsibilities',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Create a decentralized Identity and Access Management (IAM) responsibility model that enables individual teams to handle their own IAM tasks, such as creating roles and assigning permissions, as long as those teams operate within applied guardrails. This approach grants teams the autonomy to manage their roles and permissions essential for the applications they develop, encourages a culture of ownership and accountability, and enables your organization to scale its permission management effectively as it grows and embraces more DevOps practices. These guardrails reduce potential security risk while creating balance between allowing teams to manage their own IAM tasks and ensuring that they do not exceed the maximum permissions set. Establish a set of well-defined guardrails which limit the maximum permissions a user or role can safely have.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.2-delegate-identity-and-access-management-responsibilities',
				},
				ImprovementPlan: {
					DisplayText:
						'Create a decentralized Identity and Access Management (IAM) responsibility model that enables individual teams to handle their own IAM tasks, such as creating roles and assigning permissions, as long as those teams operate within applied guardrails. This approach grants teams the autonomy to manage their roles and permissions essential for the applications they develop, encourages a culture of ownership and accountability, and enables your organization to scale its permission management effectively as it grows and embraces more DevOps practices. Refer to AG.SAD.2: Delegate identity and access management responsibilities in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.2-delegate-identity-and-access-management-responsibilities',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Security best practices in IAM',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
							},
							{
								DisplayText:
									'Use permissions boundaries to delegate permissions management within an account',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#bp-permissions-boundaries',
							},
							{
								DisplayText:
									'Establish permissions guardrails across multiple accounts',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#bp-permissions-guardrails',
							},
							{
								DisplayText:
									'Blog: Delegate permission management to developers by using IAM permissions boundaries',
								Url:
									'https://aws.amazon.com/blogs/security/delegate-permission-management-to-developers-using-iam-permissions-boundaries',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_SAD_3',
				Title: 'AG.SAD.3: Treat pipelines as production resources',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Due to this level of access and their role in deploying to potentially sensitive environments, pipelines should be recognized as integral components of your overall system and must be secured and managed to the same degree as the environments and data they interact with. Emphasizing pipeline governance and treating pipelines as first-class citizens within your security infrastructure can substantially decrease your potential attack surface and reinforce the security of your overall DevOps environment. Pipelines become pivotal in every aspect of the software development lifecycle when practicing DevOps, as they become the sole method of moving code from development to production. During the process of building, testing, and deploying software, pipelines require access to all software components involved, including libraries, frameworks, repositories, modules, artifacts, and third-party dependencies. To reduce the potential for pipelines to become a security threat, their roles and permissions should be confined to align with their precise responsibilities. The application of least-privilege principles, commonly applied to human users, should be extended to pipelines.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.3-treat-pipelines-as-production-resources',
				},
				ImprovementPlan: {
					DisplayText:
						'Due to this level of access and their role in deploying to potentially sensitive environments, pipelines should be recognized as integral components of your overall system and must be secured and managed to the same degree as the environments and data they interact with. Emphasizing pipeline governance and treating pipelines as first-class citizens within your security infrastructure can substantially decrease your potential attack surface and reinforce the security of your overall DevOps environment. Refer to AG.SAD.3: Treat pipelines as production resources in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.3-treat-pipelines-as-production-resources',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'application of least-privilege principles',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP07 Regularly assess security properties of the pipelines',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_regularly_assess_security_properties_of_pipelines.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_SAD_4',
				Title: 'AG.SAD.4: Limit human access with just-in-time access',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Human users should be granted minimal access necessary for their role, which is usually read-only access that does not allow any modifications or access to sensitive data. By enforcing limited human permissions and using JIT access, you can improve your organization's security posture and reduce the risk of accidental or deliberate misuse of access rights. To accommodate these needs without compromising security, implement a just-in-time (JIT) access control strategy where permissions are temporarily escalated for a specific duration and purpose, upon explicit request and approval. As pipelines take on a more prominent role in the software development lifecycle in a DevOps model, the necessity for extensive human access to environments decreases. This approach maintains the principle of least privilege, allowing necessary operational functions to be performed efficiently when needed, while also ensuring that the access is revoked once the task is complete. For experimentation which is typically hands-on and exploratory, teams should be granted access to sandbox environments which are isolated from system workloads.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.4-limit-human-access-with-just-in-time-access',
				},
				ImprovementPlan: {
					DisplayText:
						"Human users should be granted minimal access necessary for their role, which is usually read-only access that does not allow any modifications or access to sensitive data. By enforcing limited human permissions and using JIT access, you can improve your organization's security posture and reduce the risk of accidental or deliberate misuse of access rights. Refer to AG.SAD.4: Limit human access with just-in-time access in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.4-limit-human-access-with-just-in-time-access',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Eliminate the need for human access',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/financial-services-industry-lens/use-immutable-infrastructure-with-no-human-access.html',
							},
							{
								DisplayText:
									'AWS Samples: AWS IAM Temporary Elevated Access Broker',
								Url:
									'https://github.com/aws-samples/aws-iam-temporary-elevated-access-broker',
							},
							{
								DisplayText:
									'Blog: Managing temporary elevated access to your AWS environment',
								Url:
									'https://aws.amazon.com/blogs/security/managing-temporary-elevated-access-to-your-aws-environment',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_SAD_5',
				Title: 'AG.SAD.5: Implement break-glass procedures',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Create break-glass roles and users you can assume control of during emergencies that are able to bypass established controls, update guardrails, troubleshoot issues with automation tooling, or remediate security and operational issues that may occur. These break-glass roles and users should have adequate security measures, such as configuring them with hardware-based multi-factor authentication (MFA), to ensure that even in emergencies, access is tightly controlled and auditable. During emergency scenarios, like the failure of the organization's identity provider, security incidents, or unavailability of key personnel, these measures provide temporary, elevated access beyond regular permissions. Implement measures that improve the resilience of your DevOps environments through the ability to respond effectively to emergencies without compromising long-term security. Having break-glass procedures helps ensure that your organization can respond effectively to crises without compromising long-term security. Establish alerts and alarms triggered by the use of these break-glass roles and users, and tie their usage closely to incident response and recovery procedures.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.5-implement-break-glass-procedures',
				},
				ImprovementPlan: {
					DisplayText:
						'Create break-glass roles and users you can assume control of during emergencies that are able to bypass established controls, update guardrails, troubleshoot issues with automation tooling, or remediate security and operational issues that may occur. These break-glass roles and users should have adequate security measures, such as configuring them with hardware-based multi-factor authentication (MFA), to ensure that even in emergencies, access is tightly controlled and auditable. Refer to AG.SAD.5: Implement break-glass procedures in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.5-implement-break-glass-procedures',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC03-BP03 Establish emergency access process',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_emergency_process.html',
							},
							{
								DisplayText: 'Break glass access',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/break-glass-access.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_SAD_6',
				Title:
					'AG.SAD.6: Conduct periodic identity and access management reviews',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automatically right sizing roles and permissions based on actual activity allows organizations to scalably enforce that the right resources are accessible to the right entities, at the right times. With the distributed nature of DevOps Identity and Access Management (IAM) responsibilities, it is important to systematically review IAM roles and permissions periodically. This helps ensure that changes in roles and permissions align with the rapidly shifting needs of the organization, and that the guardrails set in place for delegation are working as intended or perhaps need to be fine-tuned. This activity aids in identifying unused or overly broad permissions, reinforcing the adherence to the principle of least privilege and reducing potential security risks. This proactive approach not only keeps IAM policies up-to-date, but also minimizes potential avenues for unauthorized access, further strengthening your overall security posture. Optionally, automate the right-sizing of permissions as part of these reviews.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.6-conduct-periodic-identity-and-access-management-reviews',
				},
				ImprovementPlan: {
					DisplayText:
						'Automatically right sizing roles and permissions based on actual activity allows organizations to scalably enforce that the right resources are accessible to the right entities, at the right times. With the distributed nature of DevOps Identity and Access Management (IAM) responsibilities, it is important to systematically review IAM roles and permissions periodically. Refer to AG.SAD.6: Conduct periodic identity and access management reviews in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.6-conduct-periodic-identity-and-access-management-reviews',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC03-BP04 Reduce permissions continuously',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_continuous_reduction.html',
							},
							{
								DisplayText:
									'Regularly review and remove unused users, roles, permissions, policies, and credentials',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#remove-credentials',
							},
							{
								DisplayText:
									'Use IAM Access Analyzer to generate least-privilege policies based on access activity',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#bp-gen-least-privilege-policies',
							},
							{
								DisplayText:
									'Verify public and cross-account access to resources with IAM Access Analyzer',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#bp-preview-access',
							},
							{
								DisplayText:
									'Using AWS Identity and Access Management Access Analyzer',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_SAD_7',
				Title:
					'AG.SAD.7: Implement rotation policies for secrets, keys, and certificates',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Regular rotation of secrets, keys, and certificates is a best practice in securing access, limiting the potential damage that can occur should these security resources become compromised. Certificates play an important role in service-to-service authentication and providing encryption for both internal and external facing workloads and environments. In a DevOps environment, pipelines often require access to sensitive environments and workloads, making them potential targets for attacks. When managing certificates, consider not only those issued within your organization but also those imported from external sources which may not be automatically renewable. This approach can help prevent service disruptions caused by expired certificates and, in some cases, can trigger automated renewal procedures. The routine rotation of these resources that are used by pipelines can help to significantly mitigate this risk.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.7-implement-rotation-policies-for-secrets-keys-and-certificates',
				},
				ImprovementPlan: {
					DisplayText:
						'Regular rotation of secrets, keys, and certificates is a best practice in securing access, limiting the potential damage that can occur should these security resources become compromised. Certificates play an important role in service-to-service authentication and providing encryption for both internal and external facing workloads and environments. Refer to AG.SAD.7: Implement rotation policies for secrets, keys, and certificates in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.7-implement-rotation-policies-for-secrets-keys-and-certificates',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Blog: How to monitor expirations of imported certificates in AWS Certificate Manager (ACM)',
								Url:
									'https://aws.amazon.com/blogs/security/how-to-monitor-expirations-of-imported-certificates-in-aws-certificate-manager-acm',
							},
							{
								DisplayText:
									'Rotate AWS Secrets Manager secrets - AWS Secrets Manager',
								Url:
									'https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html',
							},
							{
								DisplayText: 'Managing access keys for IAM users - AWS IAM',
								Url:
									'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
							},
							{
								DisplayText:
									'Rotating AWS KMS keys - AWS Key Management Service',
								Url:
									'https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_SAD_8',
				Title:
					'AG.SAD.8: Adopt a zero trust security model, shifting towards an identity-centric security perimeter',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'From the initial stages of code development as developers interact with source code repositories, through continuous integration using internal and external tools to build and test software, to the deployment and maintenance of the workloads, each user, pipeline, third-party, and service needs to be authenticated and authorized with every request. In these scenarios, zero trust enforces adherence to the principle of least privilege, ensuring that all of these independent users and systems are granted access to the right resources only when necessary. Shifting to a zero trust model is not an all-or-nothing endeavor, it is a gradual process consistent with the DevOps principles of continuous improvement. Adopting zero trust often involves rethinking identity, authentication, and other context-specific factors like user behavior and device health. This understanding will guide the selection of zero trust principles, tools, and patterns that are most beneficial for your organization. When operating under a zero trust security model, no user or system is trusted by default.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.8-adopt-a-zero-trust-security-model-shifting-towards-an-identity-centric-security-perimeter',
				},
				ImprovementPlan: {
					DisplayText:
						'From the initial stages of code development as developers interact with source code repositories, through continuous integration using internal and external tools to build and test software, to the deployment and maintenance of the workloads, each user, pipeline, third-party, and service needs to be authenticated and authorized with every request. In these scenarios, zero trust enforces adherence to the principle of least privilege, ensuring that all of these independent users and systems are granted access to the right resources only when necessary. Refer to AG.SAD.8: Adopt a zero trust security model, shifting towards an identity-centric security perimeter in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.sad.8-adopt-a-zero-trust-security-model-shifting-towards-an-identity-centric-security-perimeter',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Zero Trust on AWS',
								Url: 'https://aws.amazon.com/security/zero-trust',
							},
							{
								DisplayText: 'Amazon Verified Permissions',
								Url: 'https://aws.amazon.com/verified-permissions',
							},
							{
								DisplayText: 'AWS Verified Access',
								Url: 'https://aws.amazon.com/verified-access',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_SAD_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/AG_SAD',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Automated_Governance',
		QuestionId: 'AG_SAD',
		QuestionTitle:
			'How do you implement and manage secure access and delegation?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Automated_Governance',
			QuestionDescription:
				'Establish scalable methods for managing fine-grained access controls, while still providing teams with the autonomy they need. This governance capability emphasizes the necessity for all access to be explicitly granted, guided by the principle of least privilege.',
			QuestionId: 'AG_SAD',
			QuestionTitle:
				'How do you implement and manage secure access and delegation?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'AG_DLM_1',
				Title:
					'AG.DLM.1: Define recovery objectives to maintain business continuity',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Set recovery point objectives (RPO) indicating how much data loss is acceptable, and recovery time objectives (RTO) specifying how quickly services need to be restored following an incident. Clear recovery objectives help to ensure that teams can maintain business continuity and recover with minimal data loss, keeping the delivery pipeline flowing and maintaining service reliability. Develop and document your disaster recovery (DR) strategy, make it available to teams, and conduct exercises and trainings to maintain the ability to perform the strategy. Implement policies and automated governance capabilities that align with your RPO and RTO objectives.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.1-define-recovery-objectives-to-maintain-business-continuity',
				},
				ImprovementPlan: {
					DisplayText:
						'Set recovery point objectives (RPO) indicating how much data loss is acceptable, and recovery time objectives (RTO) specifying how quickly services need to be restored following an incident. Clear recovery objectives help to ensure that teams can maintain business continuity and recover with minimal data loss, keeping the delivery pipeline flowing and maintaining service reliability. Refer to AG.DLM.1: Define recovery objectives to maintain business continuity in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.1-define-recovery-objectives-to-maintain-business-continuity',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL09-BP01 Identify and back up all data that needs to be backed up, or reproduce the data from sources',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_identified_backups_data.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL13-BP01 Define recovery objectives for downtime and data loss',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_objective_defined_recovery.html',
							},
							{
								DisplayText: 'AWS Resilience Hub',
								Url: 'https://aws.amazon.com/resilience-hub',
							},
							{
								DisplayText: 'AWS Fault Isolation Boundaries',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/abstract-and-introduction.html',
							},
							{
								DisplayText:
									'Blog: Establishing RPO and RTO Targets for Cloud Applications',
								Url:
									'https://aws.amazon.com/blogs/mt/establishing-rpo-and-rto-targets-for-cloud-applications',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DLM_2',
				Title:
					'AG.DLM.2: Strengthen security with systematic encryption enforcement',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automate the process of encryption key creation, distribution, and rotation to make the use of secure encryption methods simpler for teams to follow and enable them to focus on their core tasks without compromising security. Resources being deploy need to be checked for a compliant encryption configuration as part of deployment process, while continuous scans for unencrypted data and resource misconfiguration should be automated in the environment. To remain agile and rapidly able to deploy safely, it is necessary to enforce encryption at scale to protect sensitive data from unauthorized access when it is at rest and in transit. Automated governance guardrails and auto-remediation capabilities should be used to enforce encryption requirements at scale, ensuring compliance both during and after deployment. With continuous delivery, the risk of data breaches that can disrupt the software delivery process and negatively impact the business increases. These practices not only aid in maintaining compliance, but also facilitates seamless and secure data management across various stages of the development lifecycle.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.2-strengthen-security-with-systematic-encryption-enforcement',
				},
				ImprovementPlan: {
					DisplayText:
						'Automate the process of encryption key creation, distribution, and rotation to make the use of secure encryption methods simpler for teams to follow and enable them to focus on their core tasks without compromising security. Resources being deploy need to be checked for a compliant encryption configuration as part of deployment process, while continuous scans for unencrypted data and resource misconfiguration should be automated in the environment. Refer to AG.DLM.2: Strengthen security with systematic encryption enforcement in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.2-strengthen-security-with-systematic-encryption-enforcement',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL09-BP02 Secure and encrypt backups',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_secured_backups_data.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC08-BP02 Enforce encryption at rest',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_rest_encrypt.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC09-BP02 Enforce encryption in transit',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_transit_encrypt.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC09-BP01 Implement secure key and certificate management',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_transit_key_cert_mgmt.html',
							},
							{
								DisplayText: 'Encrypting Data-at-Rest and -in-Transit',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/logical-separation/encrypting-data-at-rest-and--in-transit.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DLM_3',
				Title:
					'AG.DLM.3: Automate data processes for reliable collection, transformation, and storage using pipelines',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Data pipelines can follow different sequences, such as extract, transform, and load (ETL), or extract and load unstructured data directly into a data lake without transformations. Data pipelines play a key role in enhancing data quality by performing operations like sorting, reformatting, deduplication, verification, and validation, making data more useful for analysis. DataOps incorporates DevOps principles into data management, including the automation of testing and deployment processes for data pipelines. A data pipeline is a series of steps to systematically collect, transform, and store data from various sources. Just as DevOps principles are applied to software delivery, the same can be done with data management through pipelines using a methodology commonly referred to as DataOps. This approach improves monitoring, accelerates issue troubleshooting, and fosters collaboration between development and data operations teams.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.3-automate-data-processes-for-reliable-collection-transformation-and-storage-using-pipelines',
				},
				ImprovementPlan: {
					DisplayText:
						'Data pipelines can follow different sequences, such as extract, transform, and load (ETL), or extract and load unstructured data directly into a data lake without transformations. Data pipelines play a key role in enhancing data quality by performing operations like sorting, reformatting, deduplication, verification, and validation, making data more useful for analysis. Refer to AG.DLM.3: Automate data processes for reliable collection, transformation, and storage using pipelines in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.3-automate-data-processes-for-reliable-collection-transformation-and-storage-using-pipelines',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What Is A Data Pipeline?',
								Url: 'https://aws.amazon.com/what-is/data-pipeline',
							},
							{
								DisplayText: 'AWS DataOps Development Kit',
								Url: 'https://awslabs.github.io/aws-ddk',
							},
							{
								DisplayText: 'AWS Glue DataBrew',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/serverless-etl-aws-glue/databrew.html',
							},
							{
								DisplayText: 'AWS Glue ETL',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/serverless-etl-aws-glue/aws-glue-etl.html',
							},
							{
								DisplayText: 'AWS Step Functions',
								Url: 'https://aws.amazon.com/step-functions',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DLM_4',
				Title:
					'AG.DLM.4: Maintain data compliance with scalable classification strategies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Misclassification or lack of data classification can lead to data breaches or non-compliance with data protection regulations. Use tagging strategies to catalog data effectively and help maintain visibility of data across different services and stages of the software development lifecycle. Automated data classification includes using tools and strategies to identify, tag, and categorize data based on sensitivity levels, type, and more. Put guardrails in place to enforce compliance with data classification and handling requirements, such as those related to data privacy and residency. For advanced use cases, AI/ML tools can provide automatic recognition and classification of data, especially sensitive data. Data classification aids in enforcing data security, privacy, and compliance requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.4-maintain-data-compliance-with-scalable-classification-strategies',
				},
				ImprovementPlan: {
					DisplayText:
						'Misclassification or lack of data classification can lead to data breaches or non-compliance with data protection regulations. Use tagging strategies to catalog data effectively and help maintain visibility of data across different services and stages of the software development lifecycle. Refer to AG.DLM.4: Maintain data compliance with scalable classification strategies in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.4-maintain-data-compliance-with-scalable-classification-strategies',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS04-BP01 Implement a data classification policy',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a2.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST03-BP02 Add organization information to cost and usage',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_monitor_usage_org_information.html',
							},
							{
								DisplayText: 'Data Classification',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/data-classification/data-classification.html',
							},
							{
								DisplayText: 'Best Practices for Tagging AWS Resources',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/tagging-best-practices.html',
							},
							{
								DisplayText:
									'Sensitive Data Discovery and Protection - Amazon Macie',
								Url: 'https://aws.amazon.com/macie',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DLM_5',
				Title:
					'AG.DLM.5: Reduce risks and costs with systematic data retention strategies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automated data retention and disposal is the process of implementing strategies and tools that systematically store data for pre-established periods and securely delete it afterward. To effectively implement automated data retention and disposal, start by defining the data lifecycle policies for your organization. Data is continuously generated, processed, and stored throughout the development lifecycle, increasing the complexity and importance of automated data management capabilities. The goal of data retention and disposal is not just about compliance, but also about reducing risks, sustainability, minimizing costs, and improving operational efficiency. Once these policies are in place, automate the enforcement of these policies with data lifecycle management tools. Automation reduces the manual workload, decreases the risk of human error, and improves data governance and compliance.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.5-reduce-risks-and-costs-with-systematic-data-retention-strategies',
				},
				ImprovementPlan: {
					DisplayText:
						'Automated data retention and disposal is the process of implementing strategies and tools that systematically store data for pre-established periods and securely delete it afterward. To effectively implement automated data retention and disposal, start by defining the data lifecycle policies for your organization. Refer to AG.DLM.5: Reduce risks and costs with systematic data retention strategies in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.5-reduce-risks-and-costs-with-systematic-data-retention-strategies',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST04-BP05 Enforce data retention policies',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning_resources_data_retention.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS04-BP03 Use policies to manage the lifecycle of your datasets',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a4.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS04-BP05 Remove unneeded or redundant data',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a6.html',
							},
							{
								DisplayText: 'Managing your storage lifecycle',
								Url:
									'https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DLM_6',
				Title: 'AG.DLM.6: Centralize shared data to enhance governance',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Governing this shared data requires proper control, management, and distribution of data to prevent unauthorized access, data breaches, and other security incidents, fostering trust and enhancing the quality and reliability of software delivery. Implement automated metadata management to better understand the context, source, and lineage of the data, and deploy continuous, automated data quality checks to ensure the accuracy and usability of the data. Use centralized data lakes to provide a single source of truth of data and management within your organization, helping to reduce data silos and inconsistencies. With predefined rules that automatically govern the flow and accessibility of data, these clean rooms help ensure data privacy while still allowing for the extraction of valuable insights. Clean rooms create isolated data processing environments that let multiple parties collaborate and share data in a controlled, privacy-safe manner. Use Role-Based Access Control (RBAC) or Attribute-Based Access Control (ABAC) to limit access to data based on the user context.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.6-centralize-shared-data-to-enhance-governance',
				},
				ImprovementPlan: {
					DisplayText:
						'Governing this shared data requires proper control, management, and distribution of data to prevent unauthorized access, data breaches, and other security incidents, fostering trust and enhancing the quality and reliability of software delivery. Implement automated metadata management to better understand the context, source, and lineage of the data, and deploy continuous, automated data quality checks to ensure the accuracy and usability of the data. Refer to AG.DLM.6: Centralize shared data to enhance governance in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.6-centralize-shared-data-to-enhance-governance',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS04-BP06 Use shared file systems or storage to access common data',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a7.html',
							},
							{
								DisplayText: 'Data Collaboration Service - AWS Clean Rooms',
								Url: 'https://aws.amazon.com/clean-rooms',
							},
							{
								DisplayText: 'AWS Lake Formation',
								Url: 'https://aws.amazon.com/lake-formation',
							},
							{
								DisplayText: 'AWS Data Exchange',
								Url: 'https://aws.amazon.com/data-exchange',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DLM_7',
				Title: 'AG.DLM.7: Ensure data safety with automated backup processes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'As data is constantly being created and modified, these processes minimize the risk for data loss and reduce the manual, error-prone manual approach of backing up data. For instance, during the development lifecycle, trigger backups before altering environments with business-critical data and in the case of rollbacks ensure that the data was not impacted. Automated backup mechanisms help to ensure that your data is not only routinely backed up, but also that these backups are maintained and readily available when needed. Define a backup policy that outlines the types of data to be backed up, the frequency of backups, and the duration for which backups should be retained. Create backup policies that best fit the classification of the data to avoid backing up unnecessary data. Regularly test the data restoration process to ensure that the backed-up data can be effectively restored when required.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.7-ensure-data-safety-with-automated-backup-processes',
				},
				ImprovementPlan: {
					DisplayText:
						'As data is constantly being created and modified, these processes minimize the risk for data loss and reduce the manual, error-prone manual approach of backing up data. For instance, during the development lifecycle, trigger backups before altering environments with business-critical data and in the case of rollbacks ensure that the data was not impacted. Refer to AG.DLM.7: Ensure data safety with automated backup processes in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.7-ensure-data-safety-with-automated-backup-processes',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS04-BP08 Back up data only when difficult to recreate',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a9.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL09-BP03 Perform data backup automatically',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_automated_backups_data.html',
							},
							{
								DisplayText:
									'Centrally manage and automate data protection - AWS Backup',
								Url: 'https://aws.amazon.com/backup',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DLM_8',
				Title: 'AG.DLM.8: Improve traceability with data provenance tracking',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Data provenance tracking is particularly recommended for datasets dealing with sensitive or regulated data, machine learning workflows, and complex data processing which may require debugging. For instance, data cataloging tools can manage data assets and their provenance information effectively, providing a systematic way to handle large volumes of data and their metadata across different stages of the development lifecycle. Data provenance tracking is particularly recommended for datasets dealing with sensitive, regulated data or complex data processing workflows. Key aspects of metadata include the data's source, any transformations it underwent (such as aggregation, filtering, or enrichment), the flow of data across systems and services (movements), and actors (the systems or individuals interacting with the data). Regularly review and update the data provenance tracking process to keep it aligned with evolving data practices, business requirements, and to maintain regulatory compliance. It also adds significant value in environments where reproducibility and traceability of data operations are required, such as in data-driven decision-making, machine learning model development, and debugging data issues.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.8-improve-traceability-with-data-provenance-tracking',
				},
				ImprovementPlan: {
					DisplayText:
						'Data provenance tracking is particularly recommended for datasets dealing with sensitive or regulated data, machine learning workflows, and complex data processing which may require debugging. For instance, data cataloging tools can manage data assets and their provenance information effectively, providing a systematic way to handle large volumes of data and their metadata across different stages of the development lifecycle. Refer to AG.DLM.8: Improve traceability with data provenance tracking in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dlm.8-improve-traceability-with-data-provenance-tracking',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Glue Data Catalog',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/serverless-etl-aws-glue/aws-glue-data-catalog.html',
							},
							{
								DisplayText:
									'Well-Architected Data Analytics Lens: Best practice 7.3  Trace data lineage',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/analytics-lens/best-practice-7.3---trace-data-lineage..html',
							},
							{
								DisplayText: 'Amazon SageMaker ML Lineage Tracking',
								Url:
									'https://docs.aws.amazon.com/sagemaker/latest/dg/lineage-tracking.html',
							},
							{
								DisplayText:
									'Blog: Build data lineage for data lakes using AWS Glue, Amazon Neptune, and Spline',
								Url:
									'https://aws.amazon.com/blogs/big-data/build-data-lineage-for-data-lakes-using-aws-glue-amazon-neptune-and-spline',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DLM_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/AG_DLM',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Automated_Governance',
		QuestionId: 'AG_DLM',
		QuestionTitle: 'How do you implement and manage data lifecycle management?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Automated_Governance',
			QuestionDescription:
				'Enforce stringent data controls, residency, privacy, sovereignty, and security throughout the entire data lifecycle. Scale your data collection, processing, classification, retention, disposal, and sharing processes to better align with regulatory compliance and safeguard your software from potential disruptions due to data mismanagement.',
			QuestionId: 'AG_DLM',
			QuestionTitle:
				'How do you implement and manage data lifecycle management?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'AG_DEP_1',
				Title:
					'AG.DEP.1: Establish a controlled, multi-environment landing zone',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"This approach allows the governing platform teams to provision and manage resources, apply common overarching policies, monitor and helps ensure compliance with governance and compliance standards, manage permissions, and implement guardrails to enforce access control guidelines, across all of the environments with minimal overhead. The landing zone often includes processes for managing network connectivity and security, application security, service onboarding, financial management, change management capabilities, and developer experience and tools. Only under special circumstances, such as acquisitions, divestments, management of exceptionally large environments, specific billing requirements, or varying classification levels for government applications, might an organization need to manage multiple landing zones. This enables teams to request or create resources within the landing zone using infrastructure as code (IaC), API calls, and other developer tooling. It's a best practice within the landing zone to separate environments, such as non-production and production, to allow for safer testing and deployments of systems. A landing zone acts as a centralized base from which you can deploy workloads and applications across multiple environments.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.1-establish-a-controlled-multi-environment-landing-zone',
				},
				ImprovementPlan: {
					DisplayText:
						'This approach allows the governing platform teams to provision and manage resources, apply common overarching policies, monitor and helps ensure compliance with governance and compliance standards, manage permissions, and implement guardrails to enforce access control guidelines, across all of the environments with minimal overhead. The landing zone often includes processes for managing network connectivity and security, application security, service onboarding, financial management, change management capabilities, and developer experience and tools. Refer to AG.DEP.1: Establish a controlled, multi-environment landing zone in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.1-establish-a-controlled-multi-environment-landing-zone',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST02-BP03 Implement an account structure',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_account_structure.html',
							},
							{
								DisplayText: 'Cloud Security Governance - AWS Control Tower',
								Url: 'https://aws.amazon.com/controltower',
							},
							{
								DisplayText: 'Landing zone - AWS Prescriptive Guidance',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-migration/aws-landing-zone.html',
							},
							{
								DisplayText: 'Benefits of using multiple AWS accounts',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/benefits-of-using-multiple-aws-accounts.html',
							},
							{
								DisplayText: 'AWS Security Reference Architecture (AWS SRA)',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/welcome.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DEP_2',
				Title: 'AG.DEP.2: Continuously baseline environments to manage drift',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The team must be able to baseline all targeted environments every time a change is made to the overall landing zone desired state definition or when a misconfiguration is detected within the environment. The centralized platform team that manages the landing zone and environments within require the ability to consistently add new features, security configuration, performance improvements, or resolving detected drift issues. As these teams are both making changes to the same environment, it is important that all controls and resources managed by the platform team are secured against unauthorized modifications by other teams operating within the environment. Baselining environments is a structured process for routinely updating and standardizing individual environments within the landing zone to match a specified configured state or baseline. All deployment, updates, or new features made to the environments should be made through an infrastructure as code (IaC) approach, which allows for version control, testing, and reproducibility of environments. Changes being made by the platform team to the environment should be communicated to the other teams to promote a culture of transparency and collaboration.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.2-continuously-baseline-environments-to-manage-drift',
				},
				ImprovementPlan: {
					DisplayText:
						'The team must be able to baseline all targeted environments every time a change is made to the overall landing zone desired state definition or when a misconfiguration is detected within the environment. The centralized platform team that manages the landing zone and environments within require the ability to consistently add new features, security configuration, performance improvements, or resolving detected drift issues. Refer to AG.DEP.2: Continuously baseline environments to manage drift in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.2-continuously-baseline-environments-to-manage-drift',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Customize your AWS Control Tower landing zone',
								Url:
									'https://docs.aws.amazon.com/controltower/latest/userguide/customize-landing-zone.html',
							},
							{
								DisplayText: 'Types of Landing Zone Governance Drift',
								Url:
									'https://docs.aws.amazon.com/controltower/latest/userguide/governance-drift.html',
							},
							{
								DisplayText:
									'Customize accounts with Account Factory Customization (AFC)',
								Url:
									'https://docs.aws.amazon.com/controltower/latest/userguide/af-customization-page.html',
							},
							{
								DisplayText:
									'Overview of AWS Control Tower Account Factory for Terraform (AFT)',
								Url:
									'https://docs.aws.amazon.com/controltower/latest/userguide/aft-overview.html',
							},
							{
								DisplayText:
									'Implementing automatic drift detection in CDK Pipelines using Amazon EventBridge',
								Url:
									'https://aws.amazon.com/blogs/devops/implementing-automatic-drift-detection-in-cdk-pipelines-using-amazon-eventbridge',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DEP_3',
				Title: 'AG.DEP.3: Enable deployment to the landing zone',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Having these environments at the system level, as opposed to sharing environments across multiple systems or at the team level, provides multiple benefits: The deployment environment should include resources and tools to support building, validation, promotion, and deployment of the system. Dedicate an environment for each system to host the resources and tools required to perform controlled and uniform application deployments to related non-production and production environments. A deployment environment may not be necessary for all organizations and scenarios, such as if your development lifecycle tools are hosted on-premises or outside of your landing zone. At a minimum, each system should have a set of deployment, test, and production environments to support the development lifecycle. For these use cases, you will need to verify network connectivity between your external tools and your landing zone environments. These deployment environments can include infrastructure or services such as pipelines and build agents.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.3-enable-deployment-to-the-landing-zone',
				},
				ImprovementPlan: {
					DisplayText:
						'Having these environments at the system level, as opposed to sharing environments across multiple systems or at the team level, provides multiple benefits: The deployment environment should include resources and tools to support building, validation, promotion, and deployment of the system. Dedicate an environment for each system to host the resources and tools required to perform controlled and uniform application deployments to related non-production and production environments. Refer to AG.DEP.3: Enable deployment to the landing zone in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.3-enable-deployment-to-the-landing-zone',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Spaces in CodeCatalyst',
								Url:
									'https://docs.aws.amazon.com/codecatalyst/latest/userguide/spaces.html',
							},
							{
								DisplayText: 'Deployments OU',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/deployments-ou.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DEP_4',
				Title: 'AG.DEP.4: Codify environment vending',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'By provisioning environments, and the accounts operating them, as IaC or API calls, teams are empowered with the flexibility to create environments according to their specific requirements and ways of working. Through infrastructure as code (IaC), teams can establish and manage their environments autonomously in a self-service manner, shifting from traditional methods where operations teams would oversee these responsibilities. Codifying the environment provisioning process provides teams with the flexibility to create both persistent and ephemeral environments based on their specific needs and workflows. These libraries should encapsulate best practices for environment configuration and should be designed to be used directly in deployment pipelines, enabling individual teams to manage their environments autonomously. This reduces the need for manual requests or interactions with a developer portal, as well as reduces the reliance on platform teams for provisioning and managing environments on their behalf. Use shared libraries or services that allow teams to request and manage environments using IaC.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.4-codify-environment-vending',
				},
				ImprovementPlan: {
					DisplayText:
						'By provisioning environments, and the accounts operating them, as IaC or API calls, teams are empowered with the flexibility to create environments according to their specific requirements and ways of working. Through infrastructure as code (IaC), teams can establish and manage their environments autonomously in a self-service manner, shifting from traditional methods where operations teams would oversee these responsibilities. Refer to AG.DEP.4: Codify environment vending in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.4-codify-environment-vending',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What is the AWS CDK?',
								Url: 'https://docs.aws.amazon.com/cdk/v2/guide/home.html',
							},
							{
								DisplayText: 'Create an AWS Proton environment',
								Url:
									'https://docs.aws.amazon.com/proton/latest/userguide/ag-create-env.html',
							},
							{
								DisplayText:
									'Provision and manage accounts with Account Factory',
								Url:
									'https://docs.aws.amazon.com/controltower/latest/userguide/account-factory.html',
							},
							{
								DisplayText: 'Provision Accounts Through Service Catalog',
								Url:
									'https://docs.aws.amazon.com/controltower/latest/userguide/service-catalog.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DEP_5',
				Title:
					'AG.DEP.5: Standardize and manage shared resources across environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Platform teams should deploy and manage shared resources into accounts they manage, then provide APIs or libraries that individual teams can use to consume the shared resources as needed. By unifying the management of these foundational resources, individual teams can focus more on the functionality of their workloads, rather than spending time and effort managing common infrastructure components. This approach enables teams to efficiently use and manage shared resources, such as networking or security services, without the need to replicate their setup in each environment. This approach reduces redundancy and promotes standardization across the organization, allowing development teams to concentrate on their unique workloads rather than complex infrastructure management. Cross-environment resource sharing is the practice of deploying, managing, and providing access to common resources across various environments from a centrally managed account.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.5-standardize-and-manage-shared-resources-across-environments',
				},
				ImprovementPlan: {
					DisplayText:
						'Platform teams should deploy and manage shared resources into accounts they manage, then provide APIs or libraries that individual teams can use to consume the shared resources as needed. By unifying the management of these foundational resources, individual teams can focus more on the functionality of their workloads, rather than spending time and effort managing common infrastructure components. Refer to AG.DEP.5: Standardize and manage shared resources across environments in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.5-standardize-and-manage-shared-resources-across-environments',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Infrastructure OU and accounts',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/infrastructure-ou-and-accounts.html',
							},
							{
								DisplayText: 'Sourcing and distribution',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/management-and-governance-guide/sourcinganddistribution.html',
							},
							{
								DisplayText:
									'Sharing your AWS resources - AWS Resource Access Manager',
								Url:
									'https://docs.aws.amazon.com/ram/latest/userguide/getting-started-sharing.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DEP_6',
				Title:
					'AG.DEP.6: Test landing zone changes in a mirrored non-production landing zone',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'When making changes to a landing zone, establish mirrored landing zones for testing changes before deploying to the production landing zone. To minimize the risk of potential failures when making changes to the landing zone, platform teams should follow similar practices seen in the development lifecycle, including thorough testing and validation in a dedicated environment before rolling out to production. Clearly communicate with those teams before rolling out changes to the production landing zone so that they are informed of imminent changes, potential impacts to their environments and systems, and the projected timeline. Overall, this practice promotes safer changes to the production landing zone which has the potential to impact many teams in the organization. Use deployment pipelines to promote, validate, and deploy changes between the mirrored and production landing zones, performing extensive testing and validation at each stage. Changes to landing zones can have significant impacts across teams and processes because it is consumed by many teams in an organization.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.6-test-landing-zone-changes-in-a-mirrored-non-production-landing-zone',
				},
				ImprovementPlan: {
					DisplayText:
						'When making changes to a landing zone, establish mirrored landing zones for testing changes before deploying to the production landing zone. To minimize the risk of potential failures when making changes to the landing zone, platform teams should follow similar practices seen in the development lifecycle, including thorough testing and validation in a dedicated environment before rolling out to production. Refer to AG.DEP.6: Test landing zone changes in a mirrored non-production landing zone in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.6-test-landing-zone-changes-in-a-mirrored-non-production-landing-zone',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Multiple organizations: Test changes to your overall AWS environment',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/multiple-organizations.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DEP_7',
				Title: 'AG.DEP.7: Utilize metadata for scalable environment management',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Where additional metadata capture is required, consider creating or integrating with a custom tracking system tailored to your specific needs, such as existing configuration management database (CMDB) or IT service management (ITSM) tools, providing a holistic view of all environments, thus empowering platform teams to better govern and manage environments based on their metadata. Not only does this allow platform teams to track and optimize costs by accurately attributing resource usage to specific environments, but it also supports the management of access controls and security measures, aligning governance and compliance needs with individual environments. Although this practice is marked as optional, it is strongly recommended for organizations operating in complex and large-scale environments, where managing resources and configurations based on metadata can significantly improve efficiency, governance, and compliance. This indicator focuses on leveraging metadata for active environment management, distinguishing it from the broader scope of configuration item management. These details can offer visibility and clarity which reduces potential confusion and misuse of environments and assists with setting up proper controls based on specific details associated with the environment. Effective environment management at scale requires the collection and maintenance of key information about each environment, such as ownership, purpose, criticality, lifespan, and more.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.7-utilize-metadata-for-scalable-environment-management',
				},
				ImprovementPlan: {
					DisplayText:
						'Where additional metadata capture is required, consider creating or integrating with a custom tracking system tailored to your specific needs, such as existing configuration management database (CMDB) or IT service management (ITSM) tools, providing a holistic view of all environments, thus empowering platform teams to better govern and manage environments based on their metadata. Not only does this allow platform teams to track and optimize costs by accurately attributing resource usage to specific environments, but it also supports the management of access controls and security measures, aligning governance and compliance needs with individual environments. Refer to AG.DEP.7: Utilize metadata for scalable environment management in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.7-utilize-metadata-for-scalable-environment-management',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Choosing tags for your environment',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/establishing-your-cloud-foundation-on-aws/choosing-tags.html',
							},
							{
								DisplayText: 'Tag policies - AWS Organizations',
								Url:
									'https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_tag-policies.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DEP_8',
				Title:
					'AG.DEP.8: Implement a unified developer portal for self-service environment management',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Consider implementing a self-service portal that empowers developers to create, manage, and decommission their own isolated development or sandbox environments, within the established boundaries set by the platform team. To ensure adherence to the organization's standards and ensure consistency, the portal could include predefined environment templates and resource bundles. The portal can evolve over time into a central resource for common, reusable tools and capabilities preconfigured to comply with organizational standards, facilitating streamlined automated governance activities. This might include centralized access to common tools into a unified developer portal, including observability, security, quality, cost, and organizational use cases. While fostering autonomy for development teams, this approach accelerates the development process and reduces the operational load on the supporting platform team. The self-service portal, if implemented, can adopt the X as a Service (XaaS) interaction model as outlined in the Team Topologies book by Matthew Skelton and Manuel Pais.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.8-implement-a-unified-developer-portal-for-self-service-environment-management',
				},
				ImprovementPlan: {
					DisplayText:
						"Consider implementing a self-service portal that empowers developers to create, manage, and decommission their own isolated development or sandbox environments, within the established boundaries set by the platform team. To ensure adherence to the organization's standards and ensure consistency, the portal could include predefined environment templates and resource bundles. Refer to AG.DEP.8: Implement a unified developer portal for self-service environment management in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.dep.8-implement-a-unified-developer-portal-for-self-service-environment-management',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_DEP_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/AG_DEP',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Automated_Governance',
		QuestionId: 'AG_DEP',
		QuestionTitle:
			'How do you implement and manage dynamic environment provisioning?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Automated_Governance',
			QuestionDescription:
				"Establish strategies and practices to create, maintain, and manage multiple environments within an organization's landing zone, using automated processes. This approach helps ensure consistency and compliance, enhances security, improves operational efficiency, optimizes resource usage, and allows organizations to adapt to changes faster.",
			QuestionId: 'AG_DEP',
			QuestionTitle:
				'How do you implement and manage dynamic environment provisioning?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'AG_ACG_1',
				Title: 'AG.ACG.1: Adopt a risk-based compliance framework',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Risk-based compliance framework such as NIST Cybersecurity Framework, ISO 27001, or CIS Controls help to align your DevOps processes and tools with industry best practices and compliance requirements. Select a relevant framework that fits your business and security needs and assess your current practices against this framework, identifying any gaps in compliance. Managing compliance in a DevOps model can initially feel even more challenging than traditional models due to the fast-paced, iterative, and distributed ways of workings. These frameworks offer a structured methodology for managing cybersecurity risk in compliance with the organization's business needs. Work towards addressing these gaps and continually monitor and reassess your practices to help ensure ongoing compliance. Leverage this well-architected guidance to improve your DevOps capabilities to more efficiently meet these compliance requirements.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.1-adopt-a-risk-based-compliance-framework',
				},
				ImprovementPlan: {
					DisplayText:
						'Risk-based compliance framework such as NIST Cybersecurity Framework, ISO 27001, or CIS Controls help to align your DevOps processes and tools with industry best practices and compliance requirements. Select a relevant framework that fits your business and security needs and assess your current practices against this framework, identifying any gaps in compliance. Refer to AG.ACG.1: Adopt a risk-based compliance framework in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.1-adopt-a-risk-based-compliance-framework',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Security Hub standards reference',
								Url:
									'https://docs.aws.amazon.com/securityhub/latest/userguide/standards-reference.html',
							},
							{
								DisplayText: 'Conformance Packs - AWS Config',
								Url:
									'https://docs.aws.amazon.com/config/latest/developerguide/conformance-packs.html',
							},
							{
								DisplayText: 'Automate Cloud Audits - AWS Audit Manager',
								Url: 'https://aws.amazon.com/audit-manager',
							},
							{
								DisplayText: 'AWS Well-Architected Tool',
								Url: 'https://aws.amazon.com/well-architected-tool',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_2',
				Title:
					'AG.ACG.2: Implement controlled procedures for introducing new services and features',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'As services update and add new features, this will help ensure that the platform team reserves the ability to perform onboarding procedures with these new features as well. To maintain the balance between encouraging innovation and upholding compliance and governance requirements, platform teams need a scalable, controlled procedure for introducing new cloud vendor or third-party services to be used. Provide teams with the ability to explore and experiment with new features and services while maintaining organizational security and compliance standards. Develop a systematic, scalable onboarding process which allows platform teams to enable guardrails and policies for governing usage of the service, which leads to enabling the feature or service in other environments, including production. Create sandbox environments where teams can safely explore and test these features without compromising production environments or violating governance policies. Establish well-defined guardrails that uphold security and compliance when introducing new features and services.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.2-implement-controlled-procedures-for-introducing-new-services-and-features',
				},
				ImprovementPlan: {
					DisplayText:
						'As services update and add new features, this will help ensure that the platform team reserves the ability to perform onboarding procedures with these new features as well. To maintain the balance between encouraging innovation and upholding compliance and governance requirements, platform teams need a scalable, controlled procedure for introducing new cloud vendor or third-party services to be used. Refer to AG.ACG.2: Implement controlled procedures for introducing new services and features in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.2-implement-controlled-procedures-for-introducing-new-services-and-features',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Example service control policies',
								Url:
									'https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_examples_general.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_3',
				Title: 'AG.ACG.3: Automate deployment of detective controls',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automated detective controls are guardrails which continuously monitor the environment, quickly identifying potential risks, and potentially mitigating them. Perform rapid and consistent detection of potential security issues or misconfigurations by deploying automated, centralized detective controls. Leveraging artificial intelligence (AI) and machine learning (ML) can further enhance the capability to monitor and detect non-compliant configurations or complex security threats. Use a compliance as code approach to integrate compliance rules into deployment pipelines. Additionally, implement detective rules in the environment for real-time checks.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.3-automate-deployment-of-detective-controls',
				},
				ImprovementPlan: {
					DisplayText:
						'Automated detective controls are guardrails which continuously monitor the environment, quickly identifying potential risks, and potentially mitigating them. Perform rapid and consistent detection of potential security issues or misconfigurations by deploying automated, centralized detective controls. Refer to AG.ACG.3: Automate deployment of detective controls in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.3-automate-deployment-of-detective-controls',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Cloud Security Posture Management (CSPM) - AWS Security Hub',
								Url: 'https://aws.amazon.com/security-hub',
							},
							{
								DisplayText:
									'AWS Config and AWS Organizations - AWS Organizations',
								Url:
									'https://docs.aws.amazon.com/organizations/latest/userguide/services-that-can-integrate-config.html',
							},
							{
								DisplayText: 'Intelligent Threat Detection - Amazon GuardDuty',
								Url: 'https://aws.amazon.com/guardduty',
							},
							{
								DisplayText:
									'Building Prowler into a QuickSight powered AWS Security Dashboard',
								Url:
									'https://catalog.us-east-1.prod.workshops.aws/workshops/b1cdc52b-eb11-44ed-8dc8-9dfe5fb254f5/en-US',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_4',
				Title:
					'AG.ACG.4: Strengthen security posture with ubiquitous preventative guardrails',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Guardrails can be placed at various stages of the development lifecycle, including being directly enforceable within the environment itselfproviding the most control and security assurance. Use environmental guardrails, such as access control limitations or API conditions, which enforce security measures and compliance ubiquitously across an environment. Automated detective controls are guardrails that continuously monitor the environment, quickly identifying potential risks, and potentially mitigating them. The actual implementation of environmental guardrails can vary based on the specific tools and technologies used within the environment. Perform rapid and consistent detection of potential security issues or misconfigurations by deploying automated, centralized detective controls. Embed similar detective and preventative checks within the deployment pipeline, which will provide faster feedback to development teams.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.4-strengthen-security-posture-with-ubiquitous-preventative-guardrails',
				},
				ImprovementPlan: {
					DisplayText:
						'Guardrails can be placed at various stages of the development lifecycle, including being directly enforceable within the environment itselfproviding the most control and security assurance. Use environmental guardrails, such as access control limitations or API conditions, which enforce security measures and compliance ubiquitously across an environment. Refer to AG.ACG.4: Strengthen security posture with ubiquitous preventative guardrails in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.4-strengthen-security-posture-with-ubiquitous-preventative-guardrails',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Example service control policies',
								Url:
									'https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_examples_general.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_5',
				Title:
					'AG.ACG.5: Automate compliance for data regulations and policies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'This extends to automated enforcement of data access and handling protocols, continuous monitoring of resource configurations for data sovereignty and residency requirements, and automated auditing and risk assessment. By doing so, your organization can adapt swiftly to changing data privacy laws and regulations, bolster your data security governance, and reduce the risk of data breaches or non-compliance. The rapid pace of development and decentralized nature of operating under in a DevOps environment can pose challenges for maintaining data privacy compliance. Set up continuous monitoring systems to assess compliance with data sovereignty and residency requirements. Implement automated tools that can enforce data access and handling policies. These tools should also be capable of automated auditing, risk assessment, and triggering incident response mechanisms when anomalies or threats are detected.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.5-automate-compliance-for-data-regulations-and-policies',
				},
				ImprovementPlan: {
					DisplayText:
						'This extends to automated enforcement of data access and handling protocols, continuous monitoring of resource configurations for data sovereignty and residency requirements, and automated auditing and risk assessment. By doing so, your organization can adapt swiftly to changing data privacy laws and regulations, bolster your data security governance, and reduce the risk of data breaches or non-compliance. Refer to AG.ACG.5: Automate compliance for data regulations and policies in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.5-automate-compliance-for-data-regulations-and-policies',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Data Protection & Privacy at AWS',
								Url: 'https://aws.amazon.com/compliance/data-protection',
							},
							{
								DisplayText: 'Amazon Information Request Report',
								Url:
									'https://d1.awsstatic.com/Security/pdfs/Amazon_Information_Request_Report.pdf',
							},
							{
								DisplayText: 'AWS Security Blog: Data Privacy',
								Url: 'https://aws.amazon.com/blogs/security',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_6',
				Title:
					'AG.ACG.6: Implement auto-remediation for non-compliant findings',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The goal of auto-remediation should not just be the swift resolution of issues, but also the continued education of developers while reducing the overall incidence of non-compliance. In the event of a non-compliance issue, an auto-remediation process should be triggered, which not only resolves the immediate issue but also initiates an alert to the developers. This is important because, while the auto-remediation resolves the problem at the system level, the developers need to be made aware of the problem so that they can correct the source of the error and prevent its recurrence. This dual approach of auto-remediation and developer notification promotes a learning environment and reduces the likelihood of recurring non-compliance issues. Use preventative guardrails and implementing detective and preventative controls directly within the development lifecycle where possible, with auto-remediation being a third best option. It allows developers to address the root cause of the configuration drift or non-compliance to prevent the continual reintroduction of the same error.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.6-implement-auto-remediation-for-non-compliant-findings',
				},
				ImprovementPlan: {
					DisplayText:
						'The goal of auto-remediation should not just be the swift resolution of issues, but also the continued education of developers while reducing the overall incidence of non-compliance. In the event of a non-compliance issue, an auto-remediation process should be triggered, which not only resolves the immediate issue but also initiates an alert to the developers. Refer to AG.ACG.6: Implement auto-remediation for non-compliant findings in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.6-implement-auto-remediation-for-non-compliant-findings',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF07-BP06 Monitor and alarm proactively',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_monitor_instances_post_launch_proactive.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL06-BP04 Automate responses (Real-time processing and alarming)',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_automate_response_monitor.html',
							},
							{
								DisplayText:
									'Remediating Noncompliant Resources with AWS Config Rules',
								Url:
									'https://docs.aws.amazon.com/config/latest/developerguide/remediation.html',
							},
							{
								DisplayText: 'AWS Systems Manager Automation',
								Url:
									'https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-automation.html',
							},
							{
								DisplayText: 'Automated Security Response on AWS',
								Url:
									'https://aws.amazon.com/solutions/implementations/automated-security-response-on-aws',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_7',
				Title: 'AG.ACG.7: Use automated tools for scalable cost management',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure these tools can alert teams when costs are approaching or exceeding budgeted amounts, and where possible, consider implementing auto-remediation methods to optimize resource usage, apply savings plans or reserved instances, and decommission unused resources. Use automated cost tracking mechanisms, such as cost budgets and alerts, and tag resources for cost allocation. Automated cost management tools enable teams to remain agile and innovative while maintaining budgetary control. Use cloud native cost management tools to monitor and report cloud expenditure continuously. As deployment frequency increases due to DevOps improvements, it becomes important to put in place guardrails to control costs.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.7-use-automated-tools-for-scalable-cost-management',
				},
				ImprovementPlan: {
					DisplayText:
						'Ensure these tools can alert teams when costs are approaching or exceeding budgeted amounts, and where possible, consider implementing auto-remediation methods to optimize resource usage, apply savings plans or reserved instances, and decommission unused resources. Use automated cost tracking mechanisms, such as cost budgets and alerts, and tag resources for cost allocation. Refer to AG.ACG.7: Use automated tools for scalable cost management in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.7-use-automated-tools-for-scalable-cost-management',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST02-BP05 Implement cost controls',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_controls.html',
							},
							{
								DisplayText: 'Cloud Financial Management',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/management-and-governance-guide/cloudfinancialmanagement.html',
							},
							{
								DisplayText: 'AWS Billing and Cost Management Conductor',
								Url:
									'https://aws.amazon.com/aws-cost-management/aws-billing-conductor',
							},
							{
								DisplayText: 'AWS Cost Anomaly Detection',
								Url:
									'https://aws.amazon.com/aws-cost-management/aws-cost-anomaly-detection',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_8',
				Title:
					'AG.ACG.8: Conduct regular scans to identify and remove unused resources',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Over time, unused resources can often be a byproduct of experimentation and more frequent deployments, including dormant servers, unused deployment resources, idle containers, redundant environments, and unused serverless functions. Based on the verification results and the organization's policies, take action to remediate these resources, such as updating the software, decommissioning the resources, or integrating them back into the environment. Perform automated scans scoped to all deployed resources in your environment and pinpoint unused or outdated resources. Frequently performing these scans can prevent potential service disruptions, maintain up-to-date software across all resources, and ensure the overall integrity of the DevOps environment. These resources can pile up to create a less than ideal operating environment if not managed effectively, leading to inefficiencies, inflated costs, system unreliability, and heightened security risks. Verify the status and compatibility of software running on these resources, especially if they have been disconnected or powered off for extended periods of time.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.8-conduct-regular-scans-to-identify-and-remove-unused-resources',
				},
				ImprovementPlan: {
					DisplayText:
						"Over time, unused resources can often be a byproduct of experimentation and more frequent deployments, including dormant servers, unused deployment resources, idle containers, redundant environments, and unused serverless functions. Based on the verification results and the organization's policies, take action to remediate these resources, such as updating the software, decommissioning the resources, or integrating them back into the environment. Refer to AG.ACG.8: Conduct regular scans to identify and remove unused resources in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.8-conduct-regular-scans-to-identify-and-remove-unused-resources',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST02-BP06 Track project lifecycle',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_track_lifecycle.html',
							},
							{
								DisplayText: 'Implementing health checks',
								Url:
									'https://aws.amazon.com/builders-library/implementing-health-checks',
							},
							{
								DisplayText:
									'Decommission resources - Cost Optimization Pillar',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/decommission-resources.html',
							},
							{
								DisplayText: 'Identifying your unused resources - DynamoDB',
								Url:
									'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/CostOptimization_UnusedResources.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_9',
				Title:
					'AG.ACG.9: Integrate software provenance tracking throughout the development lifecycle',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Software provenance tracking inspects the origin and evolution of software components throughout their lifecycle to understand where a piece of software originated, its development and update history, and its distribution. For instance, source code provenance should be tracked at the time of code check-in or commit into Version Control Systems like Git, while the provenance of third-party components should be verified at the time of component acquisition and usage using tools like Software Composition Analysis (SCA). Implementing software provenance tracking mitigates these risks by promoting better visibility into the lifecycle of software components, thereby increasing accountability, transparency, and trust. Provenance tracking ensures the integrity of software, maintains compliance, and enhances the security of the software supply chain throughout the development lifecycle. A Software Bill of Materials (SBOM) can be used as a detailed list of all components within your software, including the exact version, digital signatures, and origin of each one. Use digital signatures and hashing algorithms to verify the integrity and provenance of software artifacts as part of the deployment pipeline, validating the signature of an artifact against a trusted source before it is used.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.9-integrate-software-provenance-tracking-throughout-the-development-lifecycle',
				},
				ImprovementPlan: {
					DisplayText:
						'Software provenance tracking inspects the origin and evolution of software components throughout their lifecycle to understand where a piece of software originated, its development and update history, and its distribution. For instance, source code provenance should be tracked at the time of code check-in or commit into Version Control Systems like Git, while the provenance of third-party components should be verified at the time of component acquisition and usage using tools like Software Composition Analysis (SCA). Refer to AG.ACG.9: Integrate software provenance tracking throughout the development lifecycle in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.9-integrate-software-provenance-tracking-throughout-the-development-lifecycle',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Software Bill of Materials (SBOM)',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/software-bill-of-materials-sbom.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_10',
				Title: 'AG.ACG.10: Automate resolution of findings in tracking systems',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automating the resolution of findings in tracking systems can accelerate the security incident response process, prevent untracked mitigation activities, and ensure accuracy in reporting processes. This approach reduces the chances of human error, ensures a faster response to issues, and is capable of providing comprehensive reporting and analytics capabilities to support continuous improvement of the security posture. It also allows teams to focus more on development, resolving issues, and innovation, while automation handles the routine tracking and resolution tasks. Once the issue is resolved, the system should be able to automatically validate the resolution and close the corresponding ticket. Use tools that support automated tracking and resolution capabilities. When an issue is detected, a ticket should be created automatically in the tracking system.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.10-automate-resolution-of-findings-in-tracking-systems',
				},
				ImprovementPlan: {
					DisplayText:
						'Automating the resolution of findings in tracking systems can accelerate the security incident response process, prevent untracked mitigation activities, and ensure accuracy in reporting processes. This approach reduces the chances of human error, ensures a faster response to issues, and is capable of providing comprehensive reporting and analytics capabilities to support continuous improvement of the security posture. Refer to AG.ACG.10: Automate resolution of findings in tracking systems in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.10-automate-resolution-of-findings-in-tracking-systems',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Automation rules - AWS Security Hub',
								Url:
									'https://docs.aws.amazon.com/securityhub/latest/userguide/automation-rules.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_11',
				Title:
					'AG.ACG.11: Digital attestation verification for zero trust deployments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'If attestations for the required quality assurance tests, pipeline stages, or manual approvals are missing or invalid, meaning that compliance and change management requirements were not met during the development lifecycle, the deployment can be either prevented or subjected to an exception mechanism for risk acceptance. It provides a method of authorizing deployment based on adherence to governance and compliance requirements, extending zero trust security model principles to the deployment process. Before deployment, verify that the required attestations have been digitally signed by trusted cryptographic keys and that they meet the change management and compliance policies. Authorizing deployments by verifying attestations extends a zero trust security model to the development lifecycle. This approach to automated governance and change management continuously assesses the integrity of the software throughout the development lifecycle. If a deployment is found to be non-compliant, you can choose to respond in several ways depending on your security and governance requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.11-digital-attestation-verification-for-zero-trust-deployments',
				},
				ImprovementPlan: {
					DisplayText:
						'If attestations for the required quality assurance tests, pipeline stages, or manual approvals are missing or invalid, meaning that compliance and change management requirements were not met during the development lifecycle, the deployment can be either prevented or subjected to an exception mechanism for risk acceptance. It provides a method of authorizing deployment based on adherence to governance and compliance requirements, extending zero trust security model principles to the deployment process. Refer to AG.ACG.11: Digital attestation verification for zero trust deployments in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.acg.11-digital-attestation-verification-for-zero-trust-deployments',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Zero Trust on AWS',
								Url: 'https://aws.amazon.com/security/zero-trust',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_ACG_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/AG_ACG',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Automated_Governance',
		QuestionId: 'AG_ACG',
		QuestionTitle:
			'How do you implement and manage automated compliance and guardrails?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Automated_Governance',
			QuestionDescription:
				'Integrate risk management, business governance adherence, and application and infrastructure governance mechanisms required to maintaining compliance within dynamic, constantly changing environments.',
			QuestionId: 'AG_ACG',
			QuestionTitle:
				'How do you implement and manage automated compliance and guardrails?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'AG_CA_1',
				Title: 'AG.CA.1: Establish comprehensive audit trails',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automated governance, quality assurance, development lifecycle, and observability capabilities provide a significant amount of data about the processes that are being followed by your organization, and the absence of data indicates those that are not. Consider using tools capable of automatically pulling data from resource APIs to collect and organize evidence rather than waiting for data to be pushed to it. This data can form a comprehensive audit trail, as steps such as committing code and doing peer reviews can be traced back to specific actors, actions, and timestamps. Use tools for logging and tracking events should be enforced, along with access controls to maintain the integrity and confidentiality of audit data. This provides a log of evidence that can offer insights for security and audit teams, aiding in identifying suspicious activities, evidencing non-compliance, and uncovering the root cause of issues. Regular audits of your audit systems and processes should also be undertaken to ensure their effectiveness.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.ca.1-establish-comprehensive-audit-trails',
				},
				ImprovementPlan: {
					DisplayText:
						'Automated governance, quality assurance, development lifecycle, and observability capabilities provide a significant amount of data about the processes that are being followed by your organization, and the absence of data indicates those that are not. Consider using tools capable of automatically pulling data from resource APIs to collect and organize evidence rather than waiting for data to be pushed to it. Refer to AG.CA.1: Establish comprehensive audit trails in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.ca.1-establish-comprehensive-audit-trails',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What Is AWS CloudTrail?',
								Url:
									'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html',
							},
							{
								DisplayText: 'Automate Cloud Audits - AWS Audit Manager',
								Url: 'https://aws.amazon.com/audit-manager',
							},
							{
								DisplayText: 'Cloud Audit Academy',
								Url: 'https://aws.amazon.com/compliance/auditor-learning-path',
							},
							{
								DisplayText: 'Compliance and Auditing with AWS',
								Url:
									'https://aws.amazon.com/cloudops/compliance-and-auditing?whats-new-cards.sort-by=item.additionalFields.postDateTime&whats-new-cards.sort-order=desc&blog-posts-cards.sort-by=item.additionalFields.createdDate&blog-posts-cards.sort-order=desc',
							},
							{
								DisplayText: 'Verifiable Controls Evidence Store',
								Url:
									'https://aws.amazon.com/solutions/implementations/verifiable-controls-evidence-store',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_CA_2',
				Title: 'AG.CA.2: Optimize configuration item management',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"In all cases, maintain an up-to-date and accurate record of the configuration status of every item, tracking changes over time to provide a comprehensive audit trail. In a DevOps environment, where changes are frequent and continual, use a tool that maintains a resource inventory and continuous configuration log automatically with every change. It aids in reviewing the frequent changes and updates to infrastructure and application configurations, providing a clear understanding of the system's state at any point in time. Configuration item management involves tracking and recording all resources used across workloads and environments. In cloud-based environments, with its high degree of dynamism, scalability, auto-scaling, and elasticity, verify that your tools can keep up with automated, on-demand changes. Understand the AWS shared responsibility model and which teams within your organization are responsible for managing each aspect of the configuration.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.ca.2-optimize-configuration-item-management',
				},
				ImprovementPlan: {
					DisplayText:
						'In all cases, maintain an up-to-date and accurate record of the configuration status of every item, tracking changes over time to provide a comprehensive audit trail. In a DevOps environment, where changes are frequent and continual, use a tool that maintains a resource inventory and continuous configuration log automatically with every change. Refer to AG.CA.2: Optimize configuration item management in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.ca.2-optimize-configuration-item-management',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS shared responsibility model',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/shared-responsibility.html',
							},
							{
								DisplayText: 'What Is AWS Config?',
								Url:
									'https://docs.aws.amazon.com/config/latest/developerguide/WhatIsConfig.html',
							},
							{
								DisplayText: 'Tagging your AWS resources',
								Url:
									'https://docs.aws.amazon.com/tag-editor/latest/userguide/tagging.html',
							},
							{
								DisplayText: 'What are resource groups?',
								Url:
									'https://docs.aws.amazon.com/ARG/latest/userguide/resource-groups.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_CA_3',
				Title:
					'AG.CA.3: Implement systematic exception tracking and review processes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement a process for tracking exceptions, documenting each exception made and help ensure these exceptions are revisited over time. To prevent exceptions from being lingering for vast amounts of time, implement automated alerts for active exceptions that exceed their expected time frame. During this rapid development cycle, temporary exceptions might need to be made, for instance, granting greater permissions to a user for a specific task, or turning off a governance control for a system update. These reviews will derive the continued necessity of each exception, which could be investigated to become an approved feature, and investigate any unexpected behavior that may have arisen as a result of the exception. While necessary, these exceptions can lead to unexpected issues if not properly managed, and therefore, need to be tracked and revisited. Clear roles and responsibilities should be assigned for the creation, review, and retirement of exceptions to help ensure accountability.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.ca.3-implement-systematic-exception-tracking-and-review-processes',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement a process for tracking exceptions, documenting each exception made and help ensure these exceptions are revisited over time. To prevent exceptions from being lingering for vast amounts of time, implement automated alerts for active exceptions that exceed their expected time frame. Refer to AG.CA.3: Implement systematic exception tracking and review processes in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.ca.3-implement-systematic-exception-tracking-and-review-processes',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_CA_4',
				Title: 'AG.CA.4: Enable iterative internal auditing practices',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Consider taking an event-driven auditing approach which allows for immediate detection and response to compliance issues, increasing overall agility and efficiency with automated evidence gathering and report generation occurring constantly within the environment. By running internal audits continuously and integrating the process into the development lifecycle, developers can address compliance issues early on, often before they become a significant problem. The continuous nature of DevOps supports the idea of frequent audits, providing real-time insights, and practicing proactive risk management. Automated alerts and notifications should be implemented to identify potential issues rapidly and notify teams of non-compliance.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.ca.4-enable-iterative-internal-auditing-practices',
				},
				ImprovementPlan: {
					DisplayText:
						'Consider taking an event-driven auditing approach which allows for immediate detection and response to compliance issues, increasing overall agility and efficiency with automated evidence gathering and report generation occurring constantly within the environment. By running internal audits continuously and integrating the process into the development lifecycle, developers can address compliance issues early on, often before they become a significant problem. Refer to AG.CA.4: Enable iterative internal auditing practices in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/ag.ca.4-enable-iterative-internal-auditing-practices',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Supported control data sources for automated evidence - AWS Audit Manager',
								Url:
									'https://docs.aws.amazon.com/audit-manager/latest/userguide/control-data-sources.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'AG_CA_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/AG_CA',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Automated_Governance',
		QuestionId: 'AG_CA',
		QuestionTitle: 'How do you implement and manage continuous auditing?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Automated_Governance',
			QuestionDescription:
				"Facilitate the ongoing automated assessment of system configurations, activities, and operations against internal policies and regulatory standards to measure adherence. This capability allows organizations to glean real-time insights into their security posture, reducing the time and manual effort traditionally associated with auditing. Continuous auditing enhances an organization's ability to swiftly identify and respond to compliance issues, fostering an environment of proactive security and governance.",
			QuestionId: 'AG_CA',
			QuestionTitle: 'How do you implement and manage continuous auditing?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'DL_LD_1',
				Title:
					'DL.LD.1: Establish development environments for local development',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To keep the development environment as close to the production setup as possible, deployments to the development environment should be sourced from the main releasable branch, rather than from long-lived development branches. Create development environments that provide individual developers with a safe space to test changes and receive immediate feedback without impacting others on the team or shared environments. Development environments serve a different purpose than sandbox environments and should be used for day-to-day development and experimentation that requires access to your software components and services. Development environments are small scale, production-like environments that provide a balance between providing developers with accurate feedback and being low cost and easy to manage. Developers should be encouraged to use their own development environments for testing and debugging to reduce the chance of problems occurring in environments shared by the broader team. Development environments can take the form of dedicated cloud environments, local emulations of infrastructure, or be hosted on a local workstation.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.1-establish-development-environments-for-local-development',
				},
				ImprovementPlan: {
					DisplayText:
						'To keep the development environment as close to the production setup as possible, deployments to the development environment should be sourced from the main releasable branch, rather than from long-lived development branches. Create development environments that provide individual developers with a safe space to test changes and receive immediate feedback without impacting others on the team or shared environments. Refer to DL.LD.1: Establish development environments for local development in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.1-establish-development-environments-for-local-development',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'different purpose',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/sandbox-ou.html#sandbox-and-development-environments',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS02-BP05 Optimize team member resources for activities performed',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a6.html',
							},
							{
								DisplayText: 'Setting Up Your AWS Environment',
								Url:
									'https://aws.amazon.com/getting-started/guides/setup-environment',
							},
							{
								DisplayText: 'Dev Environments in CodeCatalyst',
								Url:
									'https://docs.aws.amazon.com/codecatalyst/latest/userguide/devenvironment.html',
							},
							{
								DisplayText:
									'Best practices for testing serverless applications',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/serverless-application-testing/best-practices.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_2',
				Title: 'DL.LD.2: Consistently provision local environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Standardize and automate the process for setting up local development environments using managed services, infrastructure as code (IaC), and scripted automation. Educate developers on the importance of using the provisioned environments and provide documentation on how to set up and troubleshoot these environments. Create a baseline configuration for your local development environment that mirrors the production setup as closely as possible. Consider allowing developers to request local environments on-demand through a self-service developer portal. Consistent local environments help to reduce issues that occur only on particular machines. This approach permits environments to be reliably replicated across different systems and teams, ensuring uniformity.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.2-consistently-provision-local-environments',
				},
				ImprovementPlan: {
					DisplayText:
						'Standardize and automate the process for setting up local development environments using managed services, infrastructure as code (IaC), and scripted automation. Educate developers on the importance of using the provisioned environments and provide documentation on how to set up and troubleshoot these environments. Refer to DL.LD.2: Consistently provision local environments in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.2-consistently-provision-local-environments',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Additional setup options for AWS Cloud9 (team and enterprise)',
								Url:
									'https://docs.aws.amazon.com/cloud9/latest/user-guide/setup-teams.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_3',
				Title: 'DL.LD.3: Commit local changes early and often',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"This practice makes local development safer, enabling developers to freely innovate without fear of losing completed work by capturing snapshots of iterative changes to the code base. Unlike pushing code changes so that they are accessible to other team members, local commits deal specifically with a developer's individual progress as they develop locally. Placing emphasis on the significance of making frequent local commits adapts developers to the idea of breaking down work into smaller, more manageable batches of work. While developing locally, developers should begin to make small, frequent commits to save versions of their code changes as they develop. Use version control tools, like Git, local testing tools for fast feedback, and conventional commit messages that describe the nature and rationale behind the changes for. Strive to make it a habit to locally commit changes as soon as a logical unit of work is completed.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.3-commit-local-changes-early-and-often',
				},
				ImprovementPlan: {
					DisplayText:
						"This practice makes local development safer, enabling developers to freely innovate without fear of losing completed work by capturing snapshots of iterative changes to the code base. Unlike pushing code changes so that they are accessible to other team members, local commits deal specifically with a developer's individual progress as they develop locally. Refer to DL.LD.3: Commit local changes early and often in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.3-commit-local-changes-early-and-often',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'continuous integration',
								Url: 'https://aws.amazon.com/devops/continuous-integration',
							},
							{
								DisplayText: 'continuous delivery',
								Url: 'https://aws.amazon.com/devops/continuous-delivery',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_4',
				Title: 'DL.LD.4: Enforce security checks before commit',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'It is best to integrate these security tools into pre-commit hooks, integrated development environments (IDEs), and continuous integration pipelines so that changes are continuously checked before code is committed into a shared repository. At a minimum, use pre-commit hooks to identify hidden secrets, like passwords and access keys, before code is published to a shared repository. These hooks can help in the early detection of potential security risks, such as exposed sensitive data or publishing code to untrusted repositories. Pre-commit hooks can be an effective tool for maintaining security best practices. When discovering secrets, the code push should fail immediatelyeffectively preventing a security incident from occurring. Select security tools compatible with your chosen programming languages and customize them to uphold your specific governance and compliance requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.4-enforce-security-checks-before-commit',
				},
				ImprovementPlan: {
					DisplayText:
						'It is best to integrate these security tools into pre-commit hooks, integrated development environments (IDEs), and continuous integration pipelines so that changes are continuously checked before code is committed into a shared repository. At a minimum, use pre-commit hooks to identify hidden secrets, like passwords and access keys, before code is published to a shared repository. Refer to DL.LD.4: Enforce security checks before commit in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.4-enforce-security-checks-before-commit',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Security in every stage of CI/CD pipeline: Pre-commit hooks',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/security-in-every-stage-of-cicd-pipeline.html#pre-commit-hooks',
							},
							{
								DisplayText: 'Security scans - CodeWhisperer',
								Url:
									'https://docs.aws.amazon.com/codewhisperer/latest/userguide/security-scans.html',
							},
							{
								DisplayText: 'AWS-IA opinionated pre-commit hooks',
								Url: 'https://github.com/aws-ia/pre-commit-configs',
							},
							{
								DisplayText:
									'Blog: Extend your pre-commit hooks with AWS CloudFormation Guard',
								Url:
									'https://aws.amazon.com/blogs/security/extend-your-pre-commit-hooks-with-aws-cloudformation-guard',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_5',
				Title: 'DL.LD.5: Enforce coding standards before commit',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automatically and consistently enforcing coding standards during the local development process directly improves the code review process by removing common errors before manual review. It is best to integrate these tools into pre-commit hooks, integrated development environments (IDEs), and continuous integration pipelines so that changes are consistently and continuously checked at all stages of the development lifecycle. Use static code scanning tools, such as linters, to improve code quality and consistency before pushing committed code. Select scanning tools compatible with your chosen programming language and customize them to uphold specific coding standards and styles. Upon discovery, pushing the commit should ideally fail and require immediate correction by the developer. This process can be automated using pre-commit hooks.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.5-enforce-coding-standards-before-commit',
				},
				ImprovementPlan: {
					DisplayText:
						'Automatically and consistently enforcing coding standards during the local development process directly improves the code review process by removing common errors before manual review. It is best to integrate these tools into pre-commit hooks, integrated development environments (IDEs), and continuous integration pipelines so that changes are consistently and continuously checked at all stages of the development lifecycle. Refer to DL.LD.5: Enforce coding standards before commit in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.5-enforce-coding-standards-before-commit',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon CodeGuru Reviewer',
								Url: 'https://aws.amazon.com/codeguru',
							},
							{
								DisplayText: 'AWS CloudFormation Linter',
								Url: 'https://github.com/aws-cloudformation/cfn-lint',
							},
							{
								DisplayText:
									'Validate your AWS SAM applications with AWS CloudFormation Linter',
								Url:
									'https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/validate-cfn-lint.html',
							},
							{
								DisplayText:
									'Workshop: AWS CloudFormation Workshop - Linting and-testing',
								Url:
									'https://catalog.workshops.aws/cfn101/en-US/basics/templates/linting-and-testing',
							},
							{
								DisplayText:
									'Blog: Use Git pre-commit hooks to avoid AWS CloudFormation errors',
								Url:
									'https://aws.amazon.com/blogs/infrastructure-and-automation/use-git-pre-commit-hooks-avoid-aws-cloudformation-errors',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_6',
				Title: 'DL.LD.6: Leverage extensible development tools',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Extensible software development tools, primarily integrated development environments (IDEs) or text editors, can be augmented with plugins or extensions. Verify that there is a process in place for regularly updating these tools and extensions to benefit from the latest improvements and security patches. Teams should be encouraged to experiment with and adopt plugins that enhance code quality, simplify integrations, or speed up routine tasks. Choose development tools that work well with your primary programming languages and technologies in your stack. Over time, curate a list of preferred, approved extensions that align with your DevOps objectives and security requirements. These plugins enhance the functionalities of the software, allowing for improved and tailored developer experiences.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.6-leverage-extensible-development-tools',
				},
				ImprovementPlan: {
					DisplayText:
						'Extensible software development tools, primarily integrated development environments (IDEs) or text editors, can be augmented with plugins or extensions. Verify that there is a process in place for regularly updating these tools and extensions to benefit from the latest improvements and security patches. Refer to DL.LD.6: Leverage extensible development tools in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.6-leverage-extensible-development-tools',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Security in every stage of CI/CD pipeline: IDE tools and plugins',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/security-in-every-stage-of-cicd-pipeline.html#pre-commit-hooks#ide-tools-and-plugins',
							},
							{
								DisplayText: 'Tools to Build on AWS',
								Url: 'https://aws.amazon.com/developer/tools',
							},
							{
								DisplayText: 'AWS Cloud9',
								Url: 'https://aws.amazon.com/cloud9',
							},
							{
								DisplayText: 'Dev Environments in CodeCatalyst',
								Url:
									'https://docs.aws.amazon.com/codecatalyst/latest/userguide/devenvironment.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_7',
				Title: 'DL.LD.7: Establish sandbox environments with spend limits',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Sandbox environments should be treated ephemerally, with automated governance processes managing the lifecycle to create, manage, clean up resources, and destroy sandbox environments as required. Overall, ensure that this policy makes a distinction between sandbox environments and development environments, and lays out the use cases best suited for each. Unlike development environments, which are meant for more structured day-to-day development, they allow more freedom and fewer controls, while ensuring no connectivity to internal networks or other environments. Rules regarding network connectivity should ensure that the sandbox remains isolated, preventing any unintended interactions with other internal networks or environments. Sandbox environments are dedicated spaces for developers to explore, experiment, and innovate with new technologies or ideas. This policy must set clear boundaries on the kinds of data permissible with the sandbox, ensuring no leakage of sensitive information or code.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.7-establish-sandbox-environments-with-spend-limits',
				},
				ImprovementPlan: {
					DisplayText:
						'Sandbox environments should be treated ephemerally, with automated governance processes managing the lifecycle to create, manage, clean up resources, and destroy sandbox environments as required. Overall, ensure that this policy makes a distinction between sandbox environments and development environments, and lays out the use cases best suited for each. Refer to DL.LD.7: Establish sandbox environments with spend limits in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.7-establish-sandbox-environments-with-spend-limits',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST02-BP05 Implement cost controls',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_controls.html',
							},
							{
								DisplayText: 'Sandbox per builder or team with spend limits',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/sandbox-ou.html#sandbox-per-builder-or-team-with-spend-limits',
							},
							{
								DisplayText: 'AWS Innovation Sandbox',
								Url:
									'https://aws.amazon.com/solutions/implementations/aws-innovation-sandbox',
							},
							{
								DisplayText: 'Cloud Financial Management with AWS',
								Url: 'https://aws.amazon.com/aws-cost-management',
							},
							{
								DisplayText: 'Sandbox Accounts for Events',
								Url: 'https://github.com/awslabs/sandbox-accounts-for-events',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_8',
				Title: 'DL.LD.8: Generate mock datasets for local development',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Methods such as masking, encrypting, or tokenizing production datasets can transform real datasets into mock datasets that are safe for local development. Generative AI can be used to generate synthetic datasets that can be used to test applications and is especially useful for generating data that is not often included in testing datasets, such as defects or edge cases. Mock datasets are synthetic or modified datasets that developers can use during the development process, eliminating the need to interact with real, sensitive production data. Use data generating tools to create mock datasets. It might be useful to store already prepared mock datasets that can be shared between teams or systems to perform testing with. This approach creates a realistic local testing environment without risking developers handling actual production data.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.8-generate-mock-datasets-for-local-development',
				},
				ImprovementPlan: {
					DisplayText:
						'Methods such as masking, encrypting, or tokenizing production datasets can transform real datasets into mock datasets that are safe for local development. Generative AI can be used to generate synthetic datasets that can be used to test applications and is especially useful for generating data that is not often included in testing datasets, such as defects or edge cases. Refer to DL.LD.8: Generate mock datasets for local development in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.8-generate-mock-datasets-for-local-development',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Generate test data using an AWS Glue job and Python',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/generate-test-data-using-an-aws-glue-job-and-python.html',
							},
							{
								DisplayText: 'Foundation Model API Service - Amazon Bedrock',
								Url: 'https://aws.amazon.com/bedrock',
							},
							{
								DisplayText: 'What is Generative AI?',
								Url: 'https://aws.amazon.com/what-is/generative-ai',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_9',
				Title: 'DL.LD.9: Share tool configurations',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Sharing tool configuration among project or team members helps ensure a uniform set up of integrated development environment (IDE) settings, text editor preferences, and pre-commit hooks. Having these configurations tailored to each code base can reduce discrepancies in code styles and promote seamless collaboration and a predictable developer experience. This enables any developer working within that repository to begin working in the environment quickly while maintaining team norms. While the idea promotes consistency, be mindful of the need to occasionally tailor configurations for specific tasks and preferences. Periodically review these shared configurations, ensuring they remain updated as tools and practices evolve. Commit tool configuration files to a shared repository.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.9-share-tool-configurations',
				},
				ImprovementPlan: {
					DisplayText:
						'Sharing tool configuration among project or team members helps ensure a uniform set up of integrated development environment (IDE) settings, text editor preferences, and pre-commit hooks. Having these configurations tailored to each code base can reduce discrepancies in code styles and promote seamless collaboration and a predictable developer experience. Refer to DL.LD.9: Share tool configurations in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.9-share-tool-configurations',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Working with AWS project and user settings in the AWS Cloud9 Integrated Development Environment (IDE)',
								Url:
									'https://docs.aws.amazon.com/cloud9/latest/user-guide/settings-aws.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_10',
				Title: 'DL.LD.10: Manage unused development environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Managing unused development environments requires tracking, disabling, or removing development setups that are dormant or no longer in active use. Treat development environments as ephemeral environments to reduces the risk of incurring unexpected cost and leaving potentially insecure resources running. When development environments are not in use, the environment and associated resources should be disabled or deleted. Properly managing unused environments prevents unnecessary resource utilization and potential security threats. Implement automated tools or scripts that monitor activity and provide notifications regarding dormant environments. Regularly audit the active and inactive development environments.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.10-manage-unused-development-environments',
				},
				ImprovementPlan: {
					DisplayText:
						'Managing unused development environments requires tracking, disabling, or removing development setups that are dormant or no longer in active use. Treat development environments as ephemeral environments to reduces the risk of incurring unexpected cost and leaving potentially insecure resources running. Refer to DL.LD.10: Manage unused development environments in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.10-manage-unused-development-environments',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS02-BP03 Stop the creation and maintenance of unused assets',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a4.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST04-BP03 Decommission resources',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning_resources_decommission.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_11',
				Title:
					'DL.LD.11: Implement smart code completion with machine-learning',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use machine learning (ML) algorithms within development tools to predict and suggest code as developers write, based on patterns and commonly used syntax. Incorporate ML-powered code generators into your developer tools, such as IDEs or text editors, for real-time, intelligent code recommendations. Train and refine these tools with regular feedback to ensure they align with your specific coding patterns and practices. This can improve development experience, speed up the coding process, and reduce the potential for errors.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.11-implement-smart-code-completion-with-machine-learning',
				},
				ImprovementPlan: {
					DisplayText:
						'Use machine learning (ML) algorithms within development tools to predict and suggest code as developers write, based on patterns and commonly used syntax. Incorporate ML-powered code generators into your developer tools, such as IDEs or text editors, for real-time, intelligent code recommendations. Refer to DL.LD.11: Implement smart code completion with machine-learning in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ld.11-implement-smart-code-completion-with-machine-learning',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon CodeWhisperer',
								Url: 'https://aws.amazon.com/codewhisperer',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_LD_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/DL_LD',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Development_Lifecycle',
		QuestionId: 'DL_LD',
		QuestionTitle: 'How do you implement and manage local development?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Development_Lifecycle',
			QuestionDescription:
				'Local development concentrates on establishing development environments that mirror the production setup as closely as possible, either on a local machine or in the cloud.',
			QuestionId: 'DL_LD',
			QuestionTitle: 'How do you implement and manage local development?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'DL_SCM_1',
				Title:
					'DL.SCM.1: Use a version control system with appropriate access management',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Version control systems play a role in maintaining the integrity of software components, as they provide an auditable trail of all modifications made to the code base, authorizes users as they access the code base, and help to ensure that changes to the code base can be reverted or rolled back. For open repositories, developers can share code freely to encourage collaboration and learning, while confidential projects or sensitive parts of the code base can use private repositories. This also allows granting broad, organization-wide read access to open repositories, while reserving the ability to limit access to sensitive or confidential private repositories. Implement access management policies on the version control systems which supports a culture of code sharing and collaboration amongst teams in your organization. Having a mix of both open and private repositories allows for a balance between promoting code reuse and collaboration, and safeguarding sensitive information. Using RBAC, you can restrict write (commit) access to specific roles or individuals and can protect the main code base from inadvertent or inappropriate alterations.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.1-use-a-version-control-system-with-appropriate-access-management',
				},
				ImprovementPlan: {
					DisplayText:
						'Version control systems play a role in maintaining the integrity of software components, as they provide an auditable trail of all modifications made to the code base, authorizes users as they access the code base, and help to ensure that changes to the code base can be reverted or rolled back. For open repositories, developers can share code freely to encourage collaboration and learning, while confidential projects or sensitive parts of the code base can use private repositories. Refer to DL.SCM.1: Use a version control system with appropriate access management in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.1-use-a-version-control-system-with-appropriate-access-management',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What Is Repo?',
								Url: 'https://aws.amazon.com/what-is/repo',
							},
							{
								DisplayText: 'AWS CodeCommit',
								Url: 'https://aws.amazon.com/codecommit',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_2',
				Title: 'DL.SCM.2: Keep feature branches short-lived',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"To enforce this, put a process in place to remove branches that are already merged and prevent long-lived branches by actively deleting branches that surpass a specific retention period. Traditional branching methods, such as GitFlow, lean towards creating long-lived feature branches which can introduce challenges including complex merges and divergent code bases. We recommend trunk-based development paired with a pull request workflow utilizing short-lived feature branches as the most effective branching strategy when practicing DevOps. Modern branching strategies, including GitHub flow and trunk-based development, emphasize the significance of keeping feature branches short-lived to avoid these challenges. Larger teams or those working on complex software might lean towards a Pull-Request workflow that uses short-lived branches. Regardless of the branching strategy you choose to use, the principle remains: branches should be transient, preferably representing a single contributor's work.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.2-keep-feature-branches-short-lived',
				},
				ImprovementPlan: {
					DisplayText:
						'To enforce this, put a process in place to remove branches that are already merged and prevent long-lived branches by actively deleting branches that surpass a specific retention period. Traditional branching methods, such as GitFlow, lean towards creating long-lived feature branches which can introduce challenges including complex merges and divergent code bases. Refer to DL.SCM.2: Keep feature branches short-lived in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.2-keep-feature-branches-short-lived',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_3',
				Title:
					'DL.SCM.3: Use artifact repositories with enforced authentication and authorization',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Altering artifacts in the artifact repository degrades the integrity of the artifact and repository, so artifact repositories should enforce that artifacts are immutable. Examples of artifacts that are stored in these repositories are container images, compiled software artifacts, third-party modules, and other shared code modules. Artifact repositories should not contain manually produced artifacts or allow existing artifacts to be altered by users. Using an artifact repository streamlines artifact versioning, access control, traceability, and dependency management, contributing to efficient and reliable software releases. Use role-based or attribute-based access control to limit which users and systems can store and modify artifacts in artifact repositories. Artifact repositories and registries offer secure storage and management for artifacts generated during the build stage of the development lifecycle.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.3-use-artifact-repositories-with-enforced-authentication-and-authorization',
				},
				ImprovementPlan: {
					DisplayText:
						'Altering artifacts in the artifact repository degrades the integrity of the artifact and repository, so artifact repositories should enforce that artifacts are immutable. Examples of artifacts that are stored in these repositories are container images, compiled software artifacts, third-party modules, and other shared code modules. Refer to DL.SCM.3: Use artifact repositories with enforced authentication and authorization in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.3-use-artifact-repositories-with-enforced-authentication-and-authorization',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP05 Centralize services for packages and dependencies',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_centralize_services_for_packages_and_dependencies.html',
							},
							{
								DisplayText: 'Artifact Repository - AWS CodeArtifact',
								Url: 'https://aws.amazon.com/codeartifact',
							},
							{
								DisplayText:
									'Fully Managed Container Registry - Amazon Elastic Container Registry',
								Url: 'https://aws.amazon.com/ecr',
							},
							{
								DisplayText:
									'Code Repositories and Artifact Management | AWS Marketplace',
								Url:
									'https://aws.amazon.com/marketplace/solutions/devops/code-repositories-and-artifact-management?aws-marketplace-cards.sort-by=item.additionalFields.headline&aws-marketplace-cards.sort-order=asc&awsf.aws-marketplace-devops-store-use-cases=*all',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_4',
				Title: 'DL.SCM.4: Grant access only to trusted repositories',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Protect against internal threat actors or inadvertently sharing code to public or untrusted git repositories by limiting the allowed repositories that developers can publish code to. By enforcing usage of trusted repositories, you ensure that only secure, vetted code components and artifacts are used, enhancing software lifecycle stability and security. To maintain the security, integrity, and quality of your software, restrict the usage of untrusted source code and artifact repositories. Untrusted repositories present risks, including potentially introducing vulnerabilities into your software and leaking sensitive code or information. Hosting your own repositories might be advantageous depending on your needs, enabling complete control over available code. This should apply to both artifact and source code repositories across the organization.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.4-grant-access-only-to-trusted-repositories',
				},
				ImprovementPlan: {
					DisplayText:
						'Protect against internal threat actors or inadvertently sharing code to public or untrusted git repositories by limiting the allowed repositories that developers can publish code to. By enforcing usage of trusted repositories, you ensure that only secure, vetted code components and artifacts are used, enhancing software lifecycle stability and security. Refer to DL.SCM.4: Grant access only to trusted repositories in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.4-grant-access-only-to-trusted-repositories',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_5',
				Title:
					'DL.SCM.5: Maintain an approved open-source software license list',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Enforce the allowed and forbidden OSS licenses list by continuously assessing all OSS usage automatically as part of the build process. Continuous enforcement helps to ensure that only approved OSS licenses are used in the code base, reducing the risk of legal issues and license violations while providing developers with fast feedback. Manage and regularly update an allowed and forbidden open-source software (OSS) licenses list. This can be enforced through quality assurance testing processes, like scanning the Software Bill of Materials (SBOM) with Software Composition Analysis (SCA) tooling. This list should reflect which licenses are, or are not, compliant with laws, regulations, and security requirements applicable to your organization. Use this list to detect and prevent legal issues while using open-source components.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.5-maintain-an-approved-open-source-software-license-list',
				},
				ImprovementPlan: {
					DisplayText:
						'Enforce the allowed and forbidden OSS licenses list by continuously assessing all OSS usage automatically as part of the build process. Continuous enforcement helps to ensure that only approved OSS licenses are used in the code base, reducing the risk of legal issues and license violations while providing developers with fast feedback. Refer to DL.SCM.5: Maintain an approved open-source software license list in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.5-maintain-an-approved-open-source-software-license-list',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Software Bill of Materials (SBOM)',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/software-bill-of-materials-sbom.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_6',
				Title: 'DL.SCM.6: Maintain informative repository documentation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'This documentation, often in the form of markdown files like README.md and CONTRIBUTING.md, contains information about reviewing, building, contributing to, and otherwise using the project and helps ensure that this knowledge lives where the code does, making it easily accessible and versioned alongside the code it is applicable to. Every repository should contain detailed documentation providing an overview of the project, its purpose, instructions for building and deploying the project, guidelines for contributions, and methods for submitting feedback or issues. Maintaining well-structured and informative repository documentation directly within the code base promotes collaboration, simplifies onboarding new team members, and improves the ability to maintain software over time. For complex projects, the creation of additional, focused documentation files addressing specific areas can be beneficial.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.6-maintain-informative-repository-documentation',
				},
				ImprovementPlan: {
					DisplayText:
						'This documentation, often in the form of markdown files like README.md and CONTRIBUTING.md, contains information about reviewing, building, contributing to, and otherwise using the project and helps ensure that this knowledge lives where the code does, making it easily accessible and versioned alongside the code it is applicable to. Every repository should contain detailed documentation providing an overview of the project, its purpose, instructions for building and deploying the project, guidelines for contributions, and methods for submitting feedback or issues. Refer to DL.SCM.6: Maintain informative repository documentation in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.6-maintain-informative-repository-documentation',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What Is Repo?',
								Url: 'https://aws.amazon.com/what-is/repo',
							},
							{
								DisplayText: 'Create a commit in AWS CodeCommit',
								Url:
									'https://docs.aws.amazon.com/codecommit/latest/userguide/how-to-create-commit.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_7',
				Title: 'DL.SCM.7: Standardize vulnerability disclosure processes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implementing standardized vulnerability disclosure practices is recommended for optimizing DevOps, as it promotes security, helps manage risk effectively, and encourages the responsible reporting and handling of discovered vulnerabilities. This guidance provides a standardized process for vulnerability disclosure using a machine readable security.txt file, which contains contact details and the vulnerability disclosure policy. A standard vulnerability disclosure policy helps ensure consistent reporting and handling of potential vulnerabilities, which in turn enhances the security of the software development lifecycle. A method for implementation is provided in RFC 9116, A File Format to Aid in Security Vulnerability Disclosure (Foudil, Shafranovich, & Nightwatch Cybersecurity, 2022). This file is to be placed in the /.well-known/ path of a domain name or IP address to enable security researchers to find the right information to report vulnerabilities they discover easily.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.7-standardize-vulnerability-disclosure-processes',
				},
				ImprovementPlan: {
					DisplayText:
						'Implementing standardized vulnerability disclosure practices is recommended for optimizing DevOps, as it promotes security, helps manage risk effectively, and encourages the responsible reporting and handling of discovered vulnerabilities. This guidance provides a standardized process for vulnerability disclosure using a machine readable security.txt file, which contains contact details and the vulnerability disclosure policy. Refer to DL.SCM.7: Standardize vulnerability disclosure processes in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.7-standardize-vulnerability-disclosure-processes',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_8',
				Title:
					'DL.SCM.8: Use a versioning specification to manage software components',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use a versioning specification, such as Semantic Versioning (SemVer), to significantly simplify governance of software governance by providing a systematic approach to tracking different types of releases (major, minor, and patch). This approach helps ensure the reproducibility of software builds, but complicates dependency management as developers then need to make updates to stay up-to-date with security fixes, bug fixes, or other improvements. Implementing version pinning for dependencies is a practical use case enabled by using a versioning specification. Use automated governance dependency management tools to maintain the balance between stable builds and timely updates. For example, if a commit message contains the keyword major, it could trigger an update to the major version number. By locking dependencies to a specific version or version range, build reproducibility is ensured.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.8-use-a-versioning-specification-to-manage-software-components',
				},
				ImprovementPlan: {
					DisplayText:
						'Use a versioning specification, such as Semantic Versioning (SemVer), to significantly simplify governance of software governance by providing a systematic approach to tracking different types of releases (major, minor, and patch). This approach helps ensure the reproducibility of software builds, but complicates dependency management as developers then need to make updates to stay up-to-date with security fixes, bug fixes, or other improvements. Refer to DL.SCM.8: Use a versioning specification to manage software components in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.8-use-a-versioning-specification-to-manage-software-components',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_9',
				Title:
					'DL.SCM.9: Implement plans for deprecating and revoking outdated software components',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Maintaining an up-to-date and secure code base requires the proactive management of components, including removing outdated artifacts, libraries, and repositories. By implementing such plans, you can streamline the code base, making it easier to manage and less prone to errors, while ensuring security and reducing the risk of system failures. These plans should include regular audits of the code base to identify deprecated or unused artifacts, libraries, and repositories. The removal process of outdated components should comply with the organization's data retention policies. Not only does their removal reduce storage costs, but it also mitigates risks associated with deploying outdated or potentially vulnerable software. Develop clear plans for the deprecation and revocation of outdated components.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.9-implement-plans-for-deprecating-and-revoking-outdated-software-components',
				},
				ImprovementPlan: {
					DisplayText:
						'Maintaining an up-to-date and secure code base requires the proactive management of components, including removing outdated artifacts, libraries, and repositories. By implementing such plans, you can streamline the code base, making it easier to manage and less prone to errors, while ensuring security and reducing the risk of system failures. Refer to DL.SCM.9: Implement plans for deprecating and revoking outdated software components in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.9-implement-plans-for-deprecating-and-revoking-outdated-software-components',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST04-BP05 Enforce data retention policies',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning_resources_data_retention.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS02-BP03 Stop the creation and maintenance of unused assets',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a4.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_10',
				Title:
					'DL.SCM.10: Generate a comprehensive software inventory for each build',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Tracking inventory that is machine readable enhances visibility and aids in identifying vulnerabilities and risks, enhancing the security posture of your software at scale. Maintain a comprehensive inventory of the components and dependencies that make up your software assists with identifying vulnerabilities and managing risks. This inventory, often taking the form of a Software Bill of Materials (SBOM), provides valuable insights into the composition of your software. This forms a continuous record of your software's composition, enabling quick and efficient identification and management of potential vulnerabilities or risks. Open-source tool sets provided by Open Worldwide Application Security Project (OWASP) and the Linux Foundation offer options for creating and managing SBOMs in standardized formats. Use a tool to create and manage SBOMs, centralizing them with other build artifacts for easier accessibility.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.10-generate-a-comprehensive-software-inventory-for-each-build',
				},
				ImprovementPlan: {
					DisplayText:
						'Tracking inventory that is machine readable enhances visibility and aids in identifying vulnerabilities and risks, enhancing the security posture of your software at scale. Maintain a comprehensive inventory of the components and dependencies that make up your software assists with identifying vulnerabilities and managing risks. Refer to DL.SCM.10: Generate a comprehensive software inventory for each build in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.scm.10-generate-a-comprehensive-software-inventory-for-each-build',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Software Bill of Materials (SBOM)',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/software-bill-of-materials-sbom.html',
							},
							{
								DisplayText: 'Exporting SBOMs with Amazon Inspector',
								Url:
									'https://docs.aws.amazon.com/inspector/latest/user/sbom-export.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_SCM_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/DL_SCM',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Development_Lifecycle',
		QuestionId: 'DL_SCM',
		QuestionTitle:
			'How do you implement and manage software component management?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Development_Lifecycle',
			QuestionDescription:
				'There are many software components that are consumed and generated during the development lifecycle, including libraries, repositories, shared modules, build artifacts, and third-party dependencies.',
			QuestionId: 'DL_SCM',
			QuestionTitle:
				'How do you implement and manage software component management?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'DL_EAC_1',
				Title: 'DL.EAC.1: Organize infrastructure as code for scale',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Service Catalog suits organizations favoring predefined deployment standards and centrally defined resource provisioning, while AWS Proton is ideal for organizations that allow development teams to maintain infrastructure and application autonomy. For example, services like AWS Service Catalog and AWS Proton provide distinct methods to distribute and consume secure-by-default software components and IaC in different ways. Effectively organizing and scaling IaC within your organization enhances flexibility, readability, and reusability across multiple teams, while streamlining infrastructure provisioning and maintenance. Some organizations might prefer to adopt a fully decentralized approach, where individual teams provision and manage their own AWS CloudFormation IaC templates. Treat IaC testing with the same rigor as other software, focusing on security risks like excessive privileges or open security groups, while upholding quality standards. Infrastructure as code (IaC) provides consistent and automated infrastructure management capabilities which are important to DevOps adoption.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.1-organize-infrastructure-as-code-for-scale',
				},
				ImprovementPlan: {
					DisplayText:
						'Service Catalog suits organizations favoring predefined deployment standards and centrally defined resource provisioning, while AWS Proton is ideal for organizations that allow development teams to maintain infrastructure and application autonomy. For example, services like AWS Service Catalog and AWS Proton provide distinct methods to distribute and consume secure-by-default software components and IaC in different ways. Refer to DL.EAC.1: Organize infrastructure as code for scale in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.1-organize-infrastructure-as-code-for-scale',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Service Catalog',
								Url: 'https://aws.amazon.com/servicecatalog',
							},
							{
								DisplayText: 'AWS Proton',
								Url: 'https://aws.amazon.com/proton',
							},
							{
								DisplayText: 'AWS CloudFormation',
								Url: 'https://aws.amazon.com/cloudformation',
							},
							{
								DisplayText:
									'Infrastructure as code - Introduction to DevOps on AWS',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/introduction-devops-aws/infrastructure-as-code.html',
							},
							{
								DisplayText: 'Infrastructure as Code on AWS - An Introduction',
								Url:
									'https://blog.awsfundamentals.com/infrastructure-as-code-on-aws-an-introduction',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_EAC_2',
				Title: 'DL.EAC.2: Modernize networks through infrastructure as code',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use infrastructure as code (IaC) tools to define network infrastructure and configurations and use development lifecycle capabilities like continuous integration and continuous delivery (CI/CD) for deploying networking changes. Networking as code enables the predictable and repeatable provisioning of networking components, making infrastructure more modular and less prone to error. Often, platform teams manage network components on behalf of individual teams when possible so that all teams do not need to become networking experts. Apply DevOps practices to networking systems to streamline network operations, reduce human errors, and speed up network deployments. The practice of managing networking configurations through code, including network automation, version control, and rigorous testing to ensure quality and stability. Like other systems, networking changes should undergo automated testing to provide assurance that they meet functional, non-functional, and security requirements before deployment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.2-modernize-networks-through-infrastructure-as-code',
				},
				ImprovementPlan: {
					DisplayText:
						'Use infrastructure as code (IaC) tools to define network infrastructure and configurations and use development lifecycle capabilities like continuous integration and continuous delivery (CI/CD) for deploying networking changes. Networking as code enables the predictable and repeatable provisioning of networking components, making infrastructure more modular and less prone to error. Refer to DL.EAC.2: Modernize networks through infrastructure as code in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.2-modernize-networks-through-infrastructure-as-code',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'NetDevOps: A modern approach to AWS networking deployments',
								Url:
									'https://aws.amazon.com/blogs/networking-and-content-delivery/netdevops-a-modern-approach-to-aws-networking-deployments',
							},
							{
								DisplayText:
									'NetDevSecOps to modernize AWS networking deployments',
								Url:
									'https://aws.amazon.com/blogs/networking-and-content-delivery/netdevsecops-to-modernize-aws-networking-deployments',
							},
							{
								DisplayText:
									'Field Notes: Using Infrastructure as Code to Manage Your AWS Networking Environment',
								Url:
									'https://aws.amazon.com/blogs/architecture/field-notes-using-infrastructure-as-code-to-manage-your-aws-networking-environment',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_EAC_3',
				Title: 'DL.EAC.3: Codify data operations',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Codifying data operations in a DevOps environment extends the infrastructure as code (IaC) principle to data management, which involves treating database schemas, data transformations, and data pipelines as code. Codifying data operations enables other DevOps capabilities including the use of data management pipelines for data lifecycle management, enforcing quality assurance and governance standards, providing auditability of changes, and the ability to rollback changes when necessary. To start managing existing data source schemas as code, database migration and event analysis tools like AWS DMS Schema Conversion Tool and Amazon EventBridge can help to infer schemas from existing data sources. Store database schemas, along with any related procedures, views, and triggers, in version control systems alongside your application code. This enables the ability to track, review, and test schema changes before deploying them to your production environment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.3-codify-data-operations',
				},
				ImprovementPlan: {
					DisplayText:
						'Codifying data operations in a DevOps environment extends the infrastructure as code (IaC) principle to data management, which involves treating database schemas, data transformations, and data pipelines as code. Codifying data operations enables other DevOps capabilities including the use of data management pipelines for data lifecycle management, enforcing quality assurance and governance standards, providing auditability of changes, and the ability to rollback changes when necessary. Refer to DL.EAC.3: Codify data operations in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.3-codify-data-operations',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS DMS Schema Conversion Tool',
								Url: 'https://aws.amazon.com/dms/schema-conversion-tool',
							},
							{
								DisplayText: 'Amazon EventBridge',
								Url: 'https://aws.amazon.com/eventbridge',
							},
							{
								DisplayText:
									'Converting database schemas using DMS Schema Conversion',
								Url:
									'https://docs.aws.amazon.com/dms/latest/userguide/CHAP_SchemaConversion.html',
							},
							{
								DisplayText: 'Creating an Amazon EventBridge schema',
								Url:
									'https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-schema-create.html',
							},
							{
								DisplayText:
									'Using Amazon RDS Blue/Green Deployments for database updates',
								Url:
									'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_EAC_4',
				Title:
					'DL.EAC.4: Implement continuous configuration for enhanced application management',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Continuous configuration uses configuration as code to enhance configuration management by allowing configuration changes to be made independently of application code deployments. Configuration as code is the practice of managing and tracking configuration changes as code, providing an audit trail and reducing errors from manual changes. Just like with application deployment pipelines, these configuration deployment pipelines should run quality assurance tests, followed by deployment in a non-production environment before deploying to production. For large-scale deployment of configuration as code, a Dynamic Configuration Pipeline is recommended. It ensures that all configurations are version-controlled, adhere to quality assurance and code review processes, and is capable of progressively deploying configuration changes and performing rollbacks as necessary to minimize system disruptions. General use cases for continuous configuration include application integration tuning, feature toggling, allowing access to premium content through allow lists, and addressing operational issues and troubleshooting.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.4-implement-continuous-configuration-for-enhanced-application-management',
				},
				ImprovementPlan: {
					DisplayText:
						'Continuous configuration uses configuration as code to enhance configuration management by allowing configuration changes to be made independently of application code deployments. Configuration as code is the practice of managing and tracking configuration changes as code, providing an audit trail and reducing errors from manual changes. Refer to DL.EAC.4: Implement continuous configuration for enhanced application management in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.4-implement-continuous-configuration-for-enhanced-application-management',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Continuous configuration',
								Url:
									'https://www.allthingsdistributed.com/2021/08/continuous-configuration-on-aws.html',
							},
							{
								DisplayText: 'AWS AppConfig',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig',
							},
							{
								DisplayText: 'Feature flags',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig#Feature_flags',
							},
							{
								DisplayText: 'Dynamic Configuration Pipeline',
								Url:
									'https://aws-samples.github.io/aws-deployment-pipeline-reference-architecture/dynamic-configuration-pipeline/index.html',
							},
							{
								DisplayText:
									'AWS Cloud Adoption Framework: Operations Perspective - Configuration management',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/aws-caf-operations-perspective/configuration-management.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_EAC_5',
				Title:
					'DL.EAC.5: Integrate technical and operational documentation into the development lifecycle',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"While some aspects of these documents still likely require manual effort to create, the benefits of incorporating these documents into the development lifecycle include enforced reviews of changes, ability to write tests to suggest updating documentation when changes are significant or made to important components, and versioning the documents for auditability. Integrating documentation and code involves creating, maintaining, and publishing documentation using the same tools and processes used for application development. The documentation can be made directly accessible through the repository or through knowledge sharing tools capable of rendering the markup language, like Git-based wikis, static site generators, or directly in developers' integrated development environments (IDEs). Many of these tools can create API references, class diagrams, or other technical documents from inline comments in your source code, ensuring the documentation is always in line with the most recent changes. This information can be used as a source to generate detailed documentation and change logs using tools specific to the programming language and platforms being used. This approach is not only limited to documenting code, but also can be used to store operational documentation like incident response procedures, disaster recovery plans, training material, and onboarding processes.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.5-integrate-technical-and-operational-documentation-into-the-development-lifecycle',
				},
				ImprovementPlan: {
					DisplayText:
						'While some aspects of these documents still likely require manual effort to create, the benefits of incorporating these documents into the development lifecycle include enforced reviews of changes, ability to write tests to suggest updating documentation when changes are significant or made to important components, and versioning the documents for auditability. Integrating documentation and code involves creating, maintaining, and publishing documentation using the same tools and processes used for application development. Refer to DL.EAC.5: Integrate technical and operational documentation into the development lifecycle in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.5-integrate-technical-and-operational-documentation-into-the-development-lifecycle',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL12-BP01 Use playbooks to investigate failures',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_playbook_resiliency.html',
							},
							{
								DisplayText: 'AWS Incident Response Playbook Samples',
								Url:
									'https://github.com/aws-samples/aws-incident-response-playbooks',
							},
							{
								DisplayText:
									'How to build an automated C# code documentation generator using AWS DevOps',
								Url:
									'https://aws.amazon.com/blogs/modernizing-with-aws/how-to-build-an-automated-c-code-documentation-generator-using-aws-devops',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_EAC_6',
				Title:
					'DL.EAC.6: Use general-purpose programming languages to generate Infrastructure-as-Code',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Instead of providing environment-specific configuration during deployment, tools like AWS Cloud Development Kit (AWS CDK) generate separate templates for each environment using configurations defined in source code. Developing infrastructure as code (IaC) using general-purpose programming languages aligns closely with modern software development practices and DevOps principles. While parameterized templates are still a best practice for traditional IaC templates, this approach can become difficult to develop, troubleshoot, and manage as infrastructure and environments become more complex. IaC has traditionally been implemented as predefined templates modeled through domain-specific languages using markup languages like JSON or YAML. It is no longer a collection of parameterized templates, but instead infrastructure is written in common programming languages such as TypeScript, Python, or Java, and can be treated the same as other code throughout the development lifecycle. Transitioning to using general-purpose programming languages for IaC can also change how you govern IaC at scale.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.6-use-general-purpose-programming-languages-to-generate-infrastructure-as-code',
				},
				ImprovementPlan: {
					DisplayText:
						'Instead of providing environment-specific configuration during deployment, tools like AWS Cloud Development Kit (AWS CDK) generate separate templates for each environment using configurations defined in source code. Developing infrastructure as code (IaC) using general-purpose programming languages aligns closely with modern software development practices and DevOps principles. Refer to DL.EAC.6: Use general-purpose programming languages to generate Infrastructure-as-Code in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.6-use-general-purpose-programming-languages-to-generate-infrastructure-as-code',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Cloud Development Kit (AWS CDK)',
								Url:
									'https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html#best-practices-apps-stages',
							},
							{
								DisplayText: 'constructs',
								Url: 'https://docs.aws.amazon.com/cdk/v2/guide/constructs.html',
							},
							{
								DisplayText: 'Construct Hub',
								Url: 'https://constructs.dev',
							},
							{
								DisplayText:
									'Best practices for developing and deploying cloud infrastructure with the AWS CDK',
								Url:
									'https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html',
							},
							{
								DisplayText: 'CDK for Kubernetes (CDK8s)',
								Url: 'https://cdk8s.io',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_EAC_7',
				Title: 'DL.EAC.7: Automate compute image generation and distribution',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The build stage creates the image based on its code definition, the test stage validates the functionality and security compliance of the image, and the distribution stage ensures the image is readily available for teams to use in their environments and workloads. Given the diverse range of applications and infrastructure requirements, especially when using managed cloud-based services, not all organizations or workloads necessitate using dedicated compute images or codifying them. Similar to other forms of infrastructure as code (IaC), compute images can be codified, stored in version control systems, tested, and distributed as part of the development lifecycle. The management of compute images, including containers and machine images, can be optimized and made more reliable through a code-driven approach. Compute images generally include a base image, libraries, environment variables, application code, and configuration files. Establish automated pipelines for building, testing, and distributing compute images.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.7-automate-compute-image-generation-and-distribution',
				},
				ImprovementPlan: {
					DisplayText:
						'The build stage creates the image based on its code definition, the test stage validates the functionality and security compliance of the image, and the distribution stage ensures the image is readily available for teams to use in their environments and workloads. Given the diverse range of applications and infrastructure requirements, especially when using managed cloud-based services, not all organizations or workloads necessitate using dedicated compute images or codifying them. Refer to DL.EAC.7: Automate compute image generation and distribution in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.eac.7-automate-compute-image-generation-and-distribution',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon EC2 Image Builder',
								Url: 'https://aws.amazon.com/image-builder',
							},
							{
								DisplayText: 'AWS Deployment Pipeline Reference Architecture',
								Url:
									'https://aws-samples.github.io/aws-deployment-pipeline-reference-architecture',
							},
							{
								DisplayText: 'What is AWS App2Container?',
								Url:
									'https://docs.aws.amazon.com/app2container/latest/UserGuide/what-is-a2c.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_EAC_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/DL_EAC',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Development_Lifecycle',
		QuestionId: 'DL_EAC',
		QuestionTitle: 'How do you implement and manage everything as code?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Development_Lifecycle',
			QuestionDescription:
				'Everything as code is a software development practice that seeks to apply the same principles of version control, testing, and deployment to enhance maintainability and scalability of all aspects of the development lifecycle, including networking infrastructure, documentation, and configuration.',
			QuestionId: 'DL_EAC',
			QuestionTitle: 'How do you implement and manage everything as code?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'DL_CR_1',
				Title: 'DL.CR.1: Standardize coding practices',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Having standards not only helps ensure consistency across distributed teams, but can also make code reviews more efficient, support knowledge sharing, and lead to faster issue resolution. Hold training sessions for developers on these standards, store them in centralized knowledge sharing spaces, and create mechanisms to gather feedback to continuously improve the standard over time. The coding standards are meant to facilitate error detection, improve code readability, simplify maintenance, and enhance the overall efficiency of builders, not prevent innovation. We recommend getting started by adopting industry-specific standards, such as the Secure Coding Guidelines for Java SE, Conventional Commits for Git, or the PEP8 styling guide for Python. Identify or develop coding standards that align with the primary programming languages used across the organization. Coding standards promote uniformity and consistency across the organization.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.1-standardize-coding-practices',
				},
				ImprovementPlan: {
					DisplayText:
						'Having standards not only helps ensure consistency across distributed teams, but can also make code reviews more efficient, support knowledge sharing, and lead to faster issue resolution. Hold training sessions for developers on these standards, store them in centralized knowledge sharing spaces, and create mechanisms to gather feedback to continuously improve the standard over time. Refer to DL.CR.1: Standardize coding practices in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.1-standardize-coding-practices',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CR_2',
				Title: 'DL.CR.2: Perform peer review for code changes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'A peer review process for code changes is a strategy for ensuring code quality and shared responsibility. Most version control systems support protection rules enforcing certain workflows, like requiring at least one peer review, before merging into designated branches. Use these rules to enforce this workflow and provide assurance that all code changes adhere to this mandatory review process. This accelerates review timelines, reduces the introduction of bugs or issues, promotes knowledge sharing, and creates a culture of quality and continuous improvement. Pick a code review process that works for your organization, and enforce it through policies, processes, and technology. Incorporating pair programming, where two programmers collaboratively work side-by-side or through screen sharing, is method of peer review.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.2-perform-peer-review-for-code-changes',
				},
				ImprovementPlan: {
					DisplayText:
						'A peer review process for code changes is a strategy for ensuring code quality and shared responsibility. Most version control systems support protection rules enforcing certain workflows, like requiring at least one peer review, before merging into designated branches. Refer to DL.CR.2: Perform peer review for code changes in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.2-perform-peer-review-for-code-changes',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP04 Manual code reviews',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_manual_code_reviews.html',
							},
							{
								DisplayText: 'Team Collaboration with Amazon CodeCatalyst',
								Url:
									'https://aws.amazon.com/blogs/devops/team-collaboration-with-amazon-codecatalyst',
							},
							{
								DisplayText:
									'Working with approval rule templates in AWS CodeCommit',
								Url:
									'https://docs.aws.amazon.com/codecommit/latest/userguide/approval-rule-templates.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CR_3',
				Title: 'DL.CR.3: Establish clear completion criteria for code tasks',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The done criteria should include the types of testing that need to be done (like functional, non-functional, or security tests), any required documentation (like code comments or user manuals), and the standards the code needs to meet (such as performance, availability, or team style guides). To implement a clear definition of done, initiate discussions among all team members during the design phase to identify and agree on the criteria that should be included. A clear definition of done ensures that developers understand the requirements of their task, can consistently meet those requirements, and that reviewers have a sense of what they are reviewing. Having a clear definition of done can streamline the review process and reduce the number of issues that need to be addressed in later stages of the development lifecycle. Once these criteria are defined and agreed upon, document them, and make this definition of done available and visible to all team members. It should be used as a checklist during the code review process to ensure that all changes meet the established criteria.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.3-establish-clear-completion-criteria-for-code-tasks',
				},
				ImprovementPlan: {
					DisplayText:
						'The done criteria should include the types of testing that need to be done (like functional, non-functional, or security tests), any required documentation (like code comments or user manuals), and the standards the code needs to meet (such as performance, availability, or team style guides). To implement a clear definition of done, initiate discussions among all team members during the design phase to identify and agree on the criteria that should be included. Refer to DL.CR.3: Establish clear completion criteria for code tasks in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.3-establish-clear-completion-criteria-for-code-tasks',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CR_4',
				Title:
					'DL.CR.4: Comprehensive code reviews with an emphasis on business logic',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Using automated code review tools is recommended for improved efficiency and consistency, but is not absolutely required for code reviews as DevOps teams can function and conduct manual code reviews without them. Use automated code review tools to detect potential issues before they are merged into the code base. This also frees manual reviewers from needing to review for trivial issues like code style inconsistencies or syntax errors. Start by identifying the types of issues that can be automated (like code formatting, syntax errors, and potential security vulnerabilities). Integrate these quality assurance (QA) tools into your development lifecycle so that the checks are automatically run when code changes are being developed and merged. Reviewers can instead focus on more on complex aspects of the code such as business logic, maintainability, and scalability, which may be difficult to automate.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.4-comprehensive-code-reviews-with-an-emphasis-on-business-logic',
				},
				ImprovementPlan: {
					DisplayText:
						'Using automated code review tools is recommended for improved efficiency and consistency, but is not absolutely required for code reviews as DevOps teams can function and conduct manual code reviews without them. Use automated code review tools to detect potential issues before they are merged into the code base. Refer to DL.CR.4: Comprehensive code reviews with an emphasis on business logic in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.4-comprehensive-code-reviews-with-an-emphasis-on-business-logic',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Create code reviews in Amazon CodeGuru Reviewer',
								Url:
									'https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/create-code-reviews.html',
							},
							{
								DisplayText:
									'Automate code reviews with Amazon CodeGuru Reviewer',
								Url:
									'https://aws.amazon.com/blogs/devops/automate-code-reviews-with-amazon-codeguru-reviewer',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CR_5',
				Title: 'DL.CR.5: Foster a constructive and inclusive review culture',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To implement a positive and inclusive review culture, teams should establish clear guidelines on the expectations for code reviews, including language use and constructive feedback. The tone and approach of code reviews can greatly impact the efficiency of the process, team morale, and ultimately the quality of the product. A positive and inclusive review culture encourages more open discussion, facilitates knowledge sharing, and can lead to improved code quality. Encourage team members to focus on the code and not the coder, to be respectful and patient, and to frame suggestions as questions or alternatives rather than absolute critiques. Use the available escalation paths and mutually agreed upon team guiding principles to quickly resolve team differences and act as tie breakers during disagreement. Code reviews should be respectful and collaborative interactions that cultivate a positive and inclusive culture.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.5-foster-a-constructive-and-inclusive-review-culture',
				},
				ImprovementPlan: {
					DisplayText:
						'To implement a positive and inclusive review culture, teams should establish clear guidelines on the expectations for code reviews, including language use and constructive feedback. The tone and approach of code reviews can greatly impact the efficiency of the process, team morale, and ultimately the quality of the product. Refer to DL.CR.5: Foster a constructive and inclusive review culture in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.5-foster-a-constructive-and-inclusive-review-culture',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CR_6',
				Title: 'DL.CR.6: Initiate code reviews using pull requests',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'This method uses feature branches solely to trigger code review processes through a pull request workflow. This workflow could include requiring multiple peer reviewers, or enforcing that reviews must take place before code is integrated into the main releasable branch. A pull request workflow is recommended for organizations and teams which have enhanced code review requirements. We recommend adopting trunk-based development paired with a pull request workflow utilizing short-lived feature branches. Some organizations and smaller teams may choose to strictly follow trunk-based development practices and commit changes directly to the main releasable branch. They can be used to propose, review, and integrate changes from a feature branch into the main releasable branch.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.6-initiate-code-reviews-using-pull-requests',
				},
				ImprovementPlan: {
					DisplayText:
						'This method uses feature branches solely to trigger code review processes through a pull request workflow. This workflow could include requiring multiple peer reviewers, or enforcing that reviews must take place before code is integrated into the main releasable branch. Refer to DL.CR.6: Initiate code reviews using pull requests in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.6-initiate-code-reviews-using-pull-requests',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Pull requests',
								Url:
									'https://docs.aws.amazon.com/codecommit/latest/userguide/pull-requests.html',
							},
							{
								DisplayText: 'Reviewing a pull request - Amazon CodeCatalyst',
								Url:
									'https://docs.aws.amazon.com/codecatalyst/latest/userguide/pull-requests-review.html',
							},
							{
								DisplayText: 'Review a pull request - AWS CodeCommit',
								Url:
									'https://docs.aws.amazon.com/codecommit/latest/userguide/how-to-review-pull-request.html',
							},
							{
								DisplayText: 'Team Collaboration with Amazon CodeCatalyst',
								Url:
									'https://aws.amazon.com/blogs/devops/team-collaboration-with-amazon-codecatalyst',
							},
							{
								DisplayText:
									'Working with approval rule templates in AWS CodeCommit',
								Url:
									'https://docs.aws.amazon.com/codecommit/latest/userguide/approval-rule-templates.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CR_7',
				Title:
					'DL.CR.7: Create consistent and descriptive commit messages using a specification',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Consistent commit messages improve collaboration, make it easier to track and understand changes, aid in debugging, and can be used to automatically generate change logs. Adopting a commit specification is recommended as it greatly enhances communication and collaboration by clearly documenting the changes being made and why they are important to the overall system. Use a well-documented specification, descriptive commit message format that clearly explain what changes were made and why. Adopt a specification, such as Conventional Commits, to indicate code features, fixes, and breaking changes through commit messages. If done consistently, this information could be used to automatically generate legible change log records for non-developer consumers and users of the system. Training and documentation can also be used to educate developers on the importance and use of this specification.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.7-create-consistent-and-descriptive-commit-messages-using-a-specification',
				},
				ImprovementPlan: {
					DisplayText:
						'Consistent commit messages improve collaboration, make it easier to track and understand changes, aid in debugging, and can be used to automatically generate change logs. Adopting a commit specification is recommended as it greatly enhances communication and collaboration by clearly documenting the changes being made and why they are important to the overall system. Refer to DL.CR.7: Create consistent and descriptive commit messages using a specification in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.7-create-consistent-and-descriptive-commit-messages-using-a-specification',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CR_8',
				Title: 'DL.CR.8: Designate code owners for expert review',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'While this practice is optional and not beneficial for all organizations, it can be particularly useful for larger teams or those with complex, distributed systems as it provides an additional layer of control and can prevent potential issues from going unnoticed if all reviewers are not equally experienced with a specific or complex part of the code base. To implement a code owners process, determine who the code owners should be based on expertise and distribute the ownership equally amongst the team to avoid bottlenecks. A code owners process assigns a designated owner, usually the person or team with the most knowledge or expertise, to each part of the code base. You can use features in version control systems that automatically assign code owners to review code changes in their area of expertise. One example of this would be to use a CODEOWNERS file stored along with the code in the repository. This file defines individuals or teams that are responsible for code in a repository.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.8-designate-code-owners-for-expert-review',
				},
				ImprovementPlan: {
					DisplayText:
						'While this practice is optional and not beneficial for all organizations, it can be particularly useful for larger teams or those with complex, distributed systems as it provides an additional layer of control and can prevent potential issues from going unnoticed if all reviewers are not equally experienced with a specific or complex part of the code base. To implement a code owners process, determine who the code owners should be based on expertise and distribute the ownership equally amongst the team to avoid bottlenecks. Refer to DL.CR.8: Designate code owners for expert review in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cr.8-designate-code-owners-for-expert-review',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CR_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/DL_CR',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Development_Lifecycle',
		QuestionId: 'DL_CR',
		QuestionTitle: 'How do you implement and manage code review?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Development_Lifecycle',
			QuestionDescription:
				'Code reviews serve as a mechanism for light and frictionless change management in a DevOps environment.',
			QuestionId: 'DL_CR',
			QuestionTitle: 'How do you implement and manage code review?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'DL_CS_1',
				Title: 'DL.CS.1: Implement automated digital attestation signing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Follow metadata frameworks such as in-toto for best practices for formatting attestations to include metadata about the software, the build environment, and the authoring party. Digital attestations serve as verifiable evidence that software components were built, tested, and conform to organizational standards within a controlled environment. Create an attestation for each action you want to create proof for, such as a test being run, software being packaged, or even manual approval acceptance steps. Generating attestations throughout the development lifecycle provides a method of ensuring software quality, origin, and authenticity. Store attestations either with build artifacts in a repository or within governance tools for deeper analysis. Embed automated tools into the deployment pipeline to produce digital attestations.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cs.1-implement-automated-digital-attestation-signing',
				},
				ImprovementPlan: {
					DisplayText:
						'Follow metadata frameworks such as in-toto for best practices for formatting attestations to include metadata about the software, the build environment, and the authoring party. Digital attestations serve as verifiable evidence that software components were built, tested, and conform to organizational standards within a controlled environment. Refer to DL.CS.1: Implement automated digital attestation signing in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cs.1-implement-automated-digital-attestation-signing',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CS_2',
				Title: 'DL.CS.2: Sign code artifacts after each build',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Code signing is the process of attaching a digital signature to build artifacts like binaries, containers, and other forms of packaged code to enable verifying its integrity and authenticity. For more control over the signing process or for complex use cases, you can create and manage your own code signing platform using Public Key Infrastructure (PKI). AWS Private Certificate Authority is a managed private CA service that helps you manage the lifecycle of your private certificates easily, without the investment and ongoing maintenance costs of operating your own private CA. When using Open Containers Initiative (OCI) compliant artifact registries, it is encouraged to store digital signatures alongside the build artifacts being signed. Timestamping provides a verified date and time of the signing, serving as evidence that the code artifact existed and met the signature criteria while the certificate was still valid. Store signatures in a location accessible to users and systems that need to verify signed code artifacts.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cs.2-sign-code-artifacts-after-each-build',
				},
				ImprovementPlan: {
					DisplayText:
						'Code signing is the process of attaching a digital signature to build artifacts like binaries, containers, and other forms of packaged code to enable verifying its integrity and authenticity. For more control over the signing process or for complex use cases, you can create and manage your own code signing platform using Public Key Infrastructure (PKI). Refer to DL.CS.2: Sign code artifacts after each build in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cs.2-sign-code-artifacts-after-each-build',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Signer',
								Url:
									'https://docs.aws.amazon.com/signer/latest/developerguide/Welcome.html',
							},
							{
								DisplayText: 'AWS Signer workflows',
								Url:
									'https://docs.aws.amazon.com/signer/latest/developerguide/workflows.html',
							},
							{
								DisplayText: 'AWS Private Certificate Authority',
								Url: 'https://aws.amazon.com/private-ca',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS05-BP03 Use managed services',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_hardware_a4.html',
							},
							{
								DisplayText: 'Using AWS Signer workflows',
								Url:
									'https://docs.aws.amazon.com/signer/latest/developerguide/workflows.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CS_3',
				Title: 'DL.CS.3: Enforce verification before using signed artifacts',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Some examples of this are integrating signature verification into the deployment pipeline, enforcing verification at the registry level as artifacts are distributed, or using the Kubernetes admission controller to verify each container image as they are pulled. Use a managed signing service like AWS Signer or the public key from your organization's trusted Certificate Authority (CA) for signature verification. This verification step enforces trust and security within the development lifecycle, ensuring that software remains unchanged before it is used or deployed. Strictly enforce verification of cryptographic signatures each time a code artifact is used or deployed. Automate the verification process where possible, as manual checks can be error-prone and may not be strictly enforced. Before using code artifacts, the cryptographic signature should be inspected and validated.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cs.3-enforce-verification-before-using-signed-artifacts',
				},
				ImprovementPlan: {
					DisplayText:
						"Some examples of this are integrating signature verification into the deployment pipeline, enforcing verification at the registry level as artifacts are distributed, or using the Kubernetes admission controller to verify each container image as they are pulled. Use a managed signing service like AWS Signer or the public key from your organization's trusted Certificate Authority (CA) for signature verification. Refer to DL.CS.3: Enforce verification before using signed artifacts in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cs.3-enforce-verification-before-using-signed-artifacts',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Signer',
								Url:
									'https://docs.aws.amazon.com/signer/latest/developerguide/Welcome.html',
							},
							{
								DisplayText: 'Configuring code signing for AWS Lambda',
								Url:
									'https://docs.aws.amazon.com/lambda/latest/dg/configuration-codesigning.html',
							},
							{
								DisplayText:
									'Announcing Container Image Signing with AWS Signer and Amazon EKS',
								Url:
									'https://aws.amazon.com/blogs/containers/announcing-container-image-signing-with-aws-signer-and-amazon-eks',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CS_4',
				Title: 'DL.CS.4: Enhance traceability using commit signing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'While not universally adopted by all organizations, commit signing enhances trust and traceability as developers make code changes, making it easier to track the origin of changes and ensure their authenticity. Have developers sign their code changes when submitting to version control using personal private keys from tools like GPG. Commit signing involves attaching a digital signature to code commits, certifying the integrity of changes and the identity of the committer. Developers must ensure that their private keys remain confidential, taking measures to store them securely and avoid potential exposure. Developers should be encouraged to sign both commits and tags with their private keys. For this approach to be effective in practice, developers require an understanding of certificates and using them for signing.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cs.4-enhance-traceability-using-commit-signing',
				},
				ImprovementPlan: {
					DisplayText:
						'While not universally adopted by all organizations, commit signing enhances trust and traceability as developers make code changes, making it easier to track the origin of changes and ensure their authenticity. Have developers sign their code changes when submitting to version control using personal private keys from tools like GPG. Refer to DL.CS.4: Enhance traceability using commit signing in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cs.4-enhance-traceability-using-commit-signing',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CS_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/DL_CS',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Development_Lifecycle',
		QuestionId: 'DL_CS',
		QuestionTitle: 'How do you implement and manage cryptographic signing?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Development_Lifecycle',
			QuestionDescription:
				'Cryptographic signing in the development lifecycle authenticates the origins and verifies the integrity of software components. Through the use of digital signatures, it safeguards software builds and deployments against unauthorized changes and potential threats from malicious actors. By leveraging cryptographic signing, you can establish a secure software supply chain, improve transparency in the build and delivery process, and reliably distribute verifiable software components at scale.',
			QuestionId: 'DL_CS',
			QuestionTitle: 'How do you implement and manage cryptographic signing?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'DL_CI_1',
				Title: 'DL.CI.1: Integrate code changes regularly and frequently',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Working in small batches, characterized by regular, small changes to a code base, enhances software delivery performance. In mature teams, developers commit changes multiple times per day and merge code frequently to prevent accumulating large changes. Developers should strive to integrate multiple small, releasable changes to the code base at least once per day. Splitting features into small increments of value, ramping up the frequency of deployment, and practicing Test Driven Development (TDD) all contribute to ensuring small batch sizes. Working in small batches requires discipline and commitment, but leads to improvements in speed, security, collaboration, and code base consistency. By making smaller, more frequent changes, teams can uncover and fix bugs earlier in the development lifecycle, simplifying the process of updating, testing, and releasing software.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.1-integrate-code-changes-regularly-and-frequently',
				},
				ImprovementPlan: {
					DisplayText:
						'Working in small batches, characterized by regular, small changes to a code base, enhances software delivery performance. In mature teams, developers commit changes multiple times per day and merge code frequently to prevent accumulating large changes. Refer to DL.CI.1: Integrate code changes regularly and frequently in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.1-integrate-code-changes-regularly-and-frequently',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'feature flags',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig?whats-new-cards.sort-by=item.additionalFields.postDateTime&whats-new-cards.sort-order=desc&blog-posts-cards.sort-by=item.additionalFields.createdDate&blog-posts-cards.sort-order=desc#Feature_flags',
							},
							{
								DisplayText:
									'What is continuous integration and continuous delivery/deployment?',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/what-is-continuous-integration-and-continuous-deliverydeployment.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CI_2',
				Title:
					'DL.CI.2: Trigger builds automatically upon source code modifications',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Continuous integration (CI) tools should be configured to regularly monitor the source code repository for any changes. This implementation creates an environment where developers can focus on coding and commit their changes, leaving the system to handle building, testing, and deploying the application. This approach minimizes the risk of integration conflicts and bugs while reducing the likelihood of unexpected outcomes that can arise from manual processes or irregular updates. It offers immediate feedback on the impact of changes, whether they cause a minor regression or a major bug, allowing for prompt correction. Alternatively, set up the source code repository to send an event upon each commit. Having this process in place aligns with the continuous integration principle of failing fast.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.2-trigger-builds-automatically-upon-source-code-modifications',
				},
				ImprovementPlan: {
					DisplayText:
						'Continuous integration (CI) tools should be configured to regularly monitor the source code repository for any changes. This implementation creates an environment where developers can focus on coding and commit their changes, leaving the system to handle building, testing, and deploying the application. Refer to DL.CI.2: Trigger builds automatically upon source code modifications in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.2-trigger-builds-automatically-upon-source-code-modifications',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon CodeCatalyst',
								Url: 'https://codecatalyst.aws/explore',
							},
							{
								DisplayText: 'Building the pipeline',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/building-the-pipeline.html',
							},
							{
								DisplayText:
									'Deploy container applications in a multicloud environment using Amazon CodeCatalyst',
								Url:
									'https://aws.amazon.com/blogs/devops/deploy-container-applications-in-a-multicloud-environment-using-amazon-codecatalyst',
							},
							{
								DisplayText: 'CodeCommit source actions and EventBridge',
								Url:
									'https://docs.aws.amazon.com/codepipeline/latest/userguide/triggering.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CI_3',
				Title: 'DL.CI.3: Ensure automated quality assurance for every build',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Adding automated quality assurance (QA) tests into the continuous integration pipeline enables rapidly validating changes and receiving fast feedback. Reserve breaking-the-build for critical issues, such as actual build failures, high severity security findings, or non-negotiable compliance findings, that demand immediate developer attention. As code changes become more frequent in a DevOps environment, it becomes important to reduce the time it takes to get feedback on those changes. Add stages to the pipeline which run pre-deployment checks to validate that code changes work alongside the existing code base. Have an exception mechanism and escalation plans prepared that developers can use if the continuous integration or continuous deployment prevent deployments which they do not agree with. Breaking-the-build, which stops the integration pipeline process due to test failures, is a powerful feedback mechanism.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.3-ensure-automated-quality-assurance-for-every-build',
				},
				ImprovementPlan: {
					DisplayText:
						'Adding automated quality assurance (QA) tests into the continuous integration pipeline enables rapidly validating changes and receiving fast feedback. Reserve breaking-the-build for critical issues, such as actual build failures, high severity security findings, or non-negotiable compliance findings, that demand immediate developer attention. Refer to DL.CI.3: Ensure automated quality assurance for every build in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.3-ensure-automated-quality-assurance-for-every-build',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL08-BP02 Integrate functional testing as part of your deployment',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_functional_testing.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP02 Automate testing throughout the development and release lifecycle',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_automate_testing_throughout_lifecycle.html',
							},
							{
								DisplayText:
									'Testing stages in continuous integration and continuous delivery',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/testing-stages-in-continuous-integration-and-continuous-delivery.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CI_4',
				Title: 'DL.CI.4: Provide consistent, actionable feedback to developers',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Feedback mechanisms should be tailored to fit within tools already used by developers, such as IDEs, chat clients, or email, reducing the learning curve and aiding early problem detection. To identify and address issues as quickly as possible, it's important that developers receive consistent and actionable feedback, regardless of the technologies and tools being used. Any failures in the process should send feedback to the developer automatically, describing the failure clearly with actionable guidance for resolution. Implement this by configuring your CI pipeline to send automatic failure notifications, offering clear, actionable resolution guidance. This consistency streamlines the process of addressing failures across diverse development environments, contributing to more efficient DevOps practices.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.4-provide-consistent-actionable-feedback-to-developers',
				},
				ImprovementPlan: {
					DisplayText:
						"Feedback mechanisms should be tailored to fit within tools already used by developers, such as IDEs, chat clients, or email, reducing the learning curve and aiding early problem detection. To identify and address issues as quickly as possible, it's important that developers receive consistent and actionable feedback, regardless of the technologies and tools being used. Refer to DL.CI.4: Provide consistent, actionable feedback to developers in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.4-provide-consistent-actionable-feedback-to-developers',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CI_5',
				Title:
					'DL.CI.5: Sequence build actions strategically for prompt feedback',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Strategically sequencing build actions is categorized as recommended as the foundational focus should first be on establishing a solid continuous integration pipeline and then later enhancing it by optimizing the build. By optimizing the sequence of actions or tasks in your continuous integration pipeline, feedback can be timely, allowing developers to quickly react and make necessary changes. Tasks less prone to failure or of lower importance should be scheduled later to prioritize higher impact tasks. Initiate long-duration actions earlier and run them in parallel with other actions, preventing bottlenecks. Regularly reviewing and adjusting action sequences ensures they effectively identify issues early and provide actionable feedback. This practice reduces the risk of delayed releases due to late detection of issues.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.5-sequence-build-actions-strategically-for-prompt-feedback',
				},
				ImprovementPlan: {
					DisplayText:
						'Strategically sequencing build actions is categorized as recommended as the foundational focus should first be on establishing a solid continuous integration pipeline and then later enhancing it by optimizing the build. By optimizing the sequence of actions or tasks in your continuous integration pipeline, feedback can be timely, allowing developers to quickly react and make necessary changes. Refer to DL.CI.5: Sequence build actions strategically for prompt feedback in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.5-sequence-build-actions-strategically-for-prompt-feedback',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CI_6',
				Title: 'DL.CI.6: Refine integration pipelines with build metrics',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'While individual metrics offer granular insights to optimize specific continuous integration capabilities, these aggregated metrics present a holistic overview of the end-to-end development lifecycle. Prioritize making these metrics accessible to all team members to create an environment where teams can proactively monitor, analyze, and improve based on these metrics. When getting started with DevOps adoption, initial efforts should prioritize the establishment of a stable and effective integration pipeline, with subsequent enhancements to the pipeline being driven by metrics. Metrics such as deployment frequency, change lead time, failure rate, and time to recover serve as outcome-based lagging indicators. Use key metricswhether sourced from this guidance, established frameworks like DORA or SPACE, or custom to your organizationto optimize your continuous integration process. These indicators span many DevOps capabilities to provide insights into the efficiency and reliability of the full delivery process.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.6-refine-integration-pipelines-with-build-metrics',
				},
				ImprovementPlan: {
					DisplayText:
						'While individual metrics offer granular insights to optimize specific continuous integration capabilities, these aggregated metrics present a holistic overview of the end-to-end development lifecycle. Prioritize making these metrics accessible to all team members to create an environment where teams can proactively monitor, analyze, and improve based on these metrics. Refer to DL.CI.6: Refine integration pipelines with build metrics in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.6-refine-integration-pipelines-with-build-metrics',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CI_7',
				Title: 'DL.CI.7: Validate the reproducibility of builds',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The implementation of reproducible builds primarily involves the creation of an immutable and consistently created build environment and controlling the inputs for each and every build. Factors that can render the build nondeterministic, such as unrestricted network access and the use of random generators or timestamps that modify the build artifact, must be limited. Every build for a specific version of source code should ideally be able to generate the same outputs from the same inputs. Have controls in place to detect and prevent configuration drift that may alter the build environment post-creation. All dependencies and software components used to create the environment and perform the build should be version pinned and recorded. Adopt mechanisms like binary diffing or checksum comparison to validate the reproducibility of the build.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.7-validate-the-reproducibility-of-builds',
				},
				ImprovementPlan: {
					DisplayText:
						'The implementation of reproducible builds primarily involves the creation of an immutable and consistently created build environment and controlling the inputs for each and every build. Factors that can render the build nondeterministic, such as unrestricted network access and the use of random generators or timestamps that modify the build artifact, must be limited. Refer to DL.CI.7: Validate the reproducibility of builds in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ci.7-validate-the-reproducibility-of-builds',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CI_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/DL_CI',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Development_Lifecycle',
		QuestionId: 'DL_CI',
		QuestionTitle: 'How do you implement and manage continuous integration?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Development_Lifecycle',
			QuestionDescription:
				'Continuous integration (CI) is a software development practice where developers make regular, small alterations to the code and integrate them into a releasable branch of the code repository. The newly integrated code is autonomously built, tested, and validated in a consistent and repeatable manner.',
			QuestionId: 'DL_CI',
			QuestionTitle: 'How do you implement and manage continuous integration?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'DL_CD_1',
				Title: 'DL.CD.1: Deploy changes to production frequently',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Teams should focus on deploying small changes rather than bundling multiple changes into a single, large batch deployment. The practice of deploying small changes demands discipline and commitment, but it improves deployment frequency, security, and enhanced collaboration while ensuring that the code base remains up-to-date and releasable at all times. By using advanced deployment strategies and employing feature flags, teams can deploy code to production and decide when to release or rollback specific features in real time, offering more granular control over releasing new features to end users. Even after deploying changes to production, these changes might not necessarily be visible or accessible to all users. Use a pipeline to automate the deployment of validated changes across various environments, including production. Frequent deployments to production encourages small, rapid, and iterative changes to the code base.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.1-deploy-changes-to-production-frequently',
				},
				ImprovementPlan: {
					DisplayText:
						'Teams should focus on deploying small changes rather than bundling multiple changes into a single, large batch deployment. The practice of deploying small changes demands discipline and commitment, but it improves deployment frequency, security, and enhanced collaboration while ensuring that the code base remains up-to-date and releasable at all times. Refer to DL.CD.1: Deploy changes to production frequently in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.1-deploy-changes-to-production-frequently',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'feature flags',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig?whats-new-cards.sort-by=item.additionalFields.postDateTime&whats-new-cards.sort-order=desc&blog-posts-cards.sort-by=item.additionalFields.createdDate&blog-posts-cards.sort-order=desc#Feature_flags',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CD_2',
				Title: 'DL.CD.2: Deploy exclusively from trusted artifact repositories',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'By using trusted artifact repositories, teams can ensure the security of deployed workloads, maintain quality and security standards, and promote trust in the delivery pipeline. Additionally, we recommend using cryptographic signing to validate artifacts and including a validation stage in the pipeline to verify that the artifacts meet the necessary standards before deployment. The delivery pipeline should be restricted to using only trusted artifact repositories, which could be enforced through mechanisms such as allow lists, IP restrictions, or authentication controls. All artifacts involved in the delivery process should originate from a trusted artifact repository. These repositories contain validated, tested, and integrated artifacts that have been deemed safe for deployment. In this way, the integrity and security of the deployed workloads are maintained consistently.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.2-deploy-exclusively-from-trusted-artifact-repositories',
				},
				ImprovementPlan: {
					DisplayText:
						'By using trusted artifact repositories, teams can ensure the security of deployed workloads, maintain quality and security standards, and promote trust in the delivery pipeline. Additionally, we recommend using cryptographic signing to validate artifacts and including a validation stage in the pipeline to verify that the artifacts meet the necessary standards before deployment. Refer to DL.CD.2: Deploy exclusively from trusted artifact repositories in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.2-deploy-exclusively-from-trusted-artifact-repositories',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Artifact Repository - AWS CodeArtifact',
								Url: 'https://aws.amazon.com/codeartifact',
							},
							{
								DisplayText:
									'Fully Managed Container Registry - Amazon Elastic Container Registry',
								Url: 'https://aws.amazon.com/ecr',
							},
							{
								DisplayText:
									'Code Repositories and Artifact Management | AWS Marketplace',
								Url:
									'https://aws.amazon.com/marketplace/solutions/devops/code-repositories-and-artifact-management?aws-marketplace-cards.sort-by=item.additionalFields.headline&aws-marketplace-cards.sort-order=asc&awsf.aws-marketplace-devops-store-use-cases=*all',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CD_3',
				Title: 'DL.CD.3: Integrate quality assurance into deployments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'This differs from previous quality checks in the development lifecycle as these tests validate that the software changes behave as expected when deployed into real-world environments. This provides the ability to test integration with other live systems, check for configuration errors, and test in environments that more closely mirror production. Deployments to environments is the ideal enforcement point for quality assurance, with QA requirements being scoped to the environment being deployed to. Incorporate QA stages into your delivery pipeline to automatically conduct required functional, non-functional, security, and data tests after deployments occur. Integrating quality assurance (QA) processes into continuous delivery pipelines tests that the whole system is ready for release. Provide immediate feedback to the development team upon any test failures, so they can rectify issues quickly and maintain the integrity of the deployment pipeline.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.3-integrate-quality-assurance-into-deployments',
				},
				ImprovementPlan: {
					DisplayText:
						'This differs from previous quality checks in the development lifecycle as these tests validate that the software changes behave as expected when deployed into real-world environments. This provides the ability to test integration with other live systems, check for configuration errors, and test in environments that more closely mirror production. Refer to DL.CD.3: Integrate quality assurance into deployments in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.3-integrate-quality-assurance-into-deployments',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL08-BP02 Integrate functional testing as part of your deployment',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_functional_testing.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL08-BP03 Integrate resiliency testing as part of your deployment',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_resiliency_testing.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP02 Automate testing throughout the development and release lifecycle',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_automate_testing_throughout_lifecycle.html',
							},
							{
								DisplayText:
									'Testing stages in continuous integration and continuous delivery',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/testing-stages-in-continuous-integration-and-continuous-delivery.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CD_4',
				Title: 'DL.CD.4: Automate the entire deployment process',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'If the organization is early in its DevOps adoption or operates in a highly regulated environment, there might be a need for manual interventions or approvals at certain stages. While optional manual approval gates can exist, all other stages should be automated, maintaining the integrity of the artifact and reducing the likelihood of errors. Some organizations might still require manual oversight at certain stages as they evolve their DevOps capabilities. Over time, even for these organizations, the goal should be to have no manual deployment stages in the deployment of changes. Exceptions for continuous delivery might include optional manual approval gates. Use the delivery pipeline to automate every stage of deploying changes, from copying the build artifact to setting up any required configurations.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.4-automate-the-entire-deployment-process',
				},
				ImprovementPlan: {
					DisplayText:
						'If the organization is early in its DevOps adoption or operates in a highly regulated environment, there might be a need for manual interventions or approvals at certain stages. While optional manual approval gates can exist, all other stages should be automated, maintaining the integrity of the artifact and reducing the likelihood of errors. Refer to DL.CD.4: Automate the entire deployment process in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.4-automate-the-entire-deployment-process',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL08-BP05 Deploy changes with automation',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_automated_changemgmt.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP06 Deploy software programmatically',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_deploy_software_programmatically.html',
							},
							{
								DisplayText: 'What is Continuous Delivery?',
								Url: 'https://aws.amazon.com/devops/continuous-delivery',
							},
							{
								DisplayText: 'Amazon CodeCatalyst',
								Url: 'https://codecatalyst.aws/explore',
							},
							{
								DisplayText: 'Building the pipeline',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/building-the-pipeline.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CD_5',
				Title: 'DL.CD.5: Ensure on-demand deployment capabilities',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'By decoupling deployments from other systems and being able to perform them during normal business hours, teams can receive fast feedback and respond to any issues that arise, leading to quicker fixes and less disruption to users. To enable on-demand deployments, teams should employ advanced deployment strategies, such as blue/green deployments, canary releases, feature flags, or rolling updates. Deployments should be able to occur during normal working hours without causing significant downtime or disruption to the business. Changes should not require synchronization with other systems and deployments should be able to occur regardless of the interdependence of other systems. While the actual decision to deploy to production may still be manual, deployments should be able to occur on-demand as needed. By using the right tools and strategies, deployments can be automated and run seamlessly, allowing for faster and more efficient delivery of applications and services.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.5-ensure-on-demand-deployment-capabilities',
				},
				ImprovementPlan: {
					DisplayText:
						'By decoupling deployments from other systems and being able to perform them during normal business hours, teams can receive fast feedback and respond to any issues that arise, leading to quicker fixes and less disruption to users. To enable on-demand deployments, teams should employ advanced deployment strategies, such as blue/green deployments, canary releases, feature flags, or rolling updates. Refer to DL.CD.5: Ensure on-demand deployment capabilities in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.5-ensure-on-demand-deployment-capabilities',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Deployment Pipeline Reference Architecture',
								Url:
									'https://aws-samples.github.io/aws-deployment-pipeline-reference-architecture',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CD_6',
				Title:
					'DL.CD.6: Refine delivery pipelines using metrics for continuous improvement',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'While individual metrics offer granular insights to optimize specific continuous delivery capabilities, these aggregated metrics present a holistic overview of the end-to-end development lifecycle. Use logs to generate metrics, and use these metrics to identify areas for improvement. When getting started with DevOps adoption, initial efforts should prioritize the establishment of a stable and effective delivery pipeline, with subsequent enhancements to the pipeline being driven by metrics. Make these metrics visible to all team members and use them to drive your continuous improvement efforts. Use key metricswhether sourced from this guidance, established frameworks like DORA or SPACE, or custom to your organizationto continually optimize the development lifecycle. Metrics such as deployment frequency, change lead time, failure rate, and time to recover serve as outcome-based lagging indicators.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.6-refine-delivery-pipelines-using-metrics-for-continuous-improvement',
				},
				ImprovementPlan: {
					DisplayText:
						'While individual metrics offer granular insights to optimize specific continuous delivery capabilities, these aggregated metrics present a holistic overview of the end-to-end development lifecycle. Use logs to generate metrics, and use these metrics to identify areas for improvement. Refer to DL.CD.6: Refine delivery pipelines using metrics for continuous improvement in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.6-refine-delivery-pipelines-using-metrics-for-continuous-improvement',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Deployment Pipeline Reference Architecture',
								Url: 'https://pipelines.devops.aws.dev/application-pipeline',
							},
							{
								DisplayText:
									'AWS Observability Best Practices: Key Performance Indicators',
								Url:
									'https://aws-observability.github.io/observability-best-practices/guides/operational/business/key-performance-indicators',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CD_7',
				Title:
					'DL.CD.7: Remove manual approvals to practice continuous deployment',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Fully automate all stages of the deployment process, allowing developers to push new code into the production environment using fully automated delivery pipelineswith no manual approval stages required. Create fully automated pipelines which perform continuous integration and continuous deployment. Removing all manual deployment steps reduces potential errors and increases deployment speed. This pipeline should perform all necessary quality assurance tests, build the application, and deploy the new version to the production environment. It allows developers to focus more on coding and less on deployment logistics, improving efficiency and productivity. Automated governance capabilities ensure that guardrails are being followed, while observability functions such as alerts and logs provide visibility.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.7-remove-manual-approvals-to-practice-continuous-deployment',
				},
				ImprovementPlan: {
					DisplayText:
						'Fully automate all stages of the deployment process, allowing developers to push new code into the production environment using fully automated delivery pipelineswith no manual approval stages required. Create fully automated pipelines which perform continuous integration and continuous deployment. Refer to DL.CD.7: Remove manual approvals to practice continuous deployment in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.7-remove-manual-approvals-to-practice-continuous-deployment',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Continuous Delivery vs. Continuous Deployment',
								Url: 'https://aws.amazon.com/devops/continuous-delivery',
							},
							{
								DisplayText:
									'Practicing Continuous Integration and Continuous Delivery on AWS',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/implementing-continuous-integration-and-continuous-delivery.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_CD_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/DL_CD',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Development_Lifecycle',
		QuestionId: 'DL_CD',
		QuestionTitle: 'How do you implement and manage continuous delivery?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Development_Lifecycle',
			QuestionDescription:
				'Continuous delivery (CD) takes place after continuous integration (CI), where code changes that pass the build validation are automatically deployed to other environments, including production, with minimal human intervention.',
			QuestionId: 'DL_CD',
			QuestionTitle: 'How do you implement and manage continuous delivery?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'DL_ADS_1',
				Title: 'DL.ADS.1: Test deployments in pre-production environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Services deployed to the zeta stage interact exclusively with production endpoints to identify potential integration issues before the code reaches the production stage. One-box refers to the testing of changes in a single unit of deployment, such as a single container or instance, which is configured to use production endpoints. These additional environments help to prevent the introduction of bugs in production environments, validates backwards compatibility, and increases the confidence in the quality of the deployment. One-box testing can be used to test backward compatibility to ensure new code changes coexist with and function properly with the existing code base. This form of testing can be used to help ensure the changes interact efficiently with production endpoints of other services. Progressively validate software changes across multiple environments, including development (alpha) and testing (beta) before deploying into production.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.1-test-deployments-in-pre-production-environments',
				},
				ImprovementPlan: {
					DisplayText:
						'Services deployed to the zeta stage interact exclusively with production endpoints to identify potential integration issues before the code reaches the production stage. One-box refers to the testing of changes in a single unit of deployment, such as a single container or instance, which is configured to use production endpoints. Refer to DL.ADS.1: Test deployments in pre-production environments in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.1-test-deployments-in-pre-production-environments',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What is Continuous Integration?',
								Url: 'https://aws.amazon.com/devops/continuous-integration',
							},
							{
								DisplayText: 'What is Continuous Delivery?',
								Url: 'https://aws.amazon.com/devops/continuous-delivery',
							},
							{
								DisplayText: 'Going faster with continuous delivery',
								Url:
									'https://aws.amazon.com/builders-library/going-faster-with-continuous-delivery?did=ba_card&trk=ba_card',
							},
							{
								DisplayText:
									'Automating safe, hands-off deployments: Test deployments in pre-production environments',
								Url:
									'https://aws.amazon.com/builders-library/automating-safe-hands-off-deployments#Test_deployments_in_pre-production_environments',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_ADS_2',
				Title: 'DL.ADS.2: Implement automatic rollbacks for failed deployments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"These operational decisions should be supported by the ability to compare the changes between the current release and the selected rollback release's deployment artifacts, including source code changes and changes in library versions. The rollback process should include the redeployment of the last successful code revision, artifact version, or container image, and should employ methods like rolling or blue/green deployments, or feature flags for a swift rollback with minimal disruption. After the rollback, depending on the specific issue being addressed, consider proactively rolling back other environments that could potentially also be affected, even if they aren't currently showing any customer impact. Rollback should be initiated based on alarms linked to key metrics like fault rates, latency, CPU usage, memory usage, disk usage, and log errors. Rollback considerations should not be limited to the latest deployments, but also account for latent changes that may be the source of current issues. The strategy should be defined as a proactive measure in case of an operational event, which prioritizes customer impact mitigation even before identifying whether the new deployment is the cause of the issue.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.2-implement-automatic-rollbacks-for-failed-deployments',
				},
				ImprovementPlan: {
					DisplayText:
						"These operational decisions should be supported by the ability to compare the changes between the current release and the selected rollback release's deployment artifacts, including source code changes and changes in library versions. The rollback process should include the redeployment of the last successful code revision, artifact version, or container image, and should employ methods like rolling or blue/green deployments, or feature flags for a swift rollback with minimal disruption. Refer to DL.ADS.2: Implement automatic rollbacks for failed deployments in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.2-implement-automatic-rollbacks-for-failed-deployments',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'feature flags',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig#Feature_flags',
							},
							{
								DisplayText: 'Ensuring rollback safety during deployments',
								Url:
									'https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments',
							},
							{
								DisplayText:
									'My CI/CD pipeline is my release captain: Easy and automatic rollbacks',
								Url:
									'https://aws.amazon.com/builders-library/cicd-pipeline#Easy_and_automatic_rollbacks',
							},
							{
								DisplayText: 'Automating safe, hands-off deployments',
								Url:
									'https://aws.amazon.com/builders-library/automating-safe-hands-off-deployments?did=ba_card&trk=ba_card',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_ADS_3',
				Title: 'DL.ADS.3: Use staggered deployment and release strategies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Staggered deployments strategies make use of techniques like progressive wave-based deployments, one-box deployments, and rolling deployments. Each production wave of the staggered deployment starts with a limited deployment, one-box stage, where the new code is first deployed to a single unit called a box. Following the limited deployment stage, rolling deployments are typically used to deploy to the wave's main production fleet. A typical rolling deployment to an environment replaces at most 33% of the system's fleet in that environment with the new code. Once fully tested and ready, traffic is switched from the active to the inactive environment, thus minimizing downtime and risk These strategies reduce the risk of introducing issues into the system and allow for monitoring, swift rollback, and issue tracking. A box could be a single server or container instance which is deployed to a specific environment, AWS Region, single AWS Availability Zone, or within a single cell in a cell-based architecture.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.3-use-staggered-deployment-and-release-strategies',
				},
				ImprovementPlan: {
					DisplayText:
						'Staggered deployments strategies make use of techniques like progressive wave-based deployments, one-box deployments, and rolling deployments. Each production wave of the staggered deployment starts with a limited deployment, one-box stage, where the new code is first deployed to a single unit called a box. Refer to DL.ADS.3: Use staggered deployment and release strategies in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.3-use-staggered-deployment-and-release-strategies',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'cell-based architecture',
								Url:
									'https://aws.amazon.com/solutions/guidance/cell-based-architecture-on-aws',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL08-BP04 Deploy using immutable infrastructure',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_immutable_infrastructure.html',
							},
							{
								DisplayText: 'Automating safe, hands-off deployments',
								Url:
									'https://aws.amazon.com/builders-library/automating-safe-hands-off-deployments?did=ba_card&trk=ba_card',
							},
							{
								DisplayText: 'AWS Deployment Pipeline Reference Architecture',
								Url:
									'https://aws-samples.github.io/aws-deployment-pipeline-reference-architecture/application-pipeline',
							},
							{
								DisplayText: 'Overview of Deployment Options on AWS',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/overview-deployment-options/welcome.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_ADS_4',
				Title: 'DL.ADS.4: Implement Incremental Feature Release Techniques',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The specific choice of technique, be it dark launching, two-phase deployments, feature flags, canary releases, or a combination, depends on your unique needs, the nature of the changes, the complexity of the system, and the degree of control required over the release process. Depending on system implementation and team preferences, dark launches can be implemented using versioning, A/B testing, canary releases, or most commonly, using feature flags. Feature flags provide an additional layer of control over the feature rollout process and can be used for A/B testing, canary releases, and dark launches. Changes should first be prepared to handle a new update without actively implementing it (Prepare phase), followed by a second deployment that activates the new changes (Activate phase). Incremental feature releases gradually roll out new features to users, reducing risk and maintaining system stability. Techniques include dark launching, two-phase deployments, feature flags, and canary releases.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.4-implement-incremental-feature-release-techniques',
				},
				ImprovementPlan: {
					DisplayText:
						'The specific choice of technique, be it dark launching, two-phase deployments, feature flags, canary releases, or a combination, depends on your unique needs, the nature of the changes, the complexity of the system, and the degree of control required over the release process. Depending on system implementation and team preferences, dark launches can be implemented using versioning, A/B testing, canary releases, or most commonly, using feature flags. Refer to DL.ADS.4: Implement Incremental Feature Release Techniques in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.4-implement-incremental-feature-release-techniques',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Feature flags',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig#Feature_flags',
							},
							{
								DisplayText: 'Two-phase deployments',
								Url:
									'https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments#Two-phase_deployment_technique',
							},
							{
								DisplayText: 'Amazon CloudWatch Evidently',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Evidently',
							},
							{
								DisplayText: 'Feature Flags - AWS AppConfig',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig',
							},
							{
								DisplayText:
									'My CI/CD pipeline is my release captain: Multiple inflight releases',
								Url:
									'https://aws.amazon.com/builders-library/cicd-pipeline#Multiple_inflight_releases',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_ADS_5',
				Title:
					'DL.ADS.5: Ensure backwards compatibility for data store and schema changes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"As modifications, additions, or deletions are made to data structures and schemas, these changes should be designed to coexist with previous data structures, allowing both old and new versions to operate concurrently. Testing typically involves three stages to detect potential issues: initially, the change is deployed to a fraction of the servers to verify coexistence of software versions; next, the deployment is completed across all servers; and finally, a rollback deployment is initiated. Backwards compatibility in data stores and schemas ensures that as changes are made, previous versions of the system continue to operate as expected. With this method, new changes are incorporated into a new version, while older versions remain functional for existing applications. Feature flags can also be used to conceal new alterations until they're fully ready, facilitating testing and phased rollout of updates without affecting existing users. Maintaining backwards compatibility helps to avoid breaking changes that could disrupt continuous integration and delivery pipelines.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.5-ensure-backwards-compatibility-for-data-store-and-schema-changes',
				},
				ImprovementPlan: {
					DisplayText:
						'As modifications, additions, or deletions are made to data structures and schemas, these changes should be designed to coexist with previous data structures, allowing both old and new versions to operate concurrently. Testing typically involves three stages to detect potential issues: initially, the change is deployed to a fraction of the servers to verify coexistence of software versions; next, the deployment is completed across all servers; and finally, a rollback deployment is initiated. Refer to DL.ADS.5: Ensure backwards compatibility for data store and schema changes in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.5-ensure-backwards-compatibility-for-data-store-and-schema-changes',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Feature flags',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig#Feature_flags',
							},
							{
								DisplayText: 'Ensuring rollback safety during deployments',
								Url:
									'https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments',
							},
							{
								DisplayText:
									'Using Amazon RDS Blue/Green Deployments for database updates',
								Url:
									'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_ADS_6',
				Title:
					'DL.ADS.6: Use cell-based architectures for granular deployment and release',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Finally, implement an operational tool to move users between cells and create new cells as needed. It allows teams to deliver incremental updates to individual cells without risking the entire system's stability. A cell-based architecture segments a larger system into isolated, independently functioning replicas, or cells. Stream changes to a central data lake for centralized querying and analysis of changes across all cells. Ensure that you implement a central dashboard to provide an aggregated view of the state of your cells, enabling easy system-wide monitoring. You will need to automate the lifecycle of your cells, including initial deployment and subsequent updates.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.6-utilize-cell-based-architectures-for-granular-deployment-and-release',
				},
				ImprovementPlan: {
					DisplayText:
						"Finally, implement an operational tool to move users between cells and create new cells as needed. It allows teams to deliver incremental updates to individual cells without risking the entire system's stability. Refer to DL.ADS.6: Use cell-based architectures for granular deployment and release in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.6-utilize-cell-based-architectures-for-granular-deployment-and-release',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL10-BP04 Use bulkhead architectures to limit scope of impact',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_fault_isolation_use_bulkhead.html',
							},
							{
								DisplayText: 'Guidance for Cell-based Architecture on AWS',
								Url:
									'https://aws.amazon.com/solutions/guidance/cell-based-architecture-on-aws',
							},
							{
								DisplayText:
									'Minimizing correlated failures in distributed systems',
								Url:
									'https://aws.amazon.com/builders-library/minimizing-correlated-failures-in-distributed-systems#Noninfrastructure_causes_of_correlated_failures',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'DL_ADS_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/DL_ADS',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Development_Lifecycle',
		QuestionId: 'DL_ADS',
		QuestionTitle:
			'How do you implement and manage advanced deployment strategies?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Development_Lifecycle',
			QuestionDescription:
				'Advanced deployment strategies provide organizations with the ability to deploy and release new features and updates gradually. The fast feedback loop enabled by these strategies aids in early detection and resolution of potential issues during deployment, enhancing the reliability of the release process. With advanced deployment strategies, organizations can improve the quality and speed of software releases, reduce the risk of downtime or errors, and provide enhanced user experience.',
			QuestionId: 'DL_ADS',
			QuestionTitle:
				'How do you implement and manage advanced deployment strategies?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'O_SI_1',
				Title:
					'O.SI.1: Center observability strategies around business and technical outcomes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Adopting the ethos that "Everything fails, all the time", famously stated by Werner Vogels, Amazon Chief Technology Officer, a successful observability strategy acknowledges this reality and continuously iterates, adapting to changes in business environments, technical architecture, user behaviors, and customer needs. On the business side, teams and leaders should meet regularly to assess how technical metrics correlate with business outcomes and adapt strategies accordingly. It is the shared responsibility of teams, leadership, and stakeholders to establish relevant performance-related metrics to collect to measure established key performance indicators (KPIs) and desired business outcomes. By continuously assessing metrics against business and technical strategies, teams can proactively address potential issues before they affect the bottom line. This means not only monitoring system performance, uptime, or error rates but also understanding how these factors directly or indirectly influence business outcomes such as revenue, customer satisfaction, and market growth. Discover customer and stakeholder requirements and choose the technical and business metrics and KPIs that best fit your organization.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.1-center-observability-strategies-around-business-and-technical-outcomes',
				},
				ImprovementPlan: {
					DisplayText:
						'Adopting the ethos that "Everything fails, all the time", famously stated by Werner Vogels, Amazon Chief Technology Officer, a successful observability strategy acknowledges this reality and continuously iterates, adapting to changes in business environments, technical architecture, user behaviors, and customer needs. On the business side, teams and leaders should meet regularly to assess how technical metrics correlate with business outcomes and adapt strategies accordingly. Refer to O.SI.1: Center observability strategies around business and technical outcomes in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.1-center-observability-strategies-around-business-and-technical-outcomes',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Discover customer and stakeholder requirements',
								Url:
									'https://aws-observability.github.io/observability-best-practices/guides/operational/business/key-performance-indicators',
							},
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF06-BP02 Define a process to improve workload performance',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_continue_having_appropriate_resource_type_define_process.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS02-BP02 Align SLAs with sustainability goals',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a3.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL11-BP07 Architect your product to meet availability targets and uptime service level agreements (SLAs)',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_service_level_agreements.html',
							},
							{
								DisplayText:
									'Monitoring and Observability Implementation Priorities',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/management-and-governance-guide/implementation-priorities-5.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_SI_2',
				Title:
					'O.SI.2: Centralize tooling for streamlined system instrumentation and telemetry data interpretation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'As the observability platform matures, it could begin to offer other capabilities such as trend analysis, anomaly detection, and automated responses, ultimately aiming to reduce the mean time to detect (MTTD) and the mean time to resolve (MTTR) any issues. Centralized observability platforms are able to offer user-friendly, self-service capabilities to individual teams that simplify embedding visibility into system components and their dependencies. The observability platform should offer capabilities to follow requests through the system, the services it interacts with, the state of the infrastructure that these services run on, and the impact of each of these on user experience. Adopt an observability platform that provides observability to teams using the X as a Service (XaaS) interaction mode as defined in the Team Topologies book by Matthew Skelton and Manuel Pais. The platform needs to support ingesting the required data sources for effective monitoring, and provide the desired level of visibility into the system components and their dependencies. This enables the organization to achieve real-time visibility into system data and improve the ability to identify and resolve issues quickly.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.2-centralize-tooling-for-streamlined-system-instrumentation-and-telemetry-data-interpretation',
				},
				ImprovementPlan: {
					DisplayText:
						'As the observability platform matures, it could begin to offer other capabilities such as trend analysis, anomaly detection, and automated responses, ultimately aiming to reduce the mean time to detect (MTTD) and the mean time to resolve (MTTR) any issues. Centralized observability platforms are able to offer user-friendly, self-service capabilities to individual teams that simplify embedding visibility into system components and their dependencies. Refer to O.SI.2: Centralize tooling for streamlined system instrumentation and telemetry data interpretation in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.2-centralize-tooling-for-streamlined-system-instrumentation-and-telemetry-data-interpretation',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'MTTD',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/availability-and-beyond-improving-resilience/reducing-mttd.html',
							},
							{
								DisplayText: 'MTTR',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/availability-and-beyond-improving-resilience/reducing-mttr.html',
							},
							{
								DisplayText: 'AWS observability tools',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/management-and-governance-guide/aws-observability-tools.html',
							},
							{
								DisplayText: 'What is Amazon CloudWatch Application Insights?',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/appinsights-what-is.html',
							},
							{
								DisplayText: 'Integrated observability partners',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/management-and-governance-guide/integrated-observability-partners.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_SI_3',
				Title:
					'O.SI.3: Instrument all systems for comprehensive telemetry data collection',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Teams should integrate instrumentation libraries into the components of new systems and feature enhancements to capture relevant data points, while also ensuring that pipelines and associated tools used during build, testing, deployment, and release of the system are also instrumented to track development lifecycle metrics and best practices. Examples of auto-instrumentation include embedding instrumentation tools in shared computer images like AMIs or containers being used, automatically gathering telemetry from the compute runtime, or embedding instrumentation tools into shared libraries and frameworks. Teams might also consider the use of auto-instrumentation tools to simplify the process of collecting data across their systems with little to no manual intervention, reducing the risk of human error and inconsistencies. Depending on the workload and existing instrumentation, this could involve structured log-based metric reporting, or it might rely on other established methods like using StatsD, Prometheus exporters, or other monitoring solutions. Strike a balance between thorough monitoring and the amount of work required to implement and maintain the monitoring solution, to avoid falling into an anti-pattern of excessive instrumentation. All systems should be fully-instrumented to collect the metrics, logs, events, and traces necessary for meeting key performance indicators (KPIs), service level objectives, and logging and monitoring strategies.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.3-instrument-all-systems-for-comprehensive-telemetry-data-collection',
				},
				ImprovementPlan: {
					DisplayText:
						'Teams should integrate instrumentation libraries into the components of new systems and feature enhancements to capture relevant data points, while also ensuring that pipelines and associated tools used during build, testing, deployment, and release of the system are also instrumented to track development lifecycle metrics and best practices. Examples of auto-instrumentation include embedding instrumentation tools in shared computer images like AMIs or containers being used, automatically gathering telemetry from the compute runtime, or embedding instrumentation tools into shared libraries and frameworks. Refer to O.SI.3: Instrument all systems for comprehensive telemetry data collection in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.3-instrument-all-systems-for-comprehensive-telemetry-data-collection',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF02-BP03 Collect compute-related metrics',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_select_compute_collect_metrics.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL06-BP01 Monitor all components for the workload (Generation)',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_monitor_resources.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST05-BP02 Analyze all components of the workload',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_select_service_analyze_all.html',
							},
							{
								DisplayText:
									'Instrumenting distributed systems for operational visibility',
								Url:
									'https://aws.amazon.com/builders-library/instrumenting-distributed-systems-for-operational-visibility?did=ba_card&trk=ba_card',
							},
							{
								DisplayText: 'AWS Observability Best Practices: Data Types',
								Url:
									'https://aws-observability.github.io/observability-best-practices',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_SI_4',
				Title: 'O.SI.4: Build health checks into every service',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Usually manifested as a secure and private HTTP health endpoint (for example, /actuator/health), this feature serves as a critical component in monitoring the health status of the overall system, generally including information such as operating status, versions of software running, database response time, and memory consumption. In systems with high interoperability, such as microservices architecture, the presence of health check endpoints in every service becomes even more critical as they help identify issues related to specific services in the system. Each service within a system should be configured to include a health check endpoint which provides real-time insight into how the system and its dependencies are performing. Observability, governance, and testing tools can invoke these health check endpoints periodically, ensuring the continuous evaluation of system health. Integrating health check endpoints is highly recommended for larger, more complex systems or any environment where system availability and rapid issue resolution need to be prioritized. These preventive deployment measures complement health check endpoints and can prevent a potentially flawed deployment from propagating throughout the entire system.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.4-build-health-checks-into-every-service',
				},
				ImprovementPlan: {
					DisplayText:
						'Usually manifested as a secure and private HTTP health endpoint (for example, /actuator/health), this feature serves as a critical component in monitoring the health status of the overall system, generally including information such as operating status, versions of software running, database response time, and memory consumption. In systems with high interoperability, such as microservices architecture, the presence of health check endpoints in every service becomes even more critical as they help identify issues related to specific services in the system. Refer to O.SI.4: Build health checks into every service in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.4-build-health-checks-into-every-service',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Implementing health checks',
								Url:
									'https://aws.amazon.com/builders-library/implementing-health-checks',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_SI_5',
				Title:
					'O.SI.5: Set and monitor service level objectives against performance standards',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"While Service Level Agreements (SLAs), which define a contract that must be met for service availability, are typically defined and published for services that are directly consumed by customers, it is equally important to establish SLOs for services consumed internally. Teams should define and document Service Level Objectives (SLOs) for every service, regardless of whether it is directly consumed by external customers or used internally. By continuously tracking SLIs against the target SLOs, teams can detect and resolve issues that impact the performance and availability of their services while ensuring that they continue to meet both external customer expectations and internal performance standards. The technical team must provide realistic estimations based on the system's capabilities and constraints, while the business team ensures these align with the company's business objectives and internal standards. Such SLOs help ensure performance standards are met, even in the absence of formal SLAs, and can also act as data points for meeting Key Performance Indicators (KPIs). Continuous improvement and periodic review of SLOs are required to ensure they remain realistic and aligned with both the system's capabilities and the business's objectives.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.5-set-and-monitor-service-level-objectives-against-performance-standards',
				},
				ImprovementPlan: {
					DisplayText:
						'While Service Level Agreements (SLAs), which define a contract that must be met for service availability, are typically defined and published for services that are directly consumed by customers, it is equally important to establish SLOs for services consumed internally. Teams should define and document Service Level Objectives (SLOs) for every service, regardless of whether it is directly consumed by external customers or used internally. Refer to O.SI.5: Set and monitor service level objectives against performance standards in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.si.5-set-and-monitor-service-level-objectives-against-performance-standards',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What Is SLA (Service Level Agreement)?',
								Url: 'https://aws.amazon.com/what-is/service-level-agreement',
							},
							{
								DisplayText: 'What is the difference between SLA and KPI?',
								Url:
									'https://aws.amazon.com/what-is/service-level-agreement#seo-faq-pairs#sla-kpi',
							},
							{
								DisplayText:
									'AWS Well-Architected Framework - Reliability Pillar',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html',
							},
							{
								DisplayText:
									'Designed-For Availability for Select AWS Services',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/appendix-a-designed-for-availability-for-select-aws-services.html',
							},
							{
								DisplayText: 'Understanding KPIs ("Golden Signals")',
								Url:
									'https://aws-observability.github.io/observability-best-practices/guides/operational/business/key-performance-indicators#10-understanding-kpis-golden-signals',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_SI_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/O_SI',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Observability',
		QuestionId: 'O_SI',
		QuestionTitle: 'How do you implement and manage strategic instrumentation?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Observability',
			QuestionDescription:
				'Strategic instrumentation is a capability aimed at designing and implementing monitoring systems to capture meaningful and actionable data from your applications and infrastructure. This includes collecting telemetry, tracking key performance indicators (KPIs), and enabling data-driven decision making. The goal of strategic instrumentation is to provide deep visibility into your systems, facilitating rapid response to issues, optimizing performance, and aligning IT operations with business objectives by capturing relevant telemetry.',
			QuestionId: 'O_SI',
			QuestionTitle:
				'How do you implement and manage strategic instrumentation?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'O_DIP_1',
				Title: 'O.DIP.1: Aggregate logs and events across workloads',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement a log aggregation solution that supports collecting logs from various sources and provides functions for filtering, searching, visualizing, and alerting. Make sure the solution provides real-time data collection, supports necessary data sources, and offers visualization options. Logs and events should be aggregated across multiple workloads to provide a comprehensive view of the entire system. The tool should be accessible to application teams, allowing them to monitor and troubleshoot their system as needed. This enables teams to troubleshoot, identify patterns, and resolve operational issues.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.1-aggregate-logs-and-events-across-workloads',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement a log aggregation solution that supports collecting logs from various sources and provides functions for filtering, searching, visualizing, and alerting. Make sure the solution provides real-time data collection, supports necessary data sources, and offers visualization options. Refer to O.DIP.1: Aggregate logs and events across workloads in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.1-aggregate-logs-and-events-across-workloads',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL11-BP01 Monitor all components of the workload to detect failures',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_monitoring_health.html',
							},
							{
								DisplayText: 'Cross-account cross-Region CloudWatch console',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Cross-Account-Cross-Region.html',
							},
							{
								DisplayText:
									'Collect, analyze, and display Amazon CloudWatch Logs in a single dashboard with the Centralized Logging on AWS solution',
								Url:
									'https://docs.aws.amazon.com/solutions/latest/centralized-logging-on-aws/welcome.html',
							},
							{
								DisplayText: 'Centralized Logging with OpenSearch',
								Url:
									'https://aws.amazon.com/solutions/implementations/centralized-logging-with-opensearch',
							},
							{
								DisplayText: 'Sending Logs Directly to Amazon S3',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Sending-Logs-Directly-To-S3.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_DIP_2',
				Title: 'O.DIP.2: Centralize logs for enhanced security investigations',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Given the sensitivity of this data, verify that the data is accessible only to authorized security personnel and that strong access controls are in place to maintain data security and confidentiality. Use cloud native tools or Security Information and Event Management (SIEM) solutions to aggregate, standardize, and centralize logs and event data, while respecting regional boundaries and data sovereignty requirements. Centralized logs and event data enhance the ability of security teams to conduct effective investigations, improve threat detection, and accelerate incident response times. Centralizing, normalizing, deduping, and removing unnecessary data allows security teams to use automation and scripted investigation tools which leads to a faster and more efficient response process. These tools are designed to collect and analyze logs and security events from various sources to provide a centralized view of an organization's security posture. Effective security investigations require the aggregation, standardization, and centralization of logs and events so they are readily accessible to investigation teams.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.2-centralize-logs-for-enhanced-security-investigations',
				},
				ImprovementPlan: {
					DisplayText:
						'Given the sensitivity of this data, verify that the data is accessible only to authorized security personnel and that strong access controls are in place to maintain data security and confidentiality. Use cloud native tools or Security Information and Event Management (SIEM) solutions to aggregate, standardize, and centralize logs and event data, while respecting regional boundaries and data sovereignty requirements. Refer to O.DIP.2: Centralize logs for enhanced security investigations in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.2-centralize-logs-for-enhanced-security-investigations',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF07-BP02 Analyze metrics when events or incidents occur',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_monitor_instances_post_launch_review_metrics.html',
							},
							{
								DisplayText:
									'Collect, analyze, and display Amazon CloudWatch Logs in a single dashboard with the Centralized Logging on AWS solution',
								Url:
									'https://docs.aws.amazon.com/solutions/latest/centralized-logging-on-aws/welcome.html',
							},
							{
								DisplayText: 'Cross-account cross-Region CloudWatch console',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Cross-Account-Cross-Region.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Framework - Security Pillar - Detection',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec-detection.html',
							},
							{
								DisplayText: 'Amazon Security Lake',
								Url: 'https://aws.amazon.com/security-lake',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_DIP_3',
				Title:
					'O.DIP.3: Implement distributed tracing for system-wide request tracking',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use a tracing solution that is scalable, provides real-time data collection, and supports comprehensive visualization of tracing data. It provides insights into system interactions across multiple services and applications, enabling quicker issue identification and resolution. This gives a comprehensive view of the entire system and its dependencies, facilitating quick identification and resolution of issues. Distributed tracing is a method to track requests as they move through distributed systems. Integrate this solution with the log and event aggregation tools to enhance system-wide visibility.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.3-implement-distributed-tracing-for-system-wide-request-tracking',
				},
				ImprovementPlan: {
					DisplayText:
						'Use a tracing solution that is scalable, provides real-time data collection, and supports comprehensive visualization of tracing data. It provides insights into system interactions across multiple services and applications, enabling quicker issue identification and resolution. Refer to O.DIP.3: Implement distributed tracing for system-wide request tracking in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.3-implement-distributed-tracing-for-system-wide-request-tracking',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL06-BP07 Monitor end-to-end tracing of requests through your system',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_end_to_end.html',
							},
							{
								DisplayText: 'Distributed Tracing System  AWS X-Ray',
								Url: 'https://aws.amazon.com/xray',
							},
							{
								DisplayText: 'Amazon CloudWatch ServiceLens',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ServiceLens.html',
							},
							{
								DisplayText: 'Amazon Managed Grafana',
								Url: 'https://aws.amazon.com/grafana',
							},
							{
								DisplayText: 'AWS X-Ray integration with Grafana',
								Url:
									'https://docs.aws.amazon.com/grafana/latest/userguide/x-ray-data-source.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_DIP_4',
				Title: 'O.DIP.4: Aggregate health and status metrics across workloads',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Aggregated health metrics provide a snapshot of the system's overall health and performance, aiding in proactive issue detection and efficient resource management. Aggregate health and status metrics across all workloads for a unified view of the system's overall health. Use a monitoring solution that allows aggregation of health metrics across all applications, supports real-time data collection, and provides intuitive visualization of metrics data. Integration with the logging, events, and tracing tools can provide a comprehensive view of overall system health.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.4-aggregate-health-and-status-metrics-across-workloads',
				},
				ImprovementPlan: {
					DisplayText:
						"Aggregated health metrics provide a snapshot of the system's overall health and performance, aiding in proactive issue detection and efficient resource management. Aggregate health and status metrics across all workloads for a unified view of the system's overall health. Refer to O.DIP.4: Aggregate health and status metrics across workloads in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.4-aggregate-health-and-status-metrics-across-workloads',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon Managed Grafana',
								Url: 'https://aws.amazon.com/grafana',
							},
							{
								DisplayText: 'Amazon Managed Service for Prometheus',
								Url: 'https://aws.amazon.com/prometheus',
							},
							{
								DisplayText: 'Application Monitoring with Amazon CloudWatch',
								Url:
									'https://aws.amazon.com/solutions/implementations/application-monitoring-with-cloudwatch',
							},
							{
								DisplayText: 'AWS Health Aware',
								Url: 'https://github.com/aws-samples/aws-health-aware',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_DIP_5',
				Title: 'O.DIP.5: Optimize telemetry data storage and costs',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Optimize costs associated with storing and processing large amounts of telemetry data by using techniques like data filtering and compression. When dealing with non-security related telemetry data, data sampling can also be an effective method to reduce costs. Be strategic about data retentionremove unused or unnecessary data from storage regularly. Also, be selective about which data sources are ingested and ensure they are required for effective analysis to avoid unnecessary spend. Always remember that while managing costs is important, it should not compromise the integrity and completeness of your data, especially when it comes to security. Select cost-effective solutions and consumption-based resources for data storage.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.5-optimize-telemetry-data-storage-and-costs',
				},
				ImprovementPlan: {
					DisplayText:
						'Optimize costs associated with storing and processing large amounts of telemetry data by using techniques like data filtering and compression. When dealing with non-security related telemetry data, data sampling can also be an effective method to reduce costs. Refer to O.DIP.5: Optimize telemetry data storage and costs in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.5-optimize-telemetry-data-storage-and-costs',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF03-BP01 Understand storage characteristics and requirements',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_right_storage_solution_understand_char.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS04-BP05 Remove unneeded or redundant data',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a6.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_DIP_6',
				Title: 'O.DIP.6: Standardize telemetry data with common formats',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Normalize telemetry data using a common format or standard schema to enhance consistency in data collection and reporting. Utilize a common telemetry format to streamline these processes, reduce associated costs of data processing, and allow teams to focus more on detecting and responding to actionable events. This facilitates seamless correlation and analysis across multiple facets of observability, such as system performance, user behaviors, and security events, improving the overall speed and accuracy of detection and response in any of these areas. Adopting and effectively using standard schemas or frameworks like OpenTelemetry and OCSF can provide considerable advantages in achieving comprehensive observability. OCSF, on the other hand, is an extensible, vendor-agnostic project designed to simplify data ingestion and normalization specifically for cybersecurity events. OpenTelemetry provides a single set of APIs, libraries, agents, and collector services to capture distributed traces and metrics from your application and send them to any observability platform.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.6-standardize-telemetry-data-with-common-formats',
				},
				ImprovementPlan: {
					DisplayText:
						'Normalize telemetry data using a common format or standard schema to enhance consistency in data collection and reporting. Utilize a common telemetry format to streamline these processes, reduce associated costs of data processing, and allow teams to focus more on detecting and responding to actionable events. Refer to O.DIP.6: Standardize telemetry data with common formats in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.dip.6-standardize-telemetry-data-with-common-formats',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Distro for OpenTelemetry',
								Url: 'https://aws.amazon.com/otel',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_DIP_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/O_DIP',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Observability',
		QuestionId: 'O_DIP',
		QuestionTitle:
			'How do you implement and manage data ingestion and processing?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Observability',
			QuestionDescription:
				'Data ingestion and processing involves the collection, centralization, and analysis of data from multiple sources. This data, when effectively ingested and processed, helps teams to understand the availability, security, performance, and reliability of their systems in real-time. Through streamlining data ingestion and processing, teams can make quicker and more effective decisions, enhancing overall agility and reliability of systems.',
			QuestionId: 'O_DIP',
			QuestionTitle:
				'How do you implement and manage data ingestion and processing?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'O_CM_1',
				Title: 'O.CM.1: Automate alerts for security and performance issues',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Effective alerting accelerates incident response times, enabling teams to quickly address and resolve issues before they can significantly impact system performance or security. Without automatic alerting, teams can suffer from delayed response times that can lead to prolonged system downtime or increased exposure to security threats. In a more advanced workflow, alerts can be integrated with automated governance systems to start remediation actions immediately upon detection or to gather additional insights that will aid investigations. Integrating these alerts into your centralized incident management systems can also help in the automatic creation of tickets, aiding faster resolution. Verify that the alerts are delivered to the appropriate teams by email, text message, or the team's preferred notification system. Alerts should automatically notify teams when there are indicators of malicious activity, compromise, or performance degradation.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.1-automate-alerts-for-security-and-performance-issues',
				},
				ImprovementPlan: {
					DisplayText:
						'Effective alerting accelerates incident response times, enabling teams to quickly address and resolve issues before they can significantly impact system performance or security. Without automatic alerting, teams can suffer from delayed response times that can lead to prolonged system downtime or increased exposure to security threats. Refer to O.CM.1: Automate alerts for security and performance issues in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.1-automate-alerts-for-security-and-performance-issues',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF07-BP06 Monitor and alarm proactively',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_monitor_instances_post_launch_proactive.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL06-BP03 Send notifications (Real-time processing and alarming)',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_notification_monitor.html',
							},
							{
								DisplayText: 'What is Anomaly Detection?',
								Url: 'https://aws.amazon.com/what-is/anomaly-detection',
							},
							{
								DisplayText: 'AWS Security Hub',
								Url: 'https://aws.amazon.com/security-hub',
							},
							{
								DisplayText: 'Amazon OpenSearch Service',
								Url: 'https://aws.amazon.com/opensearch-service',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_2',
				Title: 'O.CM.2: Plan for large scale events',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'At a minimum, the plan should outline how teams expect to maintain availability and reliability of systems by having the capability to automatically scale resources, re-route traffic, and failover to backup systems when required. Prepare a detailed incident management plan, outlining the roles, responsibilities, and processes to be followed in the event of a large-scale incident. A large scale event (LSE) is an incident that has a wide impact, such as service outages or major security incidents. Proper management of LSEs help to ensure business continuity, maintain customer trust, and reduce the negative impact of such events.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.2-plan-for-large-scale-events',
				},
				ImprovementPlan: {
					DisplayText:
						'At a minimum, the plan should outline how teams expect to maintain availability and reliability of systems by having the capability to automatically scale resources, re-route traffic, and failover to backup systems when required. Prepare a detailed incident management plan, outlining the roles, responsibilities, and processes to be followed in the event of a large-scale incident. Refer to O.CM.2: Plan for large scale events in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.2-plan-for-large-scale-events',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Disaster Recovery of Workloads on AWS: Recovery in the Cloud',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html',
							},
							{
								DisplayText: 'Incident management',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/incident-management.html',
							},
							{
								DisplayText: 'Disaster recovery plan',
								Url:
									'https://aws.amazon.com/disaster-recovery/faqs#Core_concepts',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_3',
				Title:
					'O.CM.3: Conduct post-incident analysis for continuous improvement',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The post-incident retrospective findings should be anonymized, as to not place blame onto any individuals, and should be well documented and shared with the broader organization so that others may learn as well. Instead, they provide the time for teams to optimize their response process for future incidents and helps ensure that they are continuously learning and improving their incident response capabilities. At a minimum, this should include the leaders and individual contributors who support the system, the customer advocates, those who were impacted by the issue internally, as well as those involved with the resolution of the issue. The post-incident retrospectives allow teams to identify gaps and areas for improvement by analyzing the actions that were taken during an incident. Drive the continuous improvement of analysis and response mechanisms by holding post-incident retrospectives. These retrospectives should not be used to place blame or point fingers at individuals.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.3-conduct-post-incident-analysis-for-continuous-improvement',
				},
				ImprovementPlan: {
					DisplayText:
						'The post-incident retrospective findings should be anonymized, as to not place blame onto any individuals, and should be well documented and shared with the broader organization so that others may learn as well. Instead, they provide the time for teams to optimize their response process for future incidents and helps ensure that they are continuously learning and improving their incident response capabilities. Refer to O.CM.3: Conduct post-incident analysis for continuous improvement in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.3-conduct-post-incident-analysis-for-continuous-improvement',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF07-BP02 Analyze metrics when events or incidents occur',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_monitor_instances_post_launch_review_metrics.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL12-BP02 Perform post-incident analysis',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_rca_resiliency.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Operational Excellence Pillar: OPS11-BP02 Perform post-incident analysis',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_perform_rca_process.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_4',
				Title:
					'O.CM.4: Report on business metrics to drive data-driven decision making',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"These metrics should inform key performance indicators (KPIs), service level objectives (SLOs), service level agreement (SLA) adherence, user engagement, conversion rates, and other metrics relevant to the business sides of your operations. Just like with technology metrics, continuous monitoring tools should be used to detect when business metrics cross predefined thresholds, triggering alerts that highlight significant deviations or potential issues. Continuously monitoring and alerting on business metrics is becoming foundational for organizations committed to maximizing the value they get from their technology investments and for maintaining the quality of their digital services. Observability isn't merely about data collectionit is about turning that data into actionable insights that drive better outcomes for both the technology and business sides of the organization. These alerts should inform timely and data-driven decision-making, helping identify areas for improvement, optimizing system performance, and aligning actions with overarching business goals. Ensure the data is up-to-date, accurate, and accessible to less technical leaders so that it can be used to make informed business decisions.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.4-report-on-business-metrics-to-drive-data-driven-decision-making',
				},
				ImprovementPlan: {
					DisplayText:
						'These metrics should inform key performance indicators (KPIs), service level objectives (SLOs), service level agreement (SLA) adherence, user engagement, conversion rates, and other metrics relevant to the business sides of your operations. Just like with technology metrics, continuous monitoring tools should be used to detect when business metrics cross predefined thresholds, triggering alerts that highlight significant deviations or potential issues. Refer to O.CM.4: Report on business metrics to drive data-driven decision making in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.4-report-on-business-metrics-to-drive-data-driven-decision-making',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF07-BP05 Review metrics at regular intervals',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_monitor_instances_post_launch_review_metrics_collected.html',
							},
							{
								DisplayText: 'Operational observability',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/operational-observability.html',
							},
							{
								DisplayText:
									'Using Cloud Fitness Functions to Drive Evolutionary Architecture',
								Url:
									'https://aws.amazon.com/blogs/architecture/using-cloud-fitness-functions-to-drive-evolutionary-architecture',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_5',
				Title:
					'O.CM.5: Detect performance issues using application performance monitoring',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Application Performance Monitoring (APM) refers to the use of tools to monitor and manage the ongoing, real-time performance and availability of systems in production environments. APM tools help in maintaining the performance of systems by identifying performance issues early on. Both tools collect metrics on response time, resource utilization, and other performance-related indicators, forming a holistic approach to continuous performance monitoring in production environments. These APM tools are recommended detect and diagnose performance issues in production systems. These APM tools enable teams to proactively detect and diagnose complex application performance problems to maintain an expected level of service. To comprehensively monitor application performance, implement both Real-User Monitoring (RUM) and Synthetic Monitoring.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.5-detect-performance-issues-using-application-performance-monitoring',
				},
				ImprovementPlan: {
					DisplayText:
						'Application Performance Monitoring (APM) refers to the use of tools to monitor and manage the ongoing, real-time performance and availability of systems in production environments. APM tools help in maintaining the performance of systems by identifying performance issues early on. Refer to O.CM.5: Detect performance issues using application performance monitoring in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.5-detect-performance-issues-using-application-performance-monitoring',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF01-BP06 Benchmark existing workloads',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_performing_architecture_benchmark.html',
							},
							{
								DisplayText:
									'What is APM (Application Performance Monitoring)?',
								Url:
									'https://aws.amazon.com/what-is/application-performance-monitoring',
							},
							{
								DisplayText: 'Real-User Monitoring (RUM) for Amazon CloudWatch',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM.html',
							},
							{
								DisplayText: 'Amazon CloudWatch ServiceLens',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ServiceLens.html',
							},
							{
								DisplayText: 'Amazon CloudWatch Synthetics',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_6',
				Title:
					'O.CM.6: Gather user experience insights using digital experience monitoring',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'DEM is recommended as it provides important insights into the user experience and helps detect issues that may impact user experience Digital Experience Monitoring (DEM) involves simulating user interactions with applications to measure the performance and availability of services from the perspective of end users. DEM allows teams to proactively detect and resolve issues that may impact user experience. Implement APM tools, such as synthetic transaction monitoring using canaries to simulate user interactions with your application and measure the response times and accuracy of the results. It also helps in validating that application updates or changes do not negatively impact user experience.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.6-gather-user-experience-insights-using-digital-experience-monitoring',
				},
				ImprovementPlan: {
					DisplayText:
						'DEM is recommended as it provides important insights into the user experience and helps detect issues that may impact user experience Digital Experience Monitoring (DEM) involves simulating user interactions with applications to measure the performance and availability of services from the perspective of end users. Refer to O.CM.6: Gather user experience insights using digital experience monitoring in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.6-gather-user-experience-insights-using-digital-experience-monitoring',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon CloudWatch Synthetics',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries.html',
							},
							{
								DisplayText: 'AWS Marketplace - Digital Experience Monitoring',
								Url:
									'https://aws.amazon.com/marketplace/search/results?searchTerms=Digital+Experience+Monitoring',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_7',
				Title: 'O.CM.7: Visualize telemetry data in real-time',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Using these tools, teams are able to detect trends, patterns, and anomalies in data in a readily available and easy to understand way. Visualization tools support the uniquely human capability to discover patterns that automated tools may otherwise miss. Choose a tool that provides a clear view of system data at varying time intervals, allowing teams to easily detect issues both during or after they arise. Utilize visualization tools to correlate and comprehend large sets of telemetry data in real-time. Visualization tools simplify the task of correlating and understanding large, complex datasets. Ensure that the tool is flexible and customizable, so that teams can adjust the views and create dashboards based on their unique needs.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.7-visualize-telemetry-data-in-real-time',
				},
				ImprovementPlan: {
					DisplayText:
						'Using these tools, teams are able to detect trends, patterns, and anomalies in data in a readily available and easy to understand way. Visualization tools support the uniquely human capability to discover patterns that automated tools may otherwise miss. Refer to O.CM.7: Visualize telemetry data in real-time in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.7-visualize-telemetry-data-in-real-time',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Building dashboards for operational visibility',
								Url:
									'https://aws.amazon.com/builders-library/building-dashboards-for-operational-visibility',
							},
							{
								DisplayText:
									'Building Prowler into a QuickSight powered AWS Security Dashboard',
								Url:
									'https://catalog.us-east-1.prod.workshops.aws/workshops/b1cdc52b-eb11-44ed-8dc8-9dfe5fb254f5/en-US',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_8',
				Title: 'O.CM.8: Hold operational review meetings for data transparency',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Operational review meetings are regular gatherings where teams from across the organization come prepared with an operational dashboard that showcases telemetry data, performance metrics, and other insights into operations for their products. When presenting, teams must be capable of deep diving into the data, explaining root causes behind notable data changes, and articulating the steps taken or planned to rectify any anomalies. Amazon implements this by holding weekly Ops review meetings and using the spinning wheel as a random selection method for which team will present. The aim is present to the broad audience to share and gain different perspectives on changes in the data, whether it is a spike, dip, or trend. The randomness of the selection ensures that each team comes prepared, as any team can be called upon to present. This pushes teams to maintain high-quality operational dashboards that reflect the real-time health and performance of their services.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.8-hold-operational-review-meetings-for-data-transparency',
				},
				ImprovementPlan: {
					DisplayText:
						'Operational review meetings are regular gatherings where teams from across the organization come prepared with an operational dashboard that showcases telemetry data, performance metrics, and other insights into operations for their products. When presenting, teams must be capable of deep diving into the data, explaining root causes behind notable data changes, and articulating the steps taken or planned to rectify any anomalies. Refer to O.CM.8: Hold operational review meetings for data transparency in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.8-hold-operational-review-meetings-for-data-transparency',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'spinning wheel',
								Url: 'https://github.com/aws/aws-ops-wheel',
							},
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF07-BP05 Review metrics at regular intervals',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_monitor_instances_post_launch_review_metrics_collected.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL06-BP06 Conduct reviews regularly',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_review_monitoring.html',
							},
							{
								DisplayText: 'AWS Ops Wheel',
								Url: 'https://github.com/aws/aws-ops-wheel',
							},
							{
								DisplayText:
									'AWS Well-Architected Operational Excellence Pillar: OPS11-BP07 Perform operations metrics reviews',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_metrics_review.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_9',
				Title:
					'O.CM.9: Optimize alerts to prevent fatigue and minimize monitoring costs',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Reduce the number of ineffective alerts as well as the costs associated with monitoring by optimizing rules and thresholds for alerts based on business impact and issue severity. Regular reviews and adjustments of these rules and thresholds should be done based on usage patterns to further minimize costs, while still ensuring that teams are alerted to critical issues in a timely and effective manner. By continuously refining rules and thresholds for alerts, teams can minimize unnecessary notifications, reducing the time and resources spent on non-critical issues. Implementing intelligent alerting strategies, such as alert deduplication, aggregation, and comprehensive data visualization can help to reduce cost, alert fatigue, and data overload that comes with having too many alerts. Set up alert rules and thresholds based on the severity and business impact of potential issues. Teams should leverage cost-effective methods for delivering notifications, and work to reduce the amount of false positive notifications.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.9-optimize-alerts-to-prevent-fatigue-and-minimize-monitoring-costs',
				},
				ImprovementPlan: {
					DisplayText:
						'Reduce the number of ineffective alerts as well as the costs associated with monitoring by optimizing rules and thresholds for alerts based on business impact and issue severity. Regular reviews and adjustments of these rules and thresholds should be done based on usage patterns to further minimize costs, while still ensuring that teams are alerted to critical issues in a timely and effective manner. Refer to O.CM.9: Optimize alerts to prevent fatigue and minimize monitoring costs in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.9-optimize-alerts-to-prevent-fatigue-and-minimize-monitoring-costs',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_10',
				Title: 'O.CM.10: Proactively detect issues using AI/ML',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose a tool that can leverage data and analytics to automatically infer predictions, and begin to feed data to it and inject failure to test the validity of the tool. Adopt data-driven AI/ML monitoring tools and techniques like Artificial Intelligence Operations (AIOps), ML-powered anomaly detection, and predictive analytics solutions, to detect issues and performance bottlenecks proactivelyeven before system performance is impacted. Once operational, the tool can automatically detect issues, predict impending resource exhaustion, detail likely causes, and recommend remediation actions to the team. As the tool becomes more familiar with the data patterns, teams can gradually increase the alerting scope. Ensure that there is a feedback loop to continuously train and refine these models based on real-world data and incidents. Start small when setting up alerts from these tools to avoid alert fatigue and maintain trust in the system.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.10-proactively-detect-issues-using-aiml',
				},
				ImprovementPlan: {
					DisplayText:
						'Choose a tool that can leverage data and analytics to automatically infer predictions, and begin to feed data to it and inject failure to test the validity of the tool. Adopt data-driven AI/ML monitoring tools and techniques like Artificial Intelligence Operations (AIOps), ML-powered anomaly detection, and predictive analytics solutions, to detect issues and performance bottlenecks proactivelyeven before system performance is impacted. Refer to O.CM.10: Proactively detect issues using AI/ML in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/o.cm.10-proactively-detect-issues-using-aiml',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Machine-Learning-Powered DevOps - Amazon DevOps Guru',
								Url: 'https://aws.amazon.com/devops-guru',
							},
							{
								DisplayText: 'Amazon GuardDuty',
								Url: 'https://aws.amazon.com/guardduty',
							},
							{
								DisplayText: 'Continuous Monitoring and Threat Detection',
								Url:
									'https://aws.amazon.com/security/continuous-monitoring-threat-detection',
							},
							{
								DisplayText:
									'Gaining operational insights with AIOps using Amazon DevOps Guru Workshop',
								Url:
									'https://catalog.us-east-1.prod.workshops.aws/workshops/f92df379-6add-4101-8b4b-38b788e1222b/en-US',
							},
							{
								DisplayText: 'What Is Anomaly Detection?',
								Url: 'https://aws.amazon.com/what-is/anomaly-detection',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'O_CM_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/O_CM',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Observability',
		QuestionId: 'O_CM',
		QuestionTitle: 'How do you implement and manage continuous monitoring?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Observability',
			QuestionDescription:
				'Continuous monitoring is the real-time observation and analysis of telemetry data to help optimize system performance. It encompasses alert configuration to notify teams of potential issues, promoting rapid response. Post-event investigations provide valuable insights to continuously optimize the monitoring process. By integrating artificial intelligence (AI) and machine learning (ML), continuous monitoring can achieve a higher level of precision and speed in detecting and responding to system issues.',
			QuestionId: 'O_CM',
			QuestionTitle: 'How do you implement and manage continuous monitoring?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OA_LS_1',
				Title:
					'OA.LS.1: Appoint a decision-making leader to own DevOps adoption',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Because DevOps adoption has a broad impact that requires change to occur throughout the entire organization, the leader must have support from executives, such as the CEO, CTO, CIO, or CISO. DevOps adoption requires a dedicated leader to help facilitate continued progress, make resource decisions, and gain alignment with leaders throughout the organization. As progress is made, the leader regularly updates other teams and leaders of DevOps adoption initiatives and the impact DevOps is having on the business. This leadership role, inspired by Amazon's single-threaded leadership concept, becomes the person within the company fully dedicated and accountable for DevOps adoption. The ideal single-threaded leader for DevOps adoption is usually a role reporting directly to senior executives. Open communication channels must remain open throughout the organization to foster collaboration and receive support.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.1-appoint-a-decision-making-leader-to-own-devops-adoption',
				},
				ImprovementPlan: {
					DisplayText:
						'Because DevOps adoption has a broad impact that requires change to occur throughout the entire organization, the leader must have support from executives, such as the CEO, CTO, CIO, or CISO. DevOps adoption requires a dedicated leader to help facilitate continued progress, make resource decisions, and gain alignment with leaders throughout the organization. Refer to OA.LS.1: Appoint a decision-making leader to own DevOps adoption in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.1-appoint-a-decision-making-leader-to-own-devops-adoption',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST01-BP02 Establish a partnership between finance and technology',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_partnership.html',
							},
							{
								DisplayText:
									'AWS Cloud Adoption Framework: People Perspective - Transformational leadership',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/aws-caf-people-perspective/transformational-leadership.html',
							},
							{
								DisplayText:
									'Two-Pizza Teams Are Just the Start, Part 2: Accountability and Empowerment Are Key to High-Performing Agile Organizations',
								Url:
									'https://aws.amazon.com/blogs/enterprise-strategy/two-pizza-teams-are-just-the-start-accountability-and-empowerment-are-key-to-high-performing-agile-organizations-part-2',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_LS_2',
				Title: 'OA.LS.2: Align DevOps adoption with business objectives',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Individual teams across the organization can progress towards adopting DevOps best practices as part of the regular planning processes. Synchronizing DevOps adoption and the overall business strategy means that the resources and effort put into adopting DevOps are also directly improving business outcomes. Consistently revisit the prioritized DevOps capability list at least once a year to continue progressing towards adopting DevOps best practices. The team's operating plan should be shared with leadership and other relevant teams within the organization to promote shared knowledge and collaboration. You can use the AWS DevOps Sagas indicators provided in this guidance to assess your existing DevOps capabilities against best practices. It should be aligned to broader business goals, fully supported by leadership, with other teams also adopting capabilities to streamline their individual value streams.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.2-align-devops-adoption-with-business-objectives',
				},
				ImprovementPlan: {
					DisplayText:
						'Individual teams across the organization can progress towards adopting DevOps best practices as part of the regular planning processes. Synchronizing DevOps adoption and the overall business strategy means that the resources and effort put into adopting DevOps are also directly improving business outcomes. Refer to OA.LS.2: Align DevOps adoption with business objectives in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.2-align-devops-adoption-with-business-objectives',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_LS_3',
				Title: 'OA.LS.3: Drive continued improvement through business reviews',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"It's possible to retain this visibility across a decentralized operating model by creating structured, data-driven mechanisms, such as conducting regular business review meetings and tracking key performance indicators (KPIs). KPIs should be continually improved and refined over time to keep them aligned with business objectives as the organization adopts DevOps and business needs change. Schedule frequent business review meetings to review KPIs, bringing together both technical and business stakeholders on a regular cadence. Each team should continually capture both technical and business related KPIs and make them presentable for regular business reviews. Within Amazon, teams and leaders meet regularly during weekly business reviews (WBRs) to assess the validity and quality of KPIs against organizational goals. Begin by developing a set of KPIs that align with desired business outcomes and simultaneously demonstrates the impact of DevOps adoption on achieving them.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.3-drive-continued-improvement-through-business-reviews',
				},
				ImprovementPlan: {
					DisplayText:
						"It's possible to retain this visibility across a decentralized operating model by creating structured, data-driven mechanisms, such as conducting regular business review meetings and tracking key performance indicators (KPIs). KPIs should be continually improved and refined over time to keep them aligned with business objectives as the organization adopts DevOps and business needs change. Refer to OA.LS.3: Drive continued improvement through business reviews in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.3-drive-continued-improvement-through-business-reviews',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF07-BP03 Establish key performance indicators (KPIs) to measure workload performance',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_monitor_instances_post_launch_establish_kpi.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST02-BP02 Implement goals and targets',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_goal_target.html',
							},
							{
								DisplayText: 'What is the difference between SLA and KPI?',
								Url:
									'https://aws.amazon.com/what-is/service-level-agreement#seo-faq-pairs#sla-kpi',
							},
							{
								DisplayText:
									'The Business Value of Migration to Amazon Web Services',
								Url:
									'https://pages.awscloud.com/rs/112-TZM-766/images/hackett-group-the-business-value-of-migration-to-aws-012022.pdf',
							},
							{
								DisplayText: 'Business Value of Cloud',
								Url:
									'https://pages.awscloud.com/rs/112-TZM-766/images/known-business-value-of-cloud-%20modernization-012022.pdf',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_LS_4',
				Title: 'OA.LS.4: Open dialogue between leadership and teams',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"The gathered feedback should drive decision-making at all levels of leadership to identify areas for improvement, address employee concerns, and promote a culture of open communication. Leaders should regularly share updates, insights, and learning back to teams to create a culture of collaboration and trust. Establish open communication channels between leaders and team members. Leaders must actively engage with this feedback, sharing updates and insights with teams. This action not only builds trust, but also aligns everyone with the organization's DevOps adoption progress. An Amazon example is Amazon Connections, a mechanism that captures real-time feedback and data from employees about their experiences.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.4-open-dialogue-between-leadership-and-teams',
				},
				ImprovementPlan: {
					DisplayText:
						'The gathered feedback should drive decision-making at all levels of leadership to identify areas for improvement, address employee concerns, and promote a culture of open communication. Leaders should regularly share updates, insights, and learning back to teams to create a culture of collaboration and trust. Refer to OA.LS.4: Open dialogue between leadership and teams in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.4-open-dialogue-between-leadership-and-teams',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon Connections',
								Url: 'https://amazon.jobs/en/landing_pages/hrresearch',
							},
							{
								DisplayText:
									"Business Value is IT's Primary Measure of Progress",
								Url:
									'https://aws.amazon.com/blogs/enterprise-strategy/business-value-is-its-primary-measure-of-progress',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_LS_5',
				Title:
					'OA.LS.5: Assemble a cross-functional enabling team that focuses on organizational transformation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The single-threaded DevOps owner is responsible for creating this team and providing it with the freedom, resources, training, and tools that help them effectively support and guide other teams.This centralized team should collaborate closely with other teams to identify and address barriers to adoption, share best practices, and promote a culture of nearly continuous learning and improvement. To spread knowledge across the organizations and help individual teams adopt DevOps capabilities, create an enabling team with expertise in DevOps culture, practices, and tools. While this centralized team is not strictly required for every organization to adopt DevOps, we recommend it due to its potential to streamline and expedite transformation. If leadership chooses not to create a Center of Enablement, they can supplement it by fostering a strong culture of collaboration, sharing, automation, and continuous improvement. With the right support and resources being provided from leadership, teams can work together to establish their own DevOps processes. In many organizations, this team takes the form of the Center of Enablement.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.5-assemble-a-cross-functional-enabling-team-that-focuses-on-organizational-transformation',
				},
				ImprovementPlan: {
					DisplayText:
						'The single-threaded DevOps owner is responsible for creating this team and providing it with the freedom, resources, training, and tools that help them effectively support and guide other teams.This centralized team should collaborate closely with other teams to identify and address barriers to adoption, share best practices, and promote a culture of nearly continuous learning and improvement. To spread knowledge across the organizations and help individual teams adopt DevOps capabilities, create an enabling team with expertise in DevOps culture, practices, and tools. Refer to OA.LS.5: Assemble a cross-functional enabling team that focuses on organizational transformation in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ls.5-assemble-a-cross-functional-enabling-team-that-focuses-on-organizational-transformation',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Operational Excellence Pillar: Separated AEO and IEO with centralized governance and an internal service provider consulting partner',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/separated-aeo-ieo-with-cent-gov-and-partner.html',
							},
							{
								DisplayText:
									'What is a cloud center of excellence and why should your organization create one?',
								Url:
									'https://aws.amazon.com/blogs/publicsector/what-is-cloud-center-excellence-why-should-your-organization-create-one',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_LS_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/OA_LS',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Organizational_Adoption',
		QuestionId: 'OA_LS',
		QuestionTitle: 'How do you implement and manage leader sponsorship?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Organizational_Adoption',
			QuestionDescription:
				"Obtaining leader sponsorship of DevOps adoption initiatives helps verify that the organization's leadership is committed to and actively supports the adoption of DevOps practices.",
			QuestionId: 'OA_LS',
			QuestionTitle: 'How do you implement and manage leader sponsorship?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OA_STD_1',
				Title:
					'OA.STD.1: Organize teams into distinct topology types to optimize the value stream',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To optimize the value stream and achieve desired business outcomes, embrace the four team topologies model, as outlined in Team Topologies by Matthew Skelton and Manuel Pais. Assess each team and categorize them into one of the four topologies, aligning them with the overall value stream and creating clear purpose and goals. Organizing teams according to these topologies allows organizations to manage dependencies, enhance collaboration, and facilitate effective value delivery. The four team topologies are:',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.1-organize-teams-into-distinct-topology-types-to-optimize-the-value-stream',
				},
				ImprovementPlan: {
					DisplayText:
						'To optimize the value stream and achieve desired business outcomes, embrace the four team topologies model, as outlined in Team Topologies by Matthew Skelton and Manuel Pais. Assess each team and categorize them into one of the four topologies, aligning them with the overall value stream and creating clear purpose and goals. Refer to OA.STD.1: Organize teams into distinct topology types to optimize the value stream in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.1-organize-teams-into-distinct-topology-types-to-optimize-the-value-stream',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_STD_2',
				Title:
					'OA.STD.2: Tailor operating models to business needs and team preferences',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"A centralized governance model grants platform teams within an organization the ability to control how and what other teams are able to deploy, at the cost of restricting those teams' ability to innovate and make changes quickly. Conversely, a fully decentralized model offers teams more flexibility and autonomy, requiring less intensive collaboration between teams through reliance on guardrails and automated governance over strict control. For these use cases, a fully separated operating model or introducing an Internal MSP and Consulting Partner might be needed for those systems that must stay as is with more traditional ways of working. When choosing a Well-Architected operating model for systems that can support DevOps, first determine if centralized or decentralized control of governance is necessary. The AWS Well-Architected Framework Operational Excellence Pillar provides a detailed 2 by 2 representations of operating model implementations that can be reviewed to gain insights into potential combinations. Keep in mind that multiple operating models can be used concurrently, catering to different use cases, levels of organizational maturity, and individual team and product needs.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.2-tailor-operating-models-to-business-needs-and-team-preferences',
				},
				ImprovementPlan: {
					DisplayText:
						"A centralized governance model grants platform teams within an organization the ability to control how and what other teams are able to deploy, at the cost of restricting those teams' ability to innovate and make changes quickly. Conversely, a fully decentralized model offers teams more flexibility and autonomy, requiring less intensive collaboration between teams through reliance on guardrails and automated governance over strict control. Refer to OA.STD.2: Tailor operating models to business needs and team preferences in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.2-tailor-operating-models-to-business-needs-and-team-preferences',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'2 by 2 representations of operating model implementations',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/operating-model-2-by-2-representations.html',
							},
							{
								DisplayText: 'fully separated',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/fully-separated-operating-model.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Operational Excellence Pillar: Operating model 2 by 2 representations',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/operating-model-2-by-2-representations.html',
							},
							{
								DisplayText:
									'Building your Cloud Operating Model: Organize for Success',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-cloud-operating-model/implement-roadmap.html#organize',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_STD_3',
				Title:
					'OA.STD.3: Prioritize shared accountability over individual achievements',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Prioritizing team success over individual accomplishments promotes a cohesive and high-performing team environment that is essential for successful DevOps adoption. Create a sense of shared ownership and responsibility for achieving team success, encouraging members to support each other and provide constructive feedback. Encourage a culture of teamwork and shared accountability by establishing common goals and fostering collaboration and open communication. Regularly evaluate progress towards goals and celebrate successes together as a team.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.3-prioritize-shared-accountability-over-individual-achievements',
				},
				ImprovementPlan: {
					DisplayText:
						'Prioritizing team success over individual accomplishments promotes a cohesive and high-performing team environment that is essential for successful DevOps adoption. Create a sense of shared ownership and responsibility for achieving team success, encouraging members to support each other and provide constructive feedback. Refer to OA.STD.3: Prioritize shared accountability over individual achievements in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.3-prioritize-shared-accountability-over-individual-achievements',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_STD_4',
				Title: 'OA.STD.4: Structure teams around desired business outcomes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Organizations can use this concept to build more effective team structures by employing the Inverse Conway Maneuver, also known as Reverse Conway's Law, as described by Jonny LeRoy and Matt Simons. By designing teams and their communication structures to reflect the intended architecture and interactions of the system being built, organizations can achieve increased efficiency and more effective collaboration between teams, ultimately enhancing the overall product delivery process. To maximize value and effectiveness in product delivery, intentionally design team structures that reflect the desired architecture and interactions of the systems being built. Conway's Law, introduced by Melvin Conway in the paper How Do Committees Invent?, posits that the structure of an organization influences the design of the systems it builds. This approach increases the chances of building and supporting effective products optimized for full coverage of the full value stream. Clearly define roles, responsibilities, and ownership for each team and align with the expected business outcomes.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.4-structure-teams-around-desired-business-outcomes',
				},
				ImprovementPlan: {
					DisplayText:
						"Organizations can use this concept to build more effective team structures by employing the Inverse Conway Maneuver, also known as Reverse Conway's Law, as described by Jonny LeRoy and Matt Simons. By designing teams and their communication structures to reflect the intended architecture and interactions of the system being built, organizations can achieve increased efficiency and more effective collaboration between teams, ultimately enhancing the overall product delivery process. Refer to OA.STD.4: Structure teams around desired business outcomes in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.4-structure-teams-around-desired-business-outcomes',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_STD_5',
				Title: 'OA.STD.5: Establish team norms that enhance work performance',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'When establishing team norms, consider the stages of group development as described in the paper Developmental Sequence in Small Groups by Bruce Tuckman, which describes the common stages of forming, storming, norming, and performing. Optimize work performance by establishing norms that define clear roles, schedules, and processes for agile ceremonies. Agree on regular meeting schedules, such as daily stand-ups, sprint planning, backlog refinement, and sprint retrospectives if you are following Scrum. Define roles for each team member during ceremonies, clarifying responsibilities and purpose in the ceremony. Be mindful of these stages to provide the right support to teams, especially as they progress through the early phases of group formation. Conduct regular process reviews to identify areas for improvement and refine the ceremony structure as needed.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.5-establish-team-norms-that-enhance-work-performance',
				},
				ImprovementPlan: {
					DisplayText:
						'When establishing team norms, consider the stages of group development as described in the paper Developmental Sequence in Small Groups by Bruce Tuckman, which describes the common stages of forming, storming, norming, and performing. Optimize work performance by establishing norms that define clear roles, schedules, and processes for agile ceremonies. Refer to OA.STD.5: Establish team norms that enhance work performance in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.5-establish-team-norms-that-enhance-work-performance',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What Is Scrum?',
								Url: 'https://aws.amazon.com/what-is/scrum',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_STD_6',
				Title:
					'OA.STD.6: Provide teams ownership of the entire value stream for their product',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To be successful in this model at scale, centralized functions, such as centralized security teams, must also evolve: instead of direct oversight, they should act as enablers, providing resources and expertise to these distributed teams. Over time the teams should gradually become more self-reliant, collaboration between teams should improve, and deployment frequency should increase. At Amazon, we call these small, autonomous teams with a single-threaded focus two-pizza teams. Individual teams build relationships with the centralized functions, share knowledge, and enhance processes consistently over time. The enabling functions should provide the necessary knowledge, resources, and attention required for teams to be successful. These teams not only own the development of their product, but also take responsibility of aspects like security and quality assurance.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.6-provide-teams-ownership-of-the-entire-value-stream-for-their-product',
				},
				ImprovementPlan: {
					DisplayText:
						'To be successful in this model at scale, centralized functions, such as centralized security teams, must also evolve: instead of direct oversight, they should act as enablers, providing resources and expertise to these distributed teams. Over time the teams should gradually become more self-reliant, collaboration between teams should improve, and deployment frequency should increase. Refer to OA.STD.6: Provide teams ownership of the entire value stream for their product in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.6-provide-teams-ownership-of-the-entire-value-stream-for-their-product',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'two-pizza teams',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/introduction-devops-aws/two-pizza-teams.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP01 Train for application security',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_train_for_application_security.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP08 Build a program that embeds security ownership in workload teams',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_build_program_that_embeds_security_ownership_in_teams.html',
							},
							{
								DisplayText:
									'Enterprise DevOps: Why You Should Run What You Build',
								Url:
									'https://aws.amazon.com/blogs/enterprise-strategy/enterprise-devops-why-you-should-run-what-you-build',
							},
							{
								DisplayText:
									"Powering Innovation and Speed with Amazon's Two-Pizza Teams",
								Url:
									'https://aws.amazon.com/executive-insights/content/amazon-two-pizza-team',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_STD_7',
				Title:
					'OA.STD.7: Amplify the scale and impact of centralized functions',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'As decentralized teams become responsible for their respective value streams and products, including responsibilities like security and quality assurance, centralized functions can often become bottlenecks. This involves embedding specialized champions or Guardians within individual teams to enhance and scale the capabilities of centralized functions, such as security, quality, and audit. Security, quality assurance, and audit functions are great examples of centralized functions that must scale when adopting DevOps best practices. Recognize the inefficiencies and gaps within teams that these guardians can rectify, and identify which centralized function would benefit most from on-the-ground, embedded expertise. Embedding guardians directly into teams helps make specialized knowledge always available, reducing wait times and facilitating real-time, context-aware decision-making. When selecting and training guardians, pinpoint passionate team members who volunteer to undergo specialized training to become focal points for their respective domains.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.7-amplify-the-scale-and-impact-of-centralized-functions',
				},
				ImprovementPlan: {
					DisplayText:
						'As decentralized teams become responsible for their respective value streams and products, including responsibilities like security and quality assurance, centralized functions can often become bottlenecks. This involves embedding specialized champions or Guardians within individual teams to enhance and scale the capabilities of centralized functions, such as security, quality, and audit. Refer to OA.STD.7: Amplify the scale and impact of centralized functions in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.7-amplify-the-scale-and-impact-of-centralized-functions',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP08 Build a program that embeds security ownership in workload teams',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_build_program_that_embeds_security_ownership_in_teams.html',
							},
							{
								DisplayText: 'Scaling security and compliance',
								Url:
									'https://aws.amazon.com/blogs/security/scaling-security-and-compliance',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_STD_8',
				Title: 'OA.STD.8: Promote cognitive diversity within teams',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Promote cognitive diversity within small teams by including members with varied ethnic, cultural, regional, gender, age, and other backgrounds. Additionally, invest in security training and awareness programs, equipping your team members with the knowledge and skills to identify and mitigate security risks. Having a diverse mix of skills, experiences, and backgrounds within the team helps them effectively innovate to solve complex problems and better mimic the personas and culture of their users. By creating teams that embrace cognitive diversity, organizations can improve innovation, creativity, and problem solving, leading to better outcomes for the organization and its customers. Aim to maintain strong cognitive diversity by regularly assessing the diversity of the team and identifying any potential gaps. This approach requires team members to have a wide range of cross-functional skills, from software development and testing to operations and security.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.8-promote-cognitive-diversity-within-teams',
				},
				ImprovementPlan: {
					DisplayText:
						'Promote cognitive diversity within small teams by including members with varied ethnic, cultural, regional, gender, age, and other backgrounds. Additionally, invest in security training and awareness programs, equipping your team members with the knowledge and skills to identify and mitigate security risks. Refer to OA.STD.8: Promote cognitive diversity within teams in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.std.8-promote-cognitive-diversity-within-teams',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP01 Train for application security',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_train_for_application_security.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_STD_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/OA_STD',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Organizational_Adoption',
		QuestionId: 'OA_STD',
		QuestionTitle: 'How do you implement and manage supportive team dynamics?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Organizational_Adoption',
			QuestionDescription:
				'Supportive team dynamics are essential to DevOps adoption as it promotes a sense of ownership, autonomy, shared accountability, and collaboration among team members.',
			QuestionId: 'OA_STD',
			QuestionTitle:
				'How do you implement and manage supportive team dynamics?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OA_TI_1',
				Title:
					'OA.TI.1: Communicate work flow and goals between teams and stakeholders',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Teams can use work tracking tools that promote a more agile, adaptive approach, such as Scrum or Kanban boards, and dashboards to make their work, priorities, and key metrics visible to others in the organization. One way to achieve this is by regularly sharing ongoing work, roadmaps, and team goals with key stakeholders and other teams. When operating in a DevOps model, many small teams work together to deliver business outcomes to customers. This helps teams understand how their work impacts others and the overall business goals. Make these tools easily accessible, either through physical displays or digital platforms, to promote alignment with business objectives. Regularly review the flow of work to identify bottlenecks, areas for improvement, and opportunities to optimize the process.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.1-communicate-work-flow-and-goals-between-teams-and-stakeholders',
				},
				ImprovementPlan: {
					DisplayText:
						'Teams can use work tracking tools that promote a more agile, adaptive approach, such as Scrum or Kanban boards, and dashboards to make their work, priorities, and key metrics visible to others in the organization. One way to achieve this is by regularly sharing ongoing work, roadmaps, and team goals with key stakeholders and other teams. Refer to OA.TI.1: Communicate work flow and goals between teams and stakeholders in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.1-communicate-work-flow-and-goals-between-teams-and-stakeholders',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_2',
				Title:
					'OA.TI.2: Streamline intra-team communication using tools and processes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use reporting tools, playbooks, and retrospective sessions to improve processes and team norms. Establish team norms and practices, such as lexicons, story pointing, and defining done, to streamline intra-team communication. Implement team collaboration, document sharing, task creation, and progress monitoring tools. Equip teams with tools to automate and manage their workflows, priorities, and decision-making processes.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.2-streamline-intra-team-communication-using-tools-and-processes',
				},
				ImprovementPlan: {
					DisplayText:
						'Use reporting tools, playbooks, and retrospective sessions to improve processes and team norms. Establish team norms and practices, such as lexicons, story pointing, and defining done, to streamline intra-team communication. Refer to OA.TI.2: Streamline intra-team communication using tools and processes in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.2-streamline-intra-team-communication-using-tools-and-processes',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Team Collaboration with Amazon CodeCatalyst',
								Url:
									'https://aws.amazon.com/blogs/devops/team-collaboration-with-amazon-codecatalyst',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_3',
				Title:
					'OA.TI.3: Establish mechanisms for teams to gather and manage customer feedback',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Integrate the feedback with collaboration tools and existing workflows so that inputs, decisions, and outcomes are documented and prioritized with the rest of the value stream work. Related processes should be created for teams to track, prioritize, and act on the feedback received for their respective value stream. Establish feedback channels that help teams gather and manage input from both internal and external customers of their products. Feedback data should continually be analyzed to identify trends, prioritize areas for improvement, and communicate progress to stakeholders. Embed the feedback into your team norms.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.3-establish-mechanisms-for-teams-to-gather-and-manage-customer-feedback',
				},
				ImprovementPlan: {
					DisplayText:
						'Integrate the feedback with collaboration tools and existing workflows so that inputs, decisions, and outcomes are documented and prioritized with the rest of the value stream work. Related processes should be created for teams to track, prioritize, and act on the feedback received for their respective value stream. Refer to OA.TI.3: Establish mechanisms for teams to gather and manage customer feedback in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.3-establish-mechanisms-for-teams-to-gather-and-manage-customer-feedback',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_4',
				Title: 'OA.TI.4: Refine error tracking and resolution',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement tools and processes to facilitate effective error tracking and resolution, such as issue tracking systems, monitoring, and alerting solutions. Encourage collaboration and knowledge sharing among teams to improve overall error management and resolution capabilities. Establish mechanisms for continuous improvement in error correction, tracking, and resolution. Regularly review and analyze error data to identify trends, prioritize issues, and take corrective action. This includes developing a culture of learning from mistakes, sharing knowledge, and using data-driven insights to drive improvements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.4-refine-error-tracking-and-resolution',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement tools and processes to facilitate effective error tracking and resolution, such as issue tracking systems, monitoring, and alerting solutions. Encourage collaboration and knowledge sharing among teams to improve overall error management and resolution capabilities. Refer to OA.TI.4: Refine error tracking and resolution in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.4-refine-error-tracking-and-resolution',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Correction of Error (COE)',
								Url: 'https://wa.aws.amazon.com/wat.concept.coe.en.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_5',
				Title:
					'OA.TI.5: Design adaptive approval workflows without compromising safety',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use data and APIs from version control systems, deployment pipelines, and release management tools to support automated approval processes. These tools can help streamline the approval process, reducing the risk of errors and delays while promoting agility and speed. These processes should account for factors such as risk assessment, impact analysis, and stakeholder engagement, while also allowing for feedback and improvement. Use automation and tools to support these processes, rather than requiring complex, human-driven collaboration between teams. Establish key performance indicators (KPIs) and metrics to measure the time it takes to submit, review, approve, and deploy changes. Establish approval processes and guidelines that prioritize speed, safety, and agility.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.5-design-adaptive-approval-workflows-without-compromising-safety',
				},
				ImprovementPlan: {
					DisplayText:
						'Use data and APIs from version control systems, deployment pipelines, and release management tools to support automated approval processes. These tools can help streamline the approval process, reducing the risk of errors and delays while promoting agility and speed. Refer to OA.TI.5: Design adaptive approval workflows without compromising safety in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.5-design-adaptive-approval-workflows-without-compromising-safety',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_6',
				Title:
					'OA.TI.6: Prioritize customer needs to deliver optimal business outcomes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"At Amazon, the development process begins with a document that outlines the product's core value to customers as a Press Release and Frequently Asked Questions (PRFAQ) document. This document often contains detailed data points such as usage forecasts, adoption expectations, the value to the customer, and how we can provide that value to customers. The documents can also be used throughout the development lifecycle to provide developers a clear understanding of the desired customer experience, leading to fewer errors and quicker deployment cycles. Customer-driven development is an approach that places the end user's needs and expectations at the heart of product development. Before starting development, create visual mock-ups and provide use cases to offer a tangible representation for the team so they understand how users interact with the product. To implement this mechanism within your organization, begin the development process by writing a document that envisions the desired customer outcome.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.6-prioritize-customer-needs-to-deliver-optimal-business-outcomes',
				},
				ImprovementPlan: {
					DisplayText:
						"At Amazon, the development process begins with a document that outlines the product's core value to customers as a Press Release and Frequently Asked Questions (PRFAQ) document. This document often contains detailed data points such as usage forecasts, adoption expectations, the value to the customer, and how we can provide that value to customers. Refer to OA.TI.6: Prioritize customer needs to deliver optimal business outcomes in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.6-prioritize-customer-needs-to-deliver-optimal-business-outcomes',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Working Backwards',
								Url:
									'https://www.allthingsdistributed.com/2006/11/working_backwards.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_7',
				Title: 'OA.TI.7: Maintain a unified knowledge source for teams',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Adopt collaboration and configuration tools, supported by established processes, to store documents, configurations, and other artifacts in a unified source of record. Therefore, it is highly recommended to have a centralized knowledge repository in place to improve team collaboration, knowledge sharing, onboarding time, and overall development and operational efficiency. Implement processes for regular review of artifacts in the source of record and remove outdated content as needed. However, it's more challenging for teams to find and manage information as they transition how they work and adopt new tools. DevOps adoption can be achieved without a unified source of record between teams. For example, create internal wiki pages for each team to document their team norms and best practices.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.7-maintain-a-unified-knowledge-source-for-teams',
				},
				ImprovementPlan: {
					DisplayText:
						'Adopt collaboration and configuration tools, supported by established processes, to store documents, configurations, and other artifacts in a unified source of record. Therefore, it is highly recommended to have a centralized knowledge repository in place to improve team collaboration, knowledge sharing, onboarding time, and overall development and operational efficiency. Refer to OA.TI.7: Maintain a unified knowledge source for teams in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.7-maintain-a-unified-knowledge-source-for-teams',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_8',
				Title: 'OA.TI.8: Simplify access to organizational information',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Provide internal users access to vital organizational information, such as details about the organization, objectives, analytics, employee data, policies, hierarchical structures, and escalation channels. To improve the platform's information integrity and relevance, connect it with internal systems such as Enterprise Resource Planning (ERP) software, and maintain regular updates at the source. Include instruction and training on using this platform as part of the onboarding process to equip employees with the necessary skills for information access. One approach is to manage a centralized platform, like an intranet, where employees can swiftly locate the information they need for effective job performance. This helps users swiftly access and interpret proprietary, complex documentation regarding compliance, regulations, or portfolio research using text summarization. Search is another method for faster information retrieval and classification, expediting access to relevant documents during review processes.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.8-simplify-access-to-organizational-information',
				},
				ImprovementPlan: {
					DisplayText:
						"Provide internal users access to vital organizational information, such as details about the organization, objectives, analytics, employee data, policies, hierarchical structures, and escalation channels. To improve the platform's information integrity and relevance, connect it with internal systems such as Enterprise Resource Planning (ERP) software, and maintain regular updates at the source. Refer to OA.TI.8: Simplify access to organizational information in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.8-simplify-access-to-organizational-information',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									"Business Value is IT's Primary Measure of Progress",
								Url:
									'https://aws.amazon.com/blogs/enterprise-strategy/business-value-is-its-primary-measure-of-progress',
							},
							{
								DisplayText: 'Amazon Bedrock',
								Url: 'https://aws.amazon.com/bedrock',
							},
							{
								DisplayText: 'Amazon Kendra',
								Url: 'https://aws.amazon.com/kendra',
							},
							{
								DisplayText: 'Amazon OpenSearch Service',
								Url: 'https://aws.amazon.com/opensearch-service',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_9',
				Title:
					'OA.TI.9: Facilitate self-service collaboration through APIs and documentation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Providing self-service access to services through APIs simplifies integration between systems and teams, reduces the need for manual intervention, and promotes better documentation. Establish ownership for documentation and services, and implement mechanisms for teams to ask for clarification, help, or provide feedback. Without this capability, expect increased manual coordination and required communication between teams, which could impact overall efficiency. Develop clear and comprehensive service documentation for improved accessibility and navigation, including user guides, tutorials, and FAQs. Define metrics around the usage, availability, and quality of self-service documentation and APIs. Provide well-defined interfaces, such as APIs or web portals, to simplify access and usage.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.9-facilitate-self-service-collaboration-through-apis-and-documentation',
				},
				ImprovementPlan: {
					DisplayText:
						'Providing self-service access to services through APIs simplifies integration between systems and teams, reduces the need for manual intervention, and promotes better documentation. Establish ownership for documentation and services, and implement mechanisms for teams to ask for clarification, help, or provide feedback. Refer to OA.TI.9: Facilitate self-service collaboration through APIs and documentation in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.9-facilitate-self-service-collaboration-through-apis-and-documentation',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_10',
				Title:
					'OA.TI.10: Choose interaction modes for improved efficiency and cost savings',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Teach teams about the different interaction modes as outlined in Team Topologies, including X as a Service (XaaS), facilitation, and collaboration. XaaS is typically the most cost-effective and efficient interaction mode between teams when available, as it involves providing and consuming self-service capabilities rather than sustained direct communications. With knowledge of how to optimize interaction modes for specific scenarios, teams can measure the cost, efficiency, and applicability of each mode against their use case. This interaction mode can be highly effective in certain situations; however, it can also be more time-consuming and less cost-efficient than other interaction modes. Provide training and support to help teams better understand the available interaction modes and how to use them effectively to achieve the desired outcome. Identify excessive and costly interaction modes and create a tailored improvement plan to optimize them depending on each team's preferences, topology, and skills.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.10-choose-interaction-modes-for-optimal-efficiency-and-cost-savings',
				},
				ImprovementPlan: {
					DisplayText:
						'Teach teams about the different interaction modes as outlined in Team Topologies, including X as a Service (XaaS), facilitation, and collaboration. XaaS is typically the most cost-effective and efficient interaction mode between teams when available, as it involves providing and consuming self-service capabilities rather than sustained direct communications. Refer to OA.TI.10: Choose interaction modes for improved efficiency and cost savings in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.10-choose-interaction-modes-for-optimal-efficiency-and-cost-savings',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_11',
				Title:
					'OA.TI.11: Offer optional opportunities for cross-team collaboration',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Encourage a culture of open communication and collaboration across teams, sharing knowledge, best practices, and lessons learned. Monitor the effectiveness of these cross-team communication and collaboration opportunities and adjust the approach as needed based on feedback and observed outcomes. Establish regular communication channels and forums to encourage cross-team collaboration and information sharing. This can include joint planning sessions, team demos, or cross-team retrospectives.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.11-offer-optional-opportunities-for-cross-team-collaboration',
				},
				ImprovementPlan: {
					DisplayText:
						'Encourage a culture of open communication and collaboration across teams, sharing knowledge, best practices, and lessons learned. Monitor the effectiveness of these cross-team communication and collaboration opportunities and adjust the approach as needed based on feedback and observed outcomes. Refer to OA.TI.11: Offer optional opportunities for cross-team collaboration in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ti.11-offer-optional-opportunities-for-cross-team-collaboration',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_TI_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/OA_TI',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Organizational_Adoption',
		QuestionId: 'OA_TI',
		QuestionTitle: 'How do you implement and manage team interfaces?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Organizational_Adoption',
			QuestionDescription:
				'Team interfaces are the input and output mechanisms that direct the flow of work between teams in a DevOps environment.',
			QuestionId: 'OA_TI',
			QuestionTitle: 'How do you implement and manage team interfaces?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OA_BCL_1',
				Title:
					'OA.BCL.1: Clarify purpose and direction to improve cognitive well-being',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Regularly communicate a clear strategy, and communicate the organization's business objectives it to all team members. Provide frequent updates on organizational progress towards achieving business goals to keep the team informed and involved. Align individual goals and targets with the business objectives so that every member understands their unique role and contribution. Implement a structured feedback mechanism and recognize the efforts of team members in contributing to the organization's success. Verify that every individual feels aligned with the organizational goals and sees the impact of their contributions. A motivated workforce that is driven by a sense of purpose can lead to enhanced cognitive well-being, reduced burnout, and improved retention rates.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.1-clarify-purpose-and-direction-to-improve-cognitive-well-being',
				},
				ImprovementPlan: {
					DisplayText:
						"Regularly communicate a clear strategy, and communicate the organization's business objectives it to all team members. Provide frequent updates on organizational progress towards achieving business goals to keep the team informed and involved. Refer to OA.BCL.1: Clarify purpose and direction to improve cognitive well-being in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.1-clarify-purpose-and-direction-to-improve-cognitive-well-being',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_2',
				Title: 'OA.BCL.2: Automate repetitive tasks to reduce toil',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Encourage team members to identify opportunities for automation, and provide the necessary training and resources to support automation efforts. Assess the potential for automation, setting a high standard for automation with limited allowance for manual work. Implement automation tools and processes to reduce toil and improve overall team efficiency. Identify repetitive, time-consuming tasks, referred to as toil. Continually review and reduce this allowance as more tasks are automated.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.2-automate-repetitive-tasks-to-reduce-toil',
				},
				ImprovementPlan: {
					DisplayText:
						'Encourage team members to identify opportunities for automation, and provide the necessary training and resources to support automation efforts. Assess the potential for automation, setting a high standard for automation with limited allowance for manual work. Refer to OA.BCL.2: Automate repetitive tasks to reduce toil in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.2-automate-repetitive-tasks-to-reduce-toil',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST11-BP01 Perform automations for operations',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_evaluate_cost_effort_automations_operations.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_3',
				Title:
					'OA.BCL.3: Reduce troubleshooting and technical debt through continuous improvement',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Allocating budget and a portion of the team's time to improve existing processes, environments, and workloads can yield a net improvement to overall development speed, code quality, and system stability. This can be achieved by implementing tools, processes, and team norms to identify, track, and manage technical debt, as well as regularly assessing and prioritizing process improvement opportunities. Prioritizing addressing technical debt as part of regular work can also reduce the likelihood of production issues, ultimately resulting in more stable and reliable systems. Proactively reducing the frequency of interruptions and addressing technical debt can have a significant positive impact on overall DevOps adoption. To focus teams on impactful improvements, encourage teams to factor in time and effort towards these initiatives. Establish metrics to measure their impact.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.3-reduce-troubleshooting-and-technical-debt-through-continuous-improvement',
				},
				ImprovementPlan: {
					DisplayText:
						"Allocating budget and a portion of the team's time to improve existing processes, environments, and workloads can yield a net improvement to overall development speed, code quality, and system stability. This can be achieved by implementing tools, processes, and team norms to identify, track, and manage technical debt, as well as regularly assessing and prioritizing process improvement opportunities. Refer to OA.BCL.3: Reduce troubleshooting and technical debt through continuous improvement in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.3-reduce-troubleshooting-and-technical-debt-through-continuous-improvement',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_4',
				Title: 'OA.BCL.4: Boost team efficiency by limiting work in progress',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Encourage teams to use agile project management tools and rules, such as Kanban or Scrum, to manage work in progress and complete tasks in a timely manner. Prioritize finishing tasks over starting new ones, which helps to reduce context-switching and impacts overall team efficiency. Continually monitor and adjust WIP limits to prioritize tasks that align with business outcomes. Provide ample capacity to accomplish goals on time by reducing work in progress (WIP).',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.4-boost-team-efficiency-by-limiting-work-in-progress',
				},
				ImprovementPlan: {
					DisplayText:
						'Encourage teams to use agile project management tools and rules, such as Kanban or Scrum, to manage work in progress and complete tasks in a timely manner. Prioritize finishing tasks over starting new ones, which helps to reduce context-switching and impacts overall team efficiency. Refer to OA.BCL.4: Boost team efficiency by limiting work in progress in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.4-boost-team-efficiency-by-limiting-work-in-progress',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_5',
				Title:
					'OA.BCL.5: Establish clear escalation paths and encourage constructive disagreement',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Introduce the concept of the Andon cord, inspired by Toyota's manufacturing process and adopted by companies like Amazon, as an actionable step to help team members raise concerns and stop processes when problems arise. Encourage open communication and a culture of constructive disagreement, where team members can respectfully challenge decisions while still committing to a strategy as a team once a decision has been made. The Andon cord serves as a mechanism for team members to escalate issues quickly, addressing problems promptly and effectively. Optimize issue resolution by establishing clear escalation paths and making it part of every team's norms. Once a decision is made through the escalation process, everyone should commit to the decision that is made. Define and communicate processes for how and when to escalate issues, and identify the individuals or groups responsible for making decisions.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.5-establish-clear-escalation-paths-and-encourage-constructive-disagreement',
				},
				ImprovementPlan: {
					DisplayText:
						"Introduce the concept of the Andon cord, inspired by Toyota's manufacturing process and adopted by companies like Amazon, as an actionable step to help team members raise concerns and stop processes when problems arise. Encourage open communication and a culture of constructive disagreement, where team members can respectfully challenge decisions while still committing to a strategy as a team once a decision has been made. Refer to OA.BCL.5: Establish clear escalation paths and encourage constructive disagreement in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.5-establish-clear-escalation-paths-and-encourage-constructive-disagreement',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_6',
				Title:
					'OA.BCL.6: Provide teams the autonomy to make decision that align with organizational objectives',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Provide the necessary information, policies, and tools to make informed decisions aligned with the organization's goals and objectives. Establish clear guardrails to guide decisions and achieve consistency with the overall strategy while avoiding adverse impacts on other teams or the organization. Provide teams with the autonomy to make decisions and changes at the lowest level possible. Encourage a culture of empowerment, where team members feel confident in making decisions and taking action.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.6-provide-teams-the-autonomy-to-make-decision-that-align-with-organizational-objectives',
				},
				ImprovementPlan: {
					DisplayText:
						"Provide the necessary information, policies, and tools to make informed decisions aligned with the organization's goals and objectives. Establish clear guardrails to guide decisions and achieve consistency with the overall strategy while avoiding adverse impacts on other teams or the organization. Refer to OA.BCL.6: Provide teams the autonomy to make decision that align with organizational objectives in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.6-provide-teams-the-autonomy-to-make-decision-that-align-with-organizational-objectives',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_7',
				Title:
					'OA.BCL.7: Cultivate a psychologically-safe culture for experimentation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Foster a psychologically-safe environment where team members feel encouraged to share their ideas and speak up without fear of negative consequences. Encourage experimentation and learning from failures by establishing clear guidelines and hosting sharing sessions for both successful and failed experiments. Recognize and celebrate successes, while also recognizing individuals who take risks and contribute to innovation. Provide support for team members who are willing to experiment and think big. Cultivate a culture that values open communication, feedback, and continuous learning.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.7-cultivate-a-psychologically-safe-culture-for-experimentation',
				},
				ImprovementPlan: {
					DisplayText:
						'Foster a psychologically-safe environment where team members feel encouraged to share their ideas and speak up without fear of negative consequences. Encourage experimentation and learning from failures by establishing clear guidelines and hosting sharing sessions for both successful and failed experiments. Refer to OA.BCL.7: Cultivate a psychologically-safe culture for experimentation in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.7-cultivate-a-psychologically-safe-culture-for-experimentation',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_8',
				Title: 'OA.BCL.8: Determine team sizes based on cognitive capacity',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Having a team of teams allows smaller teams to work together towards common goals that align to related business outcomes, while maintaining the benefits of smaller team sizes and scaling effectively within a larger organization. Determine team size using Dunbar's number and the 7 2 rule, which state that teams should be composed of no more than 7 to 10 individuals. Larger organizations might have teams of teams, often referred to as guilds, chapters, or squads. With smaller teams, they require the autonomy and resources necessary to be successful within their value stream. Provide teams with the necessary tools and resources to support collaboration and communication in small group settings. Regularly assess the team's composition and structure, making adjustments as needed to maintain efficiency and effectiveness.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.8-determine-team-sizes-based-on-cognitive-capacity',
				},
				ImprovementPlan: {
					DisplayText:
						"Having a team of teams allows smaller teams to work together towards common goals that align to related business outcomes, while maintaining the benefits of smaller team sizes and scaling effectively within a larger organization. Determine team size using Dunbar's number and the 7 2 rule, which state that teams should be composed of no more than 7 to 10 individuals. Refer to OA.BCL.8: Determine team sizes based on cognitive capacity in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.8-determine-team-sizes-based-on-cognitive-capacity',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Two-Pizza Teams',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/introduction-devops-aws/two-pizza-teams.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_9',
				Title:
					'OA.BCL.9: Use guiding principles to make consistent team decisions',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Encourage team members to use these guiding principles as a framework for making decisions and resolving conflicts, ensuring consistency and alignment across the team. These guiding principles should be created collaboratively and should outline the team's purpose, goals, values, and operating principles. Periodically review and update the guiding principles to ensure they remain relevant and aligned with the team's evolving goals and values. Establish team guiding principles. Verify that the charter is well understood by all team members and regularly referenced in decision-making processes.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.9-use-guiding-principles-to-make-consistent-team-decisions',
				},
				ImprovementPlan: {
					DisplayText:
						"Encourage team members to use these guiding principles as a framework for making decisions and resolving conflicts, ensuring consistency and alignment across the team. These guiding principles should be created collaboratively and should outline the team's purpose, goals, values, and operating principles. Refer to OA.BCL.9: Use guiding principles to make consistent team decisions in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.9-use-guiding-principles-to-make-consistent-team-decisions',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Tenets: supercharging decision-making',
								Url:
									'https://aws.amazon.com/blogs/enterprise-strategy/tenets-supercharging-decision-making',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_10',
				Title: 'OA.BCL.10: Make informed decisions using data',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Use the build-measure-learn loop and validated learning to make data-driven decisions, test assumptions, and adapt quickly to changing conditions to foster a culture of continuous learning and improvement. Use tools to collect, store, analyze, and visualize data effectively, allowing teams to make data-driven decisions. Encourage teams to shift from relying solely on intuition or personal experience to using data to inform their decisions so that they become more objective than subjective. Incorporate the build-measure-learn feedback loop and validated learning concepts from Eric Ries' The Lean Startup to enhance decision-making capabilities and alignment with organizational goals. Provide training on data analysis and visualization, and aim to make data easily accessible and up-to-date. Teams should consider what to measure (and why), how to measure it, and how to effectively present the data for informed decision making.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.10-make-informed-decisions-using-data',
				},
				ImprovementPlan: {
					DisplayText:
						'Use the build-measure-learn loop and validated learning to make data-driven decisions, test assumptions, and adapt quickly to changing conditions to foster a culture of continuous learning and improvement. Use tools to collect, store, analyze, and visualize data effectively, allowing teams to make data-driven decisions. Refer to OA.BCL.10: Make informed decisions using data in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.bcl.10-make-informed-decisions-using-data',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_BCL_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/OA_BCL',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Organizational_Adoption',
		QuestionId: 'OA_BCL',
		QuestionTitle: 'How do you implement and manage balanced cognitive load?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Organizational_Adoption',
			QuestionDescription:
				'Maintaining a balanced cognitive load helps challenge team members without overwhelming or under-stimulating them.',
			QuestionId: 'OA_BCL',
			QuestionTitle: 'How do you implement and manage balanced cognitive load?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OA_AWE_1',
				Title:
					'OA.AWE.1: Equip teams with feature-rich tools for virtual collaboration',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Provide well-integrated collaboration tools that support virtual collaboration through chats, voice, video, break-outs, and interactive boards for virtual meetings. Gather feedback from teams on the suitability of the collaboration tools and any new features that could enhance their virtual collaboration experience. In a DevOps environment, collaboration tools are required to facilitate effective communication and collaboration among distributed teams. These tools allow teams to rapidly make decisions and solve problems together. Invest in training for teams on how to use these tools effectively and securely. These tools should be available on different devices, including desktops, tablets, and mobile.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.1-equip-teams-with-feature-rich-tools-for-virtual-collaboration',
				},
				ImprovementPlan: {
					DisplayText:
						'Provide well-integrated collaboration tools that support virtual collaboration through chats, voice, video, break-outs, and interactive boards for virtual meetings. Gather feedback from teams on the suitability of the collaboration tools and any new features that could enhance their virtual collaboration experience. Refer to OA.AWE.1: Equip teams with feature-rich tools for virtual collaboration in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.1-equip-teams-with-feature-rich-tools-for-virtual-collaboration',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_AWE_2',
				Title:
					'OA.AWE.2: Offer inclusive options for both virtual and on-site collaboration',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Gather feedback from employees with special must identify areas for improvement and make necessary adjustments to create a more inclusive and accessible work environment. To improve the organization's capability to accommodate employees with special needs, conduct assessments of existing facilities and identify areas that require improvement. Promote an inclusive culture throughout the organization by providing training for employees on topics such as diversity, inclusion, and accessibility. Create a more inclusive and high-performing work environment by accommodating employees with diverse needs. Collaboration tools should include accessibility features such as closed captioning, screen readers, and speech-to-text capabilities.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.2-offer-inclusive-options-for-both-virtual-and-onsite-collaboration',
				},
				ImprovementPlan: {
					DisplayText:
						"Gather feedback from employees with special must identify areas for improvement and make necessary adjustments to create a more inclusive and accessible work environment. To improve the organization's capability to accommodate employees with special needs, conduct assessments of existing facilities and identify areas that require improvement. Refer to OA.AWE.2: Offer inclusive options for both virtual and on-site collaboration in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.2-offer-inclusive-options-for-both-virtual-and-onsite-collaboration',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_AWE_3',
				Title: 'OA.AWE.3: Balance work schedules for diverse global teams',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Flexible work policies for appropriate roles are recommended because they help organizations attract and retain skilled employees, while also promoting a healthy work-life balance, improving employee satisfaction, and facilitating global collaboration. Establish policies and guidelines that facilitate remote work and flexible schedules, while fostering communication and collaboration among team members across different time zones and locations. Seek feedback from employees to refine and improve the organization's remote work and flexible schedule policies to better meet the needs and preferences of its workforce. Provide employees with the necessary technology and tools to effectively work remotely, while protecting company information through appropriate security measures. Use techniques such as follow-the-sun support models and handovers to promote seamless collaboration across different time zones. Schedule meetings that are convenient for all team members or record and share information if such scheduling is not feasible.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.3-balance-work-schedules-for-diverse-global-teams',
				},
				ImprovementPlan: {
					DisplayText:
						'Flexible work policies for appropriate roles are recommended because they help organizations attract and retain skilled employees, while also promoting a healthy work-life balance, improving employee satisfaction, and facilitating global collaboration. Establish policies and guidelines that facilitate remote work and flexible schedules, while fostering communication and collaboration among team members across different time zones and locations. Refer to OA.AWE.3: Balance work schedules for diverse global teams in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.3-balance-work-schedules-for-diverse-global-teams',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_AWE_4',
				Title:
					'OA.AWE.4: Provide adaptable workspaces for effective on-site collaboration',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'When teams work in the office or use a hybrid approach that requires meeting in person, they require tools and equipment to support their unique ways of working. Having a flexible and reconfigurable workspace environment promotes DevOps adoption by allowing for customizable collaboration and communication methods that fit individual and team needs. Gather feedback from teams to assess the effectiveness of the workspace environments, and make necessary improvements to be sure that they meet the needs of the teams. Arrange the seating of teams and team members working on the same products or closely collaborating teams to be in close proximity to each other. If your team is fully remote and does not ever meet in person in a designated office, this capability might not apply to your organization. Provide on-site collaboration tools, such as meeting rooms, physical and virtual whiteboards, projectors, and conferencing equipment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.4-provide-adaptable-workspaces-for-effective-onsite-collaboration',
				},
				ImprovementPlan: {
					DisplayText:
						'When teams work in the office or use a hybrid approach that requires meeting in person, they require tools and equipment to support their unique ways of working. Having a flexible and reconfigurable workspace environment promotes DevOps adoption by allowing for customizable collaboration and communication methods that fit individual and team needs. Refer to OA.AWE.4: Provide adaptable workspaces for effective on-site collaboration in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.4-provide-adaptable-workspaces-for-effective-onsite-collaboration',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_AWE_5',
				Title:
					'OA.AWE.5: Organize team-building activities and social events to foster a sense of community and promote collaboration',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Organize regular team-building activities and social events to help team members build relationships, foster a sense of community, and promote collaboration. These events are more impactful for distributed teams that span multiple time zones, and cities, or work fully remote. These events can be both in-person and virtual to accommodate remote team members. Encourage employees to participate and provide feedback on these activities to collect data on how impactful or enjoyable they are.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.5-organize-team-building-activities-and-social-events-to-foster-a-sense-of-community-and-promote-collaboration',
				},
				ImprovementPlan: {
					DisplayText:
						'Organize regular team-building activities and social events to help team members build relationships, foster a sense of community, and promote collaboration. These events are more impactful for distributed teams that span multiple time zones, and cities, or work fully remote. Refer to OA.AWE.5: Organize team-building activities and social events to foster a sense of community and promote collaboration in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.awe.5-organize-team-building-activities-and-social-events-to-foster-a-sense-of-community-and-promote-collaboration',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_AWE_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/OA_AWE',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Organizational_Adoption',
		QuestionId: 'OA_AWE',
		QuestionTitle: 'How do you implement and manage adaptive work environment?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Organizational_Adoption',
			QuestionDescription:
				'An adaptive work environment allows organizations to maximize team performance and collaboration, whether teams are working onsite, remotely, or a mix of both.',
			QuestionId: 'OA_AWE',
			QuestionTitle:
				'How do you implement and manage adaptive work environment?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OA_PPD_1',
				Title:
					'OA.PPD.1: Encourage collaboration, innovation, learning, and continuous growth to foster a generative culture',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"For example, if individual contributors are asked to learn about DevOps, cloud technologies, or similar topics, leaders should also strive to become certified and knowledgeable about those topics as well, at least at a high level. For example, if individual contributors are asked to learn about DevOps, cloud technologies, or similar topics, leaders should also strive to become knowledgeable about those topics as well. A generative culture, as defined by Dr. Ron Westrum's research, provides teams with the autonomy and opportunities to experiment and learn from failures, creating a space for development and performance growth. Leaders should promote a culture of openness and inclusivity and provide teams the autonomy and opportunities to experiment and learn from failures. Leaders should model these behaviors and create an environment that promotes collaboration, innovation, learning, and continuous growth. This culture is more amenable to successful DevOps adoption than pathological and bureaucratic cultures, which are characterized by a focus on individual power and authority and strict adherence to rules and procedures, respectively.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.1-encourage-collaboration-innovation-learning-and-continuous-growth-to-foster-a-generative-culture',
				},
				ImprovementPlan: {
					DisplayText:
						'For example, if individual contributors are asked to learn about DevOps, cloud technologies, or similar topics, leaders should also strive to become certified and knowledgeable about those topics as well, at least at a high level. For example, if individual contributors are asked to learn about DevOps, cloud technologies, or similar topics, leaders should also strive to become knowledgeable about those topics as well. Refer to OA.PPD.1: Encourage collaboration, innovation, learning, and continuous growth to foster a generative culture in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.1-encourage-collaboration-innovation-learning-and-continuous-growth-to-foster-a-generative-culture',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_PPD_2',
				Title: 'OA.PPD.2: Allocate time and budget for targeted training',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'This could include leadership training, new employee training, or continuous training for already experienced individual contributors. Identify relevant skills and knowledge gaps, develop a comprehensive training plan, and dedicate resources and time to complete the training. Allocate dedicated time and budget for internal and external training, specifically targeting areas that are necessary for achieving business objectives and driving transformation. Implement feedback and evaluation mechanisms to measure training outcomes and identify areas for improvement. Exemplary organizations tend to provide financial support or reimbursements for costs associated with taking certifications or course registration fees.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.2-allocate-time-and-budget-for-targeted-training',
				},
				ImprovementPlan: {
					DisplayText:
						'This could include leadership training, new employee training, or continuous training for already experienced individual contributors. Identify relevant skills and knowledge gaps, develop a comprehensive training plan, and dedicate resources and time to complete the training. Refer to OA.PPD.2: Allocate time and budget for targeted training in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.2-allocate-time-and-budget-for-targeted-training',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST01-BP03 Establish cloud budgets and forecasts',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_budget_forecast.html',
							},
							{
								DisplayText: 'AWS Certification Paths',
								Url:
									'https://d1.awsstatic.com/training-and-certification/docs/AWS_certification_paths.pdf',
							},
							{
								DisplayText: 'AWS Learning Needs Analysis',
								Url:
									'https://aws.amazon.com/training/teams/learning-needs-analysis',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_PPD_3',
				Title: 'OA.PPD.3: Offer diverse and accessible training options',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Leaders should identify the diverse training needs of teams and individual team members, and develop accessible training options that are available in multiple languages and formats. Offer accessible training options with materials and courses made available in multiple languages and formats, including in-person, remote, and self-paced options. Some organizations choose to implement a learning management system (LMS) to track employee progress and provide access to training materials, while others choose to use content developed by third parties. Provide accessible and inclusive content for employees with visual or communication impairments, incorporating features like closed captioning and screen reader compatibility. Gather feedback from employees to improve the training modules and delivery formats. Keep training content relevant and up-to-date.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.3-offer-diverse-and-accessible-training-options',
				},
				ImprovementPlan: {
					DisplayText:
						'Leaders should identify the diverse training needs of teams and individual team members, and develop accessible training options that are available in multiple languages and formats. Offer accessible training options with materials and courses made available in multiple languages and formats, including in-person, remote, and self-paced options. Refer to OA.PPD.3: Offer diverse and accessible training options in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.3-offer-diverse-and-accessible-training-options',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Certification',
								Url: 'https://aws.amazon.com/certification',
							},
							{
								DisplayText: 'AWS Educate',
								Url: 'https://aws.amazon.com/education/awseducate',
							},
							{
								DisplayText: 'AWS Skills Centers',
								Url: 'https://aws.amazon.com/training/skills-centers',
							},
							{
								DisplayText: 'AWS re/Start',
								Url: 'https://aws.amazon.com/training/restart',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_PPD_4',
				Title:
					'OA.PPD.4: Invest in attracting, developing, and retaining skilled employees',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Invest in attracting, developing, and retaining skilled employees by providing clear role definitions, mentorship programs, career advancement opportunities, and actionable feedback. Regularly collect feedback from employees to gauge their needs, directing training and development initiatives accordingly. Gather feedback regularly from employees to understand their needs and inform training and development initiatives. This proactive approach crafts an environment where employees can flourish and significantly contribute to the organization's triumph. Build transparent reward and recognition programs, and communicate promotion criteria unambiguously to every employee.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.4-invest-in-attracting-developing-and-retaining-skilled-employees',
				},
				ImprovementPlan: {
					DisplayText:
						'Invest in attracting, developing, and retaining skilled employees by providing clear role definitions, mentorship programs, career advancement opportunities, and actionable feedback. Regularly collect feedback from employees to gauge their needs, directing training and development initiatives accordingly. Refer to OA.PPD.4: Invest in attracting, developing, and retaining skilled employees in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.4-invest-in-attracting-developing-and-retaining-skilled-employees',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_PPD_5',
				Title: 'OA.PPD.5: Recognize and reward continuous learning',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Celebrate and broadly acknowledge individual and team accomplishments related to learning and skill development to reinforce the organization's commitment to fostering a culture of continuous learning. Organizations can also host regular internal training sessions, workshops, or mentorship programs to facilitate individuals learning from one-another and help accelerate learning through collaboration. Establish measurable learning targets, including stretch goals, and design meaningful reward systems to encourage team members to meet their set targets. Consider financial incentives or reimbursements for successfully obtaining a certification to further motive team members to invest in their continued learning. Exemplary organizations tend to introduce immersive experiential learning platforms that develop skills through simulation, hands-on problem solving, and gamification. Regularly provide feedback and progress assessments, which keeps employees aligned with their learning goals.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.5-recognize-and-reward-continuous-learning',
				},
				ImprovementPlan: {
					DisplayText:
						"Celebrate and broadly acknowledge individual and team accomplishments related to learning and skill development to reinforce the organization's commitment to fostering a culture of continuous learning. Organizations can also host regular internal training sessions, workshops, or mentorship programs to facilitate individuals learning from one-another and help accelerate learning through collaboration. Refer to OA.PPD.5: Recognize and reward continuous learning in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.5-recognize-and-reward-continuous-learning',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Certification Paths',
								Url:
									'https://d1.awsstatic.com/training-and-certification/docs/AWS_certification_paths.pdf',
							},
							{
								DisplayText: 'AWS Ramp-Up Guide: DevOps Engineer',
								Url:
									'https://d1.awsstatic.com/training-and-certification/ramp-up_guides/Ramp-Up_Guide_DevOps.pdf',
							},
							{
								DisplayText: 'AWS Jams',
								Url: 'https://aws.amazon.com/professional-services/jam',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_PPD_6',
				Title:
					'OA.PPD.6: Promote knowledge sharing through inter-team interest groups',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Facilitate and support knowledge-sharing opportunities and interest groups, often called skills guilds, that allow individuals to interact with other like-minded people within the organization on topics of interest. Hosting lunch and learns or tech talks, where passionate individuals or teams discuss specific topics or showcase their projects, can be a great start to facilitating inter-team collaboration. Allocate time and resources to support these opportunities and groups tailored based on your organization's unique needs and circumstances. These opportunities allow for individuals to share their experiences, discuss industry trends, and collaborate on projects with others outside of their immediate team. Groups may choose to further expand into sub-groups to focus on individual capabilities, such as continuous deployment, everything-as-code, monitoring, or security testing, as they see fit. These groups can partake in activities such as internal blogging, hosting internal conferences, attending external events, or group discussions.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.6-promote-knowledge-sharing-through-inter-team-interest-groups',
				},
				ImprovementPlan: {
					DisplayText:
						'Facilitate and support knowledge-sharing opportunities and interest groups, often called skills guilds, that allow individuals to interact with other like-minded people within the organization on topics of interest. Hosting lunch and learns or tech talks, where passionate individuals or teams discuss specific topics or showcase their projects, can be a great start to facilitating inter-team collaboration. Refer to OA.PPD.6: Promote knowledge sharing through inter-team interest groups in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/oa.ppd.6-promote-knowledge-sharing-through-inter-team-interest-groups',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OA_PPD_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/OA_PPD',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Organizational_Adoption',
		QuestionId: 'OA_PPD',
		QuestionTitle:
			'How do you implement and manage personal and professional development?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Organizational_Adoption',
			QuestionDescription:
				'Organizations that provide personal and professional growth opportunities are able to improve overall employee satisfaction and enable individuals to be more amenable to adopting new ways of working.',
			QuestionId: 'OA_PPD',
			QuestionTitle:
				'How do you implement and manage personal and professional development?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'QA_TEM_1',
				Title: 'QA.TEM.1: Establish dedicated testing environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Minimize direct human intervention in these environments, similar to how you would treat production environments. Design your testing environments to mimic production qualities that you need to test, such as monitoring settings or regional variants. These environments are as production-like as possible, providing the ability to simulate real-world conditions which can validate that changes are ready for production deployment. Use testing environments to detect and correct issues earlier on in the development lifecycle. Deploy integrated changes into these environments before they are deployed to production. Infrastructure as code (IaC) should be used for managing and deploying these environments, ensuring consistent and predictable provisioning.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.1-establish-dedicated-testing-environments',
				},
				ImprovementPlan: {
					DisplayText:
						'Minimize direct human intervention in these environments, similar to how you would treat production environments. Design your testing environments to mimic production qualities that you need to test, such as monitoring settings or regional variants. Refer to QA.TEM.1: Establish dedicated testing environments in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.1-establish-dedicated-testing-environments',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS06-BP04 Use managed device farms for testing',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_dev_a5.html',
							},
							{
								DisplayText: 'Development and Test on Amazon Web Services',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/development-and-test-on-aws/testing-phase.html',
							},
							{
								DisplayText: 'Test environments in AWS Device Farm',
								Url:
									'https://docs.aws.amazon.com/devicefarm/latest/developerguide/test-environments.html',
							},
							{
								DisplayText: 'Deployment Pipeline Reference Architecture',
								Url:
									'https://pipelines.devops.aws.dev/application-pipeline/index.html#test-gamma',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_TEM_2',
				Title:
					'QA.TEM.2: Ensure consistent test case execution using test beds',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'While a single testing environment, such as a staging environment, can host multiple test beds, each test bed is tailored with the infrastructure and data suitable for specific test scenarios. Use data restoration techniques to automate populating test beds with test data specific to the test case being run. Automating test data restoration saves time and effort for teams, enabling them to focus on actual testing activities instead of manually test data management. Depending on the complexity, the test data can be generated on-demand or sourced from a centralized test data store for scalability and consistency. Being able to start each test case with the correct configuration and data setup makes testing reliable, consistent, and confirms that anomalies or failures can be attributed to code changes rather than data inconsistencies. Provide immediate feedback to the development team if there is a failure arising from test bed setup, data inconsistency, or test execution.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.2-ensure-consistent-test-case-execution-using-test-beds',
				},
				ImprovementPlan: {
					DisplayText:
						'While a single testing environment, such as a staging environment, can host multiple test beds, each test bed is tailored with the infrastructure and data suitable for specific test scenarios. Use data restoration techniques to automate populating test beds with test data specific to the test case being run. Refer to QA.TEM.2: Ensure consistent test case execution using test beds in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.2-ensure-consistent-test-case-execution-using-test-beds',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS06-BP03 Increase utilization of build environments',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_dev_a4.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_TEM_3',
				Title: 'QA.TEM.3: Store and manage test results',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Test results must be encrypted both at rest and in transit to protect against sensitive data inadvertently being stored in test results. Configure automated deployment pipelines and individual testing tools to publish test results to this platform immediately upon test completion. To view results on a regular basis, implement tools that allow for visualizations, such as dashboards, charts, or graphs, which provide a summarized view of test results. This simplifies comparison and analysis of test results across various test iterations. Ideally, this includes automatically archiving or delete test results to help ensure the system remains uncluttered and cost efficient. Store test results in a centralized system or platform using a machine-readable format, such as JSON or XML.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.3-store-and-manage-test-results',
				},
				ImprovementPlan: {
					DisplayText:
						'Test results must be encrypted both at rest and in transit to protect against sensitive data inadvertently being stored in test results. Configure automated deployment pipelines and individual testing tools to publish test results to this platform immediately upon test completion. Refer to QA.TEM.3: Store and manage test results in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.3-store-and-manage-test-results',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Viewing the results of a test action - Amazon CodeCatalyst',
								Url:
									'https://docs.aws.amazon.com/codecatalyst/latest/userguide/test-view-results.html',
							},
							{
								DisplayText: 'Working with test reporting in AWS CodeBuild',
								Url:
									'https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html',
							},
							{
								DisplayText: 'Test Reports with AWS CodeBuild',
								Url:
									'https://aws.amazon.com/blogs/devops/test-reports-with-aws-codebuild',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_TEM_4',
				Title:
					'QA.TEM.4: Implement a unified test data repository for enhanced test efficiency',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Protect sensitive data by implementing a data obfuscation plan that transforms sensitive production data into similar, but non-sensitive, test data. By centralizing, teams can reuse the same test data across different test cases, minimizing the time and effort spent preparing test data for usage. When test environments are set up and test cases are run, use delivery pipelines and automated tools to source test data directly from this centralized source. Regularly maintain the centralized test data source by updating it either periodically or when there are changes in systems data schemas, features, functions, or dependencies. Centralizing test datasets in a unified storage location, such as a data lake or source code repository, ensures they are stored, normalized, and managed effectively. It can be stored centrally for a single team who maintains multiple microservices or related products, or centrally governed for multiple teams to source test data from.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.4-implement-a-unified-test-data-repository-for-enhanced-test-efficiency',
				},
				ImprovementPlan: {
					DisplayText:
						'Protect sensitive data by implementing a data obfuscation plan that transforms sensitive production data into similar, but non-sensitive, test data. By centralizing, teams can reuse the same test data across different test cases, minimizing the time and effort spent preparing test data for usage. Refer to QA.TEM.4: Implement a unified test data repository for enhanced test efficiency in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.4-implement-a-unified-test-data-repository-for-enhanced-test-efficiency',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS04-BP06 Use shared file systems or storage to access common data',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a7.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS04-BP07 Minimize data movement across networks',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a8.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Cost Optimization Pillar: COST08-BP02 Select components to optimize data transfer cost',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_data_transfer_optimized_components.html',
							},
							{
								DisplayText: 'AWS Glue DataBrew',
								Url: 'https://aws.amazon.com/glue/features/databrew',
							},
							{
								DisplayText:
									'Identifying and handling personally identifiable information (PII)',
								Url:
									'https://docs.aws.amazon.com/databrew/latest/dg/personal-information-protection.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_TEM_5',
				Title: 'QA.TEM.5: Run tests in parallel for faster results',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Parallelized test execution is the practice of concurrently running multiple test cases or suites to accelerate test results and expedite feedback. Adopt a scaling-out strategy to test bed provisioning to establish multiple test beds tailored for specific test scenarios. By creating many test beds and distributing test cases across them asynchronously, tests can be run in parallel to allow for faster iterations and more frequent deployments. As tests are parallelized across multiple test beds, ensure data isolation to maintain test integrity. Each test bed, provisioned through infrastructure as code (IaC), should have the necessary infrastructure and data setup for its designated test cases. Use monitoring solutions to track parallelized test runs, ensuring each test bed is performing optimally and to help in debugging any anomalies.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.5-run-tests-in-parallel-for-faster-results',
				},
				ImprovementPlan: {
					DisplayText:
						'Parallelized test execution is the practice of concurrently running multiple test cases or suites to accelerate test results and expedite feedback. Adopt a scaling-out strategy to test bed provisioning to establish multiple test beds tailored for specific test scenarios. Refer to QA.TEM.5: Run tests in parallel for faster results in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.5-run-tests-in-parallel-for-faster-results',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Step Functions',
								Url: 'https://aws.amazon.com/step-functions',
							},
							{
								DisplayText: 'Run Selenium tests at scale using AWS Fargate',
								Url:
									'https://aws.amazon.com/blogs/opensource/run-selenium-tests-at-scale-using-aws-fargate',
							},
							{
								DisplayText: 'Runs in AWS Device Farm',
								Url:
									'https://docs.aws.amazon.com/devicefarm/latest/developerguide/test-runs.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_TEM_6',
				Title:
					'QA.TEM.6: Enhance developer experience through scalable quality assurance platforms',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"These teams can help stream-aligned teams onboard to quality assurance platforms and teach teams to become self-sufficient with test design and execution. As team structures and operating models change within the organization to support distributed teams with value stream ownership, the roles and responsibility of quality assurance teams also evolve. In a DevOps environment with supportive team dynamics, individual stream-aligned teams take ownership of quality assurance and security within their value stream and products. By providing a platform for consistent testing procedures and security controls, quality assurance platform teams can help support the organization's observability and automated governance goals. If long-term quality assurance support is needed within a development team, cross-train the quality assurance member so that they gain development skills and permanently embed them into the stream-aligned team. Platforms managed by these teams can feature self-service options, automated test environment management, test bed provisioning, and equipping teams with the tools to produce, manage, and use test data and infrastructure.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.6-enhance-developer-experience-through-scalable-quality-assurance-platforms',
				},
				ImprovementPlan: {
					DisplayText:
						'These teams can help stream-aligned teams onboard to quality assurance platforms and teach teams to become self-sufficient with test design and execution. As team structures and operating models change within the organization to support distributed teams with value stream ownership, the roles and responsibility of quality assurance teams also evolve. Refer to QA.TEM.6: Enhance developer experience through scalable quality assurance platforms in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.6-enhance-developer-experience-through-scalable-quality-assurance-platforms',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_TEM_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/QA_TEM',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Quality_Assurance',
		QuestionId: 'QA_TEM',
		QuestionTitle:
			'How do you implement and manage test environment management?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Quality_Assurance',
			QuestionDescription:
				'This capability focuses on dynamically provisioning test environments that are used for running test cases.',
			QuestionId: 'QA_TEM',
			QuestionTitle:
				'How do you implement and manage test environment management?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'QA_FT_1',
				Title:
					'QA.FT.1: Ensure individual component functionality with unit tests',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The goal of unit tests is to provide fast, thorough feedback while reducing the risk of introducing flaws when making changes. This approach can lead to faster feedback, more effective tests, and introducing less defects when writing code. This feedback is accomplished by writing tests cases that cover a sufficient amount of the code. Unit tests should be isolated to a single class, function, or method within the code. Teams should be able to run unit tests locally as well as through continuous integration pipelines. Unit tests evaluate the functionality of one individual part of an application, called units.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.ft.1-ensure-individual-component-functionality-with-unit-tests',
				},
				ImprovementPlan: {
					DisplayText:
						'The goal of unit tests is to provide fast, thorough feedback while reducing the risk of introducing flaws when making changes. This approach can lead to faster feedback, more effective tests, and introducing less defects when writing code. Refer to QA.FT.1: Ensure individual component functionality with unit tests in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.ft.1-ensure-individual-component-functionality-with-unit-tests',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL12-BP03 Test functional requirements',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_test_functional.html',
							},
							{
								DisplayText:
									'Building hexagonal architectures on AWS - Write and run tests from the beginning',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/best-practices.html',
							},
							{
								DisplayText: 'AWS Deployment Pipeline Reference Architecture',
								Url:
									'https://aws-samples.github.io/aws-deployment-pipeline-reference-architecture/application-pipeline/index.html',
							},
							{
								DisplayText:
									'Adopt a test-driven development approach using AWS CDK',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-cdk-typescript-iac/development-best-practices.html',
							},
							{
								DisplayText:
									'Getting started with testing serverless applications',
								Url:
									'https://aws.amazon.com/blogs/compute/getting-started-with-testing-serverless-applications',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_FT_2',
				Title:
					'QA.FT.2: Validate system interactions and data flows with integration tests',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Just as with unit tests, adopting Test-Driven Development (TDD) by writing tests before the software is developed helps to highlight potential integration pain points early, and verifies that the interfaces between components are correctly implemented from the start. Integration tests often run much slower than unit testing due to the fact that they interact with real system, such as databases, message queues, and external APIs. This allows for quicker feedback loops and makes it possible to run integration tests through continuous integration pipelines. Strive to make integration tests as efficient as possible by optimizing setup and tear down using automation and infrastructure as code (IaC). Integration tests evaluate the interactions between multiple components that make up the system, including infrastructure and external systems. While integration tests should involve real components, they should still be isolated from production or shared environments where possible.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.ft.2-validate-system-interactions-and-data-flows-with-integration-tests',
				},
				ImprovementPlan: {
					DisplayText:
						'Just as with unit tests, adopting Test-Driven Development (TDD) by writing tests before the software is developed helps to highlight potential integration pain points early, and verifies that the interfaces between components are correctly implemented from the start. Integration tests often run much slower than unit testing due to the fact that they interact with real system, such as databases, message queues, and external APIs. Refer to QA.FT.2: Validate system interactions and data flows with integration tests in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.ft.2-validate-system-interactions-and-data-flows-with-integration-tests',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL12-BP03 Test functional requirements',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_test_functional.html',
							},
							{
								DisplayText: 'AWS Deployment Pipeline Reference Architecture',
								Url:
									'https://aws-samples.github.io/aws-deployment-pipeline-reference-architecture/application-pipeline/index.html',
							},
							{
								DisplayText:
									'Getting started with testing serverless applications',
								Url:
									'https://aws.amazon.com/blogs/compute/getting-started-with-testing-serverless-applications',
							},
							{
								DisplayText:
									'Building hexagonal architectures on AWS - Write and run tests from the beginning',
								Url:
									'https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/best-practices.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_FT_3',
				Title:
					'QA.FT.3: Confirm end-user experience and functional correctness with acceptance tests',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"These tests encompass functional correctness of user interfaces, general application behavior, and ensuring that user interface elements lead to expected user experiences. Acceptance tests evaluate the observable functional behavior of the system from the perspective of the end user in a production-like environment. By considering all facets of user interactions and expectations, acceptance testing provides a comprehensive evaluation of an application's readiness for production deployment. There are various forms of functional acceptance tests which should be used throughout development lifecycle:",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.ft.3-confirm-end-user-experience-and-functional-correctness-with-acceptance-tests',
				},
				ImprovementPlan: {
					DisplayText:
						'These tests encompass functional correctness of user interfaces, general application behavior, and ensuring that user interface elements lead to expected user experiences. Acceptance tests evaluate the observable functional behavior of the system from the perspective of the end user in a production-like environment. Refer to QA.FT.3: Confirm end-user experience and functional correctness with acceptance tests in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.ft.3-confirm-end-user-experience-and-functional-correctness-with-acceptance-tests',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Device Farm',
								Url: 'https://aws.amazon.com/device-farm',
							},
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF01-BP06 Benchmark existing workloads',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_performing_architecture_benchmark.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL12-BP03 Test functional requirements',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_test_functional.html',
							},
							{
								DisplayText: 'Amazon CloudWatch Synthetics',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries.html',
							},
							{
								DisplayText: 'AWS Deployment Pipeline Reference Architecture',
								Url:
									'https://aws-samples.github.io/aws-deployment-pipeline-reference-architecture/application-pipeline/index.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_FT_4',
				Title:
					'QA.FT.4: Balance developer feedback and test coverage using advanced test selection',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Predictive test selection is an evolving approach to test selection which uses ML models trained on historical code changes and test outcomes to determine how likely a test is to reveal errors based on the change. you should first optimize test execution through parallelization, reducing stale or ineffective tests, improving the infrastructure the tests are run on, and changing the order of tests to optimize for faster feedback. Predictive test selection strikes a balance between providing faster feedback to developers and thorough test coverage. Test Impact Analysis (TIA) offers a structured approach to advanced test selection. Running all tests every time a change is made can become time-consuming and inefficient as test suites grow, slowing down the development feedback loop. Instead, every change triggers automated pipelines that conduct a new cycle of tests, making each pipeline execution effectively a regression test.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.ft.4-balance-developer-feedback-and-test-coverage-using-advanced-test-selection',
				},
				ImprovementPlan: {
					DisplayText:
						'Predictive test selection is an evolving approach to test selection which uses ML models trained on historical code changes and test outcomes to determine how likely a test is to reveal errors based on the change. you should first optimize test execution through parallelization, reducing stale or ineffective tests, improving the infrastructure the tests are run on, and changing the order of tests to optimize for faster feedback. Refer to QA.FT.4: Balance developer feedback and test coverage using advanced test selection in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.ft.4-balance-developer-feedback-and-test-coverage-using-advanced-test-selection',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Machine Learning - Amazon Web Services',
								Url: 'https://aws.amazon.com/sagemaker',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_FT_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/QA_FT',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Quality_Assurance',
		QuestionId: 'QA_FT',
		QuestionTitle: 'How do you implement and manage functional testing?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Quality_Assurance',
			QuestionDescription:
				"Functional testing validates that the system operates according to specified requirements. It is used to consistently verify that components such as user interfaces, APIs, databases, and the source code, work as intended. By examining these components of the system, functional testing ensures that each feature behaves as expected, safeguarding both user expectations and the software's integrity.",
			QuestionId: 'QA_FT',
			QuestionTitle: 'How do you implement and manage functional testing?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'QA_NT_1',
				Title: 'QA.NT.1: Evaluate code quality through static testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use static testing to run automated code reviews and detect defects early on to provide fast feedback to developers. Static testing allows teams to spot misconfigurations, security vulnerabilities, or non-compliance with organizational standards in these components before they get applied in a real environment. Keep your static analysis tools updated and regularly review their findings to adapt to changing infrastructure security and compliance best practices. Static testing should be available to developers on-demand in local environments, as well as automatically run in automated pipelines. These tools can be configured to detect issues like insecure permissions, enforcing tagging standards, or misconfigurations that could make infrastructure vulnerable. Static testing is a proactive method of assessing the quality of code without needing to run it.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.1-evaluate-code-quality-through-static-testing',
				},
				ImprovementPlan: {
					DisplayText:
						'Use static testing to run automated code reviews and detect defects early on to provide fast feedback to developers. Static testing allows teams to spot misconfigurations, security vulnerabilities, or non-compliance with organizational standards in these components before they get applied in a real environment. Refer to QA.NT.1: Evaluate code quality through static testing in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.1-evaluate-code-quality-through-static-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS CloudFormation Guard',
								Url:
									'https://docs.aws.amazon.com/cfn-guard/latest/ug/what-is-guard.html',
							},
							{
								DisplayText: 'cfn-lint',
								Url: 'https://github.com/aws-cloudformation/cfn-lint',
							},
							{
								DisplayText: 'AWS CloudFormation',
								Url: 'https://aws.amazon.com/cloudformation',
							},
							{
								DisplayText: 'What is Amazon CodeGuru Reviewer?',
								Url:
									'https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/welcome.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_NT_2',
				Title: 'QA.NT.2: Validate system reliability with performance testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Different performance tests should be run based on the nature of changes made to the system: All performance tests should be run against a test environment mirroring the production setup. Use tailored performance testing tools for your application's architecture and deployment environment. Regularly analyze test results against historical benchmarks and take proactive measures to counteract performance regressions. Performance testing evaluates the responsiveness, throughput, reliability, and scalability of a system under a specific load. It helps ensure that the application performs adequately when it is subjected to both expected and peak loads without impacting user experience.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.2-validate-system-reliability-with-performance-testing',
				},
				ImprovementPlan: {
					DisplayText:
						"Different performance tests should be run based on the nature of changes made to the system: All performance tests should be run against a test environment mirroring the production setup. Use tailored performance testing tools for your application's architecture and deployment environment. Refer to QA.NT.2: Validate system reliability with performance testing in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.2-validate-system-reliability-with-performance-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Performance Pillar: PERF01-BP07 Load test your workload',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_performing_architecture_load_test.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Sustainability Pillar: SUS03-BP03 Optimize areas of code that consume the most time or resources',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_software_a4.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL07-BP04 Load test your workload',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_adapt_to_changes_load_tested_adapt.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL12-BP04 Test scaling and performance requirements',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_test_non_functional.html',
							},
							{
								DisplayText:
									'Ensure Optimal Application Performance with Distributed Load Testing on AWS',
								Url:
									'https://aws.amazon.com/blogs/architecture/ensure-optimal-application-performance-with-distributed-load-testing-on-aws',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_NT_3',
				Title: 'QA.NT.3: Prioritize user experience with UX testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"User experience (UX) testing provides insight into the system's user interface and overall user experience, ensuring that they align with the diverse requirements of its user base. Adopting UX testing ensures that as the system evolves, its design remains intuitive, functional, and inclusive for end users. Segment your tests to understand the diverse needs and preferences of your user base. This means creating different user profiles and scenarios, ensuring that the software is tested from multiple perspectives. Recognize that UX is subjective and can vary based on demographics, tech proficiency, and individual preferences. There are various forms of non-functional UX tests which should be utilized to target specific improvements:",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.3-prioritize-user-experience-with-ux-testing',
				},
				ImprovementPlan: {
					DisplayText:
						"User experience (UX) testing provides insight into the system's user interface and overall user experience, ensuring that they align with the diverse requirements of its user base. Adopting UX testing ensures that as the system evolves, its design remains intuitive, functional, and inclusive for end users. Refer to QA.NT.3: Prioritize user experience with UX testing in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.3-prioritize-user-experience-with-ux-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Cloudscape Design System',
								Url: 'https://cloudscape.design',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_NT_4',
				Title:
					'QA.NT.4: Enhance user experience gradually through experimentation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'By directing only a small subset of the users to the version of the application with the change, teams are able to conduct experiments while hiding the new feature from the majority of the user base not included in the test. With experiments, teams can proactively assess the impact of new features on a subset of users before a full-scale rollout, reducing the risk of making the change and negatively impacting user experience. To run split testing experiments, present different versions of the application to a small segment of real users to gather detailed feedback on specific changes. Enhancing user experience requires taking a methodical approach to assessing how users behave when using your application and developing features that resonate with users. Teams can control the experiment using feature flags or dedicated tools like CloudWatch Evidently to control variables and traffic to the different versions of the application. The goal of running experiments is to identify and implement the best possible user experience based on indirect user behavior.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.4-enhance-user-experience-gradually-through-experimentation',
				},
				ImprovementPlan: {
					DisplayText:
						'By directing only a small subset of the users to the version of the application with the change, teams are able to conduct experiments while hiding the new feature from the majority of the user base not included in the test. With experiments, teams can proactively assess the impact of new features on a subset of users before a full-scale rollout, reducing the risk of making the change and negatively impacting user experience. Refer to QA.NT.4: Enhance user experience gradually through experimentation in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.4-enhance-user-experience-gradually-through-experimentation',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'feature flags',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig#Feature_flags',
							},
							{
								DisplayText: 'CloudWatch Evidently',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Evidently.html',
							},
							{
								DisplayText:
									'Perform launches and A/B experiments with CloudWatch Evidently',
								Url:
									'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Evidently.html',
							},
							{
								DisplayText: 'Feature Flags - AWS AppConfig',
								Url:
									'https://aws.amazon.com/systems-manager/features/appconfig',
							},
							{
								DisplayText:
									"Business Value is IT's Primary Measure of Progress",
								Url:
									'https://aws.amazon.com/blogs/enterprise-strategy/business-value-is-its-primary-measure-of-progress',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_NT_5',
				Title:
					'QA.NT.5: Automate adherence to compliance standards through conformance testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Conformance testing, often referred to as compliance testing, verifies that a system meets internal and external compliance requirements. Embed conformance testing scripts into deployment pipelines to generate real-time compliance attestations and documentation using this data. Conformance testing integrated into deployment pipelines provides a solution to this problem by automating the creation of compliance attestations and documentation. Use the data at your disposal, including APIs, output from other forms of testing, and possibly additional data from IT Service Management (ITSM) and Configuration Management Databases (CMDB). Start by determining both internal (for example, risk assessment policies, or change management procedures) and external standards (for example, GxP for life sciences). Conformance testing acts as a safeguard, ensuring that while agility is prioritized, compliance isn't compromised.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.5-automate-adherence-to-compliance-standards-through-conformance-testing',
				},
				ImprovementPlan: {
					DisplayText:
						'Conformance testing, often referred to as compliance testing, verifies that a system meets internal and external compliance requirements. Embed conformance testing scripts into deployment pipelines to generate real-time compliance attestations and documentation using this data. Refer to QA.NT.5: Automate adherence to compliance standards through conformance testing in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.5-automate-adherence-to-compliance-standards-through-conformance-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'GxP',
								Url: 'https://aws.amazon.com/compliance/gxp-part-11-annex-11',
							},
							{
								DisplayText:
									'Qualification Strategy for Life Science Organizations',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/gxp-systems-on-aws/qualification-strategy-for-life-science-organizations.html',
							},
							{
								DisplayText:
									'Automating the Installation Qualification (IQ) Step to Expedite GxP Compliance',
								Url:
									'https://aws.amazon.com/blogs/industries/automating-the-installation-qualification-iq-step-to-expedite-gxp-compliance',
							},
							{
								DisplayText:
									'Automating GxP compliance in the cloud: Best practices and architecture guidelines',
								Url:
									'https://aws.amazon.com/blogs/industries/automating-gxp-compliance-in-the-cloud-best-practices-and-architecture-guidelines',
							},
							{
								DisplayText:
									'Automating GxP Infrastructure Installation Qualification on AWS with Chef InSpec',
								Url:
									'https://aws.amazon.com/blogs/industries/automating-gxp-infrastructure-installation-qualification-on-aws-with-chef-inspec',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_NT_6',
				Title:
					'QA.NT.6: Experiment with failure using resilience testing to build recovery preparedness',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"There are various types of resilience testing: Before running resilience tests in either test or production environments, consider the use case, the benefits of the test, and the system's readiness. After running resilience tests, conduct a retrospective to understand what went well, any unexpected behaviors, improvements that can be made, and to plan work to enhance both the system's resilience and the testing process itself. After gaining confidence in the testing process and building the necessary observability and rollback mechanisms to run them safely, consider running controlled tests in production to gain the most accurate representation of recovery scenarios in real-world settings. We recommend initially running resilience tests in a test environment to get an understanding of their effects, refine the testing process, and train the team. Before initiating any resilience tests, especially in production, understand the potential impact on the system, dependent systems, and the operating environment. Resilience testing deliberately introduces controlled failures into a system to gauge its ability to withstand failure and recover during disruptive scenarios.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.6-experiment-with-failure-using-resilience-testing-to-build-recovery-preparedness',
				},
				ImprovementPlan: {
					DisplayText:
						"There are various types of resilience testing: Before running resilience tests in either test or production environments, consider the use case, the benefits of the test, and the system's readiness. After running resilience tests, conduct a retrospective to understand what went well, any unexpected behaviors, improvements that can be made, and to plan work to enhance both the system's resilience and the testing process itself. Refer to QA.NT.6: Experiment with failure using resilience testing to build recovery preparedness in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.6-experiment-with-failure-using-resilience-testing-to-build-recovery-preparedness',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Fault Injection Service',
								Url: 'https://aws.amazon.com/fis',
							},
							{
								DisplayText: 'AWS Resilience Hub',
								Url: 'https://aws.amazon.com/resilience-hub',
							},
							{
								DisplayText: 'AWS Elastic Disaster Recovery',
								Url: 'https://aws.amazon.com/disaster-recovery',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL09-BP04 Perform periodic recovery of the data to verify backup integrity and processes',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_periodic_recovery_testing_data.html',
							},
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL12-BP05 Test resiliency using chaos engineering',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_failure_injection_resiliency.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_NT_7',
				Title: 'QA.NT.7: Verify service integrations through contract testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Consumer-driven contract testing is the type we generally recommend, as designing contracts with the consumer in mind ensures that APIs are tailored to the customer's actual needs, making integrations more intuitive. Use purpose-built contract testing tools, such as Pact or Spring Cloud Contract, to simplify managing and validating contracts. As changes are made, these contracts can be used by producing (teams that expose the API) and consuming (teams that use the API) services to ensure they remain compatible. In consumer-driven contract testing, the consumer of a service dictates the expected behaviors of the producer. When any modification is made in a producer service, run contract tests to assess the contracts' validity. Contract testing helps ensure that different system components or services can seamlessly communicate and are compatible with each other.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.7-verify-service-integrations-through-contract-testing',
				},
				ImprovementPlan: {
					DisplayText:
						"Consumer-driven contract testing is the type we generally recommend, as designing contracts with the consumer in mind ensures that APIs are tailored to the customer's actual needs, making integrations more intuitive. Use purpose-built contract testing tools, such as Pact or Spring Cloud Contract, to simplify managing and validating contracts. Refer to QA.NT.7: Verify service integrations through contract testing in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.7-verify-service-integrations-through-contract-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Well-Architected Reliability Pillar: REL03-BP03 Provide service contracts per API',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_service_architecture_api_contracts.html',
							},
							{
								DisplayText:
									'CloudFormation Command Line Interface: Testing resource types using contract tests',
								Url:
									'https://docs.aws.amazon.com/cloudformation-cli/latest/userguide/resource-type-test.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_NT_8',
				Title:
					'QA.NT.8: Practice eco-conscious development with sustainability testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Sustainability testing encompasses: Sustainability testing should use data provided by profiling applications to measure their energy consumption, CPU usage, memory footprint, and data transfer volume. We think that by making sustainability a core part of the software development process, not only do we contribute to a healthier planet, but often, we also end up with more efficient and cost-effective solutions. Sustainability testing ensures that software products contribute to eco-conscious and energy-efficient practices that reflect a growing demand for environmentally responsible development. Combining this data with suggestions from AWS Trusted Advisor and AWS Customer Carbon Footprint Tool can lead to writing tests which can enforce sustainable development practices. In specific use cases, such as internet of things (IoT) and smart devices, software optimizations can directly translate to energy and cost savings while also improving performance. It is a commitment to ensuring software development not only meets performance expectations but also contributes positively to the organization's environmental goals.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.8-practice-eco-conscious-development-with-sustainability-testing',
				},
				ImprovementPlan: {
					DisplayText:
						'Sustainability testing encompasses: Sustainability testing should use data provided by profiling applications to measure their energy consumption, CPU usage, memory footprint, and data transfer volume. We think that by making sustainability a core part of the software development process, not only do we contribute to a healthier planet, but often, we also end up with more efficient and cost-effective solutions. Refer to QA.NT.8: Practice eco-conscious development with sustainability testing in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.nt.8-practice-eco-conscious-development-with-sustainability-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Graviton processors',
								Url: 'https://aws.amazon.com/ec2/graviton',
							},
							{
								DisplayText: 'Amazon EC2 Auto Scaling',
								Url: 'https://aws.amazon.com/ec2/autoscaling',
							},
							{
								DisplayText: 'AWS Trusted Advisor',
								Url:
									'https://aws.amazon.com/premiumsupport/technology/trusted-advisor',
							},
							{
								DisplayText: 'AWS Customer Carbon Footprint Tool',
								Url:
									'https://aws.amazon.com/aws-cost-management/aws-customer-carbon-footprint-tool',
							},
							{
								DisplayText: 'Amazon CodeGuru Profiler',
								Url:
									'https://docs.aws.amazon.com/codeguru/latest/profiler-ug/what-is-codeguru-profiler.html',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_NFT_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/QA_NFT',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Quality_Assurance',
		QuestionId: 'QA_NFT',
		QuestionTitle: 'How do you implement and manage non-functional testing?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Quality_Assurance',
			QuestionDescription:
				'Non-functional testing evaluates the quality attributes of software systems, emphasizing how a solution performs and operates in various environments rather than its functional capabilities.',
			QuestionId: 'QA_NFT',
			QuestionTitle: 'How do you implement and manage non-functional testing?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'QA_ST_1',
				Title:
					'QA.ST.1: Evolve vulnerability management processes to be conducive of DevOps practices',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"This minimizes extensive security evaluations during deployment and is consistent with the DevOps shift left approachaddressing security problems early on in the development process. Automated vulnerability scanning must be integrated into deployment pipelines to provide feedback to developers regarding security vulnerabilities and improvements early on. They can also take on the responsibilities of a security platform team, producing reusable components, improving efficiency, reducing duplication of work, and overall providing autonomy to distributed teams so that they can efficiently secure their products. To effectively practice vulnerability management in a DevOps environment, it's important to adopt a culture where security is everyone's responsibility. Development and security teams need collaboration, with clear delineations for security issue handoff and ownership. For instance, if Amazon CodeCatalyst is your pipeline tool of choice, verify that the chosen vulnerability scanning tool has a CodeCatalyst plugin or API integration capability.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.1-evolve-vulnerability-management-processes-to-be-conducive-of-devops-practices',
				},
				ImprovementPlan: {
					DisplayText:
						'This minimizes extensive security evaluations during deployment and is consistent with the DevOps shift left approachaddressing security problems early on in the development process. Automated vulnerability scanning must be integrated into deployment pipelines to provide feedback to developers regarding security vulnerabilities and improvements early on. Refer to QA.ST.1: Evolve vulnerability management processes to be conducive of DevOps practices in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.1-evolve-vulnerability-management-processes-to-be-conducive-of-devops-practices',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon CodeCatalyst',
								Url: 'https://aws.amazon.com/codecatalyst',
							},
							{
								DisplayText: 'CodeCatalyst Issues',
								Url:
									'https://docs.aws.amazon.com/codecatalyst/latest/userguide/issues.html',
							},
							{
								DisplayText:
									'Enterprise DevOps: Why You Should Run What You Build',
								Url:
									'https://aws.amazon.com/blogs/enterprise-strategy/enterprise-devops-why-you-should-run-what-you-build',
							},
							{
								DisplayText:
									'Automated Software Vulnerability Management - Amazon Inspector',
								Url: 'https://aws.amazon.com/inspector',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_ST_2',
				Title: 'QA.ST.2: Normalize security testing findings',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'These tools can enable centralizing findings from different sources into a single dashboard or reporting platform to create a unified view of the security posture which can streamline the prioritization and remediation process. Having a common framework for normalizing the interpretation and ranking of vulnerabilities from diverse security testing tools provides a systematic approach to risk management and mitigation. Begin by selecting a recognized scoring system, such as the Common Vulnerability Scoring System (CVSS), as the baseline for vulnerability ranking. Given the diversity of security testing tools in a DevOps environment, findings often emerge from different sources and in different formats. Configure your tools to automatically map their findings to the chosen system, ensuring uniformity across all results. Ensure that everyone involved in the security process understands the chosen scoring system and knows how to interpret it.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.2-normalize-security-testing-findings',
				},
				ImprovementPlan: {
					DisplayText:
						'These tools can enable centralizing findings from different sources into a single dashboard or reporting platform to create a unified view of the security posture which can streamline the prioritization and remediation process. Having a common framework for normalizing the interpretation and ranking of vulnerabilities from diverse security testing tools provides a systematic approach to risk management and mitigation. Refer to QA.ST.2: Normalize security testing findings in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.2-normalize-security-testing-findings',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_ST_3',
				Title:
					'QA.ST.3: Use application risk assessments for secure software design',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Once vulnerabilities are identified through design reviews and potential threats through modeling, these insights should directly inform the software's security requirements. After the design phase, threat modeling dives deeper into potential security threats that the finalized design might face. During these reviews, security experts should assist with making design choices to prevent introducing weak points that could introduce vulnerabilities. An inverse approach to threat modeling is attack modeling, which identifies specific attacks or vulnerabilities and examines how they can be exploited. At the earliest stages of the development lifecycle, design reviews focus on the planned architecture, features, and flow of the application. Non-functional requirements includes making changes that impact to performance, scalability, and reliability under security threats.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.3-use-application-risk-assessments-for-secure-software-design',
				},
				ImprovementPlan: {
					DisplayText:
						"Once vulnerabilities are identified through design reviews and potential threats through modeling, these insights should directly inform the software's security requirements. After the design phase, threat modeling dives deeper into potential security threats that the finalized design might face. Refer to QA.ST.3: Use application risk assessments for secure software design in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.3-use-application-risk-assessments-for-secure-software-design',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Threat Composer',
								Url: 'https://awslabs.github.io/threat-composer',
							},
							{
								DisplayText: 'Threat modeling for builders',
								Url: 'https://catalog.workshops.aws/threatmodel',
							},
							{
								DisplayText: 'AWS Security Maturity Model - Threat Modeling',
								Url:
									'https://maturitymodel.security.aws.dev/en/3.-efficient/threat-modeling',
							},
							{
								DisplayText: 'How to approach threat modeling',
								Url:
									'https://aws.amazon.com/blogs/security/how-to-approach-threat-modeling',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_ST_4',
				Title:
					'QA.ST.4: Enhance source code security with static application security testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Static Application Security Testing (SAST) is a proactive measure to identify potential vulnerabilities in your source code before they become part of a live application. SAST is a specialized form of non-functional static testing that enables you to analyze the source or binary code for security vulnerabilities, without the need for the code to be running. When selecting a SAST tool, consider its compatibility with your application's languages and frameworks, its ease of integration into your existing toolsets, its ability to provide actionable insights to fix vulnerabilities, and false positive rates. False positive rate is one of the most important metrics to focus on when selecting a SAST tool, as this can result in findings and alerts of potential security issues that are not actually exploitable. Choose a SAST tool, such as Amazon CodeGuru Security, and use it to scan your application using an automated continuous integration pipeline. To prevent developer burnout and backlash due to overwhelming false positives or a high rate of alerts in existing applications, introduce SAST rulesets incrementally.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.4-enhance-source-code-security-with-static-application-security-testing',
				},
				ImprovementPlan: {
					DisplayText:
						'Static Application Security Testing (SAST) is a proactive measure to identify potential vulnerabilities in your source code before they become part of a live application. SAST is a specialized form of non-functional static testing that enables you to analyze the source or binary code for security vulnerabilities, without the need for the code to be running. Refer to QA.ST.4: Enhance source code security with static application security testing in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.4-enhance-source-code-security-with-static-application-security-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Amazon CodeGuru Security',
								Url: 'https://aws.amazon.com/codeguru',
							},
							{
								DisplayText:
									'Security in every stage of the CI/CD pipeline: SAST',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/security-in-every-stage-of-cicd-pipeline.html#static-application-security-testing-sast',
							},
							{
								DisplayText: 'Security scans - CodeWhisperer',
								Url:
									'https://docs.aws.amazon.com/codewhisperer/latest/userguide/security-scans.html',
							},
							{
								DisplayText:
									'Blog: Building end-to-end AWS DevSecOps CI/CD pipeline with open source SCA, SAST and DAST tools',
								Url:
									'https://aws.amazon.com/blogs/devops/building-end-to-end-aws-devsecops-ci-cd-pipeline-with-open-source-sca-sast-and-dast-tools',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_ST_5',
				Title:
					'QA.ST.5: Evaluate runtime security with dynamic application security testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"While other forms of security testing identifies potential vulnerabilities in code that hasn't been run, dynamic application security testing (DAST) detects vulnerabilities in a running application. DAST works by simulating real-world attacks to identify potential security flaws while the application is running, enabling uncovering vulnerabilities that may not be detectable through static testing. With DAST, false positive rates are generally lower than other forms of security testing since it actively exploits known vulnerabilities. By proactively uncovering security weaknesses during runtime, DAST reduces the likelihood of vulnerabilities being exploited in production environments. False positives can erode developer trust in security testing while detracting from genuine threats and consuming unnecessary resources. Begin by choosing a DAST tool that offers broad vulnerability coverage, including recognition of threats listed in the OWASP Top 10.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.5-evaluate-runtime-security-with-dynamic-application-security-testing',
				},
				ImprovementPlan: {
					DisplayText:
						"While other forms of security testing identifies potential vulnerabilities in code that hasn't been run, dynamic application security testing (DAST) detects vulnerabilities in a running application. DAST works by simulating real-world attacks to identify potential security flaws while the application is running, enabling uncovering vulnerabilities that may not be detectable through static testing. Refer to QA.ST.5: Evaluate runtime security with dynamic application security testing in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.5-evaluate-runtime-security-with-dynamic-application-security-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Security in every stage of the CI/CD pipeline: DAST',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/security-in-every-stage-of-cicd-pipeline.html#dynamic-application-security-testing-dast',
							},
							{
								DisplayText:
									'Building end-to-end AWS DevSecOps CI/CD pipeline with open source SCA, SAST and DAST tools',
								Url:
									'https://aws.amazon.com/blogs/devops/building-end-to-end-aws-devsecops-ci-cd-pipeline-with-open-source-sca-sast-and-dast-tools',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_ST_6',
				Title:
					'QA.ST.6: Validate third-party components using software composition analysis',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'While scanning repositories and pipelines can capture vulnerabilities in active projects, centralized SBOMs act as a consistent, versioned record of all software components used across various projects and versions. SCA works by scanning software component inventories, such as software bill of materials software bill of materials (SBOM) and dependency manifest files. Software Composition Analysis (SCA) is used to assess these risks and verify that external dependencies being used do not have known vulnerabilities. The use of open-source software and third-party components accelerates the software development process, but it also introduces new security and compliance risks. When selecting a SCA tool, focus on tools that provide the most comprehensive vulnerability database, pulling from sources such as the National Vulnerability Database (NVD) and Common Vulnerabilities and Exposures (CVE). Instead of scanning every repository individually, centralized scanning of SBOMs offers a consolidated method to assessing and remediating vulnerabilities.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.6-validate-third-party-components-using-software-composition-analysis',
				},
				ImprovementPlan: {
					DisplayText:
						'While scanning repositories and pipelines can capture vulnerabilities in active projects, centralized SBOMs act as a consistent, versioned record of all software components used across various projects and versions. SCA works by scanning software component inventories, such as software bill of materials software bill of materials (SBOM) and dependency manifest files. Refer to QA.ST.6: Validate third-party components using software composition analysis in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.6-validate-third-party-components-using-software-composition-analysis',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'software bill of materials',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/software-bill-of-materials-sbom.html',
							},
							{
								DisplayText:
									'Security in every stage of the CI/CD pipeline: SCA',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/security-in-every-stage-of-cicd-pipeline.html#software-composition-analysis-sca',
							},
							{
								DisplayText:
									'Building end-to-end AWS DevSecOps CI/CD pipeline with open source SCA, SAST and DAST tools',
								Url:
									'https://aws.amazon.com/blogs/devops/building-end-to-end-aws-devsecops-ci-cd-pipeline-with-open-source-sca-sast-and-dast-tools',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_ST_7',
				Title:
					'QA.ST.7: Conduct proactive exploratory security testing activities',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Conduct frequent exploratory security testing activities, encompassing penetration testing, red teaming, and participation in vulnerability disclosure or bug bounty programs. Red teaming is more focused than penetration testing, targeting specific vulnerabilities by allocating more resources, spending more time, and examining additional attack vectors. Review the AWS Customer Support Policy for Penetration Testing before running penetration tests against AWS infrastructure. Going beyond the scope of penetration tests, red teaming emulates real-world adversaries in a full-scale simulation, targeting the organization's technology, people, and processes. Automation can be used to run repetitive, baseline tests, such as dynamic application security testing, to enable human testers to focus on more complex scenarios. Deployment pipelines can trigger the penetration testing process and wait for an approval to help ensure that vulnerabilities are identified and fixed before code moves to the next stage.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.7-conduct-proactive-exploratory-security-testing-activities',
				},
				ImprovementPlan: {
					DisplayText:
						'Conduct frequent exploratory security testing activities, encompassing penetration testing, red teaming, and participation in vulnerability disclosure or bug bounty programs. Red teaming is more focused than penetration testing, targeting specific vulnerabilities by allocating more resources, spending more time, and examining additional attack vectors. Refer to QA.ST.7: Conduct proactive exploratory security testing activities in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.7-conduct-proactive-exploratory-security-testing-activities',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'AWS Customer Support Policy for Penetration Testing',
								Url: 'https://aws.amazon.com/security/penetration-testing',
							},
							{
								DisplayText:
									'AWS Well-Architected Security Pillar: SEC11-BP03 Perform regular penetration testing',
								Url:
									'https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_appsec_perform_regular_penetration_testing.html',
							},
							{
								DisplayText:
									'Security in every stage of the CI/CD pipeline: Penetration Testing and Red Teaming',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/security-in-every-stage-of-cicd-pipeline.html#penetration-testing',
							},
							{
								DisplayText: 'AWS Cloud Security - Vulnerability Reporting',
								Url: 'https://aws.amazon.com/security/vulnerability-reporting',
							},
							{
								DisplayText: 'AWS BugBust',
								Url: 'https://aws.amazon.com/bugbust',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_ST_8',
				Title:
					'QA.ST.8: Improve security testing accuracy using interactive application security testing',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Interactive Application Security Testing (IAST) offers an inside-out approach to application security testing by combining strengths of both Static Application Security Testing (SAST) and Dynamic Application Security Testing (DAST). While SAST examines source code to identify vulnerabilities and DAST inspects a running system, IAST uses embedded agents which has access to application code, system memory, stack traces, and requests and responses to monitor system behavior during runtime. Unlike other automated security testing methods that can produce false alarms, IAST's real-time observability from within the application provides a contextual understanding that reduces false positive rates. Include IAST agents to the system during the build process to actively monitor the system in the testing environments. When vulnerabilities are detected, IAST provides deeper insight into how the system is impacted, providing proof that the vulnerabilities flagged are genuine and actionable. These agents provide additional observability to the system that is used to validate vulnerabilities.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.8-improve-security-testing-accuracy-using-interactive-application-security-testing',
				},
				ImprovementPlan: {
					DisplayText:
						'Interactive Application Security Testing (IAST) offers an inside-out approach to application security testing by combining strengths of both Static Application Security Testing (SAST) and Dynamic Application Security Testing (DAST). While SAST examines source code to identify vulnerabilities and DAST inspects a running system, IAST uses embedded agents which has access to application code, system memory, stack traces, and requests and responses to monitor system behavior during runtime. Refer to QA.ST.8: Improve security testing accuracy using interactive application security testing in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.st.8-improve-security-testing-accuracy-using-interactive-application-security-testing',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Security in every stage of the CI/CD pipeline: IAST',
								Url:
									'https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/security-in-every-stage-of-cicd-pipeline.html#interactive-application-security-testing-iast',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_ST_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/QA_ST',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Quality_Assurance',
		QuestionId: 'QA_ST',
		QuestionTitle: 'How do you implement and manage security testing?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Quality_Assurance',
			QuestionDescription:
				'Security testing identifies potential vulnerabilities, threats, risks, and other security weaknesses in a system.',
			QuestionId: 'QA_ST',
			QuestionTitle: 'How do you implement and manage security testing?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'QA_DT_1',
				Title:
					'QA.DT.1: Ensure data integrity and accuracy with data quality tests',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"While data quality testing might not fall under the traditional definitions of functional or non-functional testing, it's still an essential aspect of ensuring that an application or system functions correctly, as the quality of data can significantly impact the overall performance, user experience, and reliability of the software. To calculate data quality metrics on your dataset, define and verify data quality constraints, and be informed about changes in the data distribution. Data quality tests assess the accuracy, consistency, and overall quality of the data used within the application or system. Using data quality tests, teams can spend more of their time focusing on how data should appear rather than continually checking it for accuracy, streamlining the development and deployment process. We recommend data quality tests because they enable rapid software delivery and continuous improvement of data driving systems. These tests typically involve validating data against predefined rules and checking for duplicate or missing data to ensure the dataset remains reliable.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.1-ensure-data-integrity-and-accuracy-with-data-quality-tests',
				},
				ImprovementPlan: {
					DisplayText:
						"While data quality testing might not fall under the traditional definitions of functional or non-functional testing, it's still an essential aspect of ensuring that an application or system functions correctly, as the quality of data can significantly impact the overall performance, user experience, and reliability of the software. To calculate data quality metrics on your dataset, define and verify data quality constraints, and be informed about changes in the data distribution. Refer to QA.DT.1: Ensure data integrity and accuracy with data quality tests in the Well-Architected DevOps Guidance for more details.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.1-ensure-data-integrity-and-accuracy-with-data-quality-tests',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText:
									'Getting started with AWS Glue Data Quality from the AWS AWS Glue Data Catalog',
								Url:
									'https://aws.amazon.com/blogs/big-data/getting-started-with-aws-glue-data-quality-from-the-aws-glue-data-catalog',
							},
							{
								DisplayText: 'Deequ - Unit Tests for Data',
								Url: 'https://github.com/awslabs/deequ',
							},
							{
								DisplayText: 'Test data quality at scale with Deequ',
								Url:
									'https://aws.amazon.com/blogs/big-data/test-data-quality-at-scale-with-deequ',
							},
							{
								DisplayText: 'How to Architect Data Quality on the AWS Cloud',
								Url:
									'https://aws.amazon.com/blogs/industries/how-to-architect-data-quality-on-the-aws-cloud',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_DT_2',
				Title: 'QA.DT.2: Enhance understanding of data through data profiling',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'By performing data profiling, teams can gain deeper insights into the characteristics and quality of their data, enabling them to make informed decisions about data management, data governance, and data integration strategies. To integrate data profiling into a DevOps environment, consider automating the process using data profiling tools such as AWS Glue DataBrew, open-source tools, or custom scripts that analyze data regularly. Incorporate the profiling results into your data management, governance, and integration strategies, allowing your team to proactively address data quality issues and maintain consistent data standards throughout the development lifecycle. Use data profiling tools to examine, analyze, and understand the data including its content, structure, and relationships to identify issues such as inconsistencies, outliers, and missing values. This data is often used to enable or improve other types of data testing.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.2-enhance-understanding-of-data-through-data-profiling',
				},
				ImprovementPlan: {
					DisplayText:
						'By performing data profiling, teams can gain deeper insights into the characteristics and quality of their data, enabling them to make informed decisions about data management, data governance, and data integration strategies. To integrate data profiling into a DevOps environment, consider automating the process using data profiling tools such as AWS Glue DataBrew, open-source tools, or custom scripts that analyze data regularly. Refer to QA.DT.2: Enhance understanding of data through data profiling in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.2-enhance-understanding-of-data-through-data-profiling',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'AWS Glue DataBrew',
								Url: 'https://aws.amazon.com/glue/features/databrew',
							},
							{
								DisplayText:
									'Build an automatic data profiling and reporting solution with Amazon EMR, AWS Glue, and Amazon QuickSight',
								Url:
									'https://aws.amazon.com/blogs/big-data/build-an-automatic-data-profiling-and-reporting-solution-with-amazon-emr-aws-glue-and-amazon-quicksight',
							},
							{
								DisplayText: 'Test data quality at scale with Deequ',
								Url:
									'https://aws.amazon.com/blogs/big-data/test-data-quality-at-scale-with-deequ',
							},
							{
								DisplayText: 'Deequ single column profiling',
								Url:
									'https://github.com/awslabs/deequ/blob/master/src/main/scala/com/amazon/deequ/examples/data_profiling_example.md',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_DT_3',
				Title: 'QA.DT.3: Validate data processing rules with data logic tests',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement automated data logic tests in development and staging environments, which can be triggered by code commits or scheduled intervals, to proactively identify and fix issues before they reach production environments. Data logic tests verify the accuracy and reliability of data processing and transformation within your application, ensuring that it functions as intended. Establish test cases for data processing workflows and transformation functions, confirming that expected outcomes are achieved. Use version control systems to track changes in data logic and collaborate effectively with team members.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.3-validate-data-processing-rules-with-data-logic-tests',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement automated data logic tests in development and staging environments, which can be triggered by code commits or scheduled intervals, to proactively identify and fix issues before they reach production environments. Data logic tests verify the accuracy and reliability of data processing and transformation within your application, ensuring that it functions as intended. Refer to QA.DT.3: Validate data processing rules with data logic tests in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.3-validate-data-processing-rules-with-data-logic-tests',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Test data quality at scale with Deequ',
								Url:
									'https://aws.amazon.com/blogs/big-data/test-data-quality-at-scale-with-deequ',
							},
							{
								DisplayText: 'Deequ automatic suggestion of constraints',
								Url:
									'https://github.com/awslabs/deequ/blob/master/src/main/scala/com/amazon/deequ/examples/constraint_suggestion_example.md',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_DT_4',
				Title:
					'QA.DT.4: Detect and mitigate data issues with anomaly detection',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Data anomaly detection is a specialized form of anomaly detection which focuses on identifying unusual patterns or behaviors in data quality metrics that may indicate data quality issues. Consider integrating machine learning algorithms and statistical methods into your data quality monitoring processes. This enables automated assessment of the accuracy and reliability of data processing and analysis, enhancing the overall performance of your applications and systems. Use tools that can detect and address data anomalies in real-time and incorporate them into your development and deployment workflows.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.4-detect-and-mitigate-data-issues-with-anomaly-detection',
				},
				ImprovementPlan: {
					DisplayText:
						'Data anomaly detection is a specialized form of anomaly detection which focuses on identifying unusual patterns or behaviors in data quality metrics that may indicate data quality issues. Consider integrating machine learning algorithms and statistical methods into your data quality monitoring processes. Refer to QA.DT.4: Detect and mitigate data issues with anomaly detection in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.4-detect-and-mitigate-data-issues-with-anomaly-detection',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'What Is Anomaly Detection?',
								Url: 'https://aws.amazon.com/what-is/anomaly-detection',
							},
							{
								DisplayText: 'Test data quality at scale with Deequ',
								Url:
									'https://aws.amazon.com/blogs/big-data/test-data-quality-at-scale-with-deequ',
							},
							{
								DisplayText: 'Deequ anomaly detection',
								Url:
									'https://github.com/awslabs/deequ/blob/master/src/main/scala/com/amazon/deequ/examples/anomaly_detection_example.md',
							},
							{
								DisplayText: 'Amazon Lookout for Metrics',
								Url: 'https://aws.amazon.com/lookout-for-metrics',
							},
							{
								DisplayText:
									'Introducing Amazon Lookout for Metrics: An anomaly detection service to proactively monitor the health of your business',
								Url:
									'https://aws.amazon.com/blogs/machine-learning/introducing-amazon-lookout-for-metrics-an-anomaly-detection-service-to-proactively-monitor-the-health-of-your-business',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_DT_5',
				Title: 'QA.DT.5: Utilize incremental metrics computation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Incremental metrics computation allows teams to efficiently monitor and maintain data quality without needing to recompute metrics on the entire dataset every time data is updated. Automate the computation process by setting up triggers that initiate the metric computation whenever new data is added or an existing partition is updated. Use this method to significantly reduce computational resources and time spent on data quality testing, allowing for more agile and responsive data management practices. Periodically validate the results of the incremental metrics computation against a full computation to ensure accuracy. Continuously monitor the updated metrics to help ensure they reflect the true state of your data. Segment your data into logical partitions, often based on time, such as daily or hourly partitions.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.5-utilize-incremental-metrics-computation',
				},
				ImprovementPlan: {
					DisplayText:
						'Incremental metrics computation allows teams to efficiently monitor and maintain data quality without needing to recompute metrics on the entire dataset every time data is updated. Automate the computation process by setting up triggers that initiate the metric computation whenever new data is added or an existing partition is updated. Refer to QA.DT.5: Utilize incremental metrics computation in the Well-Architected DevOps Guidance for more details.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.dt.5-utilize-incremental-metrics-computation',
				},
				AdditionalResources: [
					{
						Type: 'HELPFUL_RESOURCE',
						Content: [
							{
								DisplayText: 'Deequ',
								Url: 'https://github.com/awslabs/deequ',
							},
							{
								DisplayText: 'Deequ stateful metrics computation',
								Url:
									'https://github.com/awslabs/deequ/blob/master/src/main/scala/com/amazon/deequ/examples/algebraic_states_example.md',
							},
						],
					},
				],
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'QA_DT_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText: 'Choose this if you do not follow these best practices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/QA_DT',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
		],
		IsApplicable: true,
		PillarId: 'Quality_Assurance',
		QuestionId: 'QA_DT',
		QuestionTitle: 'How do you implement and manage data testing?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/devops',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'Quality_Assurance',
			QuestionDescription:
				'Data testing is a specialized type of testing that emphasizes the evaluation of data processed by systems, encompassing aspects like data transformations, data integrity rules, and data processing logic. Its purpose is to evaluate various attributes of data to identify data quality issues, such as duplication, missing data, or errors.',
			QuestionId: 'QA_DT',
			QuestionTitle: 'How do you implement and manage data testing?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
];
export default questions;
