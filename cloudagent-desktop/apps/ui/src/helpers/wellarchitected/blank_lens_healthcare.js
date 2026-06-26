const questions = [
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST1_1',
				Title:
					'Determine applicable regulatory frameworks and controls as it pertains to data retention',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Organizations may be subject to regulatory and company requirements dictating data retention requirements. Developing strategies for data retention is imperative to maintain compliance while minimizing cost. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/data-retention.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Refer to the following resources to learn more about our best practices related to cost optimization. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-4.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST1_2',
				Title: 'Implement data lifecycle policies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement lifecycle policies that transition infrequently-accessed data to lower-cost storage tiers.  For example, use Amazon S3 Lifecycle configurations to archive infrequently accessed data after some period of time, automatically reducing storage costs. Alternatively, use Amazon S3 Intelligent-Tiering to shift the archival policies to focus on time of last access instead of time the object has been in Amazon S3.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/data-retention.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Refer to the following resources to learn more about our best practices related to cost optimization. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-4.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST1_3',
				Title: 'Centralize automated policy enforcement',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Adopting infrastructure as code, enables you to define and test your data retention policies before they make it into production.   For example, if regulatory requirements specify that you must retain certain medical images for 10 years, you can verify that no Amazon S3 lifecycle policy expires an object before that time. Additionally, consider AWS Backup for centralized backup management, which enables you to back up application data in a consistent and compliant manner.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/data-retention.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Refer to the following resources to learn more about our best practices related to cost optimization. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-4.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST1_4',
				Title:
					'Validate lifecycle policies are enforced by enabling monitoring and alerts',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Because the cloud is API-driven, you can monitor changes to your environment as described in the operational excellence and security tiers. Set up alerts for when an API action alters a data retention policy so you can quickly review the change to make sure it was authorized and operating correctly. If using AWS Backup, use AWS Backup Audit Manager to automatically detect when your AWS Backup policies violate your data retention requirements. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/data-retention.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Refer to the following resources to learn more about our best practices related to cost optimization. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-4.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST1_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'costOptimization',
		QuestionId: 'COST1',
		QuestionTitle: 'How do you define and enforce data retention policies?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Organizations typically operate multiple workloads run by multiple teams. These teams can be in different organization units, each with its own revenue stream. The capability to attribute resource costs to the workloads, individual organization, or product owners drives efficient usage behavior and helps reduce waste.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/expenditure-and-usage-awareness.html',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Healthcare organizations may be subject to regulatory and company requirements dictating how long they must store both health data as well as logs detailing access to that data.',
			QuestionId: 'COST1',
			QuestionTitle: 'How do you define and enforce data retention policies?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OPS1_1',
				Title: 'Create and maintain a risk management program',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Healthcare organizations should create a comprehensive risk management program that includes all operational, clinical, strategic, financial, legal, environmental, and any other potential risk domains. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText: 'Amazon Web Services: Risk and Compliance whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/aws-risk-and-compliance/welcome.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS1_2',
				Title: 'Create and maintain a risk authority team',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Creating an effective risk management program for the cloud should be defined by the appropriate risk authority team.  The risk authority within the organization (for example, board of directors, chief risk officers, or business risk officers) must evaluate the criticality of a business process (and the underlying workloads that support that process) and specify the level of availability they require for the process. Consider the potential impact a disruption may have on the process, organization, and customers. Weigh the impact against the cost of operating the workload in a high availability mode, consequences for business agility, and pace of innovation. Working backwards from established risk appetites allows you to define operational priorities and corresponding cloud architectures that can meet your business objectives. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText: 'Amazon Web Services: Risk and Compliance whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/aws-risk-and-compliance/welcome.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS1_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'operationalExcellence',
		QuestionId: 'OPS1',
		QuestionTitle: 'Have you defined a formal risk management program?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Many regulatory frameworks are intended to reduce risk in one way or another. Organizations usually understand that they must reduce their risk, but may struggle to determine what the appropriate risk appetite is and how to manage it. This is accomplished using a documented risk management program. In healthcare, the risk management program is designed to safeguard patient data, as well as the overall organization s assets and reputation.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'In healthcare, the risk management program is designed to safeguard patient data, as well as the overall organization’s assets and reputation.',
			QuestionId: 'OPS1',
			QuestionTitle: 'Have you defined a formal risk management program?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OPS2_1',
				Title: 'Create policies and procedures to govern cloud workloads',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'A mature governance program requires understanding the compliance objectives and requirements and establishing a control environment that meets those objectives and requirements.  Organizations that host and process healthcare data can be required to meet specific standards and regulations, such as HIPAA or General Data Protection Regulation (GDPR). A mature governance program can help verify that the necessary controls are implemented.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText: 'Amazon Web Services: Risk and Compliance whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/aws-risk-and-compliance/welcome.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS2_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'operationalExcellence',
		QuestionId: 'OPS2',
		QuestionTitle:
			'What policies and procedures has your organization adopted for cloud governance?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Cloud governance is a set of policies and procedures that outline, or govern, how an organization manages their cloud workloads.  A mature governance program requires understanding the compliance objectives and requirements and establishing a control environment that meets those objectives and requirements.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Cloud governance is a set of policies and procedures that outline, or govern, how an organization manages their cloud workloads.',
			QuestionId: 'OPS2',
			QuestionTitle:
				'What policies and procedures has your organization adopted for cloud governance?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OPS3_1',
				Title:
					'Determine regulatory frameworks and security controls that are applicable to your business and your cloud workload',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'As healthcare organizations evolve and grow, they may either want, or be required, to adhere to multiple regulations or certifications. For example, a European organization may be required to meet GDPR and additional country-specific regulations in each country it operates in. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS3_2',
				Title:
					'Map applicable frameworks and controls to AWS controls to align with regulatory frameworks',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'There are two common approaches to addressing multiple compliance regimes. First, organizations may choose to address each set of requirements from the beginning and develop mappings unique to each. Alternatively, organizations can choose to map to a common security framework, and leverage published controls mappings from that framework to many others in a hub-and-spoke model. AWS recommends the latter approach where possible to avoid duplicating effort. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS3_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'operationalExcellence',
		QuestionId: 'OPS3',
		QuestionTitle:
			'How do you map security controls to compliance requirements?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Organizations that host and process health data must verify that they are adhering to all applicable regulatory frameworks and standards. As healthcare organizations evolve and grow, they may either want, or be required, to adhere to multiple regulations or certifications. For example, a European organization may be required to meet GDPR and additional country-specific regulations in each country it operates in.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Organizations that host and process health data must verify that they are adhering to all applicable regulatory frameworks and standards.',
			QuestionId: 'OPS3',
			QuestionTitle:
				'How do you map security controls to compliance requirements?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OPS4_1',
				Title:
					'Ensure employees who may have access to sensitive healthcare data are trained on the rules and regulations.',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Employees should have knowledge on what to do when viewing sensitive data. They should know how and where to host or process that data, and how to protect it. Train employees on any other regulation-based requirements, such as breach disclosure. Document all of this in your risk management program. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS4_2',
				Title:
					'Create and document a policy and procedure aligned to each control and safeguard',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Organizations that are hosting and processing sensitive healthcare data should have a documented policy that aligns with each control or safeguard in place to secure the data. In addition, each policy should have an associated procedure document that outlines how the policy will be implemented. These policy and procedure documents will help educate employees on the safeguards used, and can help demonstrate your compliance posture to your stakeholders. These documents help create a stronger culture of compliance for your organization. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS4_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'operationalExcellence',
		QuestionId: 'OPS4',
		QuestionTitle: 'How do you educate employees on access to sensitive data? ',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Organizations that host or process PHI should ensure that employees who have access to healthcare data, either intentionally or accidentally as part of their job function, are trained on the rules and regulations that govern the organization. Employees should have knowledge on what to do when viewing sensitive data',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Organizations that host or process PHI should ensure that employees who have access to healthcare data are trained on the rules and regulations that govern the organization.',
			QuestionId: 'OPS4',
			QuestionTitle:
				'How do you educate employees on access to sensitive data? ',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OPS5_1',
				Title:
					'Partition workloads involving sensitive data into separate environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Minimize access to sensitive data by isolating workloads to separate environments requiring additional controls for access. Segmenting can be done by AWS accounts, VPCs, or Amazon Simple Storage Service buckets. Minimize using sensitive data in non-production environments. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS5_2',
				Title:
					'Architect and build with the ability to generate evidence that demonstrate continuous compliance',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Healthcare organizations must be able to demonstrate their compliance posture.  Evidence that includes the safeguards used to protect sensitive healthcare data, as well as the documented policies and procedures, can all be used to demonstrate compliance. The cloud services used to architect a compliant foundation in the cloud, can also be used to gather the necessary evidence to demonstrate compliance posture. For example, using infrastructure as code, coupled with a software development lifecycle, can demonstrate a mature change management process, which is an important compliance control. Being able to demonstrate the full scope of a compliance posture is critical for all stakeholders, whether that is an organizations leadership, shareholders, customers, and patients.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS5_3',
				Title: 'Identify resources in the cloud environment',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'An accurate representation of your cloud environments is necessary to demonstrate continuous compliance. Understand what AWS resources exist and how they interact with each other. AWS Config will help you identify these resources and how they are configured. Use distributed tracing solutions, such as AWS X-Ray, to understand how components of your system interact, and to map network accessibility between different resources in your environment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS5_4',
				Title:
					'Restrict resources and applications to pre-defined configurations',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Coupling AWS Config with infrastructure as code will allow you to test application configurations before they are deployed in your environment. Apply governance to your AWS deployments using infrastructure as code tools like AWS CloudFormation, AWS Cloud Development Kit (AWS CDK), Terraform, and Service Catalog. Verify that all configurations are secure-by-default with best practices around encryption, logging, and least privilege.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS5_5',
				Title: 'Implement compliance-as-code for configuration',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'For each configuration you specify, test the controls you put in place. Use AWS Config as the central location to evaluate configuration changes. Where possible, use AWS Config managed rules, but also implement custom evaluations with AWS Lambda, fully capturing environment configuration. Configuration triggers will also shorten the time to identify AWS resources that are out of compliance compared to periodic triggers. This helps you demonstrate your compliance posture by automatically building and maintaining a list of resources within your AWS environment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText: 'AWS Config Conformance Pack Sample Templates',
					Url:
						'https://docs.aws.amazon.com/config/latest/developerguide/conformancepack-sample-templates.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS5_6',
				Title: 'Centralize security and compliance findings',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Many customers will use multiple AWS accounts (such as development, test, and prod, or department-specific accounts). Configuration management, while important, is not the only set of technical controls you may require. For example, you may combine your configuration posture with additional findings, from third-party solutions or AWS security services like Amazon GuardDuty. Technical controls and findings should be grouped together as evidence using a solution such as AWS Security Hub. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS5_7',
				Title:
					'Map technical controls to compliance requirements using automation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Simplify maintaining a complete view of your compliance posture by automatically mapping controls and findings to your internal policies. For example, if you have a compliance policy around encryption at-rest, you may have individual controls on the configuration of each AWS resource to verify encryption is enabled.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS5_8',
				Title: 'Use up-to-date artifacts',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The creation of artifacts that document the compliance posture of a cloud environment should be automated. Use services such as AWS Config, AWS Audit Manager, and AWS Security Hub to automatically collect and report the compliance state of a cloud environment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS5_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'operationalExcellence',
		QuestionId: 'OPS5',
		QuestionTitle: 'How do you demonstrate continuous compliance?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Managing compliance manually can be time-consuming, complex, and confusing. Healthcare organizations must be able to demonstrate their compliance posture. Evidence that includes the safeguards used to protect sensitive healthcare data, as well as the documented policies and procedures, can all be used to demonstrate compliance. ',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/prepare.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Healthcare organizations must be able to demonstrate their compliance posture.',
			QuestionId: 'OPS5',
			QuestionTitle: 'How do you demonstrate continuous compliance?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'OPS6_1',
				Title: 'Automate remediation actions for non-compliant resources',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automate remediation of configurations that are out of compliance with your technical controls for rapid, consistent application of your policies. Event-driven architectures improve remediation times. Not everything can be predicted ahead of time. Certain remediations may be manual at first, but investigated when they occur and automated when possible in future occurrences. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Resources to learn more about best practices related to operational excellence',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS6_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'operationalExcellence',
		QuestionId: 'OPS6',
		QuestionTitle: 'How do you automate remediation of compliance violations?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'There are several key concepts to consider when creating an automated remediation solution. While your organization is responsible for compliance for your environment, per the shared responsibility model, the following approach will make it easier to demonstrate compliance on AWS. In general, use managed services either from AWS or a third-party solution, such as one available in AWS Marketplace, to simplify your approach.  Similar to the recommendations for demonstrating continuous compliance, define compliance requirements and create associated policies and procedures for remediation before creating the remediation solution.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/operate.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Automate remediation of configurations that are out of compliance with your technical controls for rapid, consistent application of your policies.',
			QuestionId: 'OPS6',
			QuestionTitle:
				'How do you automate remediation of compliance violations?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF_1_1',
				Title: 'Offload encryption to hardware',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Certain encryption approaches, such as VPN tunnels or IPsec meshes, can impact performance when implemented at scale. Where possible, offload encryption to hardware to maintain security while improving performance.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-3.html',
				},
				ImprovementPlan: {
					DisplayText:
						'AWS Nitro System:  A combination of dedicated hardware and lightweight hypervisor enabling faster innovation and enhanced security',
					Url: 'http://aws.amazon.com/ec2/nitro/',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF_1_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'performance',
		QuestionId: 'PERF_1',
		QuestionTitle: 'How do you encrypt data while ensuring performance?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Often, multiple approaches are required to get optimal performance across a workload. Well-architected systems use multiple solutions and enable different features to improve performance.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/performance-architecture.html',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Evaluate and select encryption services and technology that minimize performance impacts.',
			QuestionId: 'PERF_1',
			QuestionTitle: 'How do you encrypt data while ensuring performance?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF_2_1',
				Title:
					'Select compute services that meet regulatory and performance requirements',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Healthcare requirements for compute are generally consistent with other industries. Healthcare applications can take advantage of virtual machines, containers, or serverless technologies.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-3.html',
				},
				ImprovementPlan: {
					DisplayText: 'Data protection in Amazon EC2',
					Url:
						'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/data-protection.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF_2_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'performance',
		QuestionId: 'PERF_2',
		QuestionTitle: 'How do you select your compute solution?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'The optimal compute choice for a particular workload can vary based on application design, usage patterns, and configuration settings. Architectures may use different compute choices for various components and enable different features to improve performance. Selecting the wrong compute choice for an architecture can lead to lower performance efficiency.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/compute-selection.html',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Evaluate and select the compute solution that meets your business requirements.',
			QuestionId: 'PERF_2',
			QuestionTitle: 'How do you select your compute solution?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF_3_1',
				Title: 'Select the appropriate storage solution based on the use case',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The optimal storage solution for a system varies based on the kind of access method (block, file, or object), patterns of access (random or sequential), required throughput, frequency of access (online, offline, archival), frequency of update (WORM, dynamic), and availability and durability constraints. Well-architected systems use multiple storage solutions and enable different features to improve performance and use resources efficiently.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-3.html',
				},
				ImprovementPlan: {
					DisplayText: 'Cloud Storage on AWS',
					Url: 'https://aws.amazon.com/products/storage/',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF_3_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'performance',
		QuestionId: 'PERF_3',
		QuestionTitle:
			'How do you define and test storage performance requirements?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Cloud storage is a critical component of cloud computing, holding the information used by your workload. Cloud storage is typically more reliable, scalable, and secure than traditional on-premises storage systems. Select from object, block, and file storage services as well as cloud data migration options for your workload.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/framework/perf-storage.html',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Evaluate and select a storage architecture that meets your business requirements.',
			QuestionId: 'PERF_3',
			QuestionTitle:
				'How do you define and test storage performance requirements?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'REL1_1',
				Title: 'Architect systems for elasticity',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Healthcare applications often have time-based peaks in demand. For example, clinical systems may need to respond to periods of high demand using either time-based or usage-based metrics to define automatic scaling rules. An example of periods of high demand could be daytime business hours or a known event such as open-enrollment for an insurance provider.  Embracing elasticity enables healthcare organizations to right-size performance during all hours of the day while minimizing excess cost. General distributed systems recommendations apply.',
					Url:
						'https://docs.aws.amazon.com/autoscaling/application/userguide/integrated-services-list.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Refer to the following resources to learn more about our best practices related to reliability. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-2.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL1_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'reliability',
		QuestionId: 'REL1',
		QuestionTitle: 'How does your system adapt to changes in demand?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'To achieve reliability, a system must have a well-planned foundation in place, with mechanisms for handling changes in demand or requirements. The system should be designed to detect failure and automatically repair itself. ',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/foundations.html',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Where possible, implement architectures that automatically adapt to changes in demand.',
			QuestionId: 'REL1',
			QuestionTitle: 'How does your system adapt to changes in demand?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'REL2_1',
				Title: 'Architect network connections for redundancy',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Healthcare applications require secure connectivity between the cloud and on-premises resources and users.  Certain healthcare applications are more latency-sensitive than others.  Consider business continuity and disaster recovery network requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/workload-architecture.html',
				},
				ImprovementPlan: {
					DisplayText:
						'AWS Well-Architected - Reliability Pillar: Plan your network topology',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/plan-your-network-topology.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL2_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'reliability',
		QuestionId: 'REL2',
		QuestionTitle:
			'How do you ensure acceptable network availability for your healthcare workloads?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'To achieve reliability, a system must have a well-planned foundation in place, with mechanisms for handling changes in demand or requirements. The system should be designed to detect failure and automatically repair itself. ',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/workload-architecture.html',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'When evaluating your network setup, consider your business continuity and disaster recovery requirements.',
			QuestionId: 'REL2',
			QuestionTitle:
				'How do you ensure acceptable network availability for your healthcare workloads?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC1_1',
				Title:
					'Determine applicable regulatory frameworks and controls as it pertains to data classification',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'It is critical that organizations understand what types of data are being hosted and processed, and where that data resides. This understanding is a basis for ensuring that the right controls are in place for aligning with relevant regulatory frameworks and standards. Data classification also aids in traceability and access monitoring of sensitive data.',
				},
				ImprovementPlan: {
					DisplayText: 'AWS Data Classification whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/data-classification/welcome.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC1_2',
				Title: 'Create and document a data classification strategy',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Based on the business requirements, and any applicable regulatory frameworks, implement a data classification policy. This policy should extend beyond simply marking health data, but should include other sensitive or confidential data, as well as public data. The Data Classification: Secure Cloud Adoption whitepaper provides examples of how to categorize data, and how to implement a data classification strategy that implements the appropriate controls based on the data category.  Make sure that health data is classified in accordance with the proper regulatory frameworks that your business aligns to. ',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/data-classification/welcome.html',
				},
				ImprovementPlan: {
					DisplayText: 'AWS Data Classification whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/data-classification/welcome.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC1_3',
				Title:
					'Select the appropriate cloud deployment model according to your needs, the type of data you handle, and the assessed risk',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'As outlined in the Data Classification: Secure Cloud Adoption whitepaper, select the appropriate cloud deployment model according to your specific needs, the type of data you handle, and the assessed risk. Depending on the classification of the data, apply the relevant security controls (such as encryption) within your cloud environment. AWS also recommends that health data be classified and labeled as such, simplifying audits and ensuring that the proper technical controls can be implemented.  If your environment uses multiple AWS accounts, designate specific accounts to host and process health data to simplify managing where health data is located. For example, if your account structure mirrors your software development lifecycle with accounts designated for development, testing, staging, and production, the production and staging accounts may be designated as “health data” accounts and are therefore documented as containing health data. Then, implement procedures and controls in the development and testing accounts to prevent health data from being stored there. ',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/data-classification/welcome.html',
				},
				ImprovementPlan: {
					DisplayText: 'AWS Data Classification whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/data-classification/welcome.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC1_4',
				Title: 'Implement automated data classification',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use an automated system to detect and classify data.  For example, Amazon Macie is a fully managed data security service that can help you identify sensitive data residing in Amazon S3. Macie automates the discovery of sensitive data, such as personally identifiable information (PII), to provide you with a better understanding of the data that your organization stores in Amazon S3.',
					Url:
						'https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html',
				},
				ImprovementPlan: {
					DisplayText: 'AWS Data Classification whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/data-classification/welcome.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC1_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC1',
		QuestionTitle:
			'How do you identify where health data is in your environment?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Organizations should understand what types of data are being hosted and processed, and where that data resides.',
			QuestionId: 'SEC1',
			QuestionTitle:
				'How do you identify where health data is in your environment?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC2_1',
				Title:
					'Use identity and access management to control access to systems, resources, and data',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use AWS Identity and Access Management to control access to AWS services and resources. Use IAM to control who is authenticated to the environment and who is authorized to use services and resources.  Health data on the cloud is typically stored in databases, file systems, and object storage services. The optimal storage service is determined by the data type (for example, structured vs. unstructured) and access patterns required by the workload.  For each data store, use a combination of IAM permissions and any additional authorization methods to secure stored health data.',
					Url:
						'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
				},
				ImprovementPlan: {
					DisplayText: 'AWS Identity & Access Management (IAM) best practices',
					Url:
						'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC2_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC2',
		QuestionTitle:
			'How are you implementing least privilege access to health data?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'The ability to access health data should be limited to the people or systems who require the access to perform specific tasks.',
			QuestionId: 'SEC2',
			QuestionTitle:
				'How are you implementing least privilege access to health data?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC3_1',
				Title:
					'Log access to systems, resources, and data in accordance with your policies and procedures',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'If your workload hosts health data, then under the Architecting for HIPAA Security and Compliance on Amazon Web Services whitepaper you must implement and maintain logging of access to that data in accordance with the regulatory frameworks applicable to your workload.',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/architecting-hipaa-security-and-compliance-on-aws/auditing-back-ups-and-disaster-recovery.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Architecting for HIPAA Security and Compliance on Amazon Web Services whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/architecting-hipaa-security-and-compliance-on-aws/auditing-back-ups-and-disaster-recovery.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC3_2',
				Title: 'Configure audit logs to be centralized and immutable',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Configure logging to save to a centralized location and the logs made immutable to verify their integrity in the event of a forensic requirement. Prevent modification of log data by creating an AWS account in your organization that is designated to host audit logs and implement strict authorization rules. AWS audit and logging services, such as CloudWatch and CloudTrail, can save logs to a central location, yielding one set of logs that encompass an entire IT environment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/detective-controls.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Refer to the following resources to learn more about our best practices for security. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-1.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC3_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC3',
		QuestionTitle: 'How are you logging access to health data?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'If your workload hosts health data you should implement and maintain logging of access to that data in accordance with the regulatory frameworks applicable to your workload.',
			QuestionId: 'SEC3',
			QuestionTitle: 'How are you logging access to health data?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC4_1',
				Title:
					'Create, document, and follow a policy and procedure to regularly review audit logs',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'In addition to the creation and documentation of an audit log review policy and procedure, organizations who are auditing access to health data should also have systems and procedures in place to review the audit logs on a regular basis. Facilitate audits by collecting all logs in a centralized location. For example, AWS CloudTrail can be configured to deliver logs from multiple accounts to a single Amazon S3 bucket. This provides both an easier location allowing regular review of the logs, while limiting the scope of access required for the reviewer by limiting them to a single location rather than multiple accounts. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/detective-controls.html',
				},
				ImprovementPlan: {
					DisplayText: 'Logging AWS CloudTrail Insights events for trails',
					Url:
						'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-insights-events-with-cloudtrail.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC4_2',
				Title: 'Automate alerts for potential anomalies detected in logs',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Additionally, use automated systems that will generate alerts if anomalies are detected in logs.  For example, create CloudWatch alarms based on anomaly detection that uses previously recorded metrics to create a model of expected results.  You can also use the Amazon OpenSearch Service to detect anomalies in logs. Enable CloudTrail Insights to detect unusual operational activity that is recorded in your CloudTrail audit logs. Review all applicable regulatory frameworks and standards and ensuring the specific requirements are being met.  Configure all alarms to be received by an identified owner, ensuring that the alarm is acknowledged, triaged, and actioned. Finally, create and follow a procedure that outlines a regular cadence to review all automation configurations for continued accuracy, sufficiency, and relevance of the alerts. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/detective-controls.html',
				},
				ImprovementPlan: {
					DisplayText: 'Create a CloudWatch alarm based on anomaly detection',
					Url:
						'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Create_Anomaly_Detection_Alarm.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC4_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC4',
		QuestionTitle: 'How often do you review audit logs?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'In addition to the creation and documentation of an audit log review policy and procedure, organizations who are auditing access to health data should also have systems and procedures in place to review the audit logs on a regular basis',
			QuestionId: 'SEC4',
			QuestionTitle: 'How often do you review audit logs?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC5_1',
				Title:
					'Implement security controls necessary to protect the infrastructure within the AWS account',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Security controls are the technical or administrative mechanisms you put in place to implement the standards. All security controls map to standards, but not all standards map to security controls. Testing of security controls is designed to monitor and measure whether you are effectively meeting the defined standards.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html',
				},
				ImprovementPlan: {
					DisplayText: 'Security Pillar - AWS Well-Architected Framework',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC5_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC5',
		QuestionTitle: 'How does your organization protect critical systems?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Follow Well-Architected best practices for infrastructure protection when designing and managing your transactional systems of record.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/infrastructure-protection.html',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Follow Well-Architected best practices for infrastructure protection when designing and managing your transactional systems of record.',
			QuestionId: 'SEC5',
			QuestionTitle: 'How does your organization protect critical systems?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC6_1',
				Title:
					'Determine applicable regulatory frameworks and controls as it pertains to data locality',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Begin by reviewing these requirements within any applicable regulatory frameworks.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/data-protection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Learn more about considerations when determining applicable regulatory frameworks',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/data-protection.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC6_2',
				Title: 'Enforce data locality requirements by implementing controls',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Once the determination of requirements has been made and documented, technical controls can be put in place to enforce them. ',
					Url:
						'http://aws.amazon.com/about-aws/whats-new/2021/11/aws-control-tower-controls-data-residency-requirements/',
				},
				ImprovementPlan: {
					DisplayText:
						'AWS Control Tower now provides controls to meet data residency requirements',
					Url:
						'http://aws.amazon.com/about-aws/whats-new/2021/11/aws-control-tower-controls-data-residency-requirements/',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC6_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC6',
		QuestionTitle:
			'How do you determine and enforce data residency requirements?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Many healthcare organizations fall under data locality requirements or regulations on where data may be physically located.',
			QuestionId: 'SEC6',
			QuestionTitle:
				'How do you determine and enforce data residency requirements?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC7_1',
				Title:
					'Encrypt sensitive health data at rest and in transit at all times',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Protect all sensitive data stored and transmitted within a cloud environment with AWS encryption services. The AWS Business Associate Addendum (BAA), applicable to customers who align with the Health Insurance Portability and Accountability Act (HIPAA), requires the encryption of protected health information (PHI) as defined by HIPAA at rest and in transit. Encryption at rest and in transit may be required by other applicable frameworks. ',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/logical-separation/encrypting-data-at-rest-and--in-transit.html',
				},
				ImprovementPlan: {
					DisplayText: 'Encrypting Data-at-Rest and Data-in-Transit',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/logical-separation/encrypting-data-at-rest-and--in-transit.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC7_2',
				Title:
					'Implement encryption controls as part of the infrastructure architecture',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use infrastructure as code to declare encryption as a configuration when creating an environment template. Use alerts and automated remediation, where possible, with AWS Config that can detect when a resource is not configured to use encryption. Where automated remediation is not available, verify that alerts are generated and sent to the appropriate parties. ',
					Url:
						'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/data-protection.html',
				},
				ImprovementPlan: {
					DisplayText: 'Data protection in Amazon EC2',
					Url:
						'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/data-protection.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC7_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC7',
		QuestionTitle: 'How are you protecting health data at rest and in transit?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Protect all sensitive data stored and transmitted within a cloud environment with encryption services.',
			QuestionId: 'SEC7',
			QuestionTitle:
				'How are you protecting health data at rest and in transit?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC8_1',
				Title: 'Isolate health data from non-health data',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Organizations working with health data should take steps to isolate and segment health data from non-health data. In conjunction with the recommendations around data discovery and classification, it is important to separate health data so the organization can implement the necessary technical and administrative controls. ',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Organizing Your AWS Environment Using Multiple Accounts AWS whitepaper',
					Url:
						'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC8_2',
				Title: 'Limit access to health data',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'It is also important to limit access to health data within an account. Use resource isolation, such as designated Amazon S3 buckets, to separate health data from non-health data. Resource isolation can also be used to isolate tenants and tenant-specific data. Resource isolation and tenant isolation reinforce the benefits to account isolation, limiting access to sensitive data to only the people and systems that require it, without unnecessarily blocking access to less sensitive data. Refer to the Security pillar section of the Well-Architected Framework SaaS Lens for additional recommendations on tenant isolation. ',
					Url:
						'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html',
				},
				ImprovementPlan: {
					DisplayText:
						'AWS Identity & Access Management documentation: IAM Condition policy elements',
					Url:
						'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC8_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC8',
		QuestionTitle: 'How do you isolate sensitive data?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Organizations working with health data should take steps to isolate and segment health data from non-health data.',
			QuestionId: 'SEC8',
			QuestionTitle: 'How do you isolate sensitive data?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SEC9_1',
				Title:
					'Mitigate and respond to potential incidents by creating policies, procedures, and playbooks',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Healthcare, and heath data, are valuable targets for malicious actors. Create policies, procedures, and playbooks designed to respond to and mitigate the potential impact of a security event or natural disaster. This includes exercises that practice the response to a simulated incident using the defined policies, procedures, and playbooks to prepare your organization. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/incident-response.html',
				},
				ImprovementPlan: {
					DisplayText:
						'AWS Well-Architected - Security Pillar: Incident response',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/incident-response.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC9_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'security',
		QuestionId: 'SEC9',
		QuestionTitle: 'What is your disaster recovery for critical systems?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Create policies, procedures, and playbooks designed to respond to and mitigate the potential impact of a security event or natural disaster.',
			QuestionId: 'SEC9',
			QuestionTitle: 'What is your disaster recovery for critical systems?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SUS1_1',
				Title: 'Identify on-premises workloads that can be moved to the cloud',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Migrating workloads from on-premises data centers to the cloud can reduce the carbon footprint of the workload by 88%.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/best-practices-for-sustainability-in-the-cloud.html',
				},
				ImprovementPlan: {
					DisplayText: 'AWS Well-Architected Framework - Sustainability Pillar',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sustainability-pillar.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS1_2',
				Title:
					'Regular review of cloud architecture for optimization opportunities can reduce carbon footprints',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Continuous optimization of cloud architectures can result in a reduced carbon footprint.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/best-practices-for-sustainability-in-the-cloud.html',
				},
				ImprovementPlan: {
					DisplayText: 'AWS Well-Architected Framework - Sustainability Pillar',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sustainability-pillar.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS1_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'sustainability',
		QuestionId: 'SUS1',
		QuestionTitle:
			'How do you identify targets for sustainability improvement?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Prioritize targets for improvement by reviewing your workloads against the sustainability principles',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/best-practices-for-sustainability-in-the-cloud.html',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'Regular review of cloud architecture for optimization opportunities can reduce carbon footprints as well. ',
			QuestionId: 'SUS1',
			QuestionTitle:
				'How do you identify targets for sustainability improvement?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SUS2_1',
				Title:
					'Scale infrastructure to continually match user demand and performance requirements',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Many healthcare workloads are life-critical, and have steady demand 24 x 7. However, other workloads (such as those supporting ambulatory care delivery or revenue cycle workflows) exhibit cyclical utilization patterns with peak demand during business hours. Minimize the amount of hardware used by scaling workloads down during periods of low demand. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/use-the-minimum-amount-of-hardware-to-meet-your-needs.html',
				},
				ImprovementPlan: {
					DisplayText: 'Scale workload infrastructure dynamically',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a2.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'sustainability',
		QuestionId: 'SUS2',
		QuestionTitle:
			'How do you match workload infrastructure to user behavior patterns?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'Consider cloud-native ways to meet business requirements with an elastic, efficient architecture.',
			QuestionId: 'SUS2',
			QuestionTitle:
				'How do you match workload infrastructure to user behavior patterns?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SUS3_1',
				Title:
					'Analyze demand on workloads to identify components that can be removed or refactored',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Analyze demand on workloads to identify components that can be removed or refactored. Then, engage component owners and stakeholders to redesign clinical workflows, and decrease workload infrastructure',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/remove-or-refactor-workload-components-with-low-or-no-use.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Remove or refactor workload components with low or no use',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_software_a3.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS3_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'sustainability',
		QuestionId: 'SUS3',
		QuestionTitle:
			'Does your organization monitor workload activity and remove or refactor components that are no longer necessary?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'Does your organization monitor workload activity and remove or refactor components that are no longer necessary?',
			QuestionId: 'SUS3',
			QuestionTitle:
				'Does your organization monitor workload activity and remove or refactor components that are no longer necessary?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SUS4_1',
				Title:
					'Evaluate the overall impact of applications, devices, and equipment',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'As new features are released for a healthcare application, build those features as backward compatible, minimizing the need for new hardware.  Additionally, evaluate the potential impact of new or upgraded hardware requirements to minimize the overall impact when architecting new workloads or features. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sustainability-pillar.html',
				},
				ImprovementPlan: {
					DisplayText: 'Optimize impact on customer devices and equipment',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_software_a4.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS4_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'sustainability',
		QuestionId: 'SUS4',
		QuestionTitle:
			'How do you optimize the impact of and applications and the equipment that run them?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'It is recommended to optimize impact on customer devices and equipment.',
			QuestionId: 'SUS4',
			QuestionTitle:
				'How do you optimize the impact of and applications and the equipment that run them?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SUS5_1',
				Title:
					'Quantify and report results to drive continuous improvement processes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The healthcare vertical extensively uses metrics and measures to quantify care quality, effectiveness, and patient experience. Adding metrics to quantify sustainability improvement can better align business interests with sustainability goals. Further, analysis of such reporting can help identify repeatable processes for achieving sustainability improvements. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/measure-results.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Refer to the following resources to learn more about our best practices related to sustainability.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/healthcare-industry-lens/resources-5.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS5_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'sustainability',
		QuestionId: 'SUS5',
		QuestionTitle:
			'How does your organization measure the effectiveness of sustainability efforts?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'Adding metrics to quantify sustainability improvement can better align business interests with sustainability goals.',
			QuestionId: 'SUS5',
			QuestionTitle:
				'How does your organization measure the effectiveness of sustainability efforts?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'SUS6_1',
				Title:
					'Automate data retention processes that retain the minimum amount of health data required to meet requirements',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Regulatory requirements may impose data retention periods on healthcare providers and ISVs. However, it is common for health data to be retained in perpetuity, well beyond its useful life.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/remove-unneeded-or-redundant-data.html',
				},
				ImprovementPlan: {
					DisplayText: 'Remove unneeded or redundant data',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a6.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS6_no',
				Title: 'None of these',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose this if your workload does not follow these best practices.',
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
		PillarId: 'sustainability',
		QuestionId: 'SUS6',
		QuestionTitle:
			'How does your organization remove unneeded or redundant health data?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/healthcare',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'Begin by reviewing and classifying data in line with your business and regulatory requirements, such as how long health data records must be retained.',
			QuestionId: 'SUS6',
			QuestionTitle:
				'How does your organization remove unneeded or redundant health data?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
];
export default questions;
