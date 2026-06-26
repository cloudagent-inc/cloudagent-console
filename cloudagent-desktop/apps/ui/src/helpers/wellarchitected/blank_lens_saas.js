const questions = [
	{
		QuestionId: 'cost_q1',
		PillarId: 'costOptimization',
		QuestionTitle:
			'How do you measure the resource consumption of individual tenants?',
		Choices: [
			{
				ChoiceId: 'cost_cost_q1_a1',
				Title: 'Approximate tenant consumption',
				Description:
					'A simple metric (for example, number of requests) is used to create an approximate allocation of consumption for each tenant. Manual processes are used to correlate this tenant allocation with your AWS bill to arrive at a rough estimate of the cost per tenant.',
			},
			{
				ChoiceId: 'cost_cost_q1_a3',
				Title:
					'Use tenant consumption insights to shape operational and architectural efficiency',
				Description:
					'Tenant consumption data is used to provide actionable insights to operational and architecture teams, enabling them to introduce policies and strategies that can enhance to analyze and improve the efficiency of a multi-tenant system.',
			},
			{
				ChoiceId: 'cost_cost_q1_a2',
				Title: 'Build a rich view of tenant consumption',
				Description:
					'The consumption of the application’s individual resources is metered and attributed to each tenant. This data is aggregated and used to create a detailed estimate of tenant consumption.',
			},
			{
				ChoiceId: 'cost_cost_q1_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'cost_q1',
				PillarId: 'costOptimization',
				QuestionTitle:
					'How do you measure the resource consumption of individual tenants?',
				QuestionDescription:
					'Attribute infrastructure consumption to the individual tenants of your system. Surface metrics that can be used to profile the activity and consumption patterns of tenants, gathering enough insight to be able to approximate and calculate the infrastructure footprint of each tenant that is using your SaaS application. ',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.cost_q1.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'cost_q2',
		PillarId: 'costOptimization',
		QuestionTitle:
			'How are you correlating tenant consumption with the costs of your infrastructure?',
		Choices: [
			{
				ChoiceId: 'cost_cost_q2_a1',
				Title: 'Manually aggregate and correlate consumption with costs',
				Description:
					'Tools are used to manually collect and aggregate cost data for a period. The data is summarized for services and correlated with a tenant consumption data to calculate a cost-per-tenant.',
			},
			{
				ChoiceId: 'cost_cost_q2_a2',
				Title: 'Use automation to correlate tenant consumption with AWS costs',
				Description:
					'An automated mechanism acquires cost data from AWS or third-party tools, and correlates this data with tenant consumption allocations to determine the cost per tenant.',
			},
			{
				ChoiceId: 'cost_cost_q2_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'cost_q2',
				PillarId: 'costOptimization',
				QuestionTitle:
					'How are you correlating tenant consumption with the costs of your infrastructure?',
				QuestionDescription:
					'Correlate tenant consumption data with infrastructure costs to calculate the cost per tenant. The goal is to provide your business and technology teams with an ongoing view of how tenant load and architecture choices are influencing the overall cost profile of your SaaS application. ',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.cost_q2.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'ops_q1',
		PillarId: 'operationalExcellence',
		QuestionTitle:
			'How do you effectively monitor and manage the operational health of a multi-tenant environment?',
		Choices: [
			{
				ChoiceId: 'ops_ops_q1_a1',
				Title: 'Include tenant context into application logs',
				Description:
					'Operational tools aggregate log activity, enabling operations teams to inspect the health and activity of the system, individual tenants, and tenant tiers.',
			},
			{
				ChoiceId: 'ops_ops_q1_a3',
				Title:
					'Use purpose-built, tenant-aware tools to enable proactive management of tenant workloads',
				Description:
					'Use tools to provide detailed tenant operational data to enable operations teams to analyze and evaluate activity, consumption, and health through the lens of tenants and tiers. These tools enable the implementation of proactive policies and alarms.',
			},
			{
				ChoiceId: 'ops_ops_q1_a2',
				Title: 'Collect detailed tenant insights',
				Description:
					'Instrumentation is added to the SaaS application, enabling it to emit a collection of detailed tenant insights that enable detailed operational analysis of tenant activity, health, and consumption trends. Operations teams leverage business intelligence (BI) tools to analyze this tenant-infused data.',
			},
			{
				ChoiceId: 'ops_ops_q1_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'ops_q1',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How do you effectively monitor and manage the operational health of a multi-tenant environment?',
				QuestionDescription:
					'Multi-tenant environments rely on robust operational tools that enable tenant-aware views into the overall activity and health of their systems. By adding tenant consumption, activity, and health trends to the system’s operational experience, SaaS teams are able to more effectively capture, profile, and assess the health trends of tenant and tenant tiers. ',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.ops_q1.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'ops_q2',
		PillarId: 'operationalExcellence',
		QuestionTitle:
			'How are you capturing and surfacing metric data that can be used to analyze the usage and consumption trends of individual tenants?',
		Choices: [
			{
				ChoiceId: 'ops_ops_q2_a1',
				Title: 'Capture low fidelity tenant activity metrics',
				Description:
					'Use packaged frameworks and tools that can capture and surface readliy available application and system insights with minimal instrumentation, injecting tenant context where possible.',
			},
			{
				ChoiceId: 'ops_ops_q2_a3',
				Title: 'Create a complete view of tenant consumption',
				Description:
					'The SaaS application is fully instrumented with metrics that capture a range of tenant activity, feature usage, and resource consumption events. These metrics enable product managers, architects, and operations teams to build analytics views of this data to drive technical and business decisions.',
			},
			{
				ChoiceId: 'ops_ops_q2_a2',
				Title:
					'Instrument high-value workflows of the system with tenant-aware metrics',
				Description:
					'Targeted, high-value areas of the system are instrumented with metrics that provide insights on workflows and use cases that are essential to understanding the customer experience and consumption patterns of these high-value targets. Use analytics tools to analyze and surface operationally significant data.',
			},
			{
				ChoiceId: 'ops_ops_q2_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'ops_q2',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How are you capturing and surfacing metric data that can be used to analyze the usage and consumption trends of individual tenants?',
				QuestionDescription:
					'Publish and aggregate tenant-aware metric data from your SaaS environment, making it available to a range of roles within a SaaS organization. This will provide immediate access to key usage and activity trends that are essential both business and technical teams. This data is used to shape architecture strategies, pricing models, product roadmaps, and operational efficiency.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.ops_q2.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'ops_q3',
		PillarId: 'operationalExcellence',
		QuestionTitle: 'How are new tenants onboarded to your system?',
		Choices: [
			{
				ChoiceId: 'ops_ops_q3_a1',
				Title: 'Use manually triggered scripts to provision tenants',
				Description:
					'All the steps required to onboard a new tenant are performed through one or more automated scripts that provision all the elements of the tenant footprint (infrastructure, tenant, admin user, etc.). ',
			},
			{
				ChoiceId: 'ops_ops_q3_a3',
				Title:
					'Provide a fully automated, self-service user experience that configures and executes tenant provisioning',
				Description:
					'Users (internal or customers) complete a registration form that collects all of their configuration data before launching the onboarding process. This process executes the onboarding steps needed to introduce a new tenant into the system.',
			},
			{
				ChoiceId: 'ops_ops_q3_a2',
				Title: 'Use a single automated process to onboard tenants',
				Description:
					'Onboarding of a new tenant is triggered and executed by a single automation process that runs end-to-end without manual intervention. ',
			},
			{
				ChoiceId: 'ops_ops_q3_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'ops_q3',
				PillarId: 'operationalExcellence',
				QuestionTitle: 'How are new tenants onboarded to your system?',
				QuestionDescription:
					'Use an automated, predictable process is used to introduce new tenants into your system. This would cover all the steps required to introduce a new tenant, including the provisioning of infrastructure, a tenant, a user identity, isolation policies, billing, and any tenant configuration. Reducing friction here promotes operational efficiency and organizational agility.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.ops_q3.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'ops_q4',
		PillarId: 'operationalExcellence',
		QuestionTitle:
			'How do you support the need for tenant-specific customizations?',
		Choices: [
			{
				ChoiceId: 'ops_ops_q4_a1',
				Title: 'Use feature flags to manage tenant variations',
				Description:
					'Support feature and functional variations through the introduction of flags that are enabled and disabled on a tenant-by-tenant basis.',
			},
			{
				ChoiceId: 'ops_ops_q4_a2',
				Title:
					'Support unique tenant requirements via shared application customizations',
				Description:
					'Address any need for variation through the introduction of generalized application customization constructs that are configured as part of the tenant configuration process.',
			},
			{
				ChoiceId: 'ops_ops_q4_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'ops_q4',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How do you support the need for tenant-specific customizations?',
				QuestionDescription:
					'SaaS businesses rely on the operational efficiency of managing and operating all customers through a single pane of glass. To maintain their agility and efficiency, SaaS organizations will introduce all customization through a universal mechanism that is available to all tenants, eliminating the need to deploy and manage separate environments or versions for each tenant.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.ops_q4.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'perf_q1',
		PillarId: 'performance',
		QuestionTitle:
			'How do you prevent one tenant from adversely impacting the experience of another tenant?',
		Choices: [
			{
				ChoiceId: 'perf_perf_q1_a1',
				Title: 'Silo high demand tenant resources',
				Description:
					'Identify the potential bottlenecks in your system that might create noisy neighbor conditions and distribute these into separate siloes. The separation can happen across layers of your architecture, including compute, storage, messaging, and so on. Siloes should only be introduced at the layer that represents the bottleneck of the experience.',
			},
			{
				ChoiceId: 'perf_perf_q1_a4',
				Title:
					'Decompose and deploy services in a pattern that aligns tenant loads with performance expectations',
				Description:
					'The design of your SaaS system has accounted for common usage scenarios, examined potential bottlenecks, and partitioned resources to ensure that the load is effectively distributed. You have aligned scaling behavior with the consumption profiles of tenants. ',
			},
			{
				ChoiceId: 'perf_perf_q1_a2',
				Title:
					'Combine tenant-aware policies with added capacity to address tenant spikes',
				Description:
					'Tenant-aware policies are used to identify potential spikes in tenant activity that could adversely impact performance. These policies are combined with a capacity strategy that adds scaling “cushion” to help ensure that scaling delays don’t impact tenant performance.',
			},
			{
				ChoiceId: 'perf_perf_q1_a3',
				Title:
					'Use throttling policies to prevent individual tenants from placing excess load on the system',
				Description:
					'Introduce throttling policies that evaluate the activity trends of individual tenants and uses SLAs and their tier and plan to prevent saturation of one or more experiences in the system. Prevent lower tier tenants from impacting the performance of higher tier tenants.',
			},
			{
				ChoiceId: 'perf_perf_q1_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'perf_q1',
				PillarId: 'performance',
				QuestionTitle:
					'How do you prevent one tenant from adversely impacting the experience of another tenant?',
				QuestionDescription:
					'Introduce scaling and throttling constructs to help ensure that no single tenant can put load on the system in a way that impacts the performance and experience of other tenants.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.perf_q1.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'perf_q2',
		PillarId: 'performance',
		QuestionTitle:
			'How do you ensure that consumption of infrastructure resources aligns with the activity and workloads of tenants?',
		Choices: [
			{
				ChoiceId: 'perf_perf_q2_a1',
				Title: 'Use tenant profile data to configure static scaling policies',
				Description:
					'Use logs and profiling data to analyze tenant loads and periodically configure infrastructure scaling policies based on historical consumption trends. ',
			},
			{
				ChoiceId: 'perf_perf_q2_a3',
				Title: 'Scale based on application-generated tenant insights',
				Description:
					'SaaS specific metric data is captured, aggregated, and used (along with other metrics) to build a robust multi-tenant scaling strategy that minimizes the over-provisioning of resources in based on live workloads.',
			},
			{
				ChoiceId: 'perf_perf_q2_a2',
				Title:
					'Build dynamic tenant scaling policies around standard AWS metrics',
				Description:
					'Rely on the readily accessible AWS infrastructure metrics to define a series of policies that approximate tenant consumption activity. Use these metrics to build policies that move you closer to aligning tenant activity with resource consumption. ',
			},
			{
				ChoiceId: 'perf_perf_q2_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'perf_q2',
				PillarId: 'performance',
				QuestionTitle:
					'How do you ensure that consumption of infrastructure resources aligns with the activity and workloads of tenants?',
				QuestionDescription:
					'Create a scaling strategy where the infrastructure footprint of a SaaS application closely mirrors the continually evolving profile of the tenant and the tenant’s workload. The requires rich insights into tenant activity and consumption patterns to construct a scaling model that efficiently scales without over-provisioning resources, which is critical to SaaS businesses.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.perf_q2.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'perf_q3',
		PillarId: 'performance',
		QuestionTitle:
			'How do you enable varying levels of performance for the different tenant tiers and plans?',
		Choices: [
			{
				ChoiceId: 'perf_perf_q3_a1',
				Title: 'Apply throttling to lower tier tenants',
				Description:
					'The performance of lower tier tenants is constrained to enhance the performance and experience for premium tier tenant. These constraints might motivate tenants to move to higher tiers to achieve better performance for key functional aspects of the system.',
			},
			{
				ChoiceId: 'perf_perf_q3_a3',
				Title: 'Optimize the experience for different tenant tiers',
				Description:
					'The services of your application are decomposed and deployed around tiers, offering siloed or optimized experiences for workflows that impose heavy load or require optimal throughput.',
			},
			{
				ChoiceId: 'perf_perf_q3_a2',
				Title:
					'Use policies to shape application performance for each tenant tier',
				Description:
					'Introduce constructs to manage and apply tier-based performance policies across the key workflows and use cases of your application. These policies define a more internal and external performance SLAs that are used to define the experience of each SaaS tier and plan.',
			},
			{
				ChoiceId: 'perf_perf_q3_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'perf_q3',
				PillarId: 'performance',
				QuestionTitle:
					'How do you enable varying levels of performance for the different tenant tiers and plans?',
				QuestionDescription:
					'Provide different performance experiences to tenants based on their assigned tier and plan, providing higher levels of performance to premium tier tenants. This means introducing architecture strategies that allow you to enable varying level of performance within a single, shared multi-tenant environment.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.perf_q3.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'rel_q1',
		PillarId: 'reliability',
		QuestionTitle:
			'How do you limit an individual tenant’s ability to impose load that may impact availability for other tenants of your system?',
		Choices: [
			{
				ChoiceId: 'rel_rel_q1_a1',
				Title:
					' Use throttling policies to limit the effect that noisy tenants have on the system',
				Description:
					'Define strategies for capturing and identifying tenants that are imposing excess load on the system that might not be supported at scale. Apply throttling policies to help ensure that these noisy neighbor tenants do not impact the availability of the other tenants of your system.',
			},
			{
				ChoiceId: 'rel_rel_q1_a3',
				Title: 'Partition tenant load to limit the area of effect',
				Description:
					'Identify partitioning strategies that can effectively distribute or isolate tenant loads, enabling the resources (compute, storage, etc.) to effectively limit access, scale, and distribute spikey tenant loads.',
			},
			{
				ChoiceId: 'rel_rel_q1_a2',
				Title: 'Define SLAs for each tenant tier',
				Description:
					'Limit the area of effect of lower tier tenants by introducing SLAs that are configured for each tenant tier supported by your system. Use SLAs as part of a throttling strategy to tightly control the level of activity and load a tenant can place on the system.',
			},
			{
				ChoiceId: 'rel_rel_q1_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'rel_q1',
				PillarId: 'reliability',
				QuestionTitle:
					'How do you limit an individual tenant’s ability to impose load that may impact availability for other tenants of your system?',
				QuestionDescription:
					'Identify tenants that are consuming resources at a rate that could undermine the overall stability and availability of your system. Use this data and or/scaling policies to limit the load these tenants can place on the system to prevent a large-scale outage, which could cascade across all tenants of your system.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.rel_q1.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'rel_q2',
		PillarId: 'reliability',
		QuestionTitle: 'How do you proactively detect and maintain tenant health?',
		Choices: [
			{
				ChoiceId: 'rel_rel_q2_a1',
				Title:
					'Add tenant context to application logs to reactively manage tenant health',
				Description:
					'Log files are enriched with tenant context and analyzed by operations teams to reactively identify and troubleshoot reliability issues. Tenant context is used to identify specific tenant activity that might be contributing to system or tenant stability or availability issues.',
			},
			{
				ChoiceId: 'rel_rel_q2_a3',
				Title: 'Proactively identify tenant issues with policies and alarms',
				Description:
					'Combine rich tenant insights with policies to proactively surface tenant issues before they impact the stability or availability of the environment. These policies might invoke self-healing strategies for individual tenant and surface alerts and alarms.',
			},
			{
				ChoiceId: 'rel_rel_q2_a2',
				Title: 'Introduce detailed tenant insights to enhance health forensics',
				Description:
					'Publish detailed tenant activity, consumption, performance, and error data to a centralized repository that can be used to analyze health issues impacting reliability. Use this data to identify challenging multi-tenant reliability events. ',
			},
			{
				ChoiceId: 'rel_rel_q2_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'rel_q2',
				PillarId: 'reliability',
				QuestionTitle:
					'How do you proactively detect and maintain tenant health?',
				QuestionDescription:
					'Managing the reliability of a SaaS environment requires operational tools that can detect issues that might impact the availability or experience of individual tenants. A resilient SaaS environment supports tenant-aware operations that enable proactive detection and resolution of tenant and system health issues.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.rel_q2.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'rel_q3',
		PillarId: 'reliability',
		QuestionTitle:
			'How are you testing the multi-tenant capabilities of your SaaS application?',
		Choices: [
			{
				ChoiceId: 'rel_rel_q3_a1',
				Title: 'Validate “noisy neighbor” scale and availability',
				Description:
					'Test various noisy neighbor conditions, assessing the system’s ability to identify and respond to scenarios where a subset of tenants places a disproportionate load on your system. Develop a suite of tests that assess the system’s ability to apply scaling, throttling, and tiering policies for a range of tenant tiers and profiles.',
			},
			{
				ChoiceId: 'rel_rel_q3_a5',
				Title: 'Validate tenant isolation',
				Description:
					'Simulate interactions with your system to help ensure that the tenant isolation policies and practices are being successfully applied. Include tests that examine scenarios where a developer’s multi-tenant code could unintentionally cross a tenant boundary.',
			},
			{
				ChoiceId: 'rel_rel_q3_a2',
				Title: 'Exercise key workflows under multi-tenant load',
				Description:
					'Identify a range of workflows that might be key to your customer experience, implementing tests that validate your system’s ability to support SLAs under multi-tenant load. Assess the system’s stability as tenants place a mix of loads at varying levels of tenant activity.',
			},
			{
				ChoiceId: 'rel_rel_q3_a3',
				Title: 'Validate the scale and repeatability of tenant onboarding',
				Description:
					'Ensure that your tenant onboarding experience can reliably and repeatably onboard tenants with varying patterns and configurations. Verify that the onboarding process continues to meet target SLAs.',
			},
			{
				ChoiceId: 'rel_rel_q3_a4',
				Title:
					'Ensure that tenancy configuration changes are successfully propagated',
				Description:
					'Validate that the system is correctly applying and propagating changes to tenant billing accounts. Changes to account state, such as status and tier, must be shared between the billing system and your SaaS environment. Tests must validate that synchronization of this state is successfully processed.',
			},
			{
				ChoiceId: 'rel_rel_q3_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'rel_q3',
				PillarId: 'reliability',
				QuestionTitle:
					'How are you testing the multi-tenant capabilities of your SaaS application?',
				QuestionDescription:
					'Introduce automated testing that exercises and validates use cases specific to multi-tenant workloads. Focus on simulating tenant workloads and user experiences that are essential to the stability of your multi-tenant architecture.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.rel_q3.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'sec_q1',
		PillarId: 'security',
		QuestionTitle:
			'How are you associating tenant context with users and applying that context within your SaaS architecture?',
		Choices: [
			{
				ChoiceId: 'sec_sec_q1_a1',
				Title: 'Use application services to generate a unified SaaS identity',
				Description:
					'SaaS application services map users to tenants, yielding a single representation of the user/tenant identity that can be passed to downstream services.',
			},
			{
				ChoiceId: 'sec_sec_q1_a3',
				Title:
					'Create libraries and frameworks that apply tenant context outside the view of developers',
				Description:
					'The details of tenant context are hidden from developers through the introduction of libraries and frameworks that own responsibility for extracting and applying the tenant context that is passed into each service.',
			},
			{
				ChoiceId: 'sec_sec_q1_a2',
				Title: 'Use an identity provider to bind users to tenants',
				Description:
					'An identity provider manages both user and tenant data, enabling a single authentication experience to return a representation that includes the union of these two concepts. This unified representation is conveyed to all services, eliminating the need to resolve tenant context via separate services.',
			},
			{
				ChoiceId: 'sec_sec_q1_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sec_q1',
				PillarId: 'security',
				QuestionTitle:
					'How are you associating tenant context with users and applying that context within your SaaS architecture?',
				QuestionDescription:
					'A SaaS architecture must successfully connect a user’s identity with the identity of their tenant. This SaaS identity must be attached to all of their interactions with a SaaS environment, allowing you to resolve and apply this context across all the services of your application without introducing overhead that could undermine the performance of your system.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.sec_q1.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'sec_q2',
		PillarId: 'security',
		QuestionTitle:
			'How are you ensuring that tenant resources are protected from cross-tenant access?',
		Choices: [
			{
				ChoiceId: 'sec_sec_q2_a1',
				Title:
					'Use coarse-grained constructs, application-enforced policies, or both',
				Description:
					'Some applications might use more coarse-grained constructs, such as accounts or VPCs, to isolate tenant resources. Access to more fine-grained or shared infrastructure resources are controlled through application-enforced policies.',
			},
			{
				ChoiceId: 'sec_sec_q2_a2',
				Title: 'Apply a combination of IAM and application-enforced policies',
				Description:
					'AWS Identity and Access Management (IAM) policies are used to restrict access to those tenant resources that can be isolated by IAM roles and policies. Application-enforced policies protect resources that cannot be expressed by IAM policies. ',
			},
			{
				ChoiceId: 'sec_sec_q2_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'softwareasaservice',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sec_q2',
				PillarId: 'security',
				QuestionTitle:
					'How are you ensuring that tenant resources are protected from cross-tenant access?',
				QuestionDescription:
					'Create isolation boundaries between the tenants of your system, ensuring that tenants are not able to access the resources of another tenant. Use AWS accounts, network constructs, microservice decomposition, and policies to define and enforce these boundaries.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/softwareasaservice/softwareasaservice.sec_q2.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
];

export default questions;
