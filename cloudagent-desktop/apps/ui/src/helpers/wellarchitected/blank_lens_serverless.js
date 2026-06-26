const questions = [
	{
		QuestionId: 'cost_q1',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you optimize your Serverless application’s costs?',
		Choices: [
			{
				ChoiceId: 'cost_cost_q1_a1',
				Title: 'Minimize external calls and function code initialization',
				Description:
					'Functions may call other managed services and third-party APIs to operate as intended. Functions may also use application dependencies that may not be suitable for ephemeral environments. Reviewing and optimizing both can directly impact on value provided per invocation.',
			},
			{
				ChoiceId: 'cost_cost_q1_a2',
				Title: 'Optimize logging output and its retention',
				Description:
					'Review logging level, logging output, and log retention to ensure that they meet your operational needs. This helps prevent unnecessary logging and data retention while ensuring that you have the minimum levels necessary for workload operation.',
			},
			{
				ChoiceId: 'cost_cost_q1_a4',
				Title: 'Use cost-aware usage patterns in code',
				Description:
					'Reduce the time consumed by running functions by eliminating job-polling or task coordination.',
			},
			{
				ChoiceId: 'cost_cost_q1_a3',
				Title: 'Optimize function configuration to reduce cost',
				Description:
					'Functions unit of scale is memory where CPU, Network and I/O are proportionately allocated. Consider benchmarking and reviewing whether you are under/overutilising what your function is allocated to. Benchmark your Lambda function execution with various memory settings as under some conditions the added Memory/CPU may lower the duration and with this new combination reduce the cost of each invocation.',
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
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'cost_q1',
				PillarId: 'costOptimization',
				QuestionTitle:
					'How do you optimize your Serverless application’s costs?',
				QuestionDescription:
					'Design, implement, and optimize your application to maximize value. Asynchronous design patterns and performance practices ensure efficient resource use and directly impact the value per business transaction.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.cost_q1.helpful-resources.en.html',
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
		QuestionTitle: 'How do you evaluate your Serverless application’s health?',
		Choices: [
			{
				ChoiceId: 'ops_ops_q1_a1',
				Title:
					'Understand, analyze, and alert on metrics provided out of the box',
				Description:
					'Each managed service emits metrics out of the box. Establish key metrics for each managed service as the basis for comparison, and for identifying under and over performing . Examples of key metrics include function errors, queue depth, failed state machine executions, and response times.',
			},
			{
				ChoiceId: 'ops_ops_q1_a2',
				Title: 'Use application, business, and operations metrics',
				Description:
					'Identify key performance indicators (KPIs) based on desired business and customer outcomes. Evaluate KPIs to determine workload success and operational health.',
			},
			{
				ChoiceId: 'ops_ops_q1_a3',
				Title:
					'Use distributed tracing and code is instrumented with additional context',
				Description:
					'Instrument your application code to emit information about its status, correlation identifiers, business outcomes, and information to determine transaction flows across your .',
			},
			{
				ChoiceId: 'ops_ops_q1_a4',
				Title: 'Use structured and centralized logging',
				Description:
					'Standardize your application logging to emit operational information about transactions, correlation identifiers, request identifiers across , and business outcomes. Use this information to answer arbitrary questions about the state of your .',
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
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'ops_q1',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How do you evaluate your Serverless application’s health?',
				QuestionDescription:
					'Evaluating your metrics, distributed tracing, and logging gives you insight into business and operational events, and helps you understand which services should be optimized to improve your customer’s experience.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.ops_q1.helpful-resources.en.html',
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
		QuestionTitle: 'How do you approach application lifecycle management?',
		Choices: [
			{
				ChoiceId: 'ops_ops_q2_a1',
				Title:
					'Use infrastructure as code and stages isolated in separate environments',
				Description:
					'Use infrastructure as code and version control to enable tracking of changes and releases. Isolate development and production stages in separate environments. This reduces errors caused by manual processes and helps increase levels of control to gain confidence your workload operates as intended.',
			},
			{
				ChoiceId: 'ops_ops_q2_a4',
				Title: 'Use CI/CD including automated testing across separate accounts',
				Description:
					'Automate build, deployment, testing, and rollback of the  upon KPI and operational alerts. This eases troubleshooting, enables faster remediation and feedback time, and enable automatic and manual rollback/roll-forward should an alert trigger. ',
			},
			{
				ChoiceId: 'ops_ops_q2_a2',
				Title: 'Prototype new features using temporary environments',
				Description:
					'Use infrastructure as code to create temporary environments for new features you may need to prototype, and tear them down as you complete them. Temporary environments allows for higher fidelity when working with managed services, and increase levels of control to gain confidence your workload integrates and operates as intended.',
			},
			{
				ChoiceId: 'ops_ops_q2_a3',
				Title: 'Use a rollout deployment mechanism',
				Description:
					'Use rollout deployment as opposed to all-at-once mechanisms. Rollout deployment can limit application changes to a small set of customers in production gradually while all-at-once is used for non-production systems.',
			},
			{
				ChoiceId: 'ops_ops_q2_a5',
				Title: 'Use configuration management',
				Description:
					'Use configuration management systems to make and track configuration changes. These systems reduce errors caused by manual processes, reduce the level of effort to deploy changes, and help isolate configuration to business logic. ',
			},
			{
				ChoiceId: 'ops_ops_q2_a6',
				Title: 'Review the function runtime deprecation policy',
				Description:
					'AWS provided function runtimes follow official long-term support deprecation policies. Third-party provided runtime deprecation policy may differ from official long-term support. Consider reviewing your runtime deprecation policy and having a mechanism to report on runtimes that if deprecated may affect your workload to operate as intended.',
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
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'ops_q2',
				PillarId: 'operationalExcellence',
				QuestionTitle: 'How do you approach application lifecycle management?',
				QuestionDescription:
					'Adopt lifecycle management approaches that improve the flow of changes to production with higher fidelity, fast feedback on quality, and quick bug fixing. These practices help you rapidly identify, remediate, and limit changes that impact customer experience.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.ops_q2.helpful-resources.en.html',
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
			'How do you optimize your Serverless application’s performance?',
		Choices: [
			{
				ChoiceId: 'perf_perf_q1_a3',
				Title: 'Measure, evaluate, and select optimum capacity units',
				Description:
					'Capacity units can be function memory size, stream shards, database reads/writes request units, API endpoints, etc.',
			},
			{
				ChoiceId: 'perf_perf_q1_a4',
				Title:
					'Integrate with managed services directly over functions when possible',
				Description:
					'Consider using native integration between managed services as opposed to functions when no custom logic or data transformation is required.',
			},
			{
				ChoiceId: 'perf_perf_q1_a1',
				Title: 'Measure and optimize function startup time',
				Description:
					'Evaluate function startup time for both performance and cost.',
			},
			{
				ChoiceId: 'perf_perf_q1_a2',
				Title:
					'Take advantage of concurrency via async and stream-based function invocations',
				Description:
					'Functions can be executed synchronously and asynchronously. A functions’ concurrency model can be better used via asynchronous and stream-based invocations. Queues, streams, or events can be aggregated resulting in more efficient processing time per invocation rather than invocation per request-response approach.',
			},
			{
				ChoiceId: 'perf_perf_q1_a5',
				Title: 'Optimize access patterns and apply caching where applicable',
				Description:
					'Consider caching data that may not need to be frequently up-to-date, and optimize access patterns to only fetch data that is necessary to end users.',
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
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'perf_q1',
				PillarId: 'performance',
				QuestionTitle:
					'How do you optimize your Serverless application’s performance?',
				QuestionDescription:
					'Evaluating and optimizing your Serverless application’s performance based on access patterns, scaling mechanisms, and native integrations allows you to continuously gain more value per transaction.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.perf_q1.helpful-resources.en.html',
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
		QuestionTitle: 'How do you regulate inbound request rates?',
		Choices: [
			{
				ChoiceId: 'rel_rel_q1_a1',
				Title: 'Use throttling to control inbound request rates',
				Description:
					'Use throttling limits to control inbound requests by setting steady-state and burst rates limits.',
			},
			{
				ChoiceId: 'rel_rel_q1_a3',
				Title: 'Use mechanisms to protect non-scalable resources',
				Description:
					'Functions can scale faster than traditional resources, such as relational databases and cache systems. Protect non-scalable resources by adapting fast scaling components to downstream systems throughput.',
			},
			{
				ChoiceId: 'rel_rel_q1_a2',
				Title: 'Use, analyze, and enforce API quotas',
				Description:
					'API quotas limit the maximum number of requests that can be submitted within a specified time interval with a given API key.',
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
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'rel_q1',
				PillarId: 'reliability',
				QuestionTitle: 'How do you regulate inbound request rates?',
				QuestionDescription:
					'Defining, analyzing, and enforcing inbound request rates helps achieve better throughput. Regulation helps you adapt different scaling mechanisms based on customer demand.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.rel_q1.helpful-resources.en.html',
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
		QuestionTitle:
			'How do you build resiliency into your Serverless application?',
		Choices: [
			{
				ChoiceId: 'rel_rel_q2_a1',
				Title: 'Manage transaction, partial, and intermittent failures',
				Description:
					'Transaction failures might occur when components are under high load. Partial failures can occur during batch processing, while intermittent failures might occur due to network or other transient issues.',
			},
			{
				ChoiceId: 'rel_rel_q2_a3',
				Title: 'Manage duplicate and unwanted events',
				Description:
					'Duplicate events can occur when a request is retried, multiple consumers process the same message from a queue or stream, or when a request is sent twice at different time intervals with the same parameters. Design your applications to process multiple identical requests to have the same effect as making a single request. Events not adhering to your schema should be discarded.',
			},
			{
				ChoiceId: 'rel_rel_q2_a4',
				Title: 'Consider scaling patterns at burst rates',
				Description:
					'In addition to your baseline performance, consider evaluating how your workload handle initial burst rates that may be expected or unexpected peaks.',
			},
			{
				ChoiceId: 'rel_rel_q2_a2',
				Title: 'Orchestrate long-running transactions',
				Description:
					'Long-running transactions can be processed by one or multiple components. Favor state machines for long-running transaction instead of handling them within application code in a single component or multiple synchronous dependency call chains.',
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
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'rel_q2',
				PillarId: 'reliability',
				QuestionTitle:
					'How do you build resiliency into your Serverless application?',
				QuestionDescription:
					'Evaluate scaling mechanisms for Serverless and non-Serverless resources to meet customer demand, and build resiliency to withstand partial and intermittent failures across dependencies.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.rel_q2.helpful-resources.en.html',
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
		QuestionTitle: 'How do you control access to your Serverless API?',
		Choices: [
			{
				ChoiceId: 'sec_sec_q1_a3',
				Title:
					'Use appropriate endpoint type and mechanisms to secure access to your API',
				Description:
					'API Gateway can have public and private endpoints and the level of mechanisms to provide secure access to each may differ. Consider public endpoints to serve consumers where they may not be part of your network perimeter. Consider private to serve consumers in your network perimeter where you may not want to expose publicly.',
			},
			{
				ChoiceId: 'sec_sec_q1_a2',
				Title: 'Scope access based on identity’s metadata',
				Description:
					'Authenticated users should be segregated into logical groups, roles, tiers or based on custom authentication token attributes (for example, SAML/JWT claims). Consider using users identity metadata to enable fine-grain control access to resources and actions.',
			},
			{
				ChoiceId: 'sec_sec_q1_a1',
				Title: 'Use authentication and authorization mechanisms',
				Description:
					'Integrate with an Identity Provider who can validate your API consumers identity (for example, SAML, JWT, etc.) and only authorize access to successfully authenticated consumers instead of API keys. This will help prevent unauthorized access to your workload from non-authenticated users.',
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
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sec_q1',
				PillarId: 'security',
				QuestionTitle: 'How do you control access to your Serverless API?',
				QuestionDescription:
					'Use authentication and authorization mechanisms to prevent unauthorized access, and enforce quotas for public resources.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.sec_q1.helpful-resources.en.html',
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
			'How do you manage your Serverless application’s security boundaries?',
		Choices: [
			{
				ChoiceId: 'sec_sec_q2_a1',
				Title: 'Evaluate and define resource policies',
				Description:
					'Resource policies can restrict inbound access to managed services. Consider using resource policies to restrict access to your component based on the source IP address/range, geolocation, function event source, version, alias, queues, etc.',
			},
			{
				ChoiceId: 'sec_sec_q2_a4',
				Title: 'Use temporary credentials between resources and components',
				Description:
					'Credentials and permissions policies should not be shared between any resources in order to maintain a granular segregation of permissions.',
			},
			{
				ChoiceId: 'sec_sec_q2_a3',
				Title: 'Design smaller, single purpose functions',
				Description:
					'Grant automated or programmatic access to users or roles with only the minimum privileges needed in order to reduce the risk of unauthorized access. Creating smaller, single purpose functions enables you to keep your permissions aligned to least privileged access, and reduces the risk of compromise since the function will do less.',
			},
			{
				ChoiceId: 'sec_sec_q2_a2',
				Title: 'Control network traffic at all layers',
				Description:
					'Apply controls for controlling both ingress and egress traffic, including data loss prevention. Functions deployed to virtual private networks must consider network access restrict resource access.',
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
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sec_q2',
				PillarId: 'security',
				QuestionTitle:
					'How do you manage your Serverless application’s security boundaries?',
				QuestionDescription:
					'Defining and securing your Serverless application’s boundaries ensures isolation for, within, and between components.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.sec_q2.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		QuestionId: 'sec_q3',
		PillarId: 'security',
		QuestionTitle:
			'How do you implement application Security in your workload?',
		Choices: [
			{
				ChoiceId: 'sec_sec_q3_a1',
				Title: 'Review security awareness documents frequently',
				Description:
					'Stay up to date with both AWS and industry security best practices to understand and evolve protection of the workload. ',
			},
			{
				ChoiceId: 'sec_sec_q3_a4',
				Title: 'Store secrets that are used in your code securely',
				Description:
					'Store your secrets such as database passwords or API keys in a Secrets Manager that allows for rotation, secure and audited access.',
			},
			{
				ChoiceId: 'sec_sec_q3_a3',
				Title: 'Automatically review workload’s code dependencies/libraries',
				Description:
					'Regularly review of application and code dependencies is good industry security practice and helps you detect and prevent non-certified application code.',
			},
			{
				ChoiceId: 'sec_sec_q3_a5',
				Title: 'Validate inbound events',
				Description:
					'Sanitize inbound events and validate them against a predefined schema. Test your inputs by using fuzzing techniques.',
			},
			{
				ChoiceId: 'sec_sec_q3_a2',
				Title:
					'Implement runtime protection to help prevent against malicious code execution',
				Description:
					'Runtime protection enables you to disable features like spawning child processes, network access or local filesystem access in your Lambda functions.',
			},
			{
				ChoiceId: 'sec_sec_q3_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'serverless',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sec_q3',
				PillarId: 'security',
				QuestionTitle:
					'How do you implement application Security in your workload?',
				QuestionDescription:
					'Review and automate security practices at the application code level, and enforce security code review as part of development workflow. These best practices protect against emerging security threats and reduce the attack surface from malicious code (including third-party dependencies).',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/TypeII/en/serverless/serverless.sec_q3.helpful-resources.en.html',
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
