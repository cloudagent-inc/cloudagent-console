const questions = [
	{
		QuestionId: 'cloud-financial-management',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you implement cloud financial management?',
		Choices: [
			{
				ChoiceId: 'cost_cloud_financial_management_function',
				Title: 'Establish ownership of cost optimization',
				Description:
					'Create a team (Cloud Business Office, Cloud Center of Excellence, or FinOps team) that is responsible for establishing and maintaining cost awareness across your organization. The owner of cost optimization can be individual or a team (requires people from finance, technology, and business teams) that understands the entire organization and cloud finance.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_partnership',
				Title: 'Establish a partnership between finance and technology',
				Description:
					'Involve finance and technology teams in cost and usage discussions at all stages of your cloud journey. Teams regularly meet and discuss topics such as organizational goals and targets, current state of cost and usage, and financial and accounting practices.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_budget_forecast',
				Title: 'Establish cloud budgets and forecasts',
				Description:
					'Adjust existing organizational budgeting and forecasting processes to be compatible with the highly variable nature of cloud costs and usage. Processes must be dynamic, using trend-based or business driver-based algorithms or a combination of both.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_cost_awareness',
				Title: 'Implement cost awareness in your organizational processes',
				Description:
					'Implement cost awareness, create transparency, and accountability of costs into new or existing processes that impact usage, and leverage existing processes for cost awareness. Implement cost awareness into employee training.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_proactive_process',
				Title: 'Monitor cost proactively',
				Description:
					'Implement tools and dashboards to monitor cost proactively for the workload. Regularly review the costs with configured tools or out of the box tools, do not just look at costs and categories when you receive notifications. Monitoring and analyzing costs proactively helps to identify positive trends and allows you to promote them throughout your organization.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_scheduled',
				Title: 'Keep up-to-date with new service releases',
				Description:
					'Consult regularly with experts or AWS Partners to consider which services and features provide lower cost. Review AWS blogs and other information sources.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_quantify_value',
				Title: 'Quantify business value from cost optimization',
				Description:
					'Quantifying business value from cost optimization allows you to understand the entire set of benefits to your organization. Because cost optimization is a necessary investment, quantifying business value allows you to explain the return on investment to stakeholders. Quantifying business value can help you gain more buy-in from stakeholders on future cost optimization investments, and provides a framework to measure the outcomes for your organization’s cost optimization activities.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_usage_report',
				Title: 'Report and notify on cost optimization',
				Description:
					'Set up cloud budgets and configure mechanisms to detect anomalies in usage. Configure related tools for cost and usage alerts against pre-defined targets and receive notifications when any usage exceeds those targets. Have regular meetings to analyze the cost-effectiveness of your workloads and promote cost awareness.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_culture',
				Title: 'Create a cost-aware culture',
				Description:
					'Implement changes or programs across your organization to create a cost-aware culture. It is recommended to start small, then as your capabilities increase and your organization’s use of the cloud increases, implement large and wide ranging programs.',
			},
			{
				ChoiceId: 'cost_cloud_financial_management_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'cloud-financial-management',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you implement cloud financial management?',
				QuestionDescription:
					'Implementing Cloud Financial Management enables organizations to realize business value and financial success as they optimize their cost and usage and scale on AWS.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.cloud-financial-management.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'govern-usage',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you govern usage?',
		Choices: [
			{
				ChoiceId: 'cost_govern_usage_policies',
				Title: 'Develop policies based on your organization requirements',
				Description:
					'Develop policies that define how resources are managed by your organization and inspect them periodically. Policies should cover the cost aspects of resources and workloads, including creation, modification, and decommissioning over a resource’s lifetime.',
			},
			{
				ChoiceId: 'cost_govern_usage_goal_target',
				Title: 'Implement goals and targets',
				Description:
					'Implement both cost and usage goals and targets for your workload. Goals provide direction to your organization on expected outcomes, and targets provide specific measurable outcomes to be achieved for your workloads.',
			},
			{
				ChoiceId: 'cost_govern_usage_account_structure',
				Title: 'Implement an account structure',
				Description:
					'Implement a structure of accounts that maps to your organization. This assists in allocating and managing costs throughout your organization.',
			},
			{
				ChoiceId: 'cost_govern_usage_controls',
				Title: 'Implement cost controls',
				Description:
					'Implement controls based on organization policies and defined groups and roles. These certify that costs are only incurred as defined by organization requirements such as control access to regions or resource types.',
			},
			{
				ChoiceId: 'cost_govern_usage_groups_roles',
				Title: 'Implement groups and role',
				Description:
					'Implement groups and roles that align to your policies and control who can create, modify, or decommission instances and resources in each group. For example, implement development, test, and production groups. This applies to AWS services and third-party solutions.',
			},
			{
				ChoiceId: 'cost_govern_usage_track_lifecycle',
				Title: 'Track project lifecycle',
				Description:
					'Track, measure, and audit the lifecycle of projects, teams, and environments to avoid using and paying for unnecessary resources.',
			},
			{
				ChoiceId: 'cost_govern_usage_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'govern-usage',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you govern usage?',
				QuestionDescription:
					'Establish policies and mechanisms to ensure that appropriate costs are incurred while objectives are achieved. By employing a checks-and-balances approach, you can innovate without overspending.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.govern-usage.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'monitor-usage',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you monitor your cost and usage?',
		Choices: [
			{
				ChoiceId: 'cost_monitor_usage_detailed_source',
				Title: 'Configure detailed information sources',
				Description:
					'Set up cost management and reporting tools for enhanced analysis and transparency of cost and usage data. Configure your workload to create log entries that facilitate the tracking and segregation of costs and usage.',
			},
			{
				ChoiceId: 'cost_monitor_usage_define_attribution',
				Title: 'Identify cost attribution categories',
				Description:
					'Identify organization categories such as business units, departments or projects that could be used to allocate cost within your organization to the internal consuming entities. Use those categories to enforce spend accountability, create cost awareness and drive effective consumption behaviors.',
			},
			{
				ChoiceId: 'cost_monitor_usage_define_kpi',
				Title: 'Establish organization metrics',
				Description:
					'Establish the organization metrics that are required for this workload. Example metrics of a workload are customer reports produced, or web pages served to customers.',
			},
			{
				ChoiceId: 'cost_monitor_usage_config_tools',
				Title: 'Configure billing and cost management tools',
				Description:
					'Configure cost management tools in line with your organization policies to manage and optimize cloud spend. This includes services, tools, and resources to organize and track cost and usage data, enhance control through consolidated billing and access permission, improve planning through budgeting and forecasts, receive notifications or alerts, and further lower cost with resources and pricing optimizations.',
			},
			{
				ChoiceId: 'cost_monitor_usage_org_information',
				Title: 'Add organization information to cost and usage',
				Description:
					'Define a tagging schema based on your organization, workload attributes, and cost allocation categories so that you can filter and search for resources or monitor cost and usage in cost management tools. Implement consistent tagging across all resources where possible by purpose, team, environment, or other criteria relevant to your business.',
			},
			{
				ChoiceId: 'cost_monitor_usage_allocate_outcome',
				Title: 'Allocate costs based on workload metrics',
				Description:
					"Allocate the workload's costs based on usage metrics or business outcomes to measure workload cost efficiency. Implement a process to analyze the cost and usage data with analytics services, which can provide insight and charge back capability.",
			},
			{
				ChoiceId: 'cost_monitor_usage_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'monitor-usage',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you monitor your cost and usage?',
				QuestionDescription:
					'Establish policies and procedures to monitor and appropriately allocate your costs. This allows you to measure and improve the cost efficiency of this workload.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.monitor-usage.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'decomissioning-resources',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you decommission resources?',
		Choices: [
			{
				ChoiceId: 'cost_decomissioning_resources_track',
				Title: 'Track resources over their life time',
				Description:
					'Define and implement a method to track resources and their associations with systems over their lifetime. You can use tagging to identify the workload or function of the resource.',
			},
			{
				ChoiceId: 'cost_decomissioning_resources_implement_process',
				Title: 'Implement a decommissioning process',
				Description:
					'Implement a process to identify and decommission unused resources.',
			},
			{
				ChoiceId: 'cost_decomissioning_resources_decommission',
				Title: 'Decommission resources',
				Description:
					'Decommission resources triggered by events such as periodic audits, or changes in usage. Decommissioning is typically performed periodically and can be manual or automated.',
			},
			{
				ChoiceId: 'cost_decomissioning_resources_data_retention',
				Title: 'Enforce data retention policies',
				Description:
					'Define data retention policies on supported resources to handle object deletion per your organizations’ requirements. Identify and delete unnecessary or orphaned resources and objects that are no longer required.',
			},
			{
				ChoiceId: 'cost_decomissioning_resources_decomm_automated',
				Title: 'Decommission resources automatically',
				Description:
					'Design your workload to gracefully handle resource termination as you identify and decommission non-critical resources, resources that are not required, or resources with low utilization.',
			},
			{
				ChoiceId: 'cost_decomissioning_resources_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'decomissioning-resources',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you decommission resources?',
				QuestionDescription:
					'Implement change control and resource management from project inception to end-of-life. This ensures you shut down or terminate unused resources to reduce waste.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.decomissioning-resources.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'select-service',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you evaluate cost when you select services?',
		Choices: [
			{
				ChoiceId: 'cost_select_service_requirements',
				Title: 'Identify organization requirements for cost',
				Description:
					'Work with team members to define the balance between cost optimization and other pillars, such as performance and reliability, for this workload.',
			},
			{
				ChoiceId: 'cost_select_service_analyze_all',
				Title: 'Analyze all components of this workload',
				Description:
					'Verify every workload component is analyzed, regardless of current size or current costs. The review effort should reflect the potential benefit, such as current and projected costs.',
			},
			{
				ChoiceId: 'cost_select_service_thorough_analysis',
				Title: 'Perform a thorough analysis of each component',
				Description:
					'Look at overall cost to the organization of each component. Calculate the total cost of ownership by factoring in cost of operations and management, especially when using managed services by cloud provider. The review effort should reflect potential benefit (for example, time spent analyzing is proportional to component cost).',
			},
			{
				ChoiceId: 'cost_select_service_select_for_cost',
				Title:
					'Select components of this workload to optimize cost in line with organization priorities',
				Description:
					'Factor in cost when selecting all components for your workload. This includes using application level and managed services or serverless, containers, or event-driven architecture to reduce overall cost. Minimize license costs by using open-source software, software that does not have license fees, or alternatives to reduce spending.',
			},
			{
				ChoiceId: 'cost_select_service_analyze_over_time',
				Title: 'Perform cost analysis for different usage over time',
				Description:
					'Workloads can change over time. Some services or features are more cost effective at different usage levels. By performing the analysis on each component over time and at projected usage, the workload remains cost-effective over its lifetime.',
			},
			{
				ChoiceId: 'cost_select_service_licensing',
				Title: 'Select software with cost effective licensing',
				Description:
					'Open-source software eliminates software licensing costs, which can contribute significant costs to workloads. Where licensed software is required, avoid licenses bound to arbitrary attributes such as CPUs, look for licenses that are bound to output or outcomes. The cost of these licenses scales more closely to the benefit they provide.',
			},
			{
				ChoiceId: 'cost_select_service_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'select-service',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you evaluate cost when you select services?',
				QuestionDescription:
					'Amazon EC2, Amazon EBS, and Amazon S3 are building-block AWS services. Managed services, such as Amazon RDS and Amazon DynamoDB, are higher level, or application level, AWS services. By selecting the appropriate building blocks and managed services, you can optimize this workload for cost. For example, using managed services, you can reduce or remove much of your administrative and operational overhead, freeing you to work on applications and business-related activities.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.select-service.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'type-size-number-resources',
		PillarId: 'costOptimization',
		QuestionTitle:
			'How do you meet cost targets when you select resource type, size and number?',
		Choices: [
			{
				ChoiceId: 'cost_type_size_number_resources_cost_modeling',
				Title: 'Perform cost modeling',
				Description:
					'Identify organization requirements (such as business needs and existing commitments) and perform cost modeling (overall costs) of the workload and each of its components. Perform benchmark activities for the workload under different predicted loads and compare the costs. The modeling effort should reflect the potential benefit. For example, time spent is proportional to component cost.',
			},
			{
				ChoiceId: 'cost_type_size_number_resources_data',
				Title: 'Select resource type, size, and number based on data',
				Description:
					'Select resource size or type based on data about the workload and resource characteristics. For example, compute, memory, throughput, or write intensive. This selection is typically made using a previous (on-premises) version of the workload, using documentation, or using other sources of information about the workload.',
			},
			{
				ChoiceId: 'cost_type_size_number_resources_shared',
				Title: 'Consider using shared resources',
				Description:
					'For already-deployed services at the organization level for multiple business units, consider using shared resources to increase utilization and reduce total cost of ownership (TCO). Using shared resources can be a cost-effective option to centralize the management and costs by using existing solutions, sharing components, or both. Manage common functions like monitoring, backups, and connectivity either within an account boundary or in a dedicated account. You can also reduce cost by implementing standardization, reducing duplication, and reducing complexity.',
			},
			{
				ChoiceId: 'cost_type_size_number_resources_metrics',
				Title:
					'Select resource type, size, and number automatically based on metrics',
				Description:
					'Use metrics from the currently running workload to select the right size and type to optimize for cost. Appropriately provision throughput, sizing, and storage for compute, storage, data, and networking services. This can be done with a feedback loop such as automatic scaling or by custom code in the workload.',
			},
			{
				ChoiceId: 'cost_type_size_number_resources_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'type-size-number-resources',
				PillarId: 'costOptimization',
				QuestionTitle:
					'How do you meet cost targets when you select resource type, size and number?',
				QuestionDescription:
					'Ensure that you choose the appropriate resource size and number of resources for the task at hand. You minimize waste by selecting the most cost effective type, size, and number.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.type-size-number-resources.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'pricing-model',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you use pricing models to reduce cost?',
		Choices: [
			{
				ChoiceId: 'cost_pricing_model_analysis',
				Title: 'Perform pricing model analysis',
				Description:
					'Analyze each component of the workload. Determine if the component and resources will be running for extended periods (for commitment discounts) or dynamic and short-running (for spot or on-demand). Perform an analysis on the workload using the recommendations in cost management tools and apply business rules to those recommendations to achieve high returns.',
			},
			{
				ChoiceId: 'cost_pricing_model_region_cost',
				Title: 'Choose Regions based on cost',
				Description:
					'Resource pricing may be different in each Region. Identify Regional cost differences and only deploy in Regions with higher costs to meet latency, data residency and data sovereignty requirements. Factoring in Region cost helps you pay the lowest overall price for this workload.',
			},
			{
				ChoiceId: 'cost_pricing_model_third_party',
				Title: 'Select third-party agreements with cost-efficient terms',
				Description:
					'Cost-efficient agreements and terms ensure the cost of these services scales with the benefits they provide. Select agreements and pricing that scale when they provide additional benefits to your organization.',
			},
			{
				ChoiceId: 'cost_pricing_model_implement_models',
				Title: 'Implement pricing models for all components of this workload',
				Description:
					'Permanently running resources should utilize reserved capacity such as Savings Plans or Reserved Instances. Short-term capacity is configured to use Spot Instances, or Spot Fleet. On-Demand Instances are only used for short-term workloads that cannot be interrupted and do not run long enough for reserved capacity, between 25% to 75% of the period, depending on the resource type.',
			},
			{
				ChoiceId: 'cost_pricing_model_master_analysis',
				Title: 'Perform pricing model analysis at the management account level',
				Description:
					'Check billing and cost management tools and see recommended discounts with commitments and reservations to perform regular analysis at the management account level.',
			},
			{
				ChoiceId: 'cost_pricing_model_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'pricing-model',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you use pricing models to reduce cost?',
				QuestionDescription:
					'Use the pricing model that is most appropriate for your resources to minimize expense.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.pricing-model.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'data-transfer',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you plan for data transfer charges?',
		Choices: [
			{
				ChoiceId: 'cost_data_transfer_modeling',
				Title: 'Perform data transfer modeling',
				Description:
					'Gather organization requirements and perform data transfer modeling of the workload and each of its components. This identifies the lowest cost point for its current data transfer requirements.',
			},
			{
				ChoiceId: 'cost_data_transfer_optimized_components',
				Title: 'Select components to optimize data transfer cost',
				Description:
					'All components are selected, and architecture is designed to reduce data transfer costs. This includes using components such as wide-area-network (WAN) optimization and Multi-Availability Zone (AZ) configurations',
			},
			{
				ChoiceId: 'cost_data_transfer_implement_services',
				Title: 'Implement services to reduce data transfer costs',
				Description:
					'Implement services to reduce data transfer. For example, use edge locations or content delivery networks (CDN) to deliver content to end users, build caching layers in front of your application servers or databases, and use dedicated network connections instead of VPN for connectivity to the cloud.',
			},
			{
				ChoiceId: 'cost_data_transfer_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'data-transfer',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you plan for data transfer charges?',
				QuestionDescription:
					'Ensure that you plan and monitor data transfer charges so that you can make architectural decisions to minimize costs. A small yet effective architectural change can drastically reduce your operational costs over time.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.data-transfer.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'manage-demand-resources',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you manage demand, and supply resources?',
		Choices: [
			{
				ChoiceId: 'cost_manage_demand_resources_cost_analysis',
				Title: 'Perform an analysis on the workload demand',
				Description:
					'Analyze the demand of the workload over time. Verify that the analysis covers seasonal trends and accurately represents operating conditions over the full workload lifetime. Analysis effort should reflect the potential benefit, for example, time spent is proportional to the workload cost.',
			},
			{
				ChoiceId: 'cost_manage_demand_resources_buffer_throttle',
				Title: 'Implement a buffer or throttle to manage demand',
				Description:
					'Buffering and throttling modify the demand on your workload, smoothing out any peaks. Implement throttling when your clients perform retries. Implement buffering to store the request and defer processing until a later time. Verify that your throttles and buffers are designed so clients receive a response in the required time.',
			},
			{
				ChoiceId: 'cost_manage_demand_resources_dynamic',
				Title: 'Supply resources dynamically',
				Description:
					'Resources are provisioned in a planned manner. This can be demand-based, such as through automatic scaling, or time-based, where demand is predictable and resources are provided based on time. These methods result in the least amount of over-provisioning or under-provisioning.',
			},
			{
				ChoiceId: 'cost_manage_demand_resources_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'manage-demand-resources',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you manage demand, and supply resources?',
				QuestionDescription:
					'For a workload that has balanced spend and performance, ensure that everything you pay for is used and avoid significantly underutilizing instances. A skewed utilization metric in either direction has an adverse impact on your organization, in either operational costs (degraded performance due to over-utilization), or wasted AWS expenditures (due to over-provisioning).',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.manage-demand-resources.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'evaluate-new-services',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you evaluate new services?',
		Choices: [
			{
				ChoiceId: 'cost_evaluate_new_services_review_process',
				Title: 'Develop a workload review process',
				Description:
					'Develop a process that defines the criteria and process for workload review. The review effort should reflect potential benefit. For example, core workloads or workloads with a value of over ten percent of the bill are reviewed quarterly or every six months, while workloads below ten percent are reviewed annually.',
			},
			{
				ChoiceId: 'cost_evaluate_new_services_review_workload',
				Title: 'Review and analyze this workload regularly',
				Description:
					'Existing workloads are regularly reviewed based on each defined process to find out if new services can be adopted, existing services can be replaced, or workloads can be re-architected.',
			},
			{
				ChoiceId: 'cost_evaluate_new_services_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'evaluate-new-services',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you evaluate new services?',
				QuestionDescription:
					"As AWS releases new services and features, it's a best practice to review your existing architectural decisions to ensure they continue to be the most cost effective.",
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.evaluate-new-services.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'evaluate-cost-effort',
		PillarId: 'costOptimization',
		QuestionTitle: 'How do you evaluate the cost of effort?',
		Choices: [
			{
				ChoiceId: 'cost_evaluate_cost_effort_automations_operations',
				Title: 'Perform automation for operations',
				Description:
					'Evaluate the operational costs on the cloud, focusing on quantifying the time and effort savings in administrative tasks, deployments, mitigating the risk of human errors, compliance, and other operations through automation. Assess the time and associated costs required for operational efforts and implement automation for administrative tasks to minimize manual effort wherever feasible.',
			},
			{
				ChoiceId: 'cost_evaluate_cost_effort_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'evaluate-cost-effort',
				PillarId: 'costOptimization',
				QuestionTitle: 'How do you evaluate the cost of effort?',
				QuestionDescription:
					"As AWS releases new services and features, it's a best practice to review the cost of the effort required to implement new services.",
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.evaluate-cost-effort.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'priorities',
		PillarId: 'operationalExcellence',
		QuestionTitle: 'How do you determine what your priorities are?',
		Choices: [
			{
				ChoiceId: 'ops_priorities_ext_cust_needs',
				Title: 'Evaluate customer needs',
				Description:
					'Involve key stakeholders, including business, development, and operations teams, to determine where to focus efforts on external customer needs. This verifies that you have a thorough understanding of the operations support that is required to achieve your desired business outcomes.',
			},
			{
				ChoiceId: 'ops_priorities_int_cust_needs',
				Title: 'Evaluate internal customer needs',
				Description:
					'Involve key stakeholders, including business, development, and operations teams, when determining where to focus efforts on internal customer needs. This will ensure that you have a thorough understanding of the operations support that is required to achieve business outcomes.',
			},
			{
				ChoiceId: 'ops_priorities_governance_reqs',
				Title: 'Evaluate governance requirements',
				Description:
					'Governance is the set of policies, rules, or frameworks that a company uses to achieve its business goals. Governance requirements are generated from within your organization. They can affect the types of technologies you choose or influence the way you operate your workload. Incorporate organizational governance requirements into your workload. Conformance is the ability to demonstrate that you have implemented governance requirements.',
			},
			{
				ChoiceId: 'ops_priorities_compliance_reqs',
				Title: 'Evaluate compliance requirements',
				Description:
					'Regulatory, industry, and internal compliance requirements are an important driver for defining your organization’s priorities. Your compliance framework may preclude you from using specific technologies or geographic locations. Apply due diligence if no external compliance frameworks are identified. Generate audits or reports that validate compliance.',
			},
			{
				ChoiceId: 'ops_priorities_eval_threat_landscape',
				Title: 'Evaluate threat landscape',
				Description:
					'Evaluate threats to the business (for example, competition, business risk and liabilities, operational risks, and information security threats) and maintain current information in a risk registry. Include the impact of risks when determining where to focus efforts.',
			},
			{
				ChoiceId: 'ops_priorities_eval_tradeoffs',
				Title: 'Evaluate tradeoffs while managing benefits and risks',
				Description:
					'Competing interests from multiple parties can make it challenging to prioritize efforts, build capabilities, and deliver outcomes aligned with business strategies. For example, you may be asked to accelerate speed-to-market for new features over optimizing IT infrastructure costs. This can put two interested parties in conflict with one another. In these situations, decisions need to be brought to a higher authority to resolve conflict. Data is required to remove emotional attachment from the decision-making process.',
			},
			{
				ChoiceId: 'ops_priorities_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'priorities',
				PillarId: 'operationalExcellence',
				QuestionTitle: 'How do you determine what your priorities are?',
				QuestionDescription:
					'Everyone needs to understand their part in enabling business success. Have shared goals in order to set priorities for resources. This will maximize the benefits of your efforts.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.priorities.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'ops-model',
		PillarId: 'operationalExcellence',
		QuestionTitle:
			'How do you structure your organization to support your business outcomes?',
		Choices: [
			{
				ChoiceId: 'ops_ops_model_def_resource_owners',
				Title: 'Resources have identified owners',
				Description:
					'Resources for your workload must have identified owners for change control, troubleshooting, and other functions. Owners are assigned for workloads, accounts, infrastructure, platforms, and applications. Ownership is recorded using tools like a central register or metadata attached to resources. The business value of components informs the processes and procedures applied to them.',
			},
			{
				ChoiceId: 'ops_ops_model_def_proc_owners',
				Title: 'Processes and procedures have identified owners',
				Description:
					'Understand who has ownership of the definition of individual processes and procedures, why those specific process and procedures are used, and why that ownership exists. Understanding the reasons that specific processes and procedures are used enables identification of improvement opportunities.',
			},
			{
				ChoiceId: 'ops_ops_model_def_activity_owners',
				Title:
					'Operations activities have identified owners responsible for their performance',
				Description:
					'Understand who has responsibility to perform specific activities on defined workloads and why that responsibility exists. Understanding who has responsibility to perform activities informs who will conduct the activity, validate the result, and provide feedback to the owner of the activity.',
			},
			{
				ChoiceId: 'ops_ops_model_def_responsibilities_ownership',
				Title: 'Mechanisms exist to manage responsibilities and ownership',
				Description:
					'Understand the responsibilities of your role and how you contribute to business outcomes, as this understanding informs the prioritization of your tasks and why your role is important. This helps team members recognize needs and respond appropriately. When team members know their role, they can establish ownership, identify improvement opportunities, and understand how to influence or make appropriate changes.',
			},
			{
				ChoiceId: 'ops_ops_model_req_add_chg_exception',
				Title: 'Mechanisms exist to request additions, changes, and exceptions',
				Description:
					'You can make requests to owners of processes, procedures, and resources. Requests include additions, changes, and exceptions. These requests go through a change management process. Make informed decisions to approve requests where viable and determined to be appropriate after an evaluation of benefits and risks.',
			},
			{
				ChoiceId: 'ops_ops_model_def_neg_team_agreements',
				Title: 'Responsibilities between teams are predefined or negotiated',
				Description:
					'Have defined or negotiated agreements between teams describing how they work with and support each other (for example, response times, service level objectives, or service-level agreements). Inter-team communications channels are documented. Understanding the impact of the teams’ work on business outcomes and the outcomes of other teams and organizations informs the prioritization of their tasks and helps them respond appropriately.',
			},
			{
				ChoiceId: 'ops_ops_model_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'ops-model',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How do you structure your organization to support your business outcomes?',
				QuestionDescription:
					'Your teams must understand their part in achieving business outcomes. Teams need to understand their roles in the success of other teams, the role of other teams in their success, and have shared goals. Understanding responsibility, ownership, how decisions are made, and who has authority to make decisions will help focus efforts and maximize the benefits from your teams.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.ops-model.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'org-culture',
		PillarId: 'operationalExcellence',
		QuestionTitle:
			'How does your organizational culture support your business outcomes?',
		Choices: [
			{
				ChoiceId: 'ops_org_culture_executive_sponsor',
				Title: 'Provide executive sponsorship',
				Description:
					"At the highest level, senior leadership acts as the executive sponsor to clearly set expectations and direction for the organization's outcomes, including evaluating its success. The sponsor advocates and drives adoption of best practices and evolution of the organization.",
			},
			{
				ChoiceId: 'ops_org_culture_team_enc_escalation',
				Title: 'Escalation is encouraged',
				Description:
					'Team members are encouraged by leadership to escalate issues and concerns to higher-level decision makers and stakeholders if they believe desired outcomes are at risk and expected standards are not met. This is a feature of the organization’s culture and is driven at all levels. Escalation should be done early and often so that risks can be identified and prevented from causing incidents. Leadership does not reprimand individuals for escalating an issue.',
			},
			{
				ChoiceId: 'ops_org_culture_effective_comms',
				Title: 'Communications are timely, clear, and actionable',
				Description:
					'Leadership is responsible for the creation of strong and effective communications, especially when the organization adopts new strategies, technologies, or ways of working. Leaders should set expectations for all staff to work towards the company objectives. Devise communication mechanisms that create and maintain awareness among the teams responsible for running plans that are funded and sponsored by leadership. Make use of cross-organizational diversity, and listen attentively to multiple unique perspectives. Use this perspective to increase innovation, challenge your assumptions, and reduce the risk of confirmation bias. Foster inclusion, diversity, and accessibility within your teams to gain beneficial perspectives.',
			},
			{
				ChoiceId: 'ops_org_culture_team_emp_take_action',
				Title:
					'Team members are empowered to take action when outcomes are at risk',
				Description:
					'A cultural behavior of ownership instilled by leadership results in any employee feeling empowered to act on behalf of the entire company beyond their defined scope of role and accountability. Employees can act to proactively identify risks as they emerge and take appropriate action. Such a culture allows employees to make high value decisions with situational awareness.',
			},
			{
				ChoiceId: 'ops_org_culture_team_enc_experiment',
				Title: 'Experimentation is encouraged',
				Description:
					'Experimentation is a catalyst for turning new ideas into products and features. It accelerates learning and keeps team members interested and engaged. Team members are encouraged to experiment often to drive innovation. Even when an undesired result occurs, there is value in knowing what not to do. Team members are not punished for successful experiments with undesired results.',
			},
			{
				ChoiceId: 'ops_org_culture_team_enc_learn',
				Title:
					'Team members are encouraged to maintain and grow their skill sets',
				Description:
					'Teams must grow their skill sets to adopt new technologies, and to support changes in demand and responsibilities in support of your workloads. Growth of skills in new technologies is frequently a source of team member satisfaction and supports innovation. Support your team members’ pursuit and maintenance of industry certifications that validate and acknowledge their growing skills. Cross train to promote knowledge transfer and reduce the risk of significant impact when you lose skilled and experienced team members with institutional knowledge. Provide dedicated structured time for learning.',
			},
			{
				ChoiceId: 'ops_org_culture_team_res_appro',
				Title: 'Resource teams appropriately',
				Description:
					'Provision the right amount of proficient team members, and provide tools and resources to support your workload needs. Overburdening team members increases the risk of human error. Investments in tools and resources, such as automation, can scale the effectiveness of your team and help them support a greater number of workloads without requiring additional capacity.',
			},
			{
				ChoiceId: 'ops_org_culture_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'org-culture',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How does your organizational culture support your business outcomes?',
				QuestionDescription:
					'Provide support for your team members so that they can be more effective in taking action and supporting your business outcome.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.org-culture.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'observability',
		PillarId: 'operationalExcellence',
		QuestionTitle: 'How do you implement observability in your workload?',
		Choices: [
			{
				ChoiceId: 'ops_observability_identify_kpis',
				Title: 'Identify key performance indicators',
				Description:
					'Implementing observability in your workload starts with understanding its state and making data-driven decisions based on business requirements. One of the most effective ways to ensure alignment between monitoring activities and business objectives is by defining and monitoring key performance indicators (KPIs).',
			},
			{
				ChoiceId: 'ops_observability_application_telemetry',
				Title: 'Implement application telemetry',
				Description:
					"Application telemetry serves as the foundation for observability of your workload. It's crucial to emit telemetry that offers actionable insights into the state of your application and the achievement of both technical and business outcomes. From troubleshooting to measuring the impact of a new feature or ensuring alignment with business key performance indicators (KPIs), application telemetry informs the way you build, operate, and evolve your workload.",
			},
			{
				ChoiceId: 'ops_observability_customer_telemetry',
				Title: 'Implement user experience telemetry',
				Description:
					'Gaining deep insights into customer experiences and interactions with your application is crucial. Real User Monitoring (RUM) and synthetic transactions serve as powerful tools for this purpose. While RUM provides data about real user interactions, synthetic transactions simulate user interactions, helping in detecting potential issues even before they impact real users.',
			},
			{
				ChoiceId: 'ops_observability_dependency_telemetry',
				Title: 'Implement dependency telemetry',
				Description:
					'Dependency telemetry is essential for monitoring the health and performance of the external services and components your workload relies on. It provides valuable insights into reachability, timeouts, and other critical events related to dependencies such as DNS, databases, or third-party APIs. When you instrument your application to emit metrics, logs, and traces about these dependencies, you gain a clearer understanding of potential bottlenecks, performance issues, or failures that might impact your workload.',
			},
			{
				ChoiceId: 'ops_observability_dist_trace',
				Title: 'Implement distributed tracing',
				Description:
					'Distributed tracing offers a way to monitor and visualize requests as they traverse through various components of a distributed system. By capturing trace data from multiple sources and analyzing it in a unified view, teams can better understand how requests flow, where bottlenecks exist, and where optimization efforts should focus.',
			},
			{
				ChoiceId: 'ops_telemetry_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'observability',
				PillarId: 'operationalExcellence',
				QuestionTitle: 'How do you implement observability in your workload?',
				QuestionDescription:
					'Implement observability in your workload so that you can understand its state and make data-driven decisions based on business requirements.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.observability.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'dev-integ',
		PillarId: 'operationalExcellence',
		QuestionTitle:
			'How do you reduce defects, ease remediation, and improve flow into production?',
		Choices: [
			{
				ChoiceId: 'ops_dev_integ_version_control',
				Title: 'Use version control',
				Description:
					'Use version control to activate tracking of changes and releases.',
			},
			{
				ChoiceId: 'ops_dev_integ_test_val_chg',
				Title: 'Test and validate changes',
				Description:
					'Every change deployed must be tested to avoid errors in production. This best practice is focused on testing changes from version control to artifact build. Besides application code changes, testing should include infrastructure, configuration, security controls, and operations procedures. Testing takes many forms, from unit tests to software component analysis (SCA). Move tests further to the left in the software integration and delivery process results in higher certainty of artifact quality.',
			},
			{
				ChoiceId: 'ops_dev_integ_conf_mgmt_sys',
				Title: 'Use configuration management systems',
				Description:
					'Use configuration management systems to make and track configuration changes. These systems reduce errors caused by manual processes and reduce the level of effort to deploy changes.',
			},
			{
				ChoiceId: 'ops_dev_integ_build_mgmt_sys',
				Title: 'Use build and deployment management systems',
				Description:
					'Use build and deployment management systems. These systems reduce errors caused by manual processes and reduce the level of effort to deploy changes.',
			},
			{
				ChoiceId: 'ops_dev_integ_patch_mgmt',
				Title: 'Perform patch management',
				Description:
					'Perform patch management to gain features, address issues, and remain compliant with governance. Automate patch management to reduce errors caused by manual processes, scale, and reduce the level of effort to patch.',
			},
			{
				ChoiceId: 'ops_dev_integ_share_design_stds',
				Title: 'Share design standards',
				Description:
					'Share best practices across teams to increase awareness and maximize the benefits of development efforts. Document them and keep them up to date as your architecture evolves. If shared standards are enforced in your organization, it’s critical that mechanisms exist to request additions, changes, and exceptions to standards. Without this option, standards become a constraint on innovation.',
			},
			{
				ChoiceId: 'ops_dev_integ_code_quality',
				Title: 'Implement practices to improve code quality',
				Description:
					'Implement practices to improve code quality and minimize defects. Some examples include test-driven development, code reviews, standards adoption, and pair programming. Incorporate these practices into your continuous integration and delivery process.',
			},
			{
				ChoiceId: 'ops_dev_integ_multi_env',
				Title: 'Use multiple environments',
				Description:
					'Use multiple environments to experiment, develop, and test your workload. Use increasing levels of controls as environments approach production to gain confidence your workload will operate as intended when deployed.',
			},
			{
				ChoiceId: 'ops_dev_integ_freq_sm_rev_chg',
				Title: 'Make frequent, small, reversible changes',
				Description:
					'Frequent, small, and reversible changes reduce the scope and impact of a change. When used in conjunction with change management systems, configuration management systems, and build and delivery systems frequent, small, and reversible changes reduce the scope and impact of a change. This results in more effective troubleshooting and faster remediation with the option to roll back changes.',
			},
			{
				ChoiceId: 'ops_dev_integ_auto_integ_deploy',
				Title: 'Fully automate integration and deployment',
				Description:
					'Automate build, deployment, and testing of the workload. This reduces errors caused by manual processes and reduces the effort to deploy changes.',
			},
			{
				ChoiceId: 'ops_dev_integ_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'dev-integ',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				QuestionDescription:
					'Adopt approaches that improve flow of changes into production, that enable refactoring, fast feedback on quality, and bug fixing. These accelerate beneficial changes entering production, limit issues deployed, and enable rapid identification and remediation of issues introduced through deployment activities.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.dev-integ.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'mit-deploy-risks',
		PillarId: 'operationalExcellence',
		QuestionTitle: 'How do you mitigate deployment risks?',
		Choices: [
			{
				ChoiceId: 'ops_mit_deploy_risks_plan_for_unsucessful_changes',
				Title: 'Plan for unsuccessful changes',
				Description:
					'Plan to revert to a known good state, or remediate in the production environment if the deployment causes undesired outcome. Having a policy to establish such a plan helps all teams develop strategies to recover from failed changes. Some example strategies are deployment and rollback steps, change policies, feature flags, traffic isolation, and traffic shifting. A single release may include multiple related component changes. The strategy should provide the ability to withstand or recover from a failure of any component change.',
			},
			{
				ChoiceId: 'ops_mit_deploy_risks_test_val_chg',
				Title: 'Test deployments',
				Description:
					'Test release procedures in pre-production by using the same deployment configuration, security controls, steps, and procedures as in production. Validate that all deployed steps are completed as expected, such as inspecting files, configurations, and services. Further test all changes with functional, integration, and load tests, along with any monitoring such as health checks. By doing these tests, you can identify deployment issues early with an opportunity to plan and mitigate them prior to production.',
			},
			{
				ChoiceId: 'ops_mit_deploy_risks_deploy_mgmt_sys',
				Title: 'Employ safe deployment strategies',
				Description:
					'Safe production roll-outs control the flow of beneficial changes with an aim to minimize any perceived impact for customers from those changes. The safety controls provide inspection mechanisms to validate desired outcomes and limit the scope of impact from any defects introduced by the changes or from deployment failures. Safe roll-outs may include strategies such as feature-flags, one-box, rolling (canary releases), immutable, traffic splitting, and blue/green deployments.',
			},
			{
				ChoiceId: 'ops_mit_deploy_risks_auto_testing_and_rollback',
				Title: 'Automate testing and rollback',
				Description:
					'To increase the speed, reliability, and confidence of your deployment process, have a strategy for automated testing and rollback capabilities in pre-production and production environments. Automate testing when deploying to production to simulate human and system interactions that verify the changes being deployed. Automate rollback to revert back to a previous known good state quickly. The rollback should be initiated automatically on pre-defined conditions such as when the desired outcome of your change is not achieved or when the automated test fails. Automating these two activities improves your success rate for your deployments, minimizes recovery time, and reduces the potential impact to the business.',
			},
			{
				ChoiceId: 'ops_mit_deploy_risks_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'mit-deploy-risks',
				PillarId: 'operationalExcellence',
				QuestionTitle: 'How do you mitigate deployment risks?',
				QuestionDescription:
					'Adopt approaches that provide fast feedback on quality and enable rapid recovery from changes that do not have desired outcomes. Using these practices mitigates the impact of issues introduced through the deployment of changes.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.mit-deploy-risks.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'ready-to-support',
		PillarId: 'operationalExcellence',
		QuestionTitle: 'How do you know that you are ready to support a workload?',
		Choices: [
			{
				ChoiceId: 'ops_ready_to_support_personnel_capability',
				Title: 'Ensure personnel capability',
				Description:
					'Have a mechanism to validate that you have the appropriate number of trained personnel to support the workload. They must be trained on the platform and services that make up your workload. Provide them with the knowledge necessary to operate the workload. You must have enough trained personnel to support the normal operation of the workload and troubleshoot any incidents that occur. Have enough personnel so that you can rotate during on-call and vacations to avoid burnout.',
			},
			{
				ChoiceId: 'ops_ready_to_support_const_orr',
				Title: 'Ensure a consistent review of operational readiness',
				Description:
					'Use Operational Readiness Reviews (ORRs) to validate that you can operate your workload. ORR is a mechanism developed at Amazon to validate that teams can safely operate their workloads. An ORR is a review and inspection process using a checklist of requirements. An ORR is a self-service experience that teams use to certify their workloads. ORRs include best practices from lessons learned from our years of building software.',
			},
			{
				ChoiceId: 'ops_ready_to_support_use_runbooks',
				Title: 'Use runbooks to perform procedures',
				Description:
					'A runbook is a documented process to achieve a specific outcome. Runbooks consist of a series of steps that someone follows to get something done. Runbooks have been used in operations going back to the early days of aviation. In cloud operations, we use runbooks to reduce risk and achieve desired outcomes. At its simplest, a runbook is a checklist to complete a task.',
			},
			{
				ChoiceId: 'ops_ready_to_support_use_playbooks',
				Title: 'Use playbooks to investigate issues',
				Description:
					"Playbooks are step-by-step guides used to investigate an incident. When incidents happen, playbooks are used to investigate, scope impact, and identify a root cause. Playbooks are used for a variety of scenarios, from failed deployments to security incidents. In many cases, playbooks identify the root cause that a runbook is used to mitigate. Playbooks are an essential component of your organization's incident response plans.",
			},
			{
				ChoiceId: 'ops_ready_to_support_informed_deploy_decisions',
				Title: 'Make informed decisions to deploy systems and changes',
				Description:
					'Have processes in place for successful and unsuccessful changes to your workload. A pre-mortem is an exercise where a team simulates a failure to develop mitigation strategies. Use pre-mortems to anticipate failure and create procedures where appropriate. Evaluate the benefits and risks of deploying changes to your workload. Verify that all changes comply with governance.',
			},
			{
				ChoiceId: 'ops_ready_to_support_enable_support_plans',
				Title: 'Create support plans for production workloads',
				Description:
					'Enable support for any software and services that your production workload relies on. Select an appropriate support level to meet your production service-level needs. Support plans for these dependencies are necessary in case there is a service disruption or software issue. Document support plans and how to request support for all service and software vendors. Implement mechanisms that verify that support points of contacts are kept up to date.',
			},
			{
				ChoiceId: 'ops_ready_to_support_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'ready-to-support',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How do you know that you are ready to support a workload?',
				QuestionDescription:
					'Evaluate the operational readiness of your workload, processes and procedures, and personnel to understand the operational risks related to your workload.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.ready-to-support.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'workload-observability',
		PillarId: 'operationalExcellence',
		QuestionTitle:
			'How do you utilize workload observability in your organization?',
		Choices: [
			{
				ChoiceId: 'ops_workload_observability_create_alerts',
				Title: 'Create actionable alerts',
				Description:
					"Promptly detecting and responding to deviations in your application's behavior is crucial. Especially vital is recognizing when outcomes based on key performance indicators (KPIs) are at risk or when unexpected anomalies arise. Basing alerts on KPIs ensures that the signals you receive are directly tied to business or operational impact. This approach to actionable alerts promotes proactive responses and helps maintain system performance and reliability.",
			},
			{
				ChoiceId: 'ops_workload_observability_analyze_workload_metrics',
				Title: 'Analyze workload metrics',
				Description:
					"After implementing application telemetry, regularly analyze the collected metrics. While latency, requests, errors, and capacity (or quotas) provide insights into system performance, it's vital to prioritize the review of business outcome metrics. This ensures you're making data-driven decisions aligned with your business objectives.",
			},
			{
				ChoiceId: 'ops_workload_observability_analyze_workload_logs',
				Title: 'Analyze workload logs',
				Description:
					'Regularly analyzing workload logs is essential for gaining a deeper understanding of the operational aspects of your application. By efficiently sifting through, visualizing, and interpreting log data, you can continually optimize application performance and security.',
			},
			{
				ChoiceId: 'ops_workload_observability_analyze_workload_traces',
				Title: 'Analyze workload traces',
				Description:
					"Analyzing trace data is crucial for achieving a comprehensive view of an application's operational journey. By visualizing and understanding the interactions between various components, performance can be fine-tuned, bottlenecks identified, and user experiences enhanced.",
			},
			{
				ChoiceId: 'ops_workload_observability_create_dashboards',
				Title: 'Create dashboards',
				Description:
					'Dashboards are the human-centric view into the telemetry data of your workloads. While they provide a vital visual interface, they should not replace alerting mechanisms, but complement them. When crafted with care, not only can they offer rapid insights into system health and performance, but they can also present stakeholders with real-time information on business outcomes and the impact of issues.',
			},
			{
				ChoiceId: 'ops_workload_observability_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'workload-observability',
				PillarId: 'operationalExcellence',
				QuestionTitle:
					'How do you utilize workload observability in your organization?',
				QuestionDescription:
					"Ensure optimal workload health by leveraging observability. Utilize relevant metrics, logs, and traces to gain a comprehensive view of your workload's performance and address issues efficiently.",
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.workload-observability.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'operations-health',
		PillarId: 'operationalExcellence',
		QuestionTitle: 'How do you understand the health of your operations?',
		Choices: [
			{
				ChoiceId: 'ops_operations_health_measure_ops_goals_kpis',
				Title: 'Measure operations goals and KPIs with metrics',
				Description:
					'Obtain goals and KPIs that define operations success from your organization and determine that metrics that reflect these. Set baselines as a point of reference and reevaluate regularly. Develop mechanisms to collect these metrics from teams for evaluation.',
			},
			{
				ChoiceId: 'ops_operations_health_communicate_status_trends',
				Title:
					'Communicate status and trends to ensure visibility into operation',
				Description:
					'Knowing the state of your operations and its trending direction is necessary to identify when outcomes may be at risk, whether or not added work can be supported, or the effects that changes have had to your teams. During operations events, having status pages that users and operations teams can refer to for information can reduce pressure on communication channels and disseminate information proactively',
			},
			{
				ChoiceId:
					'ops_operations_health_review_ops_metrics_prioritize_improvement',
				Title: 'Review operations metrics and prioritize improvement',
				Description:
					'Setting aside dedicated time and resources for reviewing the state of operations ensures that serving the day-to-day line of business remains a priority. Pull together operations leaders and stakeholders to regularly review metrics, reaffirm or modify goals and objectives, and prioritize improvements.',
			},
			{
				ChoiceId: 'ops_operations_health_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'operations-health',
				PillarId: 'operationalExcellence',
				QuestionTitle: 'How do you understand the health of your operations?',
				QuestionDescription:
					'Define, capture, and analyze operations metrics to gain visibility to the activities of operations teams so that you can take appropriate action.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.operations-health.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'event-response',
		PillarId: 'operationalExcellence',
		QuestionTitle: 'How do you manage workload and operations events?',
		Choices: [
			{
				ChoiceId: 'ops_event_response_event_incident_problem_process',
				Title: 'Use a process for event, incident, and problem management',
				Description:
					"The ability to efficiently manage events, incidents, and problems is key to maintaining workload health and performance. It's crucial to recognize and understand the differences between these elements to develop an effective response and resolution strategy. Establishing and following a well-defined process for each aspect helps your team swiftly and effectively handle any operational challenges that arise.",
			},
			{
				ChoiceId: 'ops_event_response_process_per_alert',
				Title: 'Have a process per alert',
				Description:
					'Establishing a clear and defined process for each alert in your system is essential for effective and efficient incident management. This practice ensures that every alert leads to a specific, actionable response, improving the reliability and responsiveness of your operations.',
			},
			{
				ChoiceId: 'ops_event_response_prioritize_events',
				Title: 'Prioritize operational events based on business impact',
				Description:
					'Responding promptly to operational events is critical, but not all events are equal. When you prioritize based on business impact, you also prioritize addressing events with the potential for significant consequences, such as safety, financial loss, regulatory violations, or damage to reputation.',
			},
			{
				ChoiceId: 'ops_event_response_define_escalation_paths',
				Title: 'Define escalation paths',
				Description:
					'Establish clear escalation paths within your incident response protocols to facilitate timely and effective action. This includes specifying prompts for escalation, detailing the escalation process, and pre-approving actions to expedite decision-making and reduce mean time to resolution (MTTR).',
			},
			{
				ChoiceId: 'ops_event_response_push_notify',
				Title:
					'Define a customer communication plan for service-impacting events',
				Description:
					'Effective communication during service impacting events is critical to maintain trust and transparency with customers. A well-defined communication plan helps your organization quickly and clearly share information, both internally and externally, during incidents.',
			},
			{
				ChoiceId: 'ops_event_response_dashboards',
				Title: 'Communicate status through dashboards',
				Description:
					'Use dashboards as a strategic tool to convey real-time operational status and key metrics to different audiences, including internal technical teams, leadership, and customers. These dashboards offer a centralized, visual representation of system health and business performance, enhancing transparency and decision-making efficiency.',
			},
			{
				ChoiceId: 'ops_event_response_auto_event_response',
				Title: 'Automate responses to events',
				Description:
					'Automating event responses is key for fast, consistent, and error-free operational handling. Create streamlined processes and use tools to automatically manage and respond to events, minimizing manual interventions and enhancing operational effectiveness.',
			},
			{
				ChoiceId: 'ops_event_response_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'event-response',
				PillarId: 'operationalExcellence',
				QuestionTitle: 'How do you manage workload and operations events?',
				QuestionDescription:
					'Prepare and validate procedures for responding to events to minimize their disruption to your workload.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.event-response.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'evolve-ops',
		PillarId: 'operationalExcellence',
		QuestionTitle: 'How do you evolve operations?',
		Choices: [
			{
				ChoiceId: 'ops_evolve_ops_process_cont_imp',
				Title: 'Have a process for continuous improvement',
				Description:
					'Evaluate your workload against internal and external architecture best practices. Conduct frequent, intentional workload reviews. Prioritize improvement opportunities into your software development cadence.',
			},
			{
				ChoiceId: 'ops_evolve_ops_perform_rca_process',
				Title: 'Perform post-incident analysis',
				Description:
					'Review customer-impacting events, and identify the contributing factors and preventative actions. Use this information to develop mitigations to limit or prevent recurrence. Develop procedures for prompt and effective responses. Communicate contributing factors and corrective actions as appropriate, tailored to target audiences.',
			},
			{
				ChoiceId: 'ops_evolve_ops_feedback_loops',
				Title: 'Implement feedback loops',
				Description:
					'Feedback loops provide actionable insights that drive decision making. Build feedback loops into your procedures and workloads. This helps you identify issues and areas that need improvement. They also validate investments made in improvements. These feedback loops are the foundation for continuously improving your workload.',
			},
			{
				ChoiceId: 'ops_evolve_ops_knowledge_management',
				Title: 'Perform knowledge management',
				Description:
					'Knowledge management helps team members find the information to perform their job. In learning organizations, information is freely shared which empowers individuals. The information can be discovered or searched. Information is accurate and up to date. Mechanisms exist to create new information, update existing information, and archive outdated information. The most common example of a knowledge management platform is a content management system like a wiki.',
			},
			{
				ChoiceId: 'ops_evolve_ops_drivers_for_imp',
				Title: 'Define drivers for improvement',
				Description:
					'Identify drivers for improvement to help you evaluate and prioritize opportunities based on data and feedback loops. Explore improvement opportunities in your systems and processes, and automate where appropriate.',
			},
			{
				ChoiceId: 'ops_evolve_ops_validate_insights',
				Title: 'Validate insights',
				Description:
					'Review your analysis results and responses with cross-functional teams and business owners. Use these reviews to establish common understanding, identify additional impacts, and determine courses of action. Adjust responses as appropriate.',
			},
			{
				ChoiceId: 'ops_evolve_ops_metrics_review',
				Title: 'Perform operations metrics reviews',
				Description:
					'Regularly perform retrospective analysis of operations metrics with cross-team participants from different areas of the business. Use these reviews to identify opportunities for improvement, potential courses of action, and to share lessons learned. Look for opportunities to improve in all of your environments (for example, development, test, and production).',
			},
			{
				ChoiceId: 'ops_evolve_ops_share_lessons_learned',
				Title: 'Document and share lessons learned',
				Description:
					'Document and share lessons learned from the operations activities so that you can use them internally and across teams. You should share what your teams learn to increase the benefit across your organization. Share information and resources to prevent avoidable errors and ease development efforts, and focus on delivery of desired features.',
			},
			{
				ChoiceId: 'ops_evolve_ops_allocate_time_for_imp',
				Title: 'Allocate time to make improvements',
				Description:
					'Dedicate time and resources within your processes to make continuous incremental improvements possible.',
			},
			{
				ChoiceId: 'ops_evolve_ops_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'evolve-ops',
				PillarId: 'operationalExcellence',
				QuestionTitle: 'How do you evolve operations?',
				QuestionDescription:
					'Dedicate time and resources for continuous incremental improvement to evolve the effectiveness and efficiency of your operations.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.evolve-ops.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'performing-architecture',
		PillarId: 'performance',
		QuestionTitle:
			'How do you select the appropriate cloud resources and architecture patterns for your workload?',
		Choices: [
			{
				ChoiceId: 'perf_architecture_understand_cloud_services_and_features',
				Title:
					'Learn about and understand available cloud services and features',
				Description:
					'Continually learn about and discover available services and configurations that help you make better architectural decisions and improve performance efficiency in your workload architecture.',
			},
			{
				ChoiceId: 'perf_architecture_evaluate_trade_offs',
				Title:
					'Evaluate how trade-offs impact customers and architecture efficiency',
				Description:
					'When evaluating performance-related improvements, determine which choices impact your customers and workload efficiency. For example, if using a key-value data store increases system performance, it is important to evaluate how the eventually consistent nature of this change will impact customers.',
			},
			{
				ChoiceId:
					'perf_architecture_guidance_architecture_patterns_best_practices',
				Title:
					'Use guidance from your cloud provider or an appropriate partner to learn about architecture patterns and best practices',
				Description:
					'Use cloud company resources such as documentation, solutions architects, professional services, or appropriate partners to guide your architectural decisions. These resources help you review and improve your architecture for optimal performance.',
			},
			{
				ChoiceId: 'perf_architecture_factor_cost_into_architectural_decisions',
				Title: 'Factor cost into architectural decisions',
				Description:
					'Factor cost into your architectural decisions to improve resource utilization and performance efficiency of your cloud workload. When you are aware of the cost implications of your cloud workload, you are more likely to leverage efficient resources and reduce wasteful practices.',
			},
			{
				ChoiceId: 'perf_architecture_use_policies_and_reference_architectures',
				Title: 'Use policies and reference architectures',
				Description:
					'Use internal policies and existing reference architectures when selecting services and configurations to be more efficient when designing and implementing your workload.',
			},
			{
				ChoiceId: 'perf_architecture_use_benchmarking',
				Title: 'Use benchmarking to drive architectural decisions',
				Description:
					'Benchmark the performance of an existing workload to understand how it performs on the cloud and drive architectural decisions based on that data.',
			},
			{
				ChoiceId: 'perf_architecture_use_data_driven_approach',
				Title: 'Use a data-driven approach for architectural choices',
				Description:
					'Define a clear, data-driven approach for architectural choices to verify that the right cloud services and configurations are used to meet your specific business needs.',
			},
			{
				ChoiceId: 'perf_performing_architecture_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'performing-architecture',
				PillarId: 'performance',
				QuestionTitle:
					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
				QuestionDescription:
					'The optimal solution for a particular workload varies, and solutions often combine multiple approaches. Well-Architected workloads use multiple solutions and allow different features to improve performance.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.performing-architecture.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'compute-hardware',
		PillarId: 'performance',
		QuestionTitle:
			'How do you select and use compute resources in your workload?',
		Choices: [
			{
				ChoiceId: 'perf_compute_hardware_select_best_compute_options',
				Title: 'Select the best compute options for your workload',
				Description:
					'Selecting the most appropriate compute option for your workload allows you to improve performance, reduce unnecessary infrastructure costs, and lower the operational efforts required to maintain your workload.',
			},
			{
				ChoiceId: 'perf_compute_hardware_collect_compute_related_metrics',
				Title: 'Collect compute-related metrics',
				Description:
					'Record and track compute-related metrics to better understand how your compute resources are performing and improve their performance and their utilization.',
			},
			{
				ChoiceId: 'perf_compute_hardware_scale_compute_resources_dynamically',
				Title: 'Scale your compute resources dynamically',
				Description:
					'Use the elasticity of the cloud to scale your compute resources up or down dynamically to match your needs and avoid over- or under-provisioning capacity for your workload.',
			},
			{
				ChoiceId:
					'perf_compute_hardware_understand_compute_configuration_features',
				Title: 'Understand the available compute configuration and features',
				Description:
					'Understand the available configuration options and features for your compute service to help you provision the right amount of resources and improve performance efficiency.',
			},
			{
				ChoiceId:
					'perf_compute_hardware_configure_and_right_size_compute_resources',
				Title: 'Configure and right-size compute resources',
				Description:
					'Configure and right-size compute resources to match your workload’s performance requirements and avoid under- or over-utilized resources.',
			},
			{
				ChoiceId: 'perf_compute_hardware_compute_accelerators',
				Title: 'Use optimized hardware-based compute accelerators',
				Description:
					'Use hardware accelerators to perform certain functions more efficiently than CPU-based alternatives.',
			},
			{
				ChoiceId: 'perf_compute_hardware_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'compute-hardware',
				PillarId: 'performance',
				QuestionTitle:
					'How do you select and use compute resources in your workload?',
				QuestionDescription:
					'The optimal compute choice for a particular workload can vary based on application design, usage patterns, and configuration settings. Architectures may use different compute choices for various components and allow different features to improve performance. Selecting the wrong compute choice for an architecture can lead to lower performance efficiency.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.compute-hardware.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'data-management',
		PillarId: 'performance',
		QuestionTitle:
			'How do you store, manage, and access data in your workload?',
		Choices: [
			{
				ChoiceId: 'perf_data_use_purpose_built_data_store',
				Title:
					'Use purpose-built data store that best support your data access and storage requirements',
				Description:
					'Understand data characteristics (like shareable, size, cache size, access patterns, latency, throughput, and persistence of data) to select the right purpose-built data stores (storage or database) for your workload.',
			},
			{
				ChoiceId: 'perf_data_collect_record_data_store_performance_metrics',
				Title: 'Collect and record data store performance metrics',
				Description:
					'Track and record relevant performance metrics for your data store to understand how your data management solutions are performing. These metrics can help you optimize your data store, verify that your workload requirements are met, and provide a clear overview on how the workload performs.',
			},
			{
				ChoiceId: 'perf_data_evaluate_configuration_options_data_store',
				Title: 'Evaluate available configuration options for data store',
				Description:
					'Understand and evaluate the various features and configuration options available for your data stores to optimize storage space and performance for your workload.',
			},
			{
				ChoiceId: 'perf_data_implement_strategies_to_improve_query_performance',
				Title:
					'Implement strategies to improve query performance in data store',
				Description:
					'Implement strategies to optimize data and improve data query to enable more scalability and efficient performance for your workload.',
			},
			{
				ChoiceId: 'perf_data_access_patterns_caching',
				Title: 'Implement data access patterns that utilize caching',
				Description:
					'Implement access patterns that can benefit from caching data for fast retrieval of frequently accessed data.',
			},
			{
				ChoiceId: 'perf_data_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'data-management',
				PillarId: 'performance',
				QuestionTitle:
					'How do you store, manage, and access data in your workload?',
				QuestionDescription:
					'The optimal data management solution for a particular system varies based on the kind of data type (block, file, or object), access patterns (random or sequential), required throughput, frequency of access (online, offline, archival), frequency of update (WORM, dynamic), and availability and durability constraints. Well-Architected workloads use purpose-built data stores which allow different features to improve performance.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.data-management.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'networking',
		PillarId: 'performance',
		QuestionTitle:
			'How do you select and configure networking resources in your workload?',
		Choices: [
			{
				ChoiceId:
					'perf_networking_understand_how_networking_impacts_performance',
				Title: 'Understand how networking impacts performance',
				Description:
					'Analyze and understand how network-related decisions impact your workload to provide efficient performance and improved user experience.',
			},
			{
				ChoiceId: 'perf_networking_evaluate_networking_features',
				Title: 'Evaluate available networking features',
				Description:
					'Evaluate networking features in the cloud that may increase performance. Measure the impact of these features through testing, metrics, and analysis. For example, take advantage of network-level features that are available to reduce latency, network distance, or jitter.',
			},
			{
				ChoiceId:
					'perf_networking_choose_appropriate_dedicated_connectivity_or_vpn',
				Title:
					'Choose appropriate dedicated connectivity or VPN for your workload',
				Description:
					'When hybrid connectivity is required to connect on-premises and cloud resources, provision adequate bandwidth to meet your performance requirements. Estimate the bandwidth and latency requirements for your hybrid workload. These numbers will drive your sizing requirements.',
			},
			{
				ChoiceId: 'perf_networking_load_balancing_distribute_traffic',
				Title:
					'Use load balancing to distribute traffic across multiple resources',
				Description:
					'Distribute traffic across multiple resources or services to allow your workload to take advantage of the elasticity that the cloud provides. You can also use load balancing for offloading encryption termination to improve performance, reliability and manage and route traffic effectively.',
			},
			{
				ChoiceId:
					'perf_networking_choose_network_protocols_improve_performance',
				Title: 'Choose network protocols to improve performance',
				Description:
					'Make decisions about protocols for communication between systems and networks based on the impact to the workload’s performance.',
			},
			{
				ChoiceId:
					'perf_networking_choose_workload_location_network_requirements',
				Title: "Choose your workload's location based on network requirements",
				Description:
					'Evaluate options for resource placement to reduce network latency and improve throughput, providing an optimal user experience by reducing page load and data transfer times.',
			},
			{
				ChoiceId:
					'perf_networking_optimize_network_configuration_based_on_metrics',
				Title: 'Optimize network configuration based on metrics',
				Description:
					'Use collected and analyzed data to make informed decisions about optimizing your network configuration.',
			},
			{
				ChoiceId: 'perf_networking_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'networking',
				PillarId: 'performance',
				QuestionTitle:
					'How do you select and configure networking resources in your workload?',
				QuestionDescription:
					'The optimal networking solution for a workload varies based on latency, throughput requirements, jitter, and bandwidth. Physical constraints, such as user or on-premises resources, determine location options. These constraints can be offset with edge locations or resource placement.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.networking.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'process-culture',
		PillarId: 'performance',
		QuestionTitle:
			'What process do you use to support more performance efficiency for your workload?',
		Choices: [
			{
				ChoiceId: 'perf_process_culture_establish_key_performance_indicators',
				Title:
					'Establish key performance indicators (KPIs) to measure workload health and performance',
				Description:
					'Identify the KPIs that quantitatively and qualitatively measure workload performance. KPIs help you measure the health and performance of a workload related to a business goal.',
			},
			{
				ChoiceId: 'perf_process_culture_use_monitoring_solutions',
				Title:
					'Use monitoring solutions to understand the areas where performance is most critical',
				Description:
					'Understand and identify areas where increasing the performance of your workload will have a positive impact on efficiency or customer experience. For example, a website that has a large amount of customer interaction can benefit from using edge services to move content delivery closer to customers.',
			},
			{
				ChoiceId: 'perf_process_culture_workload_performance',
				Title: 'Define a process to improve workload performance',
				Description:
					'Define a process to evaluate new services, design patterns, resource types, and configurations as they become available. For example, run existing performance tests on new instance offerings to determine their potential to improve your workload.',
			},
			{
				ChoiceId: 'perf_process_culture_review_metrics',
				Title: 'Review metrics at regular intervals',
				Description:
					'As part of routine maintenance or in response to events or incidents, review which metrics are collected. Use these reviews to identify which metrics were essential in addressing issues and which additional metrics, if they were being tracked, could help identify, address, or prevent issues.',
			},
			{
				ChoiceId: 'perf_process_culture_load_test',
				Title: 'Load test your workload',
				Description:
					'Load test your workload to verify it can handle production load and identify any performance bottleneck.',
			},
			{
				ChoiceId: 'perf_process_culture_automation_remediate_issues',
				Title:
					'Use automation to proactively remediate performance-related issues',
				Description:
					'Use key performance indicators (KPIs), combined with monitoring and alerting systems, to proactively address performance-related issues.',
			},
			{
				ChoiceId: 'perf_process_culture_keep_workload_and_services_up_to_date',
				Title: 'Keep your workload and services up-to-date',
				Description:
					'Stay up-to-date on new cloud services and features to adopt efficient features, remove issues, and improve the overall performance efficiency of your workload.',
			},
			{
				ChoiceId: 'perf_process_culture_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'process-culture',
				PillarId: 'performance',
				QuestionTitle:
					'What process do you use to support more performance efficiency for your workload?',
				QuestionDescription:
					'When architecting workloads, there are principles and practices that you can adopt to help you better run efficient high-performing cloud workloads.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.process-culture.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'manage-service-limits',
		PillarId: 'reliability',
		QuestionTitle: 'How do you manage service quotas and constraints?',
		Choices: [
			{
				ChoiceId: 'rel_manage_service_limits_aware_quotas_and_constraints',
				Title: 'Aware of service quotas and constraints',
				Description:
					'Be aware of your default quotas and manage your quota increase requests for your workload architecture. Know which cloud resource constraints, such as disk or network, are potentially impactful.',
			},
			{
				ChoiceId: 'rel_manage_service_limits_limits_considered',
				Title: 'Manage service quotas across accounts and Regions',
				Description:
					'If you are using multiple accounts or Regions, request the appropriate quotas in all environments in which your production workloads run.',
			},
			{
				ChoiceId: 'rel_manage_service_limits_aware_fixed_limits',
				Title:
					'Accommodate fixed service quotas and constraints through architecture',
				Description:
					'Be aware of unchangeable service quotas, service constraints, and physical resource limits. Design architectures for applications and services to prevent these limits from impacting reliability.',
			},
			{
				ChoiceId: 'rel_manage_service_limits_monitor_manage_limits',
				Title: 'Monitor and manage quotas',
				Description:
					'Evaluate your potential usage and increase your quotas appropriately, allowing for planned growth in usage.',
			},
			{
				ChoiceId: 'rel_manage_service_limits_automated_monitor_limits',
				Title: 'Automate quota management',
				Description:
					'Implement tools to alert you when thresholds are being approached. You can automate quota increase requests by using AWS Service Quotas APIs.',
			},
			{
				ChoiceId: 'rel_manage_service_limits_suff_buffer_limits',
				Title:
					'Ensure that a sufficient gap exists between the current quotas and the maximum usage to accommodate failover',
				Description:
					'When a resource fails or is inaccessible, that resource might still be counted against a quota until it’s successfully terminated. Verify that your quotas cover the overlap of failed or inaccessible resources and their replacements. You should consider use cases like network failure, Availability Zone failure, or Regional failures when calculating this gap.',
			},
			{
				ChoiceId: 'rel_manage_service_limits_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'manage-service-limits',
				PillarId: 'reliability',
				QuestionTitle: 'How do you manage service quotas and constraints?',
				QuestionDescription:
					'For cloud-based workload architectures, there are service quotas (which are also referred to as service limits). These quotas exist to prevent accidentally provisioning more resources than you need and to limit request rates on API operations so as to protect services from abuse. There are also resource constraints, for example, the rate that you can push bits down a fiber-optic cable, or the amount of storage on a physical disk.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.manage-service-limits.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'planning-network-topology',
		PillarId: 'reliability',
		QuestionTitle: 'How do you plan your network topology?',
		Choices: [
			{
				ChoiceId: 'rel_planning_network_topology_ha_conn_users',
				Title:
					'Use highly available network connectivity for your workload public endpoints',
				Description:
					'Building highly available network connectivity to public endpoints of your workloads can help you reduce downtime due to loss of connectivity and improve the availability and SLA of your workload. To achieve this, use highly available DNS, content delivery networks (CDNs), API gateways, load balancing, or reverse proxies.',
			},
			{
				ChoiceId: 'rel_planning_network_topology_ha_conn_private_networks',
				Title:
					'Provision redundant connectivity between private networks in the cloud and on-premises environments',
				Description:
					'Implement redundancy in your connections between private networks in the cloud and on-premises environments to achieve connectivity resilience. This can be accomplished by deploying two or more links and traffic paths, preserving connectivity in the event of network failures.',
			},
			{
				ChoiceId: 'rel_planning_network_topology_ip_subnet_allocation',
				Title:
					'Ensure IP subnet allocation accounts for expansion and availability',
				Description:
					'Amazon VPC IP address ranges must be large enough to accommodate workload requirements, including factoring in future expansion and allocation of IP addresses to subnets across Availability Zones. This includes load balancers, EC2 instances, and container-based applications.',
			},
			{
				ChoiceId: 'rel_planning_network_topology_prefer_hub_and_spoke',
				Title: 'Prefer hub-and-spoke topologies over many-to-many mesh',
				Description:
					'When connecting multiple private networks, such as Virtual Private Clouds (VPCs) and on-premises networks, opt for a hub-and-spoke topology over a meshed one. Unlike meshed topologies, where each network connects directly to the others and increases the complexity and management overhead, the hub-and-spoke architecture centralizes connections through a single hub. This centralization simplifies the network structure and enhances its operability, scalability, and control.',
			},
			{
				ChoiceId: 'rel_planning_network_topology_non_overlap_ip',
				Title:
					'Enforce non-overlapping private IP address ranges in all private address spaces where they are connected',
				Description:
					'The IP address ranges of each of your VPCs must not overlap when peered, connected via Transit Gateway, or connected over VPN. Avoid IP address conflicts between a VPC and on-premises environments or with other cloud providers that you use. You must also have a way to allocate private IP address ranges when needed. An IP address management (IPAM) system can help with automating this.',
			},
			{
				ChoiceId: 'rel_planning_network_topology_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'planning-network-topology',
				PillarId: 'reliability',
				QuestionTitle: 'How do you plan your network topology?',
				QuestionDescription:
					'Workloads often exist in multiple environments. These include multiple cloud environments (both publicly accessible and private) and possibly your existing data center infrastructure. Plans must include network considerations such as intra- and inter-system connectivity, public IP address management, private IP address management, and domain name resolution.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.planning-network-topology.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'service-architecture',
		PillarId: 'reliability',
		QuestionTitle: 'How do you design your workload service architecture?',
		Choices: [
			{
				ChoiceId: 'rel_service_architecture_monolith_soa_microservice',
				Title: 'Choose how to segment your workload',
				Description:
					'Workload segmentation is important when determining the resilience requirements of your application. Monolithic architecture should be avoided whenever possible. Instead, carefully consider which application components can be broken out into microservices. Depending on your application requirements, this may end up being a combination of a service-oriented architecture (SOA) with microservices where possible. Workloads that are capable of statelessness are more capable of being deployed as microservices.',
			},
			{
				ChoiceId: 'rel_service_architecture_business_domains',
				Title:
					'Build services focused on specific business domains and functionality',
				Description:
					'Service-oriented architectures (SOA) define services with well-delineated functions defined by business needs. Microservices use domain models and bounded context to draw service boundaries along business context boundaries. Focusing on business domains and functionality helps teams define independent reliability requirements for their services. Bounded contexts isolate and encapsulate business logic, allowing teams to better reason about how to handle failures.',
			},
			{
				ChoiceId: 'rel_service_architecture_api_contracts',
				Title: 'Provide service contracts per API',
				Description:
					'Service contracts are documented agreements between API producers and consumers defined in a machine-readable API definition. A contract versioning strategy allows consumers to continue using the existing API and migrate their applications to a newer API when they are ready. Producer deployment can happen any time as long as the contract is followed. Service teams can use the technology stack of their choice to satisfy the API contract.',
			},
			{
				ChoiceId: 'rel_service_architecture_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'service-architecture',
				PillarId: 'reliability',
				QuestionTitle: 'How do you design your workload service architecture?',
				QuestionDescription:
					'Build highly scalable and reliable workloads using a service-oriented architecture (SOA) or a microservices architecture. Service-oriented architecture (SOA) is the practice of making software components reusable via service interfaces. Microservices architecture goes further to make components smaller and simpler.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.service-architecture.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'prevent-interaction-failure',
		PillarId: 'reliability',
		QuestionTitle:
			'How do you design interactions in a distributed system to prevent failures?',
		Choices: [
			{
				ChoiceId: 'rel_prevent_interaction_failure_identify',
				Title: 'Identify the kind of distributed systems you depend on',
				Description:
					'Distributed systems can be synchronous, asynchronous, or batch. Synchronous systems must process requests as quickly as possible and communicate with each other by making synchronous request and response calls using HTTP/S, REST, or remote procedure call (RPC) protocols. Asynchronous systems communicate with each other by exchanging data asynchronously through an intermediary service without coupling individual systems. Batch systems receive a large volume of input data, run automated data processes without human intervention, and generate output data.',
			},
			{
				ChoiceId: 'rel_prevent_interaction_failure_loosely_coupled_system',
				Title: 'Implement loosely coupled dependencies',
				Description:
					'Dependencies such as queuing systems, streaming systems, workflows, and load balancers are loosely coupled. Loose coupling helps isolate behavior of a component from other components that depend on it, increasing resiliency and agility.',
			},
			{
				ChoiceId: 'rel_prevent_interaction_failure_idempotent',
				Title: 'Make all responses idempotent',
				Description:
					'An idempotent service promises that each request is completed exactly once, such that making multiple identical requests has the same effect as making a single request. An idempotent service makes it easier for a client to implement retries without fear that a request will be erroneously processed multiple times. To do this, clients can issue API requests with an idempotency token—the same token is used whenever the request is repeated. An idempotent service API uses the token to return a response identical to the response that was returned the first time that the request was completed.',
			},
			{
				ChoiceId: 'rel_prevent_interaction_failure_constant_work',
				Title: 'Do constant work',
				Description:
					'Systems can fail when there are large, rapid changes in load. For example, if your workload is doing a health check that monitors the health of thousands of servers, it should send the same size payload (a full snapshot of the current state) each time. Whether no servers are failing, or all of them, the health check system is doing constant work with no large, rapid changes.',
			},
			{
				ChoiceId: 'rel_prevent_interaction_failure_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'prevent-interaction-failure',
				PillarId: 'reliability',
				QuestionTitle:
					'How do you design interactions in a distributed system to prevent failures?',
				QuestionDescription:
					'Distributed systems rely on communications networks to interconnect components, such as servers or services. Your workload must operate reliably despite data loss or latency in these networks. Components of the distributed system must operate in a way that does not negatively impact other components or the workload. These best practices prevent failures and improve mean time between failures (MTBF).',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.prevent-interaction-failure.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'mitigate-interaction-failure',
		PillarId: 'reliability',
		QuestionTitle:
			'How do you design interactions in a distributed system to mitigate or withstand failures?',
		Choices: [
			{
				ChoiceId: 'rel_mitigate_interaction_failure_graceful_degradation',
				Title:
					'Implement graceful degradation to transform applicable hard dependencies into soft dependencies',
				Description:
					'Application components should continue to perform their core function even if dependencies become unavailable. They might be serving slightly stale data, alternate data, or even no data. This ensures overall system function is only minimally impeded by localized failures while delivering the central business value.',
			},
			{
				ChoiceId: 'rel_mitigate_interaction_failure_throttle_requests',
				Title: 'Throttle requests',
				Description:
					'Throttle requests to mitigate resource exhaustion due to unexpected increases in demand. Requests below throttling rates are processed while those over the defined limit are rejected with a return a message indicating the request was throttled.',
			},
			{
				ChoiceId: 'rel_mitigate_interaction_failure_limit_retries',
				Title: 'Control and limit retry calls',
				Description:
					'Use exponential backoff to retry requests at progressively longer intervals between each retry. Introduce jitter between retries to randomize retry intervals. Limit the maximum number of retries.',
			},
			{
				ChoiceId: 'rel_mitigate_interaction_failure_fail_fast',
				Title: 'Fail fast and limit queues',
				Description:
					'When a service is unable to respond successfully to a request, fail fast. This allows resources associated with a request to be released, and permits a service to recover if it’s running out of resources. Failing fast is a well-established software design pattern that can be leveraged to build highly reliable workloads in the cloud. Queuing is also a well-established enterprise integration pattern that can smooth load and allow clients to release resources when asynchronous processing can be tolerated. When a service is able to respond successfully under normal conditions but fails when the rate of requests is too high, use a queue to buffer requests. However, do not allow a buildup of long queue backlogs that can result in processing stale requests that a client has already given up on.',
			},
			{
				ChoiceId: 'rel_mitigate_interaction_failure_client_timeouts',
				Title: 'Set client timeouts',
				Description:
					'Set timeouts appropriately on connections and requests, verify them systematically, and do not rely on default values as they are not aware of workload specifics.',
			},
			{
				ChoiceId: 'rel_mitigate_interaction_failure_stateless',
				Title: 'Make systems stateless where possible',
				Description:
					'Systems should either not require state, or should offload state such that between different client requests, there is no dependence on locally stored data on disk and in memory. This allows servers to be replaced at will without causing an availability impact.',
			},
			{
				ChoiceId: 'rel_mitigate_interaction_failure_emergency_levers',
				Title: 'Implement emergency levers',
				Description:
					'Emergency levers are rapid processes that can mitigate availability impact on your workload.',
			},
			{
				ChoiceId: 'rel_mitigate_interaction_failure_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'mitigate-interaction-failure',
				PillarId: 'reliability',
				QuestionTitle:
					'How do you design interactions in a distributed system to mitigate or withstand failures?',
				QuestionDescription:
					'Distributed systems rely on communications networks to interconnect components (such as servers or services). Your workload must operate reliably despite data loss or latency over these networks. Components of the distributed system must operate in a way that does not negatively impact other components or the workload. These best practices enable workloads to withstand stresses or failures, more quickly recover from them, and mitigate the impact of such impairments. The result is improved mean time to recovery (MTTR).',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.mitigate-interaction-failure.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'monitor-aws-resources',
		PillarId: 'reliability',
		QuestionTitle: 'How do you monitor workload resources?',
		Choices: [
			{
				ChoiceId: 'rel_monitor_aws_resources_monitor_resources',
				Title: 'Monitor all components for the workload (Generation)',
				Description:
					'Monitor the components of the workload with Amazon CloudWatch or third-party tools. Monitor AWS services with AWS Health Dashboard.',
			},
			{
				ChoiceId: 'rel_monitor_aws_resources_notification_aggregation',
				Title: 'Define and calculate metrics (Aggregation)',
				Description:
					'Store log data and apply filters where necessary to calculate metrics, such as counts of a specific log event, or latency calculated from log event timestamps.',
			},
			{
				ChoiceId: 'rel_monitor_aws_resources_notification_monitor',
				Title: 'Send notifications (Real-time processing and alarming)',
				Description:
					'When organizations detect potential issues, they send real-time notifications and alerts to the appropriate personnel and systems in order to respond quickly and effectively to these issues.',
			},
			{
				ChoiceId: 'rel_monitor_aws_resources_automate_response_monitor',
				Title: 'Automate responses (Real-time processing and alarming)',
				Description:
					'Use automation to take action when an event is detected, for example, to replace failed components.',
			},
			{
				ChoiceId: 'rel_monitor_aws_resources_storage_analytics',
				Title: 'Analyze logs',
				Description:
					'Organizations use log analysis to search, analyze, and visualize data generated by your IT systems, applications, and technology infrastructure. Perform regular log analysis to provide operational insights into your workloads. Capture and centralize all logs and metrics from your applications and services to get deep visibility into your application and infrastructure stack and improve uptime.',
			},
			{
				ChoiceId: 'rel_monitor_aws_resources_review_monitoring',
				Title: 'Conduct reviews regularly',
				Description:
					'Frequently review how workload monitoring is implemented and update it based on significant events and changes.',
			},
			{
				ChoiceId: 'rel_monitor_aws_resources_end_to_end',
				Title: 'Monitor end-to-end tracing of requests through your system',
				Description:
					'Trace requests as they process through service components so product teams can more easily analyze and debug issues and improve performance.',
			},
			{
				ChoiceId: 'rel_monitor_aws_resources_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'monitor-aws-resources',
				PillarId: 'reliability',
				QuestionTitle: 'How do you monitor workload resources?',
				QuestionDescription:
					'Logs and metrics are powerful tools to gain insight into the health of your workload. You can configure your workload to monitor logs and metrics and send notifications when thresholds are crossed or significant events occur. Monitoring enables your workload to recognize when low-performance thresholds are crossed or failures occur, so it can recover automatically in response.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.monitor-aws-resources.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'adapt-to-changes',
		PillarId: 'reliability',
		QuestionTitle:
			'How do you design your workload to adapt to changes in demand?',
		Choices: [
			{
				ChoiceId: 'rel_adapt_to_changes_autoscale_adapt',
				Title: 'Use automation when obtaining or scaling resources',
				Description:
					'When replacing impaired resources or scaling your workload, automate the process by using managed AWS services, such as Amazon S3 and AWS Auto Scaling. You can also use third-party tools and AWS SDKs to automate scaling.',
			},
			{
				ChoiceId: 'rel_adapt_to_changes_reactive_adapt_auto',
				Title: 'Obtain resources upon detection of impairment to a workload',
				Description:
					'Scale resources reactively when necessary if availability is impacted, to restore workload availability.',
			},
			{
				ChoiceId: 'rel_adapt_to_changes_proactive_adapt_auto',
				Title:
					'Obtain resources upon detection that more resources are needed for a workload',
				Description:
					'Scale resources proactively to meet demand and avoid availability impact.',
			},
			{
				ChoiceId: 'rel_adapt_to_changes_load_tested_adapt',
				Title: 'Load test your workload',
				Description:
					'Adopt a load testing methodology to measure if scaling activity meets workload requirements.',
			},
			{
				ChoiceId: 'rel_adapt_to_changes_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'adapt-to-changes',
				PillarId: 'reliability',
				QuestionTitle:
					'How do you design your workload to adapt to changes in demand?',
				QuestionDescription:
					'A scalable workload provides elasticity to add or remove resources automatically so that they closely match the current demand at any given point in time.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.adapt-to-changes.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'tracking-change-management',
		PillarId: 'reliability',
		QuestionTitle: 'How do you implement change?',
		Choices: [
			{
				ChoiceId: 'rel_tracking_change_management_planned_changemgmt',
				Title: 'Use runbooks for standard activities such as deployment',
				Description:
					'Runbooks are the predefined procedures to achieve specific outcomes. Use runbooks to perform standard activities, whether done manually or automatically. Examples include deploying a workload, patching a workload, or making DNS modifications.',
			},
			{
				ChoiceId: 'rel_tracking_change_management_functional_testing',
				Title: 'Integrate functional testing as part of your deployment',
				Description:
					'Functional tests are run as part of automated deployment. If success criteria are not met, the pipeline is halted or rolled back. These tests are run in a pre-production environment, which is staged prior to production in the pipeline. Ideally, this is done as part of a deployment pipeline.',
			},
			{
				ChoiceId: 'rel_tracking_change_management_resiliency_testing',
				Title: 'Integrate resiliency testing as part of your deployment',
				Description:
					'Integrate resiliency testing by consciously introducing failures in your system to measure its capability in case of disruptive scenarios. Resilience tests are different from unit and function tests that are usually integrated in deployment cycles, as they focus on the identification of unanticipated failures in your system. While it is safe to start with resiliency testing integration in pre-production, set a goal to implement these tests in production as a part of your game days.',
			},
			{
				ChoiceId: 'rel_tracking_change_management_immutable_infrastructure',
				Title: 'Deploy using immutable infrastructure',
				Description:
					'Immutable infrastructure is a model that mandates that no updates, security patches, or configuration changes happen in-place on production workloads. When a change is needed, the architecture is built onto new infrastructure and deployed into production.',
			},
			{
				ChoiceId: 'rel_tracking_change_management_automated_changemgmt',
				Title: 'Deploy changes with automation',
				Description:
					'Deployments and patching are automated to eliminate negative impact.',
			},
			{
				ChoiceId: 'rel_tracking_change_management_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'tracking-change-management',
				PillarId: 'reliability',
				QuestionTitle: 'How do you implement change?',
				QuestionDescription:
					'Controlled changes are necessary to deploy new functionality, and to ensure that the workloads and the operating environment are running known software and can be patched or replaced in a predictable manner. If these changes are uncontrolled, then it makes it difficult to predict the effect of these changes, or to address issues that arise because of them.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.tracking-change-management.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'backing-up-data',
		PillarId: 'reliability',
		QuestionTitle: 'How do you back up data?',
		Choices: [
			{
				ChoiceId: 'rel_backing_up_data_identified_backups_data',
				Title:
					'Identify and back up all data that needs to be backed up, or reproduce the data from sources',
				Description:
					'Understand and use the backup capabilities of the data services and resources used by the workload. Most services provide capabilities to back up workload data.',
			},
			{
				ChoiceId: 'rel_backing_up_data_secured_backups_data',
				Title: 'Secure and encrypt backups',
				Description:
					'Control and detect access to backups using authentication and authorization. Prevent and detect if data integrity of backups is compromised using encryption.',
			},
			{
				ChoiceId: 'rel_backing_up_data_automated_backups_data',
				Title: 'Perform data backup automatically',
				Description:
					'Configure backups to be taken automatically based on a periodic schedule informed by the Recovery Point Objective (RPO), or by changes in the dataset. Critical datasets with low data loss requirements need to be backed up automatically on a frequent basis, whereas less critical data where some loss is acceptable can be backed up less frequently.',
			},
			{
				ChoiceId: 'rel_backing_up_data_periodic_recovery_testing_data',
				Title:
					'Perform periodic recovery of the data to verify backup integrity and processes',
				Description:
					'Validate that your backup process implementation meets your Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO) by performing a recovery test.',
			},
			{
				ChoiceId: 'rel_backing_up_data_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'backing-up-data',
				PillarId: 'reliability',
				QuestionTitle: 'How do you back up data?',
				QuestionDescription:
					'Back up data, applications, and configuration to meet your requirements for recovery time objectives (RTO) and recovery point objectives (RPO).',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.backing-up-data.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'fault-isolation',
		PillarId: 'reliability',
		QuestionTitle: 'How do you use fault isolation to protect your workload?',
		Choices: [
			{
				ChoiceId: 'rel_fault_isolation_multiaz_region_system',
				Title: 'Deploy the workload to multiple locations',
				Description:
					'Distribute workload data and resources across multiple Availability Zones or, where necessary, across AWS Regions. These locations can be as diverse as required.',
			},
			{
				ChoiceId: 'rel_fault_isolation_select_location',
				Title:
					'Select the appropriate locations for your multi-location deployment',
				Description:
					'For high availability, always (when possible) deploy your workload components to multiple Availability Zones (AZs). For workloads with extreme resilience requirements, carefully evaluate the options for a multi-Region architecture.',
			},
			{
				ChoiceId: 'rel_fault_isolation_use_bulkhead',
				Title: 'Use bulkhead architectures to limit scope of impact',
				Description:
					'Implement bulkhead architectures (also known as cell-based architectures) to restrict the effect of failure within a workload to a limited number of components.',
			},
			{
				ChoiceId: 'rel_fault_isolation_single_az_system',
				Title:
					'Automate recovery for components constrained to a single location',
				Description:
					'If components of the workload can only run in a single Availability Zone or in an on-premises data center, implement the capability to do a complete rebuild of the workload within your defined recovery objectives.',
			},
			{
				ChoiceId: 'rel_fault_isolation_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'fault-isolation',
				PillarId: 'reliability',
				QuestionTitle:
					'How do you use fault isolation to protect your workload?',
				QuestionDescription:
					'Fault isolated boundaries limit the effect of a failure within a workload to a limited number of components. Components outside of the boundary are unaffected by the failure. Using multiple fault isolated boundaries, you can limit the impact on your workload.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.fault-isolation.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'withstand-component-failures',
		PillarId: 'reliability',
		QuestionTitle:
			'How do you design your workload to withstand component failures?',
		Choices: [
			{
				ChoiceId: 'rel_withstand_component_failures_monitoring_health',
				Title: 'Monitor all components of the workload to detect failures',
				Description:
					'Continually monitor the health of your workload so that you and your automated systems are aware of failures or degradations as soon as they occur. Monitor for key performance indicators (KPIs) based on business value.',
			},
			{
				ChoiceId: 'rel_withstand_component_failures_failover2good',
				Title: 'Fail over to healthy resources',
				Description:
					'If a resource failure occurs, healthy resources should continue to serve requests. For location impairments (such as Availability Zone or AWS Region), ensure that you have systems in place to fail over to healthy resources in unimpaired locations.',
			},
			{
				ChoiceId: 'rel_withstand_component_failures_auto_healing_system',
				Title: 'Automate healing on all layers',
				Description:
					'Upon detection of a failure, use automated capabilities to perform actions to remediate. Degradations may be automatically healed through internal service mechanisms or require resources to be restarted or removed through remediation actions.',
			},
			{
				ChoiceId: 'rel_withstand_component_failures_avoid_control_plane',
				Title:
					'Rely on the data plane and not the control plane during recovery',
				Description:
					'Control planes provide the administrative APIs used to create, read and describe, update, delete, and list (CRUDL) resources, while data planes handle day-to-day service traffic. When implementing recovery or mitigation responses to potentially resiliency-impacting events, focus on using a minimal number of control plane operations to recover, rescale, restore, heal, or failover the service. Data plane action should supersede any activity during these degradation events.',
			},
			{
				ChoiceId: 'rel_withstand_component_failures_static_stability',
				Title: 'Use static stability to prevent bimodal behavior',
				Description:
					'Workloads should be statically stable and only operate in a single normal mode. Bimodal behavior is when your workload exhibits different behavior under normal and failure modes.',
			},
			{
				ChoiceId: 'rel_withstand_component_failures_notifications_sent_system',
				Title: 'Send notifications when events impact availability',
				Description:
					'Notifications are sent upon the detection of thresholds breached, even if the event causing by the issue was automatically resolved.',
			},
			{
				ChoiceId: 'rel_withstand_component_failures_service_level_agreements',
				Title:
					'Architect your product to meet availability targets and uptime service level agreements (SLAs)',
				Description:
					'Architect your product to meet availability targets and uptime service level agreements (SLAs). If you publish or privately agree to availability targets or uptime SLAs, verify that your architecture and operational processes are designed to support them.',
			},
			{
				ChoiceId: 'rel_withstand_component_failures_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'withstand-component-failures',
				PillarId: 'reliability',
				QuestionTitle:
					'How do you design your workload to withstand component failures?',
				QuestionDescription:
					'Workloads with a requirement for high availability and low mean time to recovery (MTTR) must be architected for resiliency.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.withstand-component-failures.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'testing-resiliency',
		PillarId: 'reliability',
		QuestionTitle: 'How do you test reliability?',
		Choices: [
			{
				ChoiceId: 'rel_testing_resiliency_playbook_resiliency',
				Title: 'Use playbooks to investigate failures',
				Description:
					'Enable consistent and prompt responses to failure scenarios that are not well understood, by documenting the investigation process in playbooks. Playbooks are the predefined steps performed to identify the factors contributing to a failure scenario. The results from any process step are used to determine the next steps to take until the issue is identified or escalated.',
			},
			{
				ChoiceId: 'rel_testing_resiliency_rca_resiliency',
				Title: 'Perform post-incident analysis',
				Description:
					'Review customer-impacting events, and identify the contributing factors and preventative action items. Use this information to develop mitigations to limit or prevent recurrence. Develop procedures for prompt and effective responses. Communicate contributing factors and corrective actions as appropriate, tailored to target audiences. Have a method to communicate these causes to others as needed.',
			},
			{
				ChoiceId: 'rel_testing_resiliency_test_non_functional',
				Title: 'Test scalability and performance requirements',
				Description:
					'Use techniques such as load testing to validate that the workload meets scaling and performance requirements.',
			},
			{
				ChoiceId: 'rel_testing_resiliency_failure_injection_resiliency',
				Title: 'Test resiliency using chaos engineering',
				Description:
					'Run chaos experiments regularly in environments that are in or as close to production as possible to understand how your system responds to adverse conditions.',
			},
			{
				ChoiceId: 'rel_testing_resiliency_game_days_resiliency',
				Title: 'Conduct game days regularly',
				Description:
					'Use game days to regularly exercise your procedures for responding to events and failures as close to production as possible (including in production environments) with the people who will be involved in actual failure scenarios. Game days enforce measures to ensure that production events do not impact users.',
			},
			{
				ChoiceId: 'rel_testing_resiliency_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'testing-resiliency',
				PillarId: 'reliability',
				QuestionTitle: 'How do you test reliability?',
				QuestionDescription:
					'After you have designed your workload to be resilient to the stresses of production, testing is the only way to ensure that it will operate as designed, and deliver the resiliency you expect.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.testing-resiliency.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'planning-for-recovery',
		PillarId: 'reliability',
		QuestionTitle: 'How do you plan for disaster recovery (DR)?',
		Choices: [
			{
				ChoiceId: 'rel_planning_for_recovery_objective_defined_recovery',
				Title: 'Define recovery objectives for downtime and data loss',
				Description:
					'The workload has a recovery time objective (RTO) and recovery point objective (RPO).',
			},
			{
				ChoiceId: 'rel_planning_for_recovery_disaster_recovery',
				Title:
					'Use defined recovery strategies to meet the recovery objectives',
				Description:
					"Define a disaster recovery (DR) strategy that meets your workload's recovery objectives. Choose a strategy such as backup and restore, standby (active/passive), or active/active.",
			},
			{
				ChoiceId: 'rel_planning_for_recovery_dr_tested',
				Title:
					'Test disaster recovery implementation to validate the implementation',
				Description:
					'Regularly test failover to your recovery site to verify that it operates properly and that RTO and RPO are met.',
			},
			{
				ChoiceId: 'rel_planning_for_recovery_config_drift',
				Title: 'Manage configuration drift at the DR site or Region',
				Description:
					'Ensure that the infrastructure, data, and configuration are as needed at the DR site or Region. For example, check that AMIs and service quotas are up to date.',
			},
			{
				ChoiceId: 'rel_planning_for_recovery_auto_recovery',
				Title: 'Automate recovery',
				Description:
					'Use AWS or third-party tools to automate system recovery and route traffic to the DR site or Region.',
			},
			{
				ChoiceId: 'rel_planning_for_recovery_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'planning-for-recovery',
				PillarId: 'reliability',
				QuestionTitle: 'How do you plan for disaster recovery (DR)?',
				QuestionDescription:
					'Having backups and redundant workload components in place is the start of your DR strategy. RTO and RPO are your objectives for restoration of your workload. Set these based on business needs. Implement a strategy to meet these objectives, considering locations and function of workload resources and data. The probability of disruption and cost of recovery are also key factors that help to inform the business value of providing disaster recovery for a workload.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.planning-for-recovery.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'securely-operate',
		PillarId: 'security',
		QuestionTitle: 'How do you securely operate your workload?',
		Choices: [
			{
				ChoiceId: 'sec_securely_operate_multi_accounts',
				Title: 'Separate workloads using accounts',
				Description:
					'Establish common guardrails and isolation between environments (such as production, development, and test) and workloads through a multi-account strategy. Account-level separation is strongly recommended, as it provides a strong isolation boundary for security, billing, and access.',
			},
			{
				ChoiceId: 'sec_securely_operate_aws_account',
				Title: 'Secure account root user and properties',
				Description:
					'The root user is the most privileged user in an AWS account, with full administrative access to all resources within the account, and in some cases cannot be constrained by security policies. Disabling programmatic access to the root user, establishing appropriate controls for the root user, and avoiding routine use of the root user helps reduce the risk of inadvertent exposure of the root credentials and subsequent compromise of the cloud environment.',
			},
			{
				ChoiceId: 'sec_securely_operate_control_objectives',
				Title: 'Identify and validate control objectives',
				Description:
					'Based on your compliance requirements and risks identified from your threat model, derive and validate the control objectives and controls that you need to apply to your workload. Ongoing validation of control objectives and controls help you measure the effectiveness of risk mitigation.',
			},
			{
				ChoiceId: 'sec_securely_operate_updated_threats',
				Title: 'Stay up to date with security threats and recommendations',
				Description:
					'Stay up to date with the latest threats and mitigations by monitoring industry threat intelligence publications and data feeds for updates. Evaluate managed service offerings that automatically update based on the latest threat data.',
			},
			{
				ChoiceId: 'sec_securely_operate_threat_model',
				Title: 'Identify and prioritize risks using a threat model',
				Description:
					'Perform threat modeling to identify and maintain an up-to-date register of potential threats and associated mitigations for your workload. Prioritize your threats and adapt your security control mitigations to prevent, detect, and respond. Revisit and maintain this in the context of your workload, and the evolving security landscape.',
			},
			{
				ChoiceId: 'sec_securely_operate_reduce_management_scope',
				Title: 'Reduce security management scope',
				Description:
					'Determine if you can reduce your security scope by using AWS services that shift management of certain controls to AWS (managed services). These services can help reduce your security maintenance tasks, such as infrastructure provisioning, software setup, patching, or backups.',
			},
			{
				ChoiceId: 'sec_securely_operate_automate_security_controls',
				Title: 'Automate deployment of standard security controls',
				Description:
					'Apply modern DevOps practices as you develop and deploy security controls that are standard across your AWS environments.  Define standard security controls and configurations using Infrastructure as Code (IaC) templates, capture changes in a version control system, test changes as part of a CI/CD pipeline, and automate the deployment of changes to your AWS environments.',
			},
			{
				ChoiceId: 'sec_securely_operate_implement_services_features',
				Title:
					'Evaluate and implement new security services and features regularly',
				Description:
					'Evaluate and implement security services and features from AWS and AWS Partners that allow you to evolve the security posture of your workload. ',
			},
			{
				ChoiceId: 'sec_securely_operate_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		Reason: 'NONE',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'securely-operate',
				PillarId: 'security',
				QuestionTitle: 'How do you securely operate your workload?',
				QuestionDescription:
					'To operate your workload securely, you must apply overarching best practices to every area of security. Take requirements and processes that you have defined in operational excellence at an organizational and workload level, and apply them to all areas. Staying up to date with AWS and industry recommendations and threat intelligence helps you evolve your threat model and control objectives. Automating security processes, testing, and validation allow you to scale your security operations.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.securely-operate.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
				Reason: 'NONE',
			},
		},
	},
	{
		QuestionId: 'identities',
		PillarId: 'security',
		QuestionTitle: 'How do you manage identities for people and machines?',
		Choices: [
			{
				ChoiceId: 'sec_identities_enforce_mechanisms',
				Title: 'Use strong sign-in mechanisms',
				Description:
					'Sign-ins (authentication using sign-in credentials) can present risks when not using mechanisms like multi-factor authentication (MFA), especially in situations where sign-in credentials have been inadvertently disclosed or are easily guessed. Use strong sign-in mechanisms to reduce these risks by requiring MFA and strong password policies.',
			},
			{
				ChoiceId: 'sec_identities_unique',
				Title: 'Use temporary credentials',
				Description:
					'When doing any type of authentication, it’s best to use temporary credentials instead of long-term credentials to reduce or eliminate risks, such as credentials being inadvertently disclosed, shared, or stolen.',
			},
			{
				ChoiceId: 'sec_identities_secrets',
				Title: 'Store and use secrets securely',
				Description:
					'A workload requires an automated capability to prove its identity to databases, resources, and third-party services. This is accomplished using secret access credentials, such as API access keys, passwords, and OAuth tokens. Using a purpose-built service to store, manage, and rotate these credentials helps reduce the likelihood that those credentials become compromised.',
			},
			{
				ChoiceId: 'sec_identities_identity_provider',
				Title: 'Rely on a centralized identity provider',
				Description:
					'For workforce identities (employees and contractors), rely on an identity provider that allows you to manage identities in a centralized place. This makes it easier to manage access across multiple applications and systems, because you are creating, assigning, managing, revoking, and auditing access from a single location.',
			},
			{
				ChoiceId: 'sec_identities_audit',
				Title: 'Audit and rotate credentials periodically',
				Description:
					'Audit and rotate credentials periodically to limit how long the credentials can be used to access your resources. Long-term credentials create many risks, and these risks can be reduced by rotating long-term credentials regularly.',
			},
			{
				ChoiceId: 'sec_identities_groups_attributes',
				Title: 'Employ user groups and attributes',
				Description:
					'Define permissions according to user groups and attributes to help reduce the number and complexity of policies, which makes it simpler to achieve the principle of least privilege. You can use user groups to manage the permissions for many people in one place based on the function they perform in your organization. Attributes, such as department or location, can provide an additional layer of permission scope when people perform a similar function but for different subsets of resources.',
			},
			{
				ChoiceId: 'sec_identities_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'identities',
				PillarId: 'security',
				QuestionTitle: 'How do you manage identities for people and machines?',
				QuestionDescription:
					'There are two types of identities you need to manage when approaching operating secure AWS workloads. Understanding the type of identity you need to manage and grant access helps you ensure the right identities have access to the right resources under the right conditions. Human Identities: Your administrators, developers, operators, and end users require an identity to access your AWS environments and applications. These are members of your organization, or external users with whom you collaborate, and who interact with your AWS resources via a web browser, client application, or interactive command-line tools. Machine Identities: Your service applications, operational tools, and workloads require an identity to make requests to AWS services - for example, to read data. These identities include machines running in your AWS environment such as Amazon EC2 instances or AWS Lambda functions. You may also manage machine identities for external                               parties who need access. Additionally, you may also have machines outside of AWS that need access to your AWS environment.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.identities.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'permissions',
		PillarId: 'security',
		QuestionTitle: 'How do you manage permissions for people and machines?',
		Choices: [
			{
				ChoiceId: 'sec_permissions_define',
				Title: 'Define access requirements',
				Description:
					'Each component or resource of your workload needs to be accessed by administrators, end users, or other components. Have a clear definition of who or what should have access to each component, choose the appropriate identity type and method of authentication and authorization.',
			},
			{
				ChoiceId: 'sec_permissions_least_privileges',
				Title: 'Grant least privilege access',
				Description:
					"It's a best practice to grant only the access that identities require to perform specific actions on specific resources under specific conditions. Use group and identity attributes to dynamically set permissions at scale, rather than defining permissions for individual users. For example, you can allow a group of developers access to manage only resources for their project. This way, if a developer leaves the project, the developer’s access is automatically revoked without changing the underlying access policies.",
			},
			{
				ChoiceId: 'sec_permissions_define_guardrails',
				Title: 'Define permission guardrails for your organization',
				Description:
					'Use permission guardrails to reduce the scope of available permissions that can be granted to principals. The permission policy evaluation chain includes your guardrails to determine the effective permissions of a principal when making authorization decisions.  You can define guardrails using a layer-based approach. Apply some guardrails broadly across your entire organization and apply others granularly to temporary access sessions.',
			},
			{
				ChoiceId: 'sec_permissions_lifecycle',
				Title: 'Manage access based on lifecycle',
				Description:
					'Monitor and adjust the permissions granted to your principals (users, roles, and groups) throughout their lifecycle within your organization. Adjust group memberships as users change roles, and remove access when a user leaves the organization.',
			},
			{
				ChoiceId: 'sec_permissions_emergency_process',
				Title: 'Establish emergency access process',
				Description:
					'Create a process that allows for emergency access to your workloads in the unlikely event of an issue with your centralized identity provider.',
			},
			{
				ChoiceId: 'sec_permissions_share_securely',
				Title: 'Share resources securely within your organization',
				Description:
					'As the number of workloads grows, you might need to share access to resources in those workloads or provision the resources multiple times across multiple accounts. You might have constructs to compartmentalize your environment, such as having development, testing, and production environments. However, having separation constructs does not limit you from being able to share securely. By sharing components that overlap, you can reduce operational overhead and allow for a consistent experience without guessing what you might have missed while creating the same resource multiple times.',
			},
			{
				ChoiceId: 'sec_permissions_continuous_reduction',
				Title: 'Reduce permissions continuously',
				Description:
					'As your teams determine what access is required, remove unneeded permissions and establish review processes to achieve least privilege permissions. Continually monitor and remove unused identities and permissions for both human and machine access.',
			},
			{
				ChoiceId: 'sec_permissions_share_securely_third_party',
				Title: 'Share resources securely with a third party',
				Description:
					'The security of your cloud environment doesn’t stop at your organization. Your organization might rely on a third party to manage a portion of your data. The permission management for the third-party managed system should follow the practice of just-in-time access using the principle of least privilege with temporary credentials. By working closely with a third party, you can reduce the scope of impact and risk of unintended access together.',
			},
			{
				ChoiceId: 'sec_permissions_analyze_cross_account',
				Title: 'Analyze public and cross account access',
				Description:
					'Continually monitor findings that highlight public and cross-account access. Reduce public access and cross-account access to only the specific resources that require this access.',
			},
			{
				ChoiceId: 'sec_permissions_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'permissions',
				PillarId: 'security',
				QuestionTitle: 'How do you manage permissions for people and machines?',
				QuestionDescription:
					'Manage permissions to control access to people and machine identities that require access to AWS and your workload. Permissions control who can access what, and under what conditions.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.permissions.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'detect-investigate-events',
		PillarId: 'security',
		QuestionTitle: 'How do you detect and investigate security events?',
		Choices: [
			{
				ChoiceId: 'sec_detect_investigate_events_app_service_logging',
				Title: 'Configure service and application logging',
				Description:
					'Retain security event logs from services and applications. This is a fundamental principle of security for audit, investigations, and operational use cases, and a common security requirement driven by governance, risk, and compliance (GRC) standards, policies, and procedures.',
			},
			{
				ChoiceId: 'sec_detect_investigate_events_logs',
				Title: 'Capture logs, findings, and metrics in standardized locations',
				Description:
					'Security teams rely on logs and findings to analyze events that may indicate unauthorized activity or unintentional changes. To streamline this analysis, capture security logs and findings in standardized locations.  This makes data points of interest available for correlation and can simplify tool integrations.',
			},
			{
				ChoiceId: 'sec_detect_investigate_events_noncompliant_resources',
				Title: 'Initiate remediation for non-compliant resources',
				Description:
					'Your detective controls may alert on resources that are out of compliance with your configuration requirements. You can initiate programmatically-defined remediations, either manually or automatically, to fix these resources and help minimize potential impacts. When you define remediations programmatically, you can take prompt and consistent action.',
			},
			{
				ChoiceId: 'sec_detect_investigate_events_security_alerts',
				Title: 'Correlate and enrich security events',
				Description:
					'Unexpected activity can generate multiple security alerts by different sources, requiring further correlation and enrichment to understand the full context. Implement automated correlation and enrichment of security alerts to help achieve more accurate incident identification and response.',
			},
			{
				ChoiceId: 'sec_detect_investigate_events_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		Reason: 'NONE',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'detect-investigate-events',
				PillarId: 'security',
				QuestionTitle: 'How do you detect and investigate security events?',
				QuestionDescription:
					'Capture and analyze events from logs and metrics to gain visibility. Take action on security events and potential threats to help secure your workload.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.detect-investigate-events.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
				Reason: 'NONE',
			},
		},
	},
	{
		QuestionId: 'network-protection',
		PillarId: 'security',
		QuestionTitle: 'How do you protect your network resources?',
		Choices: [
			{
				ChoiceId: 'sec_network_protection_create_layers',
				Title: 'Create network layers',
				Description:
					'Segment your network topology into different layers based on logical groupings of your workload components according to their data sensitivity and access requirements.  Distinguish between components that require inbound access from the internet, such as public web endpoints, and those that only need internal access, such as databases.',
			},
			{
				ChoiceId: 'sec_network_protection_layered',
				Title: 'Control traffic within your network layers',
				Description:
					'Within the layers of your network, use further segmentation to restrict traffic only to the flows necessary for each workload. First, focus on controlling traffic between the internet or other external systems to a workload and your environment (north-south traffic). Afterwards, look at flows between different components and systems (east-west traffic).',
			},
			{
				ChoiceId: 'sec_network_protection_inspection',
				Title: 'Implement inspection-based protection',
				Description:
					'Set up traffic inspection points between your network layers to make sure data in transit matches the expected categories and patterns. Analyze traffic flows, metadata, and patterns to help identify, detect, and respond to events more effectively.',
			},
			{
				ChoiceId: 'sec_network_protection_auto_protect',
				Title: 'Automate network protection',
				Description:
					'Automate the deployment of your network protections using DevOps practices, such as infrastructure as code (IaC) and CI/CD pipelines. These practices can help you track changes in your network protections through a version control system, reduce the time it takes to deploy changes, and help detect if your network protections drift from your desired configuration.  ',
			},
			{
				ChoiceId: 'sec_network_protection_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'network-protection',
				PillarId: 'security',
				QuestionTitle: 'How do you protect your network resources?',
				QuestionDescription:
					'Any workload that has some form of network connectivity, whether it’s the internet or a private network, requires multiple layers of defense to help protect from external and internal network-based threats.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.network-protection.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'protect-compute',
		PillarId: 'security',
		QuestionTitle: 'How do you protect your compute resources?',
		Choices: [
			{
				ChoiceId: 'sec_protect_compute_vulnerability_management',
				Title: 'Perform vulnerability management',
				Description:
					'Frequently scan and patch for vulnerabilities in your code, dependencies, and in your infrastructure to help protect against new threats.',
			},
			{
				ChoiceId: 'sec_protect_compute_hardened_images',
				Title: 'Provision compute from hardened images',
				Description:
					'Provide fewer opportunities for unintended access to your runtime environments by deploying them from hardened images. Only acquire runtime dependencies, such as container images and application libraries, from trusted registries and verify their signatures. Create your own private registries to store trusted images and libraries for use in your build and deploy processes.',
			},
			{
				ChoiceId: 'sec_protect_compute_validate_software_integrity',
				Title: 'Validate software integrity',
				Description:
					'Use cryptographic verification to validate the integrity of software artifacts (including images) your workload uses.  Cryptographically sign your software as a safeguard against unauthorized changes run within your compute environments.',
			},
			{
				ChoiceId: 'sec_protect_compute_reduce_manual_management',
				Title: 'Reduce manual management and interactive access',
				Description:
					'Use automation to perform deployment, configuration, maintenance, and investigative tasks wherever possible. Consider manual access to compute resources in cases of emergency procedures or in safe (sandbox) environments, when automation is not available.',
			},
			{
				ChoiceId: 'sec_protect_compute_auto_protection',
				Title: 'Automate compute protection',
				Description:
					'Automate compute protection operations to reduce the need for human intervention. Use automated scanning to detect potential issues within your compute resources, and remediate with automated programmatic responses or fleet management operations.  Incorporate automation in your CI/CD processes to deploy trustworthy workloads with up-to-date dependencies.',
			},
			{
				ChoiceId: 'sec_protect_compute_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'protect-compute',
				PillarId: 'security',
				QuestionTitle: 'How do you protect your compute resources?',
				QuestionDescription:
					'Compute resources in your workload require multiple layers of defense to help protect from external and internal threats. Compute resources include EC2 instances, containers, AWS Lambda functions, database services, IoT devices, and more.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.protect-compute.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'data-classification',
		PillarId: 'security',
		QuestionTitle: 'How do you classify your data?',
		Choices: [
			{
				ChoiceId: 'sec_data_classification_identify_data',
				Title: 'Understand your data classification scheme',
				Description:
					'Understand the classification of data your workload is processing, its handling requirements, the associated business processes, where the data is stored, and who the data owner is. Your data classification and handling scheme should consider the applicable legal and compliance requirements of your workload and what data controls are needed. Understanding the data is the first step in the data classification journey. ',
			},
			{
				ChoiceId: 'sec_data_classification_define_protection',
				Title: 'Apply data protection controls based on data sensitivity',
				Description:
					'Apply data protection controls that provide an appropriate level of control for each class of data defined in your classification policy. This practice can allow you to protect sensitive data from unauthorized access and use, while preserving the availability and use of data.',
			},
			{
				ChoiceId: 'sec_data_classification_lifecycle_management',
				Title: 'Define scalable data lifecycle management',
				Description:
					'Understand your data lifecycle requirements as they relate to your different levels of data classification and handling.  This can include how data is handled when it first enters your environment, how data is transformed, and the rules for its destruction. Consider factors such as retention periods, access, auditing, and tracking provenance.',
			},
			{
				ChoiceId: 'sec_data_classification_auto_classification',
				Title: 'Automate identification and classification',
				Description:
					'Automating the identification and classification of data can help you implement the correct controls. Using automation to augment manual determination reduces the risk of human error and exposure.',
			},
			{
				ChoiceId: 'sec_data_classification_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'data-classification',
				PillarId: 'security',
				QuestionTitle: 'How do you classify your data?',
				QuestionDescription:
					'Classification provides a way to categorize data, based on criticality and sensitivity in order to help you determine appropriate protection and retention controls.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.data-classification.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'protect-data-rest',
		PillarId: 'security',
		QuestionTitle: 'How do you protect your data at rest?',
		Choices: [
			{
				ChoiceId: 'sec_protect_data_rest_key_mgmt',
				Title: 'Implement secure key management',
				Description:
					'Secure key management includes the storage, rotation, access control, and monitoring of key material required to secure data at rest for your workload.',
			},
			{
				ChoiceId: 'sec_protect_data_rest_encrypt',
				Title: 'Enforce encryption at rest',
				Description:
					'You should enforce the use of encryption for data at rest. Encryption maintains the confidentiality of sensitive data in the event of unauthorized access or accidental disclosure.',
			},
			{
				ChoiceId: 'sec_protect_data_rest_automate_protection',
				Title: 'Automate data at rest protection',
				Description:
					'Use automation to validate and enforce data at rest controls.  Use automated scanning to detect misconfiguration of your data storage solutions, and perform remediations through automated programmatic response where possible.  Incorporate automation in your CI/CD processes to detect data storage misconfigurations before they are deployed to production.',
			},
			{
				ChoiceId: 'sec_protect_data_rest_access_control',
				Title: 'Enforce access control',
				Description:
					'To help protect your data at rest, enforce access control using mechanisms, such as isolation and versioning, and apply the principle of least privilege. Prevent the granting of public access to your data.',
			},
			{
				ChoiceId: 'sec_protect_data_rest_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'protect-data-rest',
				PillarId: 'security',
				QuestionTitle: 'How do you protect your data at rest?',
				QuestionDescription:
					'Protect your data at rest by implementing multiple controls, to reduce the risk of unauthorized access or mishandling.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.protect-data-rest.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'protect-data-transit',
		PillarId: 'security',
		QuestionTitle: 'How do you protect your data in transit?',
		Choices: [
			{
				ChoiceId: 'sec_protect_data_transit_key_cert_mgmt',
				Title: 'Implement secure key and certificate management',
				Description:
					'Transport Layer Security (TLS) certificates are used to secure network communications and establish the identity of websites, resources, and workloads over the internet, as well as private networks.',
			},
			{
				ChoiceId: 'sec_protect_data_transit_encrypt',
				Title: 'Enforce encryption in transit',
				Description:
					'Enforce your defined encryption requirements based on your organization’s policies, regulatory obligations and standards to help meet organizational, legal, and compliance requirements. Only use protocols with encryption when transmitting sensitive data outside of your virtual private cloud (VPC). Encryption helps maintain data confidentiality even when the data transits untrusted networks.',
			},
			{
				ChoiceId: 'sec_protect_data_transit_authentication',
				Title: 'Authenticate network communications',
				Description:
					'Verify the identity of communications by using protocols that support authentication, such as Transport Layer Security (TLS) or IPsec. Design your workload to use secure, authenticated network protocols whenever communicating between services, applications, or to users. Using network protocols that support authentication and authorization provides stronger control over network flows and reduces the impact of unauthorized access.',
			},
			{
				ChoiceId: 'sec_protect_data_transit_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'protect-data-transit',
				PillarId: 'security',
				QuestionTitle: 'How do you protect your data in transit?',
				QuestionDescription:
					'Protect your data in transit by implementing multiple controls to reduce the risk of unauthorized access or loss.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.protect-data-transit.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'incident-response',
		PillarId: 'security',
		QuestionTitle:
			'How do you anticipate, respond to, and recover from incidents?',
		Choices: [
			{
				ChoiceId: 'sec_incident_response_identify_personnel',
				Title: 'Identify key personnel and external resources',
				Description:
					'Identify internal and external personnel, resources, and legal obligations that would help your organization respond to an incident.',
			},
			{
				ChoiceId: 'sec_incident_response_develop_management_plans',
				Title: 'Develop incident management plans',
				Description:
					'The first document to develop for incident response is the incident response plan. The incident response plan is designed to be the foundation for your incident response program and strategy.',
			},
			{
				ChoiceId: 'sec_incident_response_prepare_forensic',
				Title: 'Prepare forensic capabilities',
				Description:
					'Ahead of a security incident, consider developing forensics capabilities to support security event investigations.',
			},
			{
				ChoiceId: 'sec_incident_response_playbooks',
				Title: 'Develop and test security incident response playbooks',
				Description:
					'A key part of preparing your incident response processes is developing playbooks. Incident response playbooks provide a series of prescriptive guidance and steps to follow when a security event occurs. Having clear structure and steps simplifies the response and reduces the likelihood for human error.',
			},
			{
				ChoiceId: 'sec_incident_response_pre_provision_access',
				Title: 'Pre-provision access',
				Description:
					'Verify that incident responders have the correct access pre-provisioned in AWS to reduce the time needed for investigation through to recovery.',
			},
			{
				ChoiceId: 'sec_incident_response_run_game_days',
				Title: 'Run simulations',
				Description:
					'As organizations grow and evolve over time, so does the threat landscape, making it important to continually review your incident response capabilities. Running simulations (also known as game days) is one method that can be used to perform this assessment. Simulations use real-world security event scenarios designed to mimic a threat actor’s tactics, techniques, and procedures (TTPs) and allow an organization to exercise and evaluate their incident response capabilities by responding to these mock cyber events as they might occur in reality.',
			},
			{
				ChoiceId: 'sec_incident_response_establish_incident_framework',
				Title: 'Establish a framework for learning from incidents',
				Description:
					'Implementing a lessons learned framework and root cause analysis capability will not only help improve incident response capabilities, but also help prevent the incident from recurring. By learning from each incident, you can help avoid repeating the same mistakes, exposures, or misconfigurations, not only improving your security posture, but also minimizing time lost to preventable situations.',
			},
			{
				ChoiceId: 'sec_incident_response_pre_deploy_tools',
				Title: 'Pre-deploy tools',
				Description:
					'Verify that security personnel have the right tools pre-deployed to reduce the time for investigation through to recovery.',
			},
			{
				ChoiceId: 'sec_incident_response_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'incident-response',
				PillarId: 'security',
				QuestionTitle:
					'How do you anticipate, respond to, and recover from incidents?',
				QuestionDescription:
					'Even with mature preventive and detective controls, your organization should implement mechanisms to respond to and mitigate the potential impact of security incidents. Your preparation strongly affects the ability of your teams to operate effectively during an incident, to isolate, contain and perform forensics on issues, and to restore operations to a known good state. Putting in place the tools and access ahead of a security incident, then routinely practicing incident response through game days, helps ensure that you can recover while minimizing business disruption.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.incident-response.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'application-security',
		PillarId: 'security',
		QuestionTitle:
			'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
		Choices: [
			{
				ChoiceId: 'sec_appsec_perform_regular_penetration_testing',
				Title: 'Perform regular penetration testing',
				Description:
					'Perform regular penetration testing of your software. This mechanism helps identify potential software issues that cannot be detected by automated testing or a manual code review. It can also help you understand the efficacy of your detective controls. Penetration testing should try to determine if the software can be made to perform in unexpected ways, such as exposing data that should be protected, or granting broader permissions than expected.',
			},
			{
				ChoiceId: 'sec_appsec_deploy_software_programmatically',
				Title: 'Deploy software programmatically',
				Description:
					'Perform software deployments programmatically where possible. This approach reduces the likelihood that a deployment fails or an unexpected issue is introduced due to human error.',
			},
			{
				ChoiceId:
					'sec_appsec_regularly_assess_security_properties_of_pipelines',
				Title: 'Regularly assess security properties of the pipelines',
				Description:
					'Apply the principles of the Well-Architected Security Pillar to your pipelines, with particular attention to the separation of permissions. Regularly assess the security properties of your pipeline infrastructure. Effectively managing the security of the pipelines allows you to deliver the security of the software that passes through the pipelines.',
			},
			{
				ChoiceId: 'sec_appsec_train_for_application_security',
				Title: 'Train for application security',
				Description:
					'Provide training to the builders in your organization on common practices for the secure development and operation of applications. Adopting security focused development practices helps reduce the likelihood of issues that are only detected at the security review stage.',
			},
			{
				ChoiceId: 'sec_appsec_automate_testing_throughout_lifecycle',
				Title:
					'Automate testing throughout the development and release lifecycle',
				Description:
					'Automate the testing for security properties throughout the development and release lifecycle. Automation makes it easier to consistently and repeatably identify potential issues in software prior to release, which reduces the risk of security issues in the software being provided.',
			},
			{
				ChoiceId: 'sec_appsec_manual_code_reviews',
				Title: 'Manual code reviews',
				Description:
					'Perform a manual code review of the software that you produce. This process helps verify that the person who wrote the code is not the only one checking the code quality.',
			},
			{
				ChoiceId:
					'sec_appsec_centralize_services_for_packages_and_dependencies',
				Title: 'Centralize services for packages and dependencies',
				Description:
					'Provide centralized services for builder teams to obtain software packages and other dependencies. This allows the validation of packages before they are included in the software that you write, and provides a source of data for the analysis of the software being used in your organization.',
			},
			{
				ChoiceId:
					'sec_appsec_build_program_that_embeds_security_ownership_in_teams',
				Title:
					'Build a program that embeds security ownership in workload teams',
				Description:
					'Build a program or mechanism that empowers builder teams to make security decisions about the software that they create. Your security team still needs to validate these decisions during a review, but embedding security ownership in builder teams allows for faster, more secure workloads to be built. This mechanism also promotes a culture of ownership that positively impacts the operation of the systems you build.',
			},
			{
				ChoiceId: 'sec_appsec_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'application-security',
				PillarId: 'security',
				QuestionTitle:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				QuestionDescription:
					'Training people, testing using automation, understanding dependencies, and validating the security properties of tools and applications help to reduce the likelihood of security issues in production workloads.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.application-security.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'sus_region',
		PillarId: 'sustainability',
		QuestionTitle: 'How do you select Regions for your workload?',
		Choices: [
			{
				ChoiceId: 'sus_sus_region_a2',
				Title:
					'Choose Region based on both business requirements and sustainability goals',
				Description:
					'Choose a Region for your workload based on both your business requirements and sustainability goals to optimize its KPIs, including performance, cost, and carbon footprint.',
			},
			{
				ChoiceId: 'sus_sus_region_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sus_region',
				PillarId: 'sustainability',
				QuestionTitle: 'How do you select Regions for your workload?',
				QuestionDescription:
					'The choice of Region for your workload significantly affects its KPIs, including performance, cost, and carbon footprint. To effectively improve these KPIs, you should choose Regions for your workloads based on both business requirements and sustainability goals.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.sus_region.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'sus_user',
		PillarId: 'sustainability',
		QuestionTitle: 'How do you align cloud resources to your demand?',
		Choices: [
			{
				ChoiceId: 'sus_sus_user_a2',
				Title: 'Scale workload infrastructure dynamically',
				Description:
					'Use elasticity of the cloud and scale your infrastructure dynamically to match supply of cloud resources to demand and avoid overprovisioned capacity in your workload.',
			},
			{
				ChoiceId: 'sus_sus_user_a3',
				Title: 'Align SLAs with sustainability goals',
				Description:
					'Review and optimize workload service-level agreements (SLA) based on your sustainability goals to minimize the resources required to support your workload while continuing to meet business needs.',
			},
			{
				ChoiceId: 'sus_sus_user_a5',
				Title:
					'Optimize geographic placement of workloads based on their networking requirements',
				Description:
					'Select cloud location and services for your workload that reduce the distance network traffic must travel and decrease the total network resources required to support your workload.',
			},
			{
				ChoiceId: 'sus_sus_user_a4',
				Title: 'Stop the creation and maintenance of unused assets',
				Description:
					'Decommission unused assets in your workload to reduce the number of cloud resources required to support your demand and minimize waste.',
			},
			{
				ChoiceId: 'sus_sus_user_a6',
				Title: 'Optimize team member resources for activities performed',
				Description:
					'Optimize resources provided to team members to minimize the environmental sustainability impact while supporting their needs.',
			},
			{
				ChoiceId: 'sus_sus_user_a7',
				Title: 'Implement buffering or throttling to flatten the demand curve',
				Description:
					'Buffering and throttling flatten the demand curve and reduce the provisioned capacity required for your workload.',
			},
			{
				ChoiceId: 'sus_sus_user_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sus_user',
				PillarId: 'sustainability',
				QuestionTitle: 'How do you align cloud resources to your demand?',
				QuestionDescription:
					'The way users and applications consume your workloads and other resources can help you identify improvements to meet sustainability goals. Scale infrastructure to continually match demand and verify that you use only the minimum resources required to support your users. Align service levels to customer needs. Position resources to limit the network required for users and applications to consume them. Remove unused assets. Provide your team members with devices that support their needs and minimize their sustainability impact.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.sus_user.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'sus_software',
		PillarId: 'sustainability',
		QuestionTitle:
			'How do you take advantage of software and architecture patterns to support your sustainability goals?',
		Choices: [
			{
				ChoiceId: 'sus_sus_software_a2',
				Title:
					'Optimize software and architecture for asynchronous and scheduled jobs',
				Description:
					'Use efficient software and architecture patterns such as queue-driven to maintain consistent high utilization of deployed resources.',
			},
			{
				ChoiceId: 'sus_sus_software_a3',
				Title: 'Remove or refactor workload components with low or no use',
				Description:
					'Remove components that are unused and no longer required, and refactor components with little utilization to minimize waste in your workload.',
			},
			{
				ChoiceId: 'sus_sus_software_a4',
				Title: 'Optimize areas of code that consume the most time or resources',
				Description:
					'Optimize your code that runs within different components of your architecture to minimize resource usage while maximizing performance.',
			},
			{
				ChoiceId: 'sus_sus_software_a5',
				Title: 'Optimize impact on devices and equipment',
				Description:
					'Understand the devices and equipment used in your architecture and use strategies to reduce their usage. This can minimize the overall environmental impact of your cloud workload.',
			},
			{
				ChoiceId: 'sus_sus_software_a6',
				Title:
					'Use software patterns and architectures that best support data access and storage patterns',
				Description:
					'Understand how data is used within your workload, consumed by your users, transferred, and stored. Use software patterns and architectures that best support data access and storage to minimize the compute, networking, and storage resources required to support the workload.',
			},
			{
				ChoiceId: 'sus_sus_software_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sus_software',
				PillarId: 'sustainability',
				QuestionTitle:
					'How do you take advantage of software and architecture patterns to support your sustainability goals?',
				QuestionDescription:
					'Implement patterns for performing load smoothing and maintaining consistent high utilization of deployed resources to minimize the resources consumed. Components might become idle from lack of use because of changes in user behavior over time. Revise patterns and architecture to consolidate under-utilized components to increase overall utilization. Retire components that are no longer required. Understand the performance of your workload components, and optimize the components that consume the most resources. Be aware of the devices your customers use to access your services, and implement patterns to minimize the need for device upgrades.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.sus_software.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'sus_data',
		PillarId: 'sustainability',
		QuestionTitle:
			'How do you take advantage of data management policies and patterns to support your sustainability goals?',
		Choices: [
			{
				ChoiceId: 'sus_sus_data_a2',
				Title: 'Implement a data classification policy',
				Description:
					'Classify data to understand its criticality to business outcomes and choose the right energy-efficient storage tier to store the data.',
			},
			{
				ChoiceId: 'sus_sus_data_a3',
				Title: 'Use technologies that support data access and storage patterns',
				Description:
					'Use storage technologies that best support how your data is accessed and stored to minimize the resources provisioned while supporting your workload.',
			},
			{
				ChoiceId: 'sus_sus_data_a4',
				Title: 'Use policies to manage the lifecycle of your datasets',
				Description:
					'Manage the lifecycle of all of your data and automatically enforce deletion to minimize the total storage required for your workload.',
			},
			{
				ChoiceId: 'sus_sus_data_a6',
				Title: 'Remove unneeded or redundant data',
				Description:
					'Remove unneeded or redundant data to minimize the storage resources required to store your datasets.',
			},
			{
				ChoiceId: 'sus_sus_data_a7',
				Title: 'Use shared file systems or storage to access common data',
				Description:
					'Adopt shared file systems or storage to avoid data duplication and enable more efficient infrastructure for your workload.',
			},
			{
				ChoiceId: 'sus_sus_data_a9',
				Title: 'Back up data only when difficult to recreate',
				Description:
					'Avoid backing up data that has no business value to minimize storage resources requirements for your workload.',
			},
			{
				ChoiceId: 'sus_sus_data_a5',
				Title:
					'Use elasticity and automation to expand block storage or file system',
				Description:
					'Use elasticity and automation to expand block storage or file system as data grows to minimize the total provisioned storage.',
			},
			{
				ChoiceId: 'sus_sus_data_a8',
				Title: 'Minimize data movement across networks',
				Description:
					'Use shared file systems or object storage to access common data and minimize the total networking resources required to support data movement for your workload.',
			},
			{
				ChoiceId: 'sus_sus_data_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sus_data',
				PillarId: 'sustainability',
				QuestionTitle:
					'How do you take advantage of data management policies and patterns to support your sustainability goals?',
				QuestionDescription:
					'Implement data management practices to reduce the provisioned storage required to support your workload, and the resources required to use it. Understand your data, and use storage technologies and configurations that best support the business value of the data and how it’s used. Lifecycle data to more efficient, less performant storage when requirements decrease, and delete data that’s no longer required.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.sus_data.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'sus_hardware',
		PillarId: 'sustainability',
		QuestionTitle:
			'How do you select and use cloud hardware and services in your architecture to support your sustainability goals?',
		Choices: [
			{
				ChoiceId: 'sus_sus_hardware_a2',
				Title: 'Use the minimum amount of hardware to meet your needs',
				Description:
					'Use the minimum amount of hardware for your workload to efficiently meet your business needs.',
			},
			{
				ChoiceId: 'sus_sus_hardware_a3',
				Title: 'Use instance types with the least impact',
				Description:
					'Continually monitor and use new instance types to take advantage of energy efficiency improvements.',
			},
			{
				ChoiceId: 'sus_sus_hardware_a4',
				Title: 'Use managed services',
				Description:
					'Use managed services to operate more efficiently in the cloud.',
			},
			{
				ChoiceId: 'sus_sus_hardware_a5',
				Title: 'Optimize your use of hardware-based compute accelerators',
				Description:
					'Optimize your use of accelerated computing instances to reduce the physical infrastructure demands of your workload.',
			},
			{
				ChoiceId: 'sus_sus_hardware_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sus_hardware',
				PillarId: 'sustainability',
				QuestionTitle:
					'How do you select and use cloud hardware and services in your architecture to support your sustainability goals?',
				QuestionDescription:
					'Look for opportunities to reduce workload sustainability impacts by making changes to your hardware management practices. Minimize the amount of hardware needed to provision and deploy, and select the most efficient hardware and services for your individual workload.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.sus_hardware.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
	{
		QuestionId: 'sus_dev',
		PillarId: 'sustainability',
		QuestionTitle:
			'How do your organizational processes support your sustainability goals?',
		Choices: [
			{
				ChoiceId: 'sus_sus_dev_a2',
				Title:
					'Adopt methods that can rapidly introduce sustainability improvements',
				Description:
					'Adopt methods and processes to validate potential improvements, minimize testing costs, and deliver small improvements.',
			},
			{
				ChoiceId: 'sus_sus_dev_a3',
				Title: 'Keep your workload up-to-date',
				Description:
					'Keep your workload up-to-date to adopt efficient features, remove issues, and improve the overall efficiency of your workload.',
			},
			{
				ChoiceId: 'sus_sus_dev_a4',
				Title: 'Increase utilization of build environments',
				Description:
					'Increase the utilization of resources to develop, test, and build your workloads.',
			},
			{
				ChoiceId: 'sus_sus_dev_a5',
				Title: 'Use managed device farms for testing',
				Description:
					'Use managed device farms to efficiently test a new feature on a representative set of hardware.',
			},
			{
				ChoiceId: 'sus_sus_dev_no',
				Title: 'None of these',
				Description: '',
			},
		],
		SelectedChoices: [],
		ChoiceAnswerSummaries: [],
		IsApplicable: true,
		Risk: 'UNANSWERED',
		LensAlias: 'wellarchitected',
		AdditionalDetails: {
			code: 200,
			data: {
				QuestionId: 'sus_dev',
				PillarId: 'sustainability',
				QuestionTitle:
					'How do your organizational processes support your sustainability goals?',
				QuestionDescription:
					'Look for opportunities to reduce your sustainability impact by making changes to your development, test, and deployment practices.',
				HelpfulResourceUrl:
					'https://wa.aws.amazon.com/wellarchitected/2024-06-27T08-00-00/TypeII/en/wellarchitected/wellarchitected.sus_dev.helpful-resources.en.html',
				ChoiceAnswers: [],
				IsApplicable: true,
				Risk: 'UNANSWERED',
			},
		},
	},
];
// const questions = [
// 	{
// 		QuestionId: 'cloud-financial-management',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you implement cloud financial management?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_function',
// 				Title: 'Establish ownership of cost optimization',
// 				Description:
// 					'Create a team (Cloud Business Office, Cloud Center of Excellence, or FinOps team) that is responsible for establishing and maintaining cost awareness across your organization. The owner of cost optimization can be individual or a team (requires people from finance, technology, and business teams) that understands the entire organization and cloud finance.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_partnership',
// 				Title: 'Establish a partnership between finance and technology',
// 				Description:
// 					'Involve finance and technology teams in cost and usage discussions at all stages of your cloud journey. Teams regularly meet and discuss topics such as organizational goals and targets, current state of cost and usage, and financial and accounting practices.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_budget_forecast',
// 				Title: 'Establish cloud budgets and forecasts',
// 				Description:
// 					'Adjust existing organizational budgeting and forecasting processes to be compatible with the highly variable nature of cloud costs and usage. Processes must be dynamic, using trend-based or business driver-based algorithms, or a combination of both.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_cost_awareness',
// 				Title: 'Implement cost awareness in your organizational processes',
// 				Description:
// 					'Implement cost awareness, create transparency, and accountability of costs into new or existing processes that impact usage, and leverage existing processes for cost awareness. Implement cost awareness into employee training.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_proactive_process',
// 				Title: 'Monitor cost proactively',
// 				Description:
// 					'Implement tools and dashboards to monitor cost proactively for the workload. Regularly review the costs with configured tools or out of the box tools, do not just look at costs and categories when you receive notifications. Monitoring and analyzing costs proactively helps to identify positive trends and allows you to promote them throughout your organization.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_scheduled',
// 				Title: 'Keep up-to-date with new service releases',
// 				Description:
// 					'Consult regularly with experts or AWS Partners to consider which services and features provide lower cost. Review AWS blogs and other information sources.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_quantify_value',
// 				Title: 'Quantify business value from cost optimization',
// 				Description:
// 					'Quantifying business value from cost optimization allows you to understand the entire set of benefits to your organization. Because cost optimization is a necessary investment, quantifying business value allows you to explain the return on investment to stakeholders. Quantifying business value can help you gain more buy-in from stakeholders on future cost optimization investments, and provides a framework to measure the outcomes for your organization’s cost optimization activities.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_usage_report',
// 				Title: 'Report and notify on cost optimization',
// 				Description:
// 					'Set up cloud budgets and configure mechanisms to detect anomalies in usage. Configure related tools for cost and usage alerts against pre-defined targets and receive notifications when any usage exceeds those targets. Have regular meetings to analyze the cost-effectiveness of your workloads and promote cost awareness.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_culture',
// 				Title: 'Create a cost-aware culture',
// 				Description:
// 					'Implement changes or programs across your organization to create a cost-aware culture. It is recommended to start small, then as your capabilities increase and your organization’s use of the cloud increases, implement large and wide ranging programs.',
// 			},
// 			{
// 				ChoiceId: 'cost_cloud_financial_management_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'cloud-financial-management',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you implement cloud financial management?',
// 				QuestionDescription:
// 					'Implementing Cloud Financial Management enables organizations to realize business value and financial success as they optimize their cost and usage and scale on AWS.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.cloud-financial-management.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'govern-usage',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you govern usage?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_govern_usage_policies',
// 				Title: 'Develop policies based on your organization requirements',
// 				Description:
// 					'Develop policies that define how resources are managed by your organization and inspect them periodically. Policies should cover the cost aspects of resources and workloads, including creation, modification, and decommissioning over a resource’s lifetime.',
// 			},
// 			{
// 				ChoiceId: 'cost_govern_usage_goal_target',
// 				Title: 'Implement goals and targets',
// 				Description:
// 					'Implement both cost and usage goals and targets for your workload. Goals provide direction to your organization on expected outcomes, and targets provide specific measurable outcomes to be achieved for your workloads.',
// 			},
// 			{
// 				ChoiceId: 'cost_govern_usage_account_structure',
// 				Title: 'Implement an account structure',
// 				Description:
// 					'Implement a structure of accounts that maps to your organization. This assists in allocating and managing costs throughout your organization.',
// 			},
// 			{
// 				ChoiceId: 'cost_govern_usage_controls',
// 				Title: 'Implement cost controls',
// 				Description:
// 					'Implement controls based on organization policies and defined groups and roles. These certify that costs are only incurred as defined by organization requirements such as control access to regions or resource types.',
// 			},
// 			{
// 				ChoiceId: 'cost_govern_usage_groups_roles',
// 				Title: 'Implement groups and roles',
// 				Description:
// 					'Implement groups and roles that align to your policies and control who can create, modify, or decommission instances and resources in each group. For example, implement development, test, and production groups. This applies to AWS services and third-party solutions.',
// 			},
// 			{
// 				ChoiceId: 'cost_govern_usage_track_lifecycle',
// 				Title: 'Track project lifecycle',
// 				Description:
// 					'Track, measure, and audit the lifecycle of projects, teams, and environments to avoid using and paying for unnecessary resources.',
// 			},
// 			{
// 				ChoiceId: 'cost_govern_usage_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'govern-usage',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you govern usage?',
// 				QuestionDescription:
// 					'Establish policies and mechanisms to ensure that appropriate costs are incurred while objectives are achieved. By employing a checks-and-balances approach, you can innovate without overspending.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.govern-usage.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'monitor-usage',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you monitor your cost and usage?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_monitor_usage_detailed_source',
// 				Title: 'Configure detailed information sources',
// 				Description:
// 					'Configure the cost management and reporting tools for hourly granularity to provide detailed cost and usage information, enabling deeper analytics and transparency. Configure your workload to generate or have the log entries for every delivered business outcome.',
// 			},
// 			{
// 				ChoiceId: 'cost_monitor_usage_define_attribution',
// 				Title: 'Identify cost attribution categories',
// 				Description:
// 					'Identify organization categories such as business units, departments or projects that could be used to allocate cost within your organization to the internal consuming entities. Use those categories to enforce spend accountability, create cost awareness and drive effective consumption behaviors.',
// 			},
// 			{
// 				ChoiceId: 'cost_monitor_usage_define_kpi',
// 				Title: 'Establish organization metrics',
// 				Description:
// 					'Establish the organization metrics that are required for this workload. Example metrics of a workload are customer reports produced, or web pages served to customers.',
// 			},
// 			{
// 				ChoiceId: 'cost_monitor_usage_config_tools',
// 				Title: 'Configure billing and cost management tools',
// 				Description:
// 					'Configure cost management tools in line with your organization policies to manage and optimize cloud spend. This includes services, tools, and resources to organize and track cost and usage data, enhance control through consolidated billing and access permission, improve planning through budgeting and forecasts, receive notifications or alerts, and further lower cost with resources and pricing optimizations.',
// 			},
// 			{
// 				ChoiceId: 'cost_monitor_usage_org_information',
// 				Title: 'Add organization information to cost and usage',
// 				Description:
// 					'Define a tagging schema based on your organization, workload attributes, and cost allocation categories so that you can filter and search for resources or monitor cost and usage in cost management tools. Implement consistent tagging across all resources where possible by purpose, team, environment, or other criteria relevant to your business.',
// 			},
// 			{
// 				ChoiceId: 'cost_monitor_usage_allocate_outcome',
// 				Title: 'Allocate costs based on workload metrics',
// 				Description:
// 					"Allocate the workload's costs by usage metrics or business outcomes to measure workload cost efficiency. Implement a process to analyze the cost and usage data with analytics services, which can provide insight and charge back capability.",
// 			},
// 			{
// 				ChoiceId: 'cost_monitor_usage_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'monitor-usage',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you monitor your cost and usage?',
// 				QuestionDescription:
// 					'Establish policies and procedures to monitor and appropriately allocate your costs. This allows you to measure and improve the cost efficiency of this workload.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.monitor-usage.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'decomissioning-resources',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you decommission resources?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_decomissioning_resources_track',
// 				Title: 'Track resources over their life time',
// 				Description:
// 					'Define and implement a method to track resources and their associations with systems over their lifetime. You can use tagging to identify the workload or function of the resource.',
// 			},
// 			{
// 				ChoiceId: 'cost_decomissioning_resources_implement_process',
// 				Title: 'Implement a decommissioning process',
// 				Description:
// 					'Implement a process to identify and decommission unused resources.',
// 			},
// 			{
// 				ChoiceId: 'cost_decomissioning_resources_decommission',
// 				Title: 'Decommission resources',
// 				Description:
// 					'Decommission resources triggered by events such as periodic audits, or changes in usage. Decommissioning is typically performed periodically and can be manual or automated.',
// 			},
// 			{
// 				ChoiceId: 'cost_decomissioning_resources_data_retention',
// 				Title: 'Enforce data retention policies',
// 				Description:
// 					'Define data retention policies on supported resources to handle object deletion per your organizations’ requirements. Identify and delete unnecessary or orphaned resources and objects that are no longer required.',
// 			},
// 			{
// 				ChoiceId: 'cost_decomissioning_resources_decomm_automated',
// 				Title: 'Decommission resources automatically',
// 				Description:
// 					'Design your workload to gracefully handle resource termination as you identify and decommission non-critical resources, resources that are not required, or resources with low utilization.',
// 			},
// 			{
// 				ChoiceId: 'cost_decomissioning_resources_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'decomissioning-resources',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you decommission resources?',
// 				QuestionDescription:
// 					'Implement change control and resource management from project inception to end-of-life. This ensures you shut down or terminate unused resources to reduce waste.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.decomissioning-resources.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'select-service',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you evaluate cost when you select services?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_select_service_requirements',
// 				Title: 'Identify organization requirements for cost',
// 				Description:
// 					'Work with team members to define the balance between cost optimization and other pillars, such as performance and reliability, for this workload.',
// 			},
// 			{
// 				ChoiceId: 'cost_select_service_analyze_all',
// 				Title: 'Analyze all components of this workload',
// 				Description:
// 					'Verify every workload component is analyzed, regardless of current size or current costs. The review effort should reflect the potential benefit, such as current and projected costs.',
// 			},
// 			{
// 				ChoiceId: 'cost_select_service_thorough_analysis',
// 				Title: 'Perform a thorough analysis of each component',
// 				Description:
// 					'Look at overall cost to the organization of each component. Calculate the total cost of ownership by factoring in cost of operations and management, especially when using managed services by cloud provider. The review effort should reflect potential benefit (for example, time spent analyzing is proportional to component cost).',
// 			},
// 			{
// 				ChoiceId: 'cost_select_service_select_for_cost',
// 				Title:
// 					'Select components of this workload to optimize cost in line with organization priorities',
// 				Description:
// 					'Factor in cost when selecting all components for your workload. This includes using application level and managed services or serverless, containers, or event-driven architecture to reduce overall cost. Minimize license costs by using open-source software, software that does not have license fees, or alternatives to reduce spending.',
// 			},
// 			{
// 				ChoiceId: 'cost_select_service_analyze_over_time',
// 				Title: 'Perform cost analysis for different usage over time',
// 				Description:
// 					'Workloads can change over time. Some services or features are more cost effective at different usage levels. By performing the analysis on each component over time and at projected usage, the workload remains cost-effective over its lifetime.',
// 			},
// 			{
// 				ChoiceId: 'cost_select_service_licensing',
// 				Title: 'Select software with cost effective licensing',
// 				Description:
// 					'Open-source software eliminates software licensing costs, which can contribute significant costs to workloads. Where licensed software is required, avoid licenses bound to arbitrary attributes such as CPUs, look for licenses that are bound to output or outcomes. The cost of these licenses scales more closely to the benefit they provide.',
// 			},
// 			{
// 				ChoiceId: 'cost_select_service_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'select-service',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you evaluate cost when you select services?',
// 				QuestionDescription:
// 					'Amazon EC2, Amazon EBS, and Amazon S3 are building-block AWS services. Managed services, such as Amazon RDS and Amazon DynamoDB, are higher level, or application level, AWS services. By selecting the appropriate building blocks and managed services, you can optimize this workload for cost. For example, using managed services, you can reduce or remove much of your administrative and operational overhead, freeing you to work on applications and business-related activities.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.select-service.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'type-size-number-resources',
// 		PillarId: 'costOptimization',
// 		QuestionTitle:
// 			'How do you meet cost targets when you select resource type, size and number?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_type_size_number_resources_cost_modeling',
// 				Title: 'Perform cost modeling',
// 				Description:
// 					'Identify organization requirements (such as business needs and existing commitments) and perform cost modeling (overall costs) of the workload and each of its components. Perform benchmark activities for the workload under different predicted loads and compare the costs. The modeling effort should reflect the potential benefit. For example, time spent is proportional to component cost.',
// 			},
// 			{
// 				ChoiceId: 'cost_type_size_number_resources_data',
// 				Title: 'Select resource type, size, and number based on data',
// 				Description:
// 					'Select resource size or type based on data about the workload and resource characteristics. For example, compute, memory, throughput, or write intensive. This selection is typically made using a previous (on-premises) version of the workload, using documentation, or using other sources of information about the workload.',
// 			},
// 			{
// 				ChoiceId: 'cost_type_size_number_resources_metrics',
// 				Title:
// 					'Select resource type, size, and number automatically based on metrics',
// 				Description:
// 					'Use metrics from the currently running workload to select the right size and type to optimize for cost. Appropriately provision throughput, sizing, and storage for compute, storage, data, and networking services. This can be done with a feedback loop such as automatic scaling or by custom code in the workload.',
// 			},
// 			{
// 				ChoiceId: 'cost_type_size_number_resources_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'type-size-number-resources',
// 				PillarId: 'costOptimization',
// 				QuestionTitle:
// 					'How do you meet cost targets when you select resource type, size and number?',
// 				QuestionDescription:
// 					'Ensure that you choose the appropriate resource size and number of resources for the task at hand. You minimize waste by selecting the most cost effective type, size, and number.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.type-size-number-resources.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'pricing-model',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you use pricing models to reduce cost?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_pricing_model_analysis',
// 				Title: 'Perform pricing model analysis',
// 				Description:
// 					'Analyze each component of the workload. Determine if the component and resources will be running for extended periods (for commitment discounts) or dynamic and short-running (for spot or on-demand). Perform an analysis on the workload using the recommendations in cost management tools and apply business rules to those recommendations to achieve high returns.',
// 			},
// 			{
// 				ChoiceId: 'cost_pricing_model_region_cost',
// 				Title: 'Choose Regions based on cost',
// 				Description:
// 					'Resource pricing may be different in each Region. Identify Regional cost differences and only deploy in Regions with higher costs to meet latency, data residency and data sovereignty requirements. Factoring in Region cost helps you pay the lowest overall price for this workload.',
// 			},
// 			{
// 				ChoiceId: 'cost_pricing_model_third_party',
// 				Title: 'Select third-party agreements with cost-efficient terms',
// 				Description:
// 					'Cost-efficient agreements and terms ensure the cost of these services scales with the benefits they provide. Select agreements and pricing that scale when they provide additional benefits to your organization.',
// 			},
// 			{
// 				ChoiceId: 'cost_pricing_model_implement_models',
// 				Title: 'Implement pricing models for all components of this workload',
// 				Description:
// 					'Permanently running resources should utilize reserved capacity such as Savings Plans or Reserved Instances. Short-term capacity is configured to use Spot Instances, or Spot Fleet. On-Demand Instances are only used for short-term workloads that cannot be interrupted and do not run long enough for reserved capacity, between 25% to 75% of the period, depending on the resource type.',
// 			},
// 			{
// 				ChoiceId: 'cost_pricing_model_master_analysis',
// 				Title: 'Perform pricing model analysis at the management account level',
// 				Description:
// 					'Check billing and cost management tools and see recommended discounts with commitments and reservations to perform regular analysis at the management account level.',
// 			},
// 			{
// 				ChoiceId: 'cost_pricing_model_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'pricing-model',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you use pricing models to reduce cost?',
// 				QuestionDescription:
// 					'Use the pricing model that is most appropriate for your resources to minimize expense.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.pricing-model.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'data-transfer',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you plan for data transfer charges?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_data_transfer_modeling',
// 				Title: 'Perform data transfer modeling',
// 				Description:
// 					'Gather organization requirements and perform data transfer modeling of the workload and each of its components. This identifies the lowest cost point for its current data transfer requirements.',
// 			},
// 			{
// 				ChoiceId: 'cost_data_transfer_optimized_components',
// 				Title: 'Select components to optimize data transfer cost',
// 				Description:
// 					'All components are selected, and architecture is designed to reduce data transfer costs. This includes using components such as wide-area-network (WAN) optimization and Multi-Availability Zone (AZ) configurations',
// 			},
// 			{
// 				ChoiceId: 'cost_data_transfer_implement_services',
// 				Title: 'Implement services to reduce data transfer costs',
// 				Description:
// 					'Implement services to reduce data transfer. For example, use edge locations or content delivery networks (CDN) to deliver content to end users, build caching layers in front of your application servers or databases, and use dedicated network connections instead of VPN for connectivity to the cloud.',
// 			},
// 			{
// 				ChoiceId: 'cost_data_transfer_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'data-transfer',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you plan for data transfer charges?',
// 				QuestionDescription:
// 					'Ensure that you plan and monitor data transfer charges so that you can make architectural decisions to minimize costs. A small yet effective architectural change can drastically reduce your operational costs over time.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.data-transfer.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'manage-demand-resources',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you manage demand, and supply resources?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_manage_demand_resources_cost_analysis',
// 				Title: 'Perform an analysis on the workload demand',
// 				Description:
// 					'Analyze the demand of the workload over time. Verify that the analysis covers seasonal trends and accurately represents operating conditions over the full workload lifetime. Analysis effort should reflect the potential benefit, for example, time spent is proportional to the workload cost.',
// 			},
// 			{
// 				ChoiceId: 'cost_manage_demand_resources_buffer_throttle',
// 				Title: 'Implement a buffer or throttle to manage demand',
// 				Description:
// 					'Buffering and throttling modify the demand on your workload, smoothing out any peaks. Implement throttling when your clients perform retries. Implement buffering to store the request and defer processing until a later time. Verify that your throttles and buffers are designed so clients receive a response in the required time.',
// 			},
// 			{
// 				ChoiceId: 'cost_manage_demand_resources_dynamic',
// 				Title: 'Supply resources dynamically',
// 				Description:
// 					'Resources are provisioned in a planned manner. This can be demand-based, such as through automatic scaling, or time-based, where demand is predictable and resources are provided based on time. These methods result in the least amount of over-provisioning or under-provisioning.',
// 			},
// 			{
// 				ChoiceId: 'cost_manage_demand_resources_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'manage-demand-resources',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you manage demand, and supply resources?',
// 				QuestionDescription:
// 					'For a workload that has balanced spend and performance, ensure that everything you pay for is used and avoid significantly underutilizing instances. A skewed utilization metric in either direction has an adverse impact on your organization, in either operational costs (degraded performance due to over-utilization), or wasted AWS expenditures (due to over-provisioning).',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.manage-demand-resources.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'evaluate-new-services',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you evaluate new services?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_evaluate_new_services_review_process',
// 				Title: 'Develop a workload review process',
// 				Description:
// 					'Develop a process that defines the criteria and process for workload review. The review effort should reflect potential benefit. For example, core workloads or workloads with a value of over ten percent of the bill are reviewed quarterly or every six months, while workloads below ten percent are reviewed annually.',
// 			},
// 			{
// 				ChoiceId: 'cost_evaluate_new_services_review_workload',
// 				Title: 'Review and analyze this workload regularly',
// 				Description:
// 					'Existing workloads are regularly reviewed based on each defined process to find out if new services can be adopted, existing services can be replaced, or workloads can be re-architected.',
// 			},
// 			{
// 				ChoiceId: 'cost_evaluate_new_services_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'evaluate-new-services',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you evaluate new services?',
// 				QuestionDescription:
// 					"As AWS releases new services and features, it's a best practice to review your existing architectural decisions to ensure they continue to be the most cost effective.",
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.evaluate-new-services.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'evaluate-cost-effort',
// 		PillarId: 'costOptimization',
// 		QuestionTitle: 'How do you evaluate the cost of effort?',
// 		Choices: [
// 			{
// 				ChoiceId: 'cost_evaluate_cost_effort_automations_operations',
// 				Title: 'Perform automation for operations',
// 				Description:
// 					'Evaluate cost of effort for operations on cloud. Quantify reduction in time and effort for admin tasks, deployment and other operations using automation. Evaluate the required time and cost for the effort of operations and automate admin tasks to reduce the human effort where possible.',
// 			},
// 			{
// 				ChoiceId: 'cost_evaluate_cost_effort_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'evaluate-cost-effort',
// 				PillarId: 'costOptimization',
// 				QuestionTitle: 'How do you evaluate the cost of effort?',
// 				QuestionDescription:
// 					"As AWS releases new services and features, it's a best practice to review the cost of the effort required to implement new services.",
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.evaluate-cost-effort.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'priorities',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle: 'How do you determine what your priorities are?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_priorities_ext_cust_needs',
// 				Title: 'Evaluate external customer needs',
// 				Description:
// 					'Involve key stakeholders, including business, development, and operations teams, to determine where to focus efforts on external customer needs. This will ensure that you have a thorough understanding of the operations support that is required to achieve your desired business outcomes.',
// 			},
// 			{
// 				ChoiceId: 'ops_priorities_int_cust_needs',
// 				Title: 'Evaluate internal customer needs',
// 				Description:
// 					'Involve key stakeholders, including business, development, and operations teams, when determining where to focus efforts on internal customer needs. This will ensure that you have a thorough understanding of the operations support that is required to achieve business outcomes.',
// 			},
// 			{
// 				ChoiceId: 'ops_priorities_governance_reqs',
// 				Title: 'Evaluate governance requirements',
// 				Description:
// 					'Governance is the set of policies, rules, or frameworks that a company uses to achieve its business goals. Governance requirements are generated from within your organization. They can affect the types of technologies you choose or influence the way you operate your workload. Incorporate organizational governance requirements into your workload. Conformance is the ability to demonstrate that you have implemented governance requirements.',
// 			},
// 			{
// 				ChoiceId: 'ops_priorities_compliance_reqs',
// 				Title: 'Evaluate compliance requirements',
// 				Description:
// 					'Regulatory, industry, and internal compliance requirements are an important driver for defining your organization’s priorities. Your compliance framework may preclude you from using specific technologies or geographic locations. Apply due diligence if no external compliance frameworks are identified. Generate audits or reports that validate compliance.',
// 			},
// 			{
// 				ChoiceId: 'ops_priorities_eval_threat_landscape',
// 				Title: 'Evaluate threat landscape',
// 				Description:
// 					'Evaluate threats to the business (for example, competition, business risk and liabilities, operational risks, and information security threats) and maintain current information in a risk registry. Include the impact of risks when determining where to focus efforts.',
// 			},
// 			{
// 				ChoiceId: 'ops_priorities_eval_tradeoffs',
// 				Title: 'Evaluate tradeoffs',
// 				Description:
// 					'Evaluate the impact of tradeoffs between competing interests or alternative approaches, to help make informed decisions when determining where to focus efforts or choosing a course of action. For example, accelerating speed to market for new features may be emphasized over cost optimization, or you may choose a relational database for non-relational data to simplify the effort to migrate a system, rather than migrating to a database optimized for your data type and updating your application.',
// 			},
// 			{
// 				ChoiceId: 'ops_priorities_manage_risk_benefit',
// 				Title: 'Manage benefits and risks',
// 				Description:
// 					'Manage benefits and risks to make informed decisions when determining where to focus efforts. For example, it may be beneficial to deploy a workload with unresolved issues so that significant new features can be made available to customers. It may be possible to mitigate associated risks, or it may become unacceptable to allow a risk to remain, in which case you will take action to address the risk.',
// 			},
// 			{
// 				ChoiceId: 'ops_priorities_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'priorities',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle: 'How do you determine what your priorities are?',
// 				QuestionDescription:
// 					'Everyone needs to understand their part in enabling business success. Have shared goals in order to set priorities for resources. This will maximize the benefits of your efforts.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.priorities.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'ops-model',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle:
// 			'How do you structure your organization to support your business outcomes?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_ops_model_def_resource_owners',
// 				Title: 'Resources have identified owners',
// 				Description:
// 					'Resources for your workload must have identified owners for change control, troubleshooting, and other functions. Owners are assigned for workloads, accounts, infrastructure, platforms, and applications. Ownership is recorded using tools like a central register or metadata attached to resources. The business value of components informs the processes and procedures applied to them.',
// 			},
// 			{
// 				ChoiceId: 'ops_ops_model_def_proc_owners',
// 				Title: 'Processes and procedures have identified owners',
// 				Description:
// 					'Understand who has ownership of the definition of individual processes and procedures, why those specific process and procedures are used, and why that ownership exists. Understanding the reasons that specific processes and procedures are used enables identification of improvement opportunities.',
// 			},
// 			{
// 				ChoiceId: 'ops_ops_model_def_activity_owners',
// 				Title:
// 					'Operations activities have identified owners responsible for their performance',
// 				Description:
// 					'Understand who has responsibility to perform specific activities on defined workloads and why that responsibility exists. Understanding who has responsibility to perform activities informs who will conduct the activity, validate the result, and provide feedback to the owner of the activity.',
// 			},
// 			{
// 				ChoiceId: 'ops_ops_model_know_my_job',
// 				Title: 'Team members know what they are responsible for',
// 				Description:
// 					'Understanding the responsibilities of your role and how you contribute to business outcomes informs the prioritization of your tasks and why your role is important. This enables team members to recognize needs and respond appropriately.',
// 			},
// 			{
// 				ChoiceId: 'ops_ops_model_find_owner',
// 				Title: 'Mechanisms exist to identify responsibility and ownership',
// 				Description:
// 					'Where no individual or team is identified, there are defined escalation paths to someone with the authority to assign ownership or plan for that need to be addressed.',
// 			},
// 			{
// 				ChoiceId: 'ops_ops_model_req_add_chg_exception',
// 				Title: 'Mechanisms exist to request additions, changes, and exceptions',
// 				Description:
// 					'You can make requests to owners of processes, procedures, and resources. Requests include additions, changes, and exceptions. These requests go through a change management process. Make informed decisions to approve requests where viable and determined to be appropriate after an evaluation of benefits and risks.',
// 			},
// 			{
// 				ChoiceId: 'ops_ops_model_def_neg_team_agreements',
// 				Title: 'Responsibilities between teams are predefined or negotiated',
// 				Description:
// 					'Have defined or negotiated agreements between teams describing how they work with and support each other (for example, response times, service level objectives, or service-level agreements). Inter-team communications channels are documented. Understanding the impact of the teams’ work on business outcomes and the outcomes of other teams and organizations informs the prioritization of their tasks and helps them respond appropriately.',
// 			},
// 			{
// 				ChoiceId: 'ops_ops_model_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'ops-model',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle:
// 					'How do you structure your organization to support your business outcomes?',
// 				QuestionDescription:
// 					'Your teams must understand their part in achieving business outcomes. Teams need to understand their roles in the success of other teams, the role of other teams in their success, and have shared goals. Understanding responsibility, ownership, how decisions are made, and who has authority to make decisions will help focus efforts and maximize the benefits from your teams.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.ops-model.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'org-culture',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle:
// 			'How does your organizational culture support your business outcomes?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_org_culture_executive_sponsor',
// 				Title: 'Executive Sponsorship',
// 				Description:
// 					'Senior leadership clearly sets expectations for the organization and evaluates success. Senior leadership is the sponsor, advocate, and driver for the adoption of best practices and evolution of the organization.',
// 			},
// 			{
// 				ChoiceId: 'ops_org_culture_team_emp_take_action',
// 				Title:
// 					'Team members are empowered to take action when outcomes are at risk',
// 				Description:
// 					'The workload owner has defined guidance and scope empowering team members to respond when outcomes are at risk. Escalation mechanisms are used to get direction when events are outside of the defined scope.',
// 			},
// 			{
// 				ChoiceId: 'ops_org_culture_team_enc_escalation',
// 				Title: 'Escalation is encouraged',
// 				Description:
// 					'Team members have mechanisms and are encouraged to escalate concerns to decision makers and stakeholders if they believe outcomes are at risk. Escalation should be performed early and often so that risks can be identified, and prevented from causing incidents.',
// 			},
// 			{
// 				ChoiceId: 'ops_org_culture_effective_comms',
// 				Title: 'Communications are timely, clear, and actionable',
// 				Description:
// 					'Mechanisms exist and are used to provide timely notice to team members of known risks and planned events. Necessary context, details, and time (when possible) are provided to support determining if action is necessary, what action is required, and to take action in a timely manner. For example, providing notice of software vulnerabilities so that patching can be expedited, or providing notice of planned sales promotions so that a change freeze can be implemented to avoid the risk of service disruption. Planned events can be recorded in a change calendar or maintenance schedule so that team members can identify what activities are pending.',
// 			},
// 			{
// 				ChoiceId: 'ops_org_culture_team_enc_experiment',
// 				Title: 'Experimentation is encouraged',
// 				Description:
// 					'Experimentation is a catalyst for turning new ideas into products and features. It accelerates learning and keeps team members interested and engaged. Team members are encouraged to experiment often to drive innovation. Even when an undesired result occurs, there is value in knowing what not to do. Team members are not punished for successful experiments with undesired results.',
// 			},
// 			{
// 				ChoiceId: 'ops_org_culture_team_enc_learn',
// 				Title:
// 					'Team members are encouraged to maintain and grow their skill sets',
// 				Description:
// 					'Teams must grow their skill sets to adopt new technologies, and to support changes in demand and responsibilities in support of your workloads. Growth of skills in new technologies is frequently a source of team member satisfaction and supports innovation. Support your team members’ pursuit and maintenance of industry certifications that validate and acknowledge their growing skills. Cross train to promote knowledge transfer and reduce the risk of significant impact when you lose skilled and experienced team members with institutional knowledge. Provide dedicated structured time for learning.',
// 			},
// 			{
// 				ChoiceId: 'ops_org_culture_team_res_appro',
// 				Title: 'Resource teams appropriately',
// 				Description:
// 					'Maintain team member capacity, and provide tools and resources to support your workload needs. Overtasking team members increases the risk of incidents resulting from human error. Investments in tools and resources (for example, providing automation for frequently performed activities) can scale the effectiveness of your team, enabling them to support additional activities.',
// 			},
// 			{
// 				ChoiceId: 'ops_org_culture_diverse_inc_access',
// 				Title:
// 					'Diverse opinions are encouraged and sought within and across teams',
// 				Description:
// 					'Leverage cross-organizational diversity to seek multiple unique perspectives. Use this perspective to increase innovation, challenge your assumptions, and reduce the risk of confirmation bias. Grow inclusion, diversity, and accessibility within your teams to gain beneficial perspectives.',
// 			},
// 			{
// 				ChoiceId: 'ops_org_culture_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'org-culture',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle:
// 					'How does your organizational culture support your business outcomes?',
// 				QuestionDescription:
// 					'Provide support for your team members so that they can be more effective in taking action and supporting your business outcome.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.org-culture.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'observability',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle: 'How do you implement observability in your workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_observability_identify_kpis',
// 				Title: 'Identify key performance indicators',
// 				Description:
// 					'Implementing observability in your workload starts with understanding its state and making data-driven decisions based on business requirements. One of the most effective ways to ensure alignment between monitoring activities and business objectives is by defining and monitoring key performance indicators (KPIs).',
// 			},
// 			{
// 				ChoiceId: 'ops_observability_application_telemetry',
// 				Title: 'Implement application telemetry',
// 				Description:
// 					"Application telemetry serves as the foundation for observability of your workload. It's crucial to emit telemetry that offers actionable insights into the state of your application and the achievement of both technical and business outcomes. From troubleshooting to measuring the impact of a new feature or ensuring alignment with business key performance indicators (KPIs), application telemetry informs the way you build, operate, and evolve your workload.",
// 			},
// 			{
// 				ChoiceId: 'ops_observability_customer_telemetry',
// 				Title: 'Implement user experience telemetry',
// 				Description:
// 					'Gaining deep insights into customer experiences and interactions with your application is crucial. Real User Monitoring (RUM) and synthetic transactions serve as powerful tools for this purpose. While RUM provides data about real user interactions, synthetic transactions simulate user interactions, helping in detecting potential issues even before they impact real users.',
// 			},
// 			{
// 				ChoiceId: 'ops_observability_dependency_telemetry',
// 				Title: 'Implement dependency telemetry',
// 				Description:
// 					'Dependency telemetry is essential for monitoring the health and performance of the external services and components your workload relies on. It provides valuable insights into reachability, timeouts, and other critical events related to dependencies such as DNS, databases, or third-party APIs. By instrumenting your application to emit metrics, logs and traces about these dependencies, you gain a clearer understanding of potential bottlenecks, performance issues, or failures that might impact your workload.',
// 			},
// 			{
// 				ChoiceId: 'ops_observability_dist_trace',
// 				Title: 'Implement distributed tracing',
// 				Description:
// 					'Distributed tracing offers a way to monitor and visualize requests as they traverse through various components of a distributed system. By capturing trace data from multiple sources and analyzing it in a unified view, teams can better understand how requests flow, where bottlenecks exist, and where optimization efforts should focus.',
// 			},
// 			{
// 				ChoiceId: 'ops_telemetry_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'observability',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle: 'How do you implement observability in your workload?',
// 				QuestionDescription:
// 					'Implement observability in your workload so that you can understand its state and make data-driven decisions based on business requirements.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.observability.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'dev-integ',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle:
// 			'How do you reduce defects, ease remediation, and improve flow into production?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_dev_integ_version_control',
// 				Title: 'Use version control',
// 				Description:
// 					'Use version control to activate tracking of changes and releases.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_test_val_chg',
// 				Title: 'Test and validate changes',
// 				Description:
// 					'Every change deployed must be tested to avoid errors in production. This best practice is focused on testing changes from version control to artifact build. Besides application code changes, testing should include infrastructure, configuration, security controls, and operations procedures. Testing takes many forms, from unit tests to software component analysis (SCA). Move tests further to the left in the software integration and delivery process results in higher certainty of artifact quality.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_conf_mgmt_sys',
// 				Title: 'Use configuration management systems',
// 				Description:
// 					'Use configuration management systems to make and track configuration changes. These systems reduce errors caused by manual processes and reduce the level of effort to deploy changes.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_build_mgmt_sys',
// 				Title: 'Use build and deployment management systems',
// 				Description:
// 					'Use build and deployment management systems. These systems reduce errors caused by manual processes and reduce the level of effort to deploy changes.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_patch_mgmt',
// 				Title: 'Perform patch management',
// 				Description:
// 					'Perform patch management to gain features, address issues, and remain compliant with governance. Automate patch management to reduce errors caused by manual processes, scale, and reduce the level of effort to patch.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_share_design_stds',
// 				Title: 'Share design standards',
// 				Description:
// 					'Share best practices across teams to increase awareness and maximize the benefits of development efforts. Document them and keep them up to date as your architecture evolves. If shared standards are enforced in your organization, it’s critical that mechanisms exist to request additions, changes, and exceptions to standards. Without this option, standards become a constraint on innovation.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_code_quality',
// 				Title: 'Implement practices to improve code quality',
// 				Description:
// 					'Implement practices to improve code quality and minimize defects. Some examples include test-driven development, code reviews, standards adoption, and pair programming. Incorporate these practices into your continuous integration and delivery process.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_multi_env',
// 				Title: 'Use multiple environments',
// 				Description:
// 					'Use multiple environments to experiment, develop, and test your workload. Use increasing levels of controls as environments approach production to gain confidence your workload will operate as intended when deployed.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_freq_sm_rev_chg',
// 				Title: 'Make frequent, small, reversible changes',
// 				Description:
// 					'Frequent, small, and reversible changes reduce the scope and impact of a change. When used in conjunction with change management systems, configuration management systems, and build and delivery systems frequent, small, and reversible changes reduce the scope and impact of a change. This results in more effective troubleshooting and faster remediation with the option to roll back changes.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_auto_integ_deploy',
// 				Title: 'Fully automate integration and deployment',
// 				Description:
// 					'Automate build, deployment, and testing of the workload. This reduces errors caused by manual processes and reduces the effort to deploy changes.',
// 			},
// 			{
// 				ChoiceId: 'ops_dev_integ_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'dev-integ',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle:
// 					'How do you reduce defects, ease remediation, and improve flow into production?',
// 				QuestionDescription:
// 					'Adopt approaches that improve flow of changes into production, that enable refactoring, fast feedback on quality, and bug fixing. These accelerate beneficial changes entering production, limit issues deployed, and enable rapid identification and remediation of issues introduced through deployment activities.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.dev-integ.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'mit-deploy-risks',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle: 'How do you mitigate deployment risks?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_mit_deploy_risks_plan_for_unsucessful_changes',
// 				Title: 'Plan for unsuccessful changes',
// 				Description:
// 					'Plan to revert to a known good state, or remediate in the production environment if the deployment causes undesired outcome. Having a policy to establish such a plan helps all teams develop strategies to recover from failed changes. Some example strategies are deployment and rollback steps, change policies, feature flags, traffic isolation, and traffic shifting. A single release may include multiple related component changes. The strategy should provide the ability to withstand or recover from a failure of any component change.',
// 			},
// 			{
// 				ChoiceId: 'ops_mit_deploy_risks_test_val_chg',
// 				Title: 'Test deployments',
// 				Description:
// 					'Test release procedures in pre-production by using the same deployment configuration, security controls, steps, and procedures as in production. Validate that all deployed steps are completed as expected, such as inspecting files, configurations, and services. Further test all changes with functional, integration, and load tests, along with any monitoring such as health checks. By doing these tests, you can identify deployment issues early with an opportunity to plan and mitigate them prior to production.',
// 			},
// 			{
// 				ChoiceId: 'ops_mit_deploy_risks_deploy_mgmt_sys',
// 				Title: 'Employ safe deployment strategies',
// 				Description:
// 					'Safe production roll-outs control the flow of beneficial changes with an aim to minimize any perceived impact for customers from those changes. The safety controls provide inspection mechanisms to validate desired outcomes and limit the scope of impact from any defects introduced by the changes or from deployment failures. Safe roll-outs may include strategies such as feature-flags, one-box, rolling (canary releases), immutable, traffic splitting, and blue/green deployments.',
// 			},
// 			{
// 				ChoiceId: 'ops_mit_deploy_risks_auto_testing_and_rollback',
// 				Title: 'Automate testing and rollback',
// 				Description:
// 					'To increase the speed, reliability, and confidence of your deployment process, have a strategy for automated testing and rollback capabilities in pre-production and production environments. Automate testing when deploying to production to simulate human and system interactions that verify the changes being deployed. Automate rollback to revert back to a previous known good state quickly. The rollback should be initiated automatically on pre-defined conditions such as when the desired outcome of your change is not achieved or when the automated test fails. Automating these two activities improves your success rate for your deployments, minimizes recovery time, and reduces the potential impact to the business.',
// 			},
// 			{
// 				ChoiceId: 'ops_mit_deploy_risks_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'mit-deploy-risks',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle: 'How do you mitigate deployment risks?',
// 				QuestionDescription:
// 					'Adopt approaches that provide fast feedback on quality and enable rapid recovery from changes that do not have desired outcomes. Using these practices mitigates the impact of issues introduced through the deployment of changes.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.mit-deploy-risks.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'ready-to-support',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle: 'How do you know that you are ready to support a workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_ready_to_support_personnel_capability',
// 				Title: 'Ensure personnel capability',
// 				Description:
// 					'Have a mechanism to validate that you have the appropriate number of trained personnel to support the workload. They must be trained on the platform and services that make up your workload. Provide them with the knowledge necessary to operate the workload. You must have enough trained personnel to support the normal operation of the workload and troubleshoot any incidents that occur. Have enough personnel so that you can rotate during on-call and vacations to avoid burnout.',
// 			},
// 			{
// 				ChoiceId: 'ops_ready_to_support_const_orr',
// 				Title: 'Ensure a consistent review of operational readiness',
// 				Description:
// 					'Use Operational Readiness Reviews (ORRs) to validate that you can operate your workload. ORR is a mechanism developed at Amazon to validate that teams can safely operate their workloads. An ORR is a review and inspection process using a checklist of requirements. An ORR is a self-service experience that teams use to certify their workloads. ORRs include best practices from lessons learned from our years of building software.',
// 			},
// 			{
// 				ChoiceId: 'ops_ready_to_support_use_runbooks',
// 				Title: 'Use runbooks to perform procedures',
// 				Description:
// 					'A runbook is a documented process to achieve a specific outcome. Runbooks consist of a series of steps that someone follows to get something done. Runbooks have been used in operations going back to the early days of aviation. In cloud operations, we use runbooks to reduce risk and achieve desired outcomes. At its simplest, a runbook is a checklist to complete a task.',
// 			},
// 			{
// 				ChoiceId: 'ops_ready_to_support_use_playbooks',
// 				Title: 'Use playbooks to investigate issues',
// 				Description:
// 					"Playbooks are step-by-step guides used to investigate an incident. When incidents happen, playbooks are used to investigate, scope impact, and identify a root cause. Playbooks are used for a variety of scenarios, from failed deployments to security incidents. In many cases, playbooks identify the root cause that a runbook is used to mitigate. Playbooks are an essential component of your organization's incident response plans.",
// 			},
// 			{
// 				ChoiceId: 'ops_ready_to_support_informed_deploy_decisions',
// 				Title: 'Make informed decisions to deploy systems and changes',
// 				Description:
// 					'Have processes in place for successful and unsuccessful changes to your workload. A pre-mortem is an exercise where a team simulates a failure to develop mitigation strategies. Use pre-mortems to anticipate failure and create procedures where appropriate. Evaluate the benefits and risks of deploying changes to your workload. Verify that all changes comply with governance.',
// 			},
// 			{
// 				ChoiceId: 'ops_ready_to_support_enable_support_plans',
// 				Title: 'Create support plans for production workloads',
// 				Description:
// 					'Enable support for any software and services that your production workload relies on. Select an appropriate support level to meet your production service-level needs. Support plans for these dependencies are necessary in case there is a service disruption or software issue. Document support plans and how to request support for all service and software vendors. Implement mechanisms that verify that support points of contacts are kept up to date.',
// 			},
// 			{
// 				ChoiceId: 'ops_ready_to_support_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'ready-to-support',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle:
// 					'How do you know that you are ready to support a workload?',
// 				QuestionDescription:
// 					'Evaluate the operational readiness of your workload, processes and procedures, and personnel to understand the operational risks related to your workload.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.ready-to-support.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'workload-observability',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle:
// 			'How do you utilize workload observability in your organization?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_workload_observability_create_alerts',
// 				Title: 'Create actionable alerts',
// 				Description:
// 					"Promptly detecting and responding to deviations in your application's behavior is crucial. Especially vital is recognizing when outcomes based on key performance indicators (KPIs) are at risk or when unexpected anomalies arise. Basing alerts on KPIs ensures that the signals you receive are directly tied to business or operational impact. This approach to actionable alerts promotes proactive responses and helps maintain system performance and reliability.",
// 			},
// 			{
// 				ChoiceId: 'ops_workload_observability_analyze_workload_metrics',
// 				Title: 'Analyze workload metrics',
// 				Description:
// 					"After implementing application telemetry, regularly analyze the collected metrics. While latency, requests, errors, and capacity (or quotas) provide insights into system performance, it's vital to prioritize the review of business outcome metrics. This ensures you're making data-driven decisions aligned with your business objectives.",
// 			},
// 			{
// 				ChoiceId: 'ops_workload_observability_analyze_workload_logs',
// 				Title: 'Analyze workload logs',
// 				Description:
// 					'Regularly analyzing workload logs is essential for gaining a deeper understanding of the operational aspects of your application. By efficiently sifting through, visualizing, and interpreting log data, you can continually optimize application performance and security.',
// 			},
// 			{
// 				ChoiceId: 'ops_workload_observability_analyze_workload_traces',
// 				Title: 'Analyze workload traces',
// 				Description:
// 					"Analyzing trace data is crucial for achieving a comprehensive view of an application's operational journey. By visualizing and understanding the interactions between various components, performance can be fine-tuned, bottlenecks identified, and user experiences enhanced.",
// 			},
// 			{
// 				ChoiceId: 'ops_workload_observability_create_dashboards',
// 				Title: 'Create dashboards',
// 				Description:
// 					'Dashboards are the human-centric view into the telemetry data of your workloads. While they provide a vital visual interface, they should not replace alerting mechanisms, but complement them. When crafted with care, not only can they offer rapid insights into system health and performance, but they can also present stakeholders with real-time information on business outcomes and the impact of issues.',
// 			},
// 			{
// 				ChoiceId: 'ops_workload_observability_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'workload-observability',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle:
// 					'How do you utilize workload observability in your organization?',
// 				QuestionDescription:
// 					"Ensure optimal workload health by leveraging observability. Utilize relevant metrics, logs, and traces to gain a comprehensive view of your workload's performance and address issues efficiently.",
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.workload-observability.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'operations-health',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle: 'How do you understand the health of your operations?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_operations_health_measure_ops_goals_kpis',
// 				Title: 'Measure operations goals and KPIs with metrics',
// 				Description:
// 					'Obtain goals and KPIs that define operations success from your organization and determine that metrics that reflect these. Set baselines as a point of reference and reevaluate regularly. Develop mechanisms to collect these metrics from teams for evaluation.',
// 			},
// 			{
// 				ChoiceId: 'ops_operations_health_communicate_status_trends',
// 				Title:
// 					'Communicate status and trends to ensure visibility into operation',
// 				Description:
// 					'Knowing the state of your operations and its trending direction is necessary to identify when outcomes may be at risk, whether or not added work can be supported, or the effects that changes have had to your teams. During operations events, having status pages that users and operations teams can refer to for information can reduce pressure on communication channels and disseminate information proactively',
// 			},
// 			{
// 				ChoiceId:
// 					'ops_operations_health_review_ops_metrics_prioritize_improvement',
// 				Title: 'Review operations metrics and prioritize improvement',
// 				Description:
// 					'Setting aside dedicated time and resources for reviewing the state of operations ensures that serving the day-to-day line of business remains a priority. Pull together operations leaders and stakeholders to regularly review metrics, reaffirm or modify goals and objectives, and prioritize improvements.',
// 			},
// 			{
// 				ChoiceId: 'ops_operations_health_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'operations-health',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle: 'How do you understand the health of your operations?',
// 				QuestionDescription:
// 					'Define, capture, and analyze operations metrics to gain visibility to the activities of operations teams so that you can take appropriate action.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.operations-health.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'event-response',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle: 'How do you manage workload and operations events?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_event_response_event_incident_problem_process',
// 				Title: 'Use a process for event, incident, and problem management',
// 				Description:
// 					'Your organization has processes to handle events, incidents, and problems. Events are things that occur in your workload but may not need intervention. Incidents are events that require intervention. Problems are recurring events that require intervention or cannot be resolved. You need processes to mitigate the impact of these events on your business and make sure that you respond appropriately.',
// 			},
// 			{
// 				ChoiceId: 'ops_event_response_process_per_alert',
// 				Title: 'Have a process per alert',
// 				Description:
// 					'Have a well-defined response (runbook or playbook), with a specifically identified owner, for any event for which you raise an alert. This ensures effective and prompt responses to operations events and prevents actionable events from being obscured by less valuable notifications.',
// 			},
// 			{
// 				ChoiceId: 'ops_event_response_prioritize_events',
// 				Title: 'Prioritize operational events based on business impact',
// 				Description:
// 					'Ensure that when multiple events require intervention, those that are most significant to the business are addressed first. Impacts can include loss of life or injury, financial loss, or damage to reputation or trust.',
// 			},
// 			{
// 				ChoiceId: 'ops_event_response_define_escalation_paths',
// 				Title: 'Define escalation paths',
// 				Description:
// 					'Define escalation paths in your runbooks and playbooks, including what triggers escalation, and procedures for escalation. Specifically identify owners for each action to ensure effective and prompt responses to operations events.',
// 			},
// 			{
// 				ChoiceId: 'ops_event_response_push_notify',
// 				Title: 'Define a customer communication plan for outages',
// 				Description:
// 					'Define and test a communication plan for system outages that you can rely on to keep your customers and stakeholders informed during outages. Communicate directly with your users both when the services they use are impacted and when services return to normal.',
// 			},
// 			{
// 				ChoiceId: 'ops_event_response_dashboards',
// 				Title: 'Communicate status through dashboards',
// 				Description:
// 					'Provide dashboards tailored to their target audiences (for example, internal technical teams, leadership, and customers) to communicate the current operating status of the business and provide metrics of interest.',
// 			},
// 			{
// 				ChoiceId: 'ops_event_response_auto_event_response',
// 				Title: 'Automate responses to events',
// 				Description:
// 					'Automate responses to events to reduce errors caused by manual processes, and to ensure prompt and consistent responses.',
// 			},
// 			{
// 				ChoiceId: 'ops_event_response_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'event-response',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle: 'How do you manage workload and operations events?',
// 				QuestionDescription:
// 					'Prepare and validate procedures for responding to events to minimize their disruption to your workload.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.event-response.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'evolve-ops',
// 		PillarId: 'operationalExcellence',
// 		QuestionTitle: 'How do you evolve operations?',
// 		Choices: [
// 			{
// 				ChoiceId: 'ops_evolve_ops_process_cont_imp',
// 				Title: 'Have a process for continuous improvement',
// 				Description:
// 					'Evaluate your workload against internal and external architecture best practices. Conduct workload reviews at least once per year. Prioritize improvement opportunities into your software development cadence.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_perform_rca_process',
// 				Title: 'Perform post-incident analysis',
// 				Description:
// 					'Review customer-impacting events, and identify the contributing factors and preventative actions. Use this information to develop mitigations to limit or prevent recurrence. Develop procedures for prompt and effective responses. Communicate contributing factors and corrective actions as appropriate, tailored to target audiences.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_feedback_loops',
// 				Title: 'Implement feedback loops',
// 				Description:
// 					'Feedback loops provide actionable insights that drive decision making. Build feedback loops into your procedures and workloads. This helps you identify issues and areas that need improvement. They also validate investments made in improvements. These feedback loops are the foundation for continuously improving your workload.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_knowledge_management',
// 				Title: 'Perform knowledge management',
// 				Description:
// 					'Knowledge management helps team members find the information to perform their job. In learning organizations, information is freely shared which empowers individuals. The information can be discovered or searched. Information is accurate and up to date. Mechanisms exist to create new information, update existing information, and archive outdated information. The most common example of a knowledge management platform is a content management system like a wiki.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_drivers_for_imp',
// 				Title: 'Define drivers for improvement',
// 				Description:
// 					'Identify drivers for improvement to help you evaluate and prioritize opportunities.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_validate_insights',
// 				Title: 'Validate insights',
// 				Description:
// 					'Review your analysis results and responses with cross-functional teams and business owners. Use these reviews to establish common understanding, identify additional impacts, and determine courses of action. Adjust responses as appropriate.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_metrics_review',
// 				Title: 'Perform operations metrics reviews',
// 				Description:
// 					'Regularly perform retrospective analysis of operations metrics with cross-team participants from different areas of the business. Use these reviews to identify opportunities for improvement, potential courses of action, and to share lessons learned.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_share_lessons_learned',
// 				Title: 'Document and share lessons learned',
// 				Description:
// 					'Document and share lessons learned from the operations activities so that you can use them internally and across teams.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_allocate_time_for_imp',
// 				Title: 'Allocate time to make improvements',
// 				Description:
// 					'Dedicate time and resources within your processes to make continuous incremental improvements possible.',
// 			},
// 			{
// 				ChoiceId: 'ops_evolve_ops_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'evolve-ops',
// 				PillarId: 'operationalExcellence',
// 				QuestionTitle: 'How do you evolve operations?',
// 				QuestionDescription:
// 					'Dedicate time and resources for continuous incremental improvement to evolve the effectiveness and efficiency of your operations.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.evolve-ops.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'performing-architecture',
// 		PillarId: 'performance',
// 		QuestionTitle:
// 			'How do you select the appropriate cloud resources and architecture patterns for your workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'perf_architecture_understand_cloud_services_and_features',
// 				Title:
// 					'Learn about and understand available cloud services and features',
// 				Description:
// 					'Continually learn about and discover available services and configurations that help you make better architectural decisions and improve performance efficiency in your workload architecture.',
// 			},
// 			{
// 				ChoiceId: 'perf_architecture_evaluate_trade_offs',
// 				Title:
// 					'Evaluate how trade-offs impact customers and architecture efficiency',
// 				Description:
// 					'When evaluating performance-related improvements, determine which choices impact your customers and workload efficiency. For example, if using a key-value data store increases system performance, it is important to evaluate how the eventually consistent nature of this change will impact customers.',
// 			},
// 			{
// 				ChoiceId:
// 					'perf_architecture_guidance_architecture_patterns_best_practices',
// 				Title:
// 					'Use guidance from your cloud provider or an appropriate partner to learn about architecture patterns and best practices',
// 				Description:
// 					'Use cloud company resources such as documentation, solutions architects, professional services, or appropriate partners to guide your architectural decisions. These resources help you review and improve your architecture for optimal performance.',
// 			},
// 			{
// 				ChoiceId: 'perf_architecture_factor_cost_into_architectural_decisions',
// 				Title: 'Factor cost into architectural decisions',
// 				Description:
// 					'Factor cost into your architectural decisions to improve resource utilization and performance efficiency of your cloud workload. When you are aware of the cost implications of your cloud workload, you are more likely to leverage efficient resources and reduce wasteful practices.',
// 			},
// 			{
// 				ChoiceId: 'perf_architecture_use_policies_and_reference_architectures',
// 				Title: 'Use policies and reference architectures',
// 				Description:
// 					'Use internal policies and existing reference architectures when selecting services and configurations to be more efficient when designing and implementing your workload.',
// 			},
// 			{
// 				ChoiceId: 'perf_architecture_use_benchmarking',
// 				Title: 'Use benchmarking to drive architectural decisions',
// 				Description:
// 					'Benchmark the performance of an existing workload to understand how it performs on the cloud and drive architectural decisions based on that data.',
// 			},
// 			{
// 				ChoiceId: 'perf_architecture_use_data_driven_approach',
// 				Title: 'Use a data-driven approach for architectural choices',
// 				Description:
// 					'Define a clear, data-driven approach for architectural choices to verify that the right cloud services and configurations are used to meet your specific business needs.',
// 			},
// 			{
// 				ChoiceId: 'perf_performing_architecture_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'performing-architecture',
// 				PillarId: 'performance',
// 				QuestionTitle:
// 					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
// 				QuestionDescription:
// 					'The optimal solution for a particular workload varies, and solutions often combine multiple approaches. Well-Architected workloads use multiple solutions and allow different features to improve performance.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.performing-architecture.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'compute-hardware',
// 		PillarId: 'performance',
// 		QuestionTitle:
// 			'How do you select and use compute resources in your workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'perf_compute_hardware_select_best_compute_options',
// 				Title: 'Select the best compute options for your workload',
// 				Description:
// 					'Selecting the most appropriate compute option for your workload allows you to improve performance, reduce unnecessary infrastructure costs, and lower the operational efforts required to maintain your workload.',
// 			},
// 			{
// 				ChoiceId: 'perf_compute_hardware_collect_compute_related_metrics',
// 				Title: 'Collect compute-related metrics',
// 				Description:
// 					'Record and track compute-related metrics to better understand how your compute resources are performing and improve their performance and their utilization.',
// 			},
// 			{
// 				ChoiceId: 'perf_compute_hardware_scale_compute_resources_dynamically',
// 				Title: 'Scale your compute resources dynamically',
// 				Description:
// 					'Use the elasticity of the cloud to scale your compute resources up or down dynamically to match your needs and avoid over- or under-provisioning capacity for your workload.',
// 			},
// 			{
// 				ChoiceId:
// 					'perf_compute_hardware_understand_compute_configuration_features',
// 				Title: 'Understand the available compute configuration and features',
// 				Description:
// 					'Understand the available configuration options and features for your compute service to help you provision the right amount of resources and improve performance efficiency.',
// 			},
// 			{
// 				ChoiceId:
// 					'perf_compute_hardware_configure_and_right_size_compute_resources',
// 				Title: 'Configure and right-size compute resources',
// 				Description:
// 					'Configure and right-size compute resources to match your workload’s performance requirements and avoid under- or over-utilized resources.',
// 			},
// 			{
// 				ChoiceId: 'perf_compute_hardware_compute_accelerators',
// 				Title: 'Use optimized hardware-based compute accelerators',
// 				Description:
// 					'Use hardware accelerators to perform certain functions more efficiently than CPU-based alternatives.',
// 			},
// 			{
// 				ChoiceId: 'perf_compute_hardware_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'compute-hardware',
// 				PillarId: 'performance',
// 				QuestionTitle:
// 					'How do you select and use compute resources in your workload?',
// 				QuestionDescription:
// 					'The optimal compute choice for a particular workload can vary based on application design, usage patterns, and configuration settings. Architectures may use different compute choices for various components and allow different features to improve performance. Selecting the wrong compute choice for an architecture can lead to lower performance efficiency.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.compute-hardware.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'data-management',
// 		PillarId: 'performance',
// 		QuestionTitle:
// 			'How do you store, manage, and access data in your workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'perf_data_use_purpose_built_data_store',
// 				Title:
// 					'Use purpose-built data store that best support your data access and storage requirements',
// 				Description:
// 					'Understand data characteristics (like shareable, size, cache size, access patterns, latency, throughput, and persistence of data) to select the right purpose-built data stores (storage or database) for your workload.',
// 			},
// 			{
// 				ChoiceId: 'perf_data_collect_record_data_store_performance_metrics',
// 				Title: 'Collect and record data store performance metrics',
// 				Description:
// 					'Track and record relevant performance metrics for your data store to understand how your data management solutions are performing. These metrics can help you optimize your data store, verify that your workload requirements are met, and provide a clear overview on how the workload performs.',
// 			},
// 			{
// 				ChoiceId: 'perf_data_evaluate_configuration_options_data_store',
// 				Title: 'Evaluate available configuration options for data store',
// 				Description:
// 					'Understand and evaluate the various features and configuration options available for your data stores to optimize storage space and performance for your workload.',
// 			},
// 			{
// 				ChoiceId: 'perf_data_implement_strategies_to_improve_query_performance',
// 				Title:
// 					'Implement strategies to improve query performance in data store',
// 				Description:
// 					'Implement strategies to optimize data and improve data query to enable more scalability and efficient performance for your workload.',
// 			},
// 			{
// 				ChoiceId: 'perf_data_access_patterns_caching',
// 				Title: 'Implement data access patterns that utilize caching',
// 				Description:
// 					'Implement access patterns that can benefit from caching data for fast retrieval of frequently accessed data.',
// 			},
// 			{
// 				ChoiceId: 'perf_data_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'data-management',
// 				PillarId: 'performance',
// 				QuestionTitle:
// 					'How do you store, manage, and access data in your workload?',
// 				QuestionDescription:
// 					'The optimal data management solution for a particular system varies based on the kind of data type (block, file, or object), access patterns (random or sequential), required throughput, frequency of access (online, offline, archival), frequency of update (WORM, dynamic), and availability and durability constraints. Well-Architected workloads use purpose-built data stores which allow different features to improve performance.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.data-management.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'networking',
// 		PillarId: 'performance',
// 		QuestionTitle:
// 			'How do you select and configure networking resources in your workload?',
// 		Choices: [
// 			{
// 				ChoiceId:
// 					'perf_networking_understand_how_networking_impacts_performance',
// 				Title: 'Understand how networking impacts performance',
// 				Description:
// 					'Analyze and understand how network-related decisions impact your workload to provide efficient performance and improved user experience.',
// 			},
// 			{
// 				ChoiceId: 'perf_networking_evaluate_networking_features',
// 				Title: 'Evaluate available networking features',
// 				Description:
// 					'Evaluate networking features in the cloud that may increase performance. Measure the impact of these features through testing, metrics, and analysis. For example, take advantage of network-level features that are available to reduce latency, network distance, or jitter.',
// 			},
// 			{
// 				ChoiceId:
// 					'perf_networking_choose_appropriate_dedicated_connectivity_or_vpn',
// 				Title:
// 					'Choose appropriate dedicated connectivity or VPN for your workload',
// 				Description:
// 					'When hybrid connectivity is required to connect on-premises and cloud resources, provision adequate bandwidth to meet your performance requirements. Estimate the bandwidth and latency requirements for your hybrid workload. These numbers will drive your sizing requirements.',
// 			},
// 			{
// 				ChoiceId: 'perf_networking_load_balancing_distribute_traffic',
// 				Title:
// 					'Use load balancing to distribute traffic across multiple resources',
// 				Description:
// 					'Distribute traffic across multiple resources or services to allow your workload to take advantage of the elasticity that the cloud provides. You can also use load balancing for offloading encryption termination to improve performance, reliability and manage and route traffic effectively.',
// 			},
// 			{
// 				ChoiceId:
// 					'perf_networking_choose_network_protocols_improve_performance',
// 				Title: 'Choose network protocols to improve performance',
// 				Description:
// 					'Make decisions about protocols for communication between systems and networks based on the impact to the workload’s performance.',
// 			},
// 			{
// 				ChoiceId:
// 					'perf_networking_choose_workload_location_network_requirements',
// 				Title: "Choose your workload's location based on network requirements",
// 				Description:
// 					'Evaluate options for resource placement to reduce network latency and improve throughput, providing an optimal user experience by reducing page load and data transfer times.',
// 			},
// 			{
// 				ChoiceId:
// 					'perf_networking_optimize_network_configuration_based_on_metrics',
// 				Title: 'Optimize network configuration based on metrics',
// 				Description:
// 					'Use collected and analyzed data to make informed decisions about optimizing your network configuration.',
// 			},
// 			{
// 				ChoiceId: 'perf_networking_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'networking',
// 				PillarId: 'performance',
// 				QuestionTitle:
// 					'How do you select and configure networking resources in your workload?',
// 				QuestionDescription:
// 					'The optimal networking solution for a workload varies based on latency, throughput requirements, jitter, and bandwidth. Physical constraints, such as user or on-premises resources, determine location options. These constraints can be offset with edge locations or resource placement.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.networking.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'process-culture',
// 		PillarId: 'performance',
// 		QuestionTitle:
// 			'What process do you use to support more performance efficiency for your workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'perf_process_culture_establish_key_performance_indicators',
// 				Title:
// 					'Establish key performance indicators (KPIs) to measure workload health and performance',
// 				Description:
// 					'Identify the KPIs that quantitatively and qualitatively measure workload performance. KPIs help you measure the health and performance of a workload related to a business goal.',
// 			},
// 			{
// 				ChoiceId: 'perf_process_culture_use_monitoring_solutions',
// 				Title:
// 					'Use monitoring solutions to understand the areas where performance is most critical',
// 				Description:
// 					'Understand and identify areas where increasing the performance of your workload will have a positive impact on efficiency or customer experience. For example, a website that has a large amount of customer interaction can benefit from using edge services to move content delivery closer to customers.',
// 			},
// 			{
// 				ChoiceId: 'perf_process_culture_workload_performance',
// 				Title: 'Define a process to improve workload performance',
// 				Description:
// 					'Define a process to evaluate new services, design patterns, resource types, and configurations as they become available. For example, run existing performance tests on new instance offerings to determine their potential to improve your workload.',
// 			},
// 			{
// 				ChoiceId: 'perf_process_culture_review_metrics',
// 				Title: 'Review metrics at regular intervals',
// 				Description:
// 					'As part of routine maintenance or in response to events or incidents, review which metrics are collected. Use these reviews to identify which metrics were essential in addressing issues and which additional metrics, if they were being tracked, could help identify, address, or prevent issues.',
// 			},
// 			{
// 				ChoiceId: 'perf_process_culture_load_test',
// 				Title: 'Load test your workload',
// 				Description:
// 					'Load test your workload to verify it can handle production load and identify any performance bottleneck.',
// 			},
// 			{
// 				ChoiceId: 'perf_process_culture_automation_remediate_issues',
// 				Title:
// 					'Use automation to proactively remediate performance-related issues',
// 				Description:
// 					'Use key performance indicators (KPIs), combined with monitoring and alerting systems, to proactively address performance-related issues.',
// 			},
// 			{
// 				ChoiceId: 'perf_process_culture_keep_workload_and_services_up_to_date',
// 				Title: 'Keep your workload and services up-to-date',
// 				Description:
// 					'Stay up-to-date on new cloud services and features to adopt efficient features, remove issues, and improve the overall performance efficiency of your workload.',
// 			},
// 			{
// 				ChoiceId: 'perf_process_culture_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'process-culture',
// 				PillarId: 'performance',
// 				QuestionTitle:
// 					'What process do you use to support more performance efficiency for your workload?',
// 				QuestionDescription:
// 					'When architecting workloads, there are principles and practices that you can adopt to help you better run efficient high-performing cloud workloads.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.process-culture.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'manage-service-limits',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you manage service quotas and constraints?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_manage_service_limits_aware_quotas_and_constraints',
// 				Title: 'Aware of service quotas and constraints',
// 				Description:
// 					'Be aware of your default quotas and manage your quota increase requests for your workload architecture. Know which cloud resource constraints, such as disk or network, are potentially impactful.',
// 			},
// 			{
// 				ChoiceId: 'rel_manage_service_limits_limits_considered',
// 				Title: 'Manage service quotas across accounts and Regions',
// 				Description:
// 					'If you are using multiple accounts or Regions, request the appropriate quotas in all environments in which your production workloads run.',
// 			},
// 			{
// 				ChoiceId: 'rel_manage_service_limits_aware_fixed_limits',
// 				Title:
// 					'Accommodate fixed service quotas and constraints through architecture',
// 				Description:
// 					'Be aware of unchangeable service quotas, service constraints, and physical resource limits. Design architectures for applications and services to prevent these limits from impacting reliability.',
// 			},
// 			{
// 				ChoiceId: 'rel_manage_service_limits_monitor_manage_limits',
// 				Title: 'Monitor and manage quotas',
// 				Description:
// 					'Evaluate your potential usage and increase your quotas appropriately, allowing for planned growth in usage.',
// 			},
// 			{
// 				ChoiceId: 'rel_manage_service_limits_automated_monitor_limits',
// 				Title: 'Automate quota management',
// 				Description:
// 					'Implement tools to alert you when thresholds are being approached. You can automate quota increase requests by using AWS Service Quotas APIs.',
// 			},
// 			{
// 				ChoiceId: 'rel_manage_service_limits_suff_buffer_limits',
// 				Title:
// 					'Ensure that a sufficient gap exists between the current quotas and the maximum usage to accommodate failover',
// 				Description:
// 					'When a resource fails or is inaccessible, that resource might still be counted against a quota until it’s successfully terminated. Verify that your quotas cover the overlap of failed or inaccessible resources and their replacements. You should consider use cases like network failure, Availability Zone failure, or Regional failures when calculating this gap.',
// 			},
// 			{
// 				ChoiceId: 'rel_manage_service_limits_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'manage-service-limits',
// 				PillarId: 'reliability',
// 				QuestionTitle: 'How do you manage service quotas and constraints?',
// 				QuestionDescription:
// 					'For cloud-based workload architectures, there are service quotas (which are also referred to as service limits). These quotas exist to prevent accidentally provisioning more resources than you need and to limit request rates on API operations so as to protect services from abuse. There are also resource constraints, for example, the rate that you can push bits down a fiber-optic cable, or the amount of storage on a physical disk.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.manage-service-limits.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [
// 			{
// 				id: 'servicequotas_organization_quota_enabled',
// 				priority: 'high',
// 				n_priority: {
// 					default_priority: 20,
// 					accountType: {
// 						Production: 20,
// 						Development: 0,
// 						Sandbox: 0,
// 					},
// 				},
// 				service: ['Service Quotas'],
// 				domain: ['Infrastructure Security'],
// 				title: 'Service Quota Organizations Request Template is Enabled',
// 				description:
// 					'Check if Service Quota templates for AWS Organizations are enabled.',
// 				relatedConfiguration: [],
// 				result: {
// 					passed: [],
// 					failed: [],
// 					notapplicable: [
// 						{
// 							accountId: '025825898506',
// 							outcome: 'notapplicable',
// 							displayName: 'Service Quotas',
// 							resourceArn: '',
// 							resourceId: '',
// 							resourceType: 'Service Quotas',
// 							link: 'https://console.aws.amazon.com/servicequotas/home/',
// 							description:
// 								"The request was called by a member account. Please call the request using organization's master account.",
// 						},
// 					],
// 					error: [],
// 					exceptions: [],
// 				},
// 			},
// 			{
// 				id: 'servicequotas_request_templates_exist',
// 				priority: 'high',
// 				n_priority: {
// 					default_priority: 20,
// 					accountType: {
// 						Production: 20,
// 						Development: 0,
// 						Sandbox: 0,
// 					},
// 				},
// 				service: ['Service Quotas'],
// 				domain: ['Infrastructure Security'],
// 				title: 'Service Quota Request Template is Configured',
// 				description: 'Check if Service Quota request templates are used.',
// 				relatedConfiguration: [],
// 				result: {
// 					passed: [],
// 					failed: [],
// 					notapplicable: [
// 						{
// 							accountId: '025825898506',
// 							outcome: 'notapplicable',
// 							displayName: 'Service Quotas',
// 							resourceArn: '',
// 							resourceId: '',
// 							resourceType: 'Service Quotas',
// 							link: 'https://console.aws.amazon.com/servicequotas/home/',
// 							description:
// 								"The request was called by a member account. Please call the request using organization's master account.",
// 						},
// 					],
// 					error: [],
// 					exceptions: [],
// 				},
// 			},
// 			{
// 				id: 'servicequotas_request_templates_exist',
// 				priority: 'high',
// 				n_priority: {
// 					default_priority: 20,
// 					accountType: {
// 						Production: 20,
// 						Development: 0,
// 						Sandbox: 0,
// 					},
// 				},
// 				service: ['Service Quotas'],
// 				domain: ['Infrastructure Security'],
// 				title: 'Service Quota Request Template is Configured',
// 				description: 'Check if Service Quota request templates are used.',
// 				relatedConfiguration: [],
// 				result: {
// 					passed: [],
// 					failed: [],
// 					notapplicable: [
// 						{
// 							accountId: '025825898506',
// 							outcome: 'notapplicable',
// 							displayName: 'Service Quotas',
// 							resourceArn: '',
// 							resourceId: '',
// 							resourceType: 'Service Quotas',
// 							link: 'https://console.aws.amazon.com/servicequotas/home/',
// 							description:
// 								"The request was called by a member account. Please call the request using organization's master account.",
// 						},
// 					],
// 					error: [],
// 					exceptions: [],
// 				},
// 			},
// 		],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'planning-network-topology',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you plan your network topology?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_planning_network_topology_ha_conn_users',
// 				Title:
// 					'Use highly available network connectivity for your workload public endpoints',
// 				Description:
// 					'Building highly available network connectivity to public endpoints of your workloads can help you reduce downtime due to loss of connectivity and improve the availability and SLA of your workload. To achieve this, use highly available DNS, content delivery networks (CDNs), API gateways, load balancing, or reverse proxies.',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_network_topology_ha_conn_private_networks',
// 				Title:
// 					'Provision redundant connectivity between private networks in the cloud and on-premises environments',
// 				Description:
// 					'Use multiple AWS Direct Connect connections or VPN tunnels between separately deployed private networks. Use multiple Direct Connect locations for high availability. If using multiple AWS Regions, ensure redundancy in at least two of them. You might want to evaluate AWS Marketplace appliances that terminate VPNs. If you use AWS Marketplace appliances, deploy redundant instances for high availability in different Availability Zones.',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_network_topology_ip_subnet_allocation',
// 				Title:
// 					'Ensure IP subnet allocation accounts for expansion and availability',
// 				Description:
// 					'Amazon VPC IP address ranges must be large enough to accommodate workload requirements, including factoring in future expansion and allocation of IP addresses to subnets across Availability Zones. This includes load balancers, EC2 instances, and container-based applications.',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_network_topology_prefer_hub_and_spoke',
// 				Title: 'Prefer hub-and-spoke topologies over many-to-many mesh',
// 				Description:
// 					'If more than two network address spaces (for example, VPCs and on-premises networks) are connected via VPC peering, AWS Direct Connect, or VPN, then use a hub-and-spoke model, like that provided by AWS Transit Gateway.',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_network_topology_non_overlap_ip',
// 				Title:
// 					'Enforce non-overlapping private IP address ranges in all private address spaces where they are connected',
// 				Description:
// 					'The IP address ranges of each of your VPCs must not overlap when peered or connected via VPN. You must similarly avoid IP address conflicts between a VPC and on-premises environments or with other cloud providers that you use. You must also have a way to allocate private IP address ranges when needed.',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_network_topology_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'planning-network-topology',
// 				PillarId: 'reliability',
// 				QuestionTitle: 'How do you plan your network topology?',
// 				QuestionDescription:
// 					'Workloads often exist in multiple environments. These include multiple cloud environments (both publicly accessible and private) and possibly your existing data center infrastructure. Plans must include network considerations such as intra- and inter-system connectivity, public IP address management, private IP address management, and domain name resolution.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.planning-network-topology.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'service-architecture',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you design your workload service architecture?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_service_architecture_monolith_soa_microservice',
// 				Title: 'Choose how to segment your workload',
// 				Description:
// 					'Workload segmentation is important when determining the resilience requirements of your application. Monolithic architecture should be avoided whenever possible. Instead, carefully consider which application components can be broken out into microservices. Depending on your application requirements, this may end up being a combination of a service-oriented architecture (SOA) with microservices where possible. Workloads that are capable of statelessness are more capable of being deployed as microservices.',
// 			},
// 			{
// 				ChoiceId: 'rel_service_architecture_business_domains',
// 				Title:
// 					'Build services focused on specific business domains and functionality',
// 				Description:
// 					'Service-oriented architectures (SOA) define services with well-delineated functions defined by business needs. Microservices use domain models and bounded context to draw service boundaries along business context boundaries. Focusing on business domains and functionality helps teams define independent reliability requirements for their services. Bounded contexts isolate and encapsulate business logic, allowing teams to better reason about how to handle failures.',
// 			},
// 			{
// 				ChoiceId: 'rel_service_architecture_api_contracts',
// 				Title: 'Provide service contracts per API',
// 				Description:
// 					'Service contracts are documented agreements between API producers and consumers defined in a machine-readable API definition. A contract versioning strategy allows consumers to continue using the existing API and migrate their applications to a newer API when they are ready. Producer deployment can happen any time as long as the contract is followed. Service teams can use the technology stack of their choice to satisfy the API contract.',
// 			},
// 			{
// 				ChoiceId: 'rel_service_architecture_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'service-architecture',
// 				PillarId: 'reliability',
// 				QuestionTitle: 'How do you design your workload service architecture?',
// 				QuestionDescription:
// 					'Build highly scalable and reliable workloads using a service-oriented architecture (SOA) or a microservices architecture. Service-oriented architecture (SOA) is the practice of making software components reusable via service interfaces. Microservices architecture goes further to make components smaller and simpler.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.service-architecture.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'prevent-interaction-failure',
// 		PillarId: 'reliability',
// 		QuestionTitle:
// 			'How do you design interactions in a distributed system to prevent failures?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_prevent_interaction_failure_identify',
// 				Title: 'Identify which kind of distributed system is required',
// 				Description:
// 					'Hard real-time distributed systems require responses to be given synchronously and rapidly, while soft real-time systems have a more generous time window of minutes or more for response. Offline systems handle responses through batch or asynchronous processing. Hard real-time distributed systems have the most stringent reliability requirements.',
// 			},
// 			{
// 				ChoiceId: 'rel_prevent_interaction_failure_loosely_coupled_system',
// 				Title: 'Implement loosely coupled dependencies',
// 				Description:
// 					'Dependencies such as queuing systems, streaming systems, workflows, and load balancers are loosely coupled. Loose coupling helps isolate behavior of a component from other components that depend on it, increasing resiliency and agility.',
// 			},
// 			{
// 				ChoiceId: 'rel_prevent_interaction_failure_idempotent',
// 				Title: 'Make all responses idempotent',
// 				Description:
// 					'An idempotent service promises that each request is completed exactly once, such that making multiple identical requests has the same effect as making a single request. An idempotent service makes it easier for a client to implement retries without fear that a request will be erroneously processed multiple times. To do this, clients can issue API requests with an idempotency token—the same token is used whenever the request is repeated. An idempotent service API uses the token to return a response identical to the response that was returned the first time that the request was completed.',
// 			},
// 			{
// 				ChoiceId: 'rel_prevent_interaction_failure_constant_work',
// 				Title: 'Do constant work',
// 				Description:
// 					'Systems can fail when there are large, rapid changes in load. For example, if your workload is doing a health check that monitors the health of thousands of servers, it should send the same size payload (a full snapshot of the current state) each time. Whether no servers are failing, or all of them, the health check system is doing constant work with no large, rapid changes.',
// 			},
// 			{
// 				ChoiceId: 'rel_prevent_interaction_failure_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'prevent-interaction-failure',
// 				PillarId: 'reliability',
// 				QuestionTitle:
// 					'How do you design interactions in a distributed system to prevent failures?',
// 				QuestionDescription:
// 					'Distributed systems rely on communications networks to interconnect components, such as servers or services. Your workload must operate reliably despite data loss or latency in these networks. Components of the distributed system must operate in a way that does not negatively impact other components or the workload. These best practices prevent failures and improve mean time between failures (MTBF).',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.prevent-interaction-failure.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'mitigate-interaction-failure',
// 		PillarId: 'reliability',
// 		QuestionTitle:
// 			'How do you design interactions in a distributed system to mitigate or withstand failures?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_mitigate_interaction_failure_graceful_degradation',
// 				Title:
// 					'Implement graceful degradation to transform applicable hard dependencies into soft dependencies',
// 				Description:
// 					'Application components should continue to perform their core function even if dependencies become unavailable. They might be serving slightly stale data, alternate data, or even no data. This ensures overall system function is only minimally impeded by localized failures while delivering the central business value.',
// 			},
// 			{
// 				ChoiceId: 'rel_mitigate_interaction_failure_throttle_requests',
// 				Title: 'Throttle requests',
// 				Description:
// 					'Throttle requests to mitigate resource exhaustion due to unexpected increases in demand. Requests below throttling rates are processed while those over the defined limit are rejected with a return a message indicating the request was throttled.',
// 			},
// 			{
// 				ChoiceId: 'rel_mitigate_interaction_failure_limit_retries',
// 				Title: 'Control and limit retry calls',
// 				Description:
// 					'Use exponential backoff to retry requests at progressively longer intervals between each retry. Introduce jitter between retries to randomize retry intervals. Limit the maximum number of retries.',
// 			},
// 			{
// 				ChoiceId: 'rel_mitigate_interaction_failure_fail_fast',
// 				Title: 'Fail fast and limit queues',
// 				Description:
// 					'When a service is unable to respond successfully to a request, fail fast. This allows resources associated with a request to be released, and permits a service to recover if it’s running out of resources. Failing fast is a well-established software design pattern that can be leveraged to build highly reliable workloads in the cloud. Queuing is also a well-established enterprise integration pattern that can smooth load and allow clients to release resources when asynchronous processing can be tolerated. When a service is able to respond successfully under normal conditions but fails when the rate of requests is too high, use a queue to buffer requests. However, do not allow a buildup of long queue backlogs that can result in processing stale requests that a client has already given up on.',
// 			},
// 			{
// 				ChoiceId: 'rel_mitigate_interaction_failure_client_timeouts',
// 				Title: 'Set client timeouts',
// 				Description:
// 					'Set timeouts appropriately on connections and requests, verify them systematically, and do not rely on default values as they are not aware of workload specifics.',
// 			},
// 			{
// 				ChoiceId: 'rel_mitigate_interaction_failure_stateless',
// 				Title: 'Make services stateless where possible',
// 				Description:
// 					'Services should either not require state, or should offload state such that between different client requests, there is no dependence on locally stored data on disk and in memory. This enables servers to be replaced at will without causing an availability impact. Amazon ElastiCache or Amazon DynamoDB are good destinations for offloaded state.',
// 			},
// 			{
// 				ChoiceId: 'rel_mitigate_interaction_failure_emergency_levers',
// 				Title: 'Implement emergency levers',
// 				Description:
// 					'Emergency levers are rapid processes that can mitigate availability impact on your workload.',
// 			},
// 			{
// 				ChoiceId: 'rel_mitigate_interaction_failure_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'mitigate-interaction-failure',
// 				PillarId: 'reliability',
// 				QuestionTitle:
// 					'How do you design interactions in a distributed system to mitigate or withstand failures?',
// 				QuestionDescription:
// 					'Distributed systems rely on communications networks to interconnect components (such as servers or services). Your workload must operate reliably despite data loss or latency over these networks. Components of the distributed system must operate in a way that does not negatively impact other components or the workload. These best practices enable workloads to withstand stresses or failures, more quickly recover from them, and mitigate the impact of such impairments. The result is improved mean time to recovery (MTTR).',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.mitigate-interaction-failure.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'monitor-aws-resources',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you monitor workload resources?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_monitor_aws_resources_monitor_resources',
// 				Title: 'Monitor all components for the workload (Generation)',
// 				Description:
// 					'Monitor the components of the workload with Amazon CloudWatch or third-party tools. Monitor AWS services with AWS Health Dashboard.',
// 			},
// 			{
// 				ChoiceId: 'rel_monitor_aws_resources_notification_aggregation',
// 				Title: 'Define and calculate metrics (Aggregation)',
// 				Description:
// 					'Store log data and apply filters where necessary to calculate metrics, such as counts of a specific log event, or latency calculated from log event timestamps.',
// 			},
// 			{
// 				ChoiceId: 'rel_monitor_aws_resources_notification_monitor',
// 				Title: 'Send notifications (Real-time processing and alarming)',
// 				Description:
// 					'When organizations detect potential issues, they send real-time notifications and alerts to the appropriate personnel and systems in order to respond quickly and effectively to these issues.',
// 			},
// 			{
// 				ChoiceId: 'rel_monitor_aws_resources_automate_response_monitor',
// 				Title: 'Automate responses (Real-time processing and alarming)',
// 				Description:
// 					'Use automation to take action when an event is detected, for example, to replace failed components.',
// 			},
// 			{
// 				ChoiceId: 'rel_monitor_aws_resources_storage_analytics',
// 				Title: 'Analytics',
// 				Description:
// 					'Collect log files and metrics histories and analyze these for broader trends and workload insights.',
// 			},
// 			{
// 				ChoiceId: 'rel_monitor_aws_resources_review_monitoring',
// 				Title: 'Conduct reviews regularly',
// 				Description:
// 					'Frequently review how workload monitoring is implemented and update it based on significant events and changes.',
// 			},
// 			{
// 				ChoiceId: 'rel_monitor_aws_resources_end_to_end',
// 				Title: 'Monitor end-to-end tracing of requests through your system',
// 				Description:
// 					'Trace requests as they process through service components so product teams can more easily analyze and debug issues and improve performance.',
// 			},
// 			{
// 				ChoiceId: 'rel_monitor_aws_resources_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'monitor-aws-resources',
// 				PillarId: 'reliability',
// 				QuestionTitle: 'How do you monitor workload resources?',
// 				QuestionDescription:
// 					'Logs and metrics are powerful tools to gain insight into the health of your workload. You can configure your workload to monitor logs and metrics and send notifications when thresholds are crossed or significant events occur. Monitoring enables your workload to recognize when low-performance thresholds are crossed or failures occur, so it can recover automatically in response.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.monitor-aws-resources.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'adapt-to-changes',
// 		PillarId: 'reliability',
// 		QuestionTitle:
// 			'How do you design your workload to adapt to changes in demand?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_adapt_to_changes_autoscale_adapt',
// 				Title: 'Use automation when obtaining or scaling resources',
// 				Description:
// 					'When replacing impaired resources or scaling your workload, automate the process by using managed AWS services, such as Amazon S3 and AWS Auto Scaling. You can also use third-party tools and AWS SDKs to automate scaling.',
// 			},
// 			{
// 				ChoiceId: 'rel_adapt_to_changes_reactive_adapt_auto',
// 				Title: 'Obtain resources upon detection of impairment to a workload',
// 				Description:
// 					'Scale resources reactively when necessary if availability is impacted, to restore workload availability.',
// 			},
// 			{
// 				ChoiceId: 'rel_adapt_to_changes_proactive_adapt_auto',
// 				Title:
// 					'Obtain resources upon detection that more resources are needed for a workload',
// 				Description:
// 					'Scale resources proactively to meet demand and avoid availability impact.',
// 			},
// 			{
// 				ChoiceId: 'rel_adapt_to_changes_load_tested_adapt',
// 				Title: 'Load test your workload',
// 				Description:
// 					'Adopt a load testing methodology to measure if scaling activity meets workload requirements.',
// 			},
// 			{
// 				ChoiceId: 'rel_adapt_to_changes_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'adapt-to-changes',
// 				PillarId: 'reliability',
// 				QuestionTitle:
// 					'How do you design your workload to adapt to changes in demand?',
// 				QuestionDescription:
// 					'A scalable workload provides elasticity to add or remove resources automatically so that they closely match the current demand at any given point in time.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.adapt-to-changes.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'tracking-change-management',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you implement change?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_tracking_change_management_planned_changemgmt',
// 				Title: 'Use runbooks for standard activities such as deployment',
// 				Description:
// 					'Runbooks are the predefined procedures to achieve specific outcomes. Use runbooks to perform standard activities, whether done manually or automatically. Examples include deploying a workload, patching a workload, or making DNS modifications.',
// 			},
// 			{
// 				ChoiceId: 'rel_tracking_change_management_functional_testing',
// 				Title: 'Integrate functional testing as part of your deployment',
// 				Description:
// 					'Functional tests are run as part of automated deployment. If success criteria are not met, the pipeline is halted or rolled back.',
// 			},
// 			{
// 				ChoiceId: 'rel_tracking_change_management_resiliency_testing',
// 				Title: 'Integrate resiliency testing as part of your deployment',
// 				Description:
// 					'Resiliency tests (using the principles of chaos engineering) are run as part of the automated deployment pipeline in a pre-production environment.',
// 			},
// 			{
// 				ChoiceId: 'rel_tracking_change_management_immutable_infrastructure',
// 				Title: 'Deploy using immutable infrastructure',
// 				Description:
// 					'Immutable infrastructure is a model that mandates that no updates, security patches, or configuration changes happen in-place on production workloads. When a change is needed, the architecture is built onto new infrastructure and deployed into production.',
// 			},
// 			{
// 				ChoiceId: 'rel_tracking_change_management_automated_changemgmt',
// 				Title: 'Deploy changes with automation',
// 				Description:
// 					'Deployments and patching are automated to eliminate negative impact.',
// 			},
// 			{
// 				ChoiceId: 'rel_tracking_change_management_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'tracking-change-management',
// 				PillarId: 'reliability',
// 				QuestionTitle: 'How do you implement change?',
// 				QuestionDescription:
// 					'Controlled changes are necessary to deploy new functionality, and to ensure that the workloads and the operating environment are running known software and can be patched or replaced in a predictable manner. If these changes are uncontrolled, then it makes it difficult to predict the effect of these changes, or to address issues that arise because of them.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.tracking-change-management.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'backing-up-data',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you back up data?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_backing_up_data_identified_backups_data',
// 				Title:
// 					'Identify and back up all data that needs to be backed up, or reproduce the data from sources',
// 				Description:
// 					'Understand and use the backup capabilities of the data services and resources used by the workload. Most services provide capabilities to back up workload data.',
// 			},
// 			{
// 				ChoiceId: 'rel_backing_up_data_secured_backups_data',
// 				Title: 'Secure and encrypt backups',
// 				Description:
// 					'Control and detect access to backups using authentication and authorization. Prevent and detect if data integrity of backups is compromised using encryption.',
// 			},
// 			{
// 				ChoiceId: 'rel_backing_up_data_automated_backups_data',
// 				Title: 'Perform data backup automatically',
// 				Description:
// 					'Configure backups to be taken automatically based on a periodic schedule informed by the Recovery Point Objective (RPO), or by changes in the dataset. Critical datasets with low data loss requirements need to be backed up automatically on a frequent basis, whereas less critical data where some loss is acceptable can be backed up less frequently.',
// 			},
// 			{
// 				ChoiceId: 'rel_backing_up_data_periodic_recovery_testing_data',
// 				Title:
// 					'Perform periodic recovery of the data to verify backup integrity and processes',
// 				Description:
// 					'Validate that your backup process implementation meets your Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO) by performing a recovery test.',
// 			},
// 			{
// 				ChoiceId: 'rel_backing_up_data_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'backing-up-data',
// 				PillarId: 'reliability',
// 				QuestionTitle: 'How do you back up data?',
// 				QuestionDescription:
// 					'Back up data, applications, and configuration to meet your requirements for recovery time objectives (RTO) and recovery point objectives (RPO).',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.backing-up-data.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'fault-isolation',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you use fault isolation to protect your workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_fault_isolation_multiaz_region_system',
// 				Title: 'Deploy the workload to multiple locations',
// 				Description:
// 					'Distribute workload data and resources across multiple Availability Zones or, where necessary, across AWS Regions. These locations can be as diverse as required.',
// 			},
// 			{
// 				ChoiceId: 'rel_fault_isolation_select_location',
// 				Title:
// 					'Select the appropriate locations for your multi-location deployment',
// 				Description:
// 					'For high availability, always (when possible) deploy your workload components to multiple Availability Zones (AZs). For workloads with extreme resilience requirements, carefully evaluate the options for a multi-Region architecture.',
// 			},
// 			{
// 				ChoiceId: 'rel_fault_isolation_use_bulkhead',
// 				Title: 'Use bulkhead architectures to limit scope of impact',
// 				Description:
// 					'Implement bulkhead architectures (also known as cell-based architectures) to restrict the effect of failure within a workload to a limited number of components.',
// 			},
// 			{
// 				ChoiceId: 'rel_fault_isolation_single_az_system',
// 				Title:
// 					'Automate recovery for components constrained to a single location',
// 				Description:
// 					'If components of the workload can only run in a single Availability Zone or in an on-premises data center, implement the capability to do a complete rebuild of the workload within your defined recovery objectives.',
// 			},
// 			{
// 				ChoiceId: 'rel_fault_isolation_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'fault-isolation',
// 				PillarId: 'reliability',
// 				QuestionTitle:
// 					'How do you use fault isolation to protect your workload?',
// 				QuestionDescription:
// 					'Fault isolated boundaries limit the effect of a failure within a workload to a limited number of components. Components outside of the boundary are unaffected by the failure. Using multiple fault isolated boundaries, you can limit the impact on your workload.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.fault-isolation.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'withstand-component-failures',
// 		PillarId: 'reliability',
// 		QuestionTitle:
// 			'How do you design your workload to withstand component failures?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_withstand_component_failures_monitoring_health',
// 				Title: 'Monitor all components of the workload to detect failures',
// 				Description:
// 					'Continually monitor the health of your workload so that you and your automated systems are aware of failures or degradations as soon as they occur. Monitor for key performance indicators (KPIs) based on business value.',
// 			},
// 			{
// 				ChoiceId: 'rel_withstand_component_failures_failover2good',
// 				Title: 'Fail over to healthy resources',
// 				Description:
// 					'If a resource failure occurs, healthy resources should continue to serve requests. For location impairments (such as Availability Zone or AWS Region), ensure that you have systems in place to fail over to healthy resources in unimpaired locations.',
// 			},
// 			{
// 				ChoiceId: 'rel_withstand_component_failures_auto_healing_system',
// 				Title: 'Automate healing on all layers',
// 				Description:
// 					'Upon detection of a failure, use automated capabilities to perform actions to remediate. Degradations may be automatically healed through internal service mechanisms or require resources to be restarted or removed through remediation actions.',
// 			},
// 			{
// 				ChoiceId: 'rel_withstand_component_failures_avoid_control_plane',
// 				Title:
// 					'Rely on the data plane and not the control plane during recovery',
// 				Description:
// 					'Control planes provide the administrative APIs used to create, read and describe, update, delete, and list (CRUDL) resources, while data planes handle day-to-day service traffic. When implementing recovery or mitigation responses to potentially resiliency-impacting events, focus on using a minimal number of control plane operations to recover, rescale, restore, heal, or failover the service. Data plane action should supersede any activity during these degradation events.',
// 			},
// 			{
// 				ChoiceId: 'rel_withstand_component_failures_static_stability',
// 				Title: 'Use static stability to prevent bimodal behavior',
// 				Description:
// 					'Workloads should be statically stable and only operate in a single normal mode. Bimodal behavior is when your workload exhibits different behavior under normal and failure modes.',
// 			},
// 			{
// 				ChoiceId: 'rel_withstand_component_failures_notifications_sent_system',
// 				Title: 'Send notifications when events impact availability',
// 				Description:
// 					'Notifications are sent upon the detection of thresholds breached, even if the event causing by the issue was automatically resolved.',
// 			},
// 			{
// 				ChoiceId: 'rel_withstand_component_failures_service_level_agreements',
// 				Title:
// 					'Architect your product to meet availability targets and uptime service level agreements (SLAs)',
// 				Description:
// 					'Architect your product to meet availability targets and uptime service level agreements (SLAs). If you publish or privately agree to availability targets or uptime SLAs, verify that your architecture and operational processes are designed to support them.',
// 			},
// 			{
// 				ChoiceId: 'rel_withstand_component_failures_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'withstand-component-failures',
// 				PillarId: 'reliability',
// 				QuestionTitle:
// 					'How do you design your workload to withstand component failures?',
// 				QuestionDescription:
// 					'Workloads with a requirement for high availability and low mean time to recovery (MTTR) must be architected for resiliency.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.withstand-component-failures.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'testing-resiliency',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you test reliability?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_testing_resiliency_playbook_resiliency',
// 				Title: 'Use playbooks to investigate failures',
// 				Description:
// 					'Enable consistent and prompt responses to failure scenarios that are not well understood, by documenting the investigation process in playbooks. Playbooks are the predefined steps performed to identify the factors contributing to a failure scenario. The results from any process step are used to determine the next steps to take until the issue is identified or escalated.',
// 			},
// 			{
// 				ChoiceId: 'rel_testing_resiliency_rca_resiliency',
// 				Title: 'Perform post-incident analysis',
// 				Description:
// 					'Review customer-impacting events, and identify the contributing factors and preventative action items. Use this information to develop mitigations to limit or prevent recurrence. Develop procedures for prompt and effective responses. Communicate contributing factors and corrective actions as appropriate, tailored to target audiences. Have a method to communicate these causes to others as needed.',
// 			},
// 			{
// 				ChoiceId: 'rel_testing_resiliency_test_functional',
// 				Title: 'Test functional requirements',
// 				Description:
// 					'Use techniques such as unit tests and integration tests that validate required functionality.',
// 			},
// 			{
// 				ChoiceId: 'rel_testing_resiliency_test_non_functional',
// 				Title: 'Test scaling and performance requirements',
// 				Description:
// 					'Use techniques such as load testing to validate that the workload meets scaling and performance requirements.',
// 			},
// 			{
// 				ChoiceId: 'rel_testing_resiliency_failure_injection_resiliency',
// 				Title: 'Test resiliency using chaos engineering',
// 				Description:
// 					'Run chaos experiments regularly in environments that are in or as close to production as possible to understand how your system responds to adverse conditions.',
// 			},
// 			{
// 				ChoiceId: 'rel_testing_resiliency_game_days_resiliency',
// 				Title: 'Conduct game days regularly',
// 				Description:
// 					'Use game days to regularly exercise your procedures for responding to events and failures as close to production as possible (including in production environments) with the people who will be involved in actual failure scenarios. Game days enforce measures to ensure that production events do not impact users.',
// 			},
// 			{
// 				ChoiceId: 'rel_testing_resiliency_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'testing-resiliency',
// 				PillarId: 'reliability',
// 				QuestionTitle: 'How do you test reliability?',
// 				QuestionDescription:
// 					'After you have designed your workload to be resilient to the stresses of production, testing is the only way to ensure that it will operate as designed, and deliver the resiliency you expect.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.testing-resiliency.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'planning-for-recovery',
// 		PillarId: 'reliability',
// 		QuestionTitle: 'How do you plan for disaster recovery (DR)?',
// 		Choices: [
// 			{
// 				ChoiceId: 'rel_planning_for_recovery_objective_defined_recovery',
// 				Title: 'Define recovery objectives for downtime and data loss',
// 				Description:
// 					'The workload has a recovery time objective (RTO) and recovery point objective (RPO).',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_for_recovery_disaster_recovery',
// 				Title:
// 					'Use defined recovery strategies to meet the recovery objectives',
// 				Description:
// 					"Define a disaster recovery (DR) strategy that meets your workload's recovery objectives. Choose a strategy such as backup and restore, standby (active/passive), or active/active.",
// 			},
// 			{
// 				ChoiceId: 'rel_planning_for_recovery_dr_tested',
// 				Title:
// 					'Test disaster recovery implementation to validate the implementation',
// 				Description:
// 					'Regularly test failover to your recovery site to verify that it operates properly and that RTO and RPO are met.',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_for_recovery_config_drift',
// 				Title: 'Manage configuration drift at the DR site or Region',
// 				Description:
// 					'Ensure that the infrastructure, data, and configuration are as needed at the DR site or Region. For example, check that AMIs and service quotas are up to date.',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_for_recovery_auto_recovery',
// 				Title: 'Automate recovery',
// 				Description:
// 					'Use AWS or third-party tools to automate system recovery and route traffic to the DR site or Region.',
// 			},
// 			{
// 				ChoiceId: 'rel_planning_for_recovery_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'planning-for-recovery',
// 				PillarId: 'reliability',
// 				QuestionTitle: 'How do you plan for disaster recovery (DR)?',
// 				QuestionDescription:
// 					'Having backups and redundant workload components in place is the start of your DR strategy. RTO and RPO are your objectives for restoration of your workload. Set these based on business needs. Implement a strategy to meet these objectives, considering locations and function of workload resources and data. The probability of disruption and cost of recovery are also key factors that help to inform the business value of providing disaster recovery for a workload.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.planning-for-recovery.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'securely-operate',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you securely operate your workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_securely_operate_multi_accounts',
// 				Title: 'Separate workloads using accounts',
// 				Description:
// 					'Establish common guardrails and isolation between environments (such as production, development, and test) and workloads through a multi-account strategy. Account-level separation is strongly recommended, as it provides a strong isolation boundary for security, billing, and access.',
// 			},
// 			{
// 				ChoiceId: 'sec_securely_operate_aws_account',
// 				Title: 'Secure account root user and properties',
// 				Description:
// 					'The root user is the most privileged user in an AWS account, with full administrative access to all resources within the account, and in some cases cannot be constrained by security policies. Disabling programmatic access to the root user, establishing appropriate controls for the root user, and avoiding routine use of the root user helps reduce the risk of inadvertent exposure of the root credentials and subsequent compromise of the cloud environment.',
// 			},
// 			{
// 				ChoiceId: 'sec_securely_operate_control_objectives',
// 				Title: 'Identify and validate control objectives',
// 				Description:
// 					'Based on your compliance requirements and risks identified from your threat model, derive and validate the control objectives and controls that you need to apply to your workload. Ongoing validation of control objectives and controls help you measure the effectiveness of risk mitigation.',
// 			},
// 			{
// 				ChoiceId: 'sec_securely_operate_updated_threats',
// 				Title: 'Keep up-to-date with security threats',
// 				Description:
// 					'To help you define and implement appropriate controls, recognize attack vectors by staying up to date with the latest security threats. Consume AWS Managed Services to make it easier to receive notification of unexpected or unusual behavior in your AWS accounts. Investigate using AWS Partner tools or third-party threat information feeds as part of your security information flow. The Common Vulnerabilities and Exposures (CVE) List list contains publicly disclosed cyber security vulnerabilities that you can use to stay up to date.',
// 			},
// 			{
// 				ChoiceId: 'sec_securely_operate_updated_recommendations',
// 				Title: 'Keep up-to-date with security recommendations',
// 				Description:
// 					'Stay up-to-date with both AWS and industry security recommendations to evolve the security posture of your workload. AWS Security Bulletins contain important information about security and privacy notifications.',
// 			},
// 			{
// 				ChoiceId: 'sec_securely_operate_threat_model',
// 				Title: 'Identify and prioritize risks using a threat model',
// 				Description:
// 					'Perform threat modeling to identify and maintain an up-to-date register of potential threats and associated mitigations for your workload. Prioritize your threats and adapt your security control mitigations to prevent, detect, and respond. Revisit and maintain this in the context of your workload, and the evolving security landscape.',
// 			},
// 			{
// 				ChoiceId: 'sec_securely_operate_test_validate_pipeline',
// 				Title:
// 					'Automate testing and validation of security controls in pipelines',
// 				Description:
// 					'Establish secure baselines and templates for security mechanisms that are tested and validated as part of your build, pipelines, and processes. Use tools and automation to test and validate all security controls continuously. For example, scan items such as machine images and infrastructure-as-code templates for security vulnerabilities, irregularities, and drift from an established baseline at each stage. AWS CloudFormation Guard can help you verify that CloudFormation templates are safe, save you time, and reduce the risk of configuration error.',
// 			},
// 			{
// 				ChoiceId: 'sec_securely_operate_implement_services_features',
// 				Title:
// 					'Evaluate and implement new security services and features regularly',
// 				Description:
// 					"Evaluate and implement security services and features from AWS and AWS Partners that allow you to evolve the security posture of your workload. The AWS Security Blog highlights new AWS services and features, implementation guides, and general security guidance. What's New with AWS? is a great way to stay up to date with all new AWS features, services, and announcements.",
// 			},
// 			{
// 				ChoiceId: 'sec_securely_operate_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'securely-operate',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you securely operate your workload?',
// 				QuestionDescription:
// 					'To operate your workload securely, you must apply overarching best practices to every area of security. Take requirements and processes that you have defined in operational excellence at an organizational and workload level, and apply them to all areas. Staying up to date with AWS and industry recommendations and threat intelligence helps you evolve your threat model and control objectives. Automating security processes, testing, and validation allow you to scale your security operations.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.securely-operate.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'identities',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you manage identities for people and machines?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_identities_enforce_mechanisms',
// 				Title: 'Use strong sign-in mechanisms',
// 				Description:
// 					'Sign-ins (authentication using sign-in credentials) can present risks when not using mechanisms like multi-factor authentication (MFA), especially in situations where sign-in credentials have been inadvertently disclosed or are easily guessed. Use strong sign-in mechanisms to reduce these risks by requiring MFA and strong password policies.',
// 			},
// 			{
// 				ChoiceId: 'sec_identities_unique',
// 				Title: 'Use temporary credentials',
// 				Description:
// 					'When doing any type of authentication, it’s best to use temporary credentials instead of long-term credentials to reduce or eliminate risks, such as credentials being inadvertently disclosed, shared, or stolen.',
// 			},
// 			{
// 				ChoiceId: 'sec_identities_secrets',
// 				Title: 'Store and use secrets securely',
// 				Description:
// 					'A workload requires an automated capability to prove its identity to databases, resources, and third-party services. This is accomplished using secret access credentials, such as API access keys, passwords, and OAuth tokens. Using a purpose-built service to store, manage, and rotate these credentials helps reduce the likelihood that those credentials become compromised.',
// 			},
// 			{
// 				ChoiceId: 'sec_identities_identity_provider',
// 				Title: 'Rely on a centralized identity provider',
// 				Description:
// 					'For workforce identities (employees and contractors), rely on an identity provider that allows you to manage identities in a centralized place. This makes it easier to manage access across multiple applications and systems, because you are creating, assigning, managing, revoking, and auditing access from a single location.',
// 			},
// 			{
// 				ChoiceId: 'sec_identities_audit',
// 				Title: 'Audit and rotate credentials periodically',
// 				Description:
// 					'Audit and rotate credentials periodically to limit how long the credentials can be used to access your resources. Long-term credentials create many risks, and these risks can be reduced by rotating long-term credentials regularly.',
// 			},
// 			{
// 				ChoiceId: 'sec_identities_groups_attributes',
// 				Title: 'Leverage user groups and attributes',
// 				Description:
// 					'As the number of users you manage grows, you will need to determine ways to organize them so that you can manage them at scale. Place users with common security requirements in groups defined by your identity provider, and put mechanisms in place to ensure that user attributes that may be used for access control (for example, department or location) are correct and updated. Use these groups and attributes to control access, rather than individual users. This allows you to manage access centrally by changing a user’s group membership or attributes once with a permission set, rather than updating many individual policies when a user’s access needs change.',
// 			},
// 			{
// 				ChoiceId: 'sec_identities_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'identities',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you manage identities for people and machines?',
// 				QuestionDescription:
// 					'There are two types of identities you need to manage when approaching operating secure AWS workloads. Understanding the type of identity you need to manage and grant access helps you ensure the right identities have access to the right resources under the right conditions. Human Identities: Your administrators, developers, operators, and end users require an identity to access your AWS environments and applications. These are members of your organization, or external users with whom you collaborate, and who interact with your AWS resources via a web browser, client application, or interactive command-line tools. Machine Identities: Your service applications, operational tools, and workloads require an identity to make requests to AWS services - for example, to read data. These identities include machines running in your AWS environment such as Amazon EC2 instances or AWS Lambda functions. You may also manage machine identities for external                               parties who need access. Additionally, you may also have machines outside of AWS that need access to your AWS environment.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.identities.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'permissions',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you manage permissions for people and machines?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_permissions_define',
// 				Title: 'Define access requirements',
// 				Description:
// 					'Each component or resource of your workload needs to be accessed by administrators, end users, or other components. Have a clear definition of who or what should have access to each component, choose the appropriate identity type and method of authentication and authorization.',
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_least_privileges',
// 				Title: 'Grant least privilege access',
// 				Description:
// 					"It's a best practice to grant only the access that identities require to perform specific actions on specific resources under specific conditions. Use group and identity attributes to dynamically set permissions at scale, rather than defining permissions for individual users. For example, you can allow a group of developers access to manage only resources for their project. This way, if a developer leaves the project, the developer’s access is automatically revoked without changing the underlying access policies.",
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_define_guardrails',
// 				Title: 'Define permission guardrails for your organization',
// 				Description:
// 					'Establish common controls that restrict access to all identities in your organization. For example, you can restrict access to specific AWS Regions, or prevent your operators from deleting common resources, such as an IAM role used for your central security team.',
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_emergency_process',
// 				Title: 'Establish emergency access process',
// 				Description:
// 					'Create a process that allows for emergency access to your workloads in the unlikely event of an issue with your centralized identity provider.',
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_share_securely',
// 				Title: 'Share resources securely within your organization',
// 				Description:
// 					'As the number of workloads grows, you might need to share access to resources in those workloads or provision the resources multiple times across multiple accounts. You might have constructs to compartmentalize your environment, such as having development, testing, and production environments. However, having separation constructs does not limit you from being able to share securely. By sharing components that overlap, you can reduce operational overhead and allow for a consistent experience without guessing what you might have missed while creating the same resource multiple times.',
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_continuous_reduction',
// 				Title: 'Reduce permissions continuously',
// 				Description:
// 					'As your teams determine what access is required, remove unneeded permissions and establish review processes to achieve least privilege permissions. Continually monitor and remove unused identities and permissions for both human and machine access.',
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_share_securely_third_party',
// 				Title: 'Share resources securely with a third party',
// 				Description:
// 					'The security of your cloud environment doesn’t stop at your organization. Your organization might rely on a third party to manage a portion of your data. The permission management for the third-party managed system should follow the practice of just-in-time access using the principle of least privilege with temporary credentials. By working closely with a third party, you can reduce the scope of impact and risk of unintended access together.',
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_lifecycle',
// 				Title: 'Manage access based on life cycle',
// 				Description:
// 					'Integrate access controls with operator and application lifecycle and your centralized federation provider. For example, remove a user’s access when they leave the organization or change roles.',
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_analyze_cross_account',
// 				Title: 'Analyze public and cross account access',
// 				Description:
// 					'Continually monitor findings that highlight public and cross-account access. Reduce public access and cross-account access to only the specific resources that require this access.',
// 			},
// 			{
// 				ChoiceId: 'sec_permissions_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'permissions',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you manage permissions for people and machines?',
// 				QuestionDescription:
// 					'Manage permissions to control access to people and machine identities that require access to AWS and your workload. Permissions control who can access what, and under what conditions.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.permissions.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'detect-investigate-events',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you detect and investigate security events?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_detect_investigate_events_app_service_logging',
// 				Title: 'Configure service and application logging',
// 				Description:
// 					'Retain security event logs from services and applications. This is a fundamental principle of security for audit, investigations, and operational use cases, and a common security requirement driven by governance, risk, and compliance (GRC) standards, policies, and procedures.',
// 			},
// 			{
// 				ChoiceId: 'sec_detect_investigate_events_analyze_all',
// 				Title: 'Analyze logs, findings, and metrics centrally',
// 				Description:
// 					'Security operations teams rely on the collection of logs and the use of search tools to discover potential events of interest, which might indicate unauthorized activity or unintentional change. However, simply analyzing collected data and manually processing information is insufficient to keep up with the volume of information flowing from complex architectures. Analysis and reporting alone don’t facilitate the assignment of the right resources to work an event in a timely fashion.',
// 			},
// 			{
// 				ChoiceId: 'sec_detect_investigate_events_auto_response',
// 				Title: 'Automate response to events',
// 				Description:
// 					'Using automation to investigate and remediate events reduces human effort and error, and enables you to scale investigation capabilities. Regular reviews will help you tune automation tools, and continuously iterate.',
// 			},
// 			{
// 				ChoiceId: 'sec_detect_investigate_events_actionable_events',
// 				Title: 'Implement actionable security events',
// 				Description:
// 					'Create alerts that are sent to and can be actioned by your team. Ensure that alerts include relevant information for the team to take action. For each detective mechanism you have, you should also have a process, in the form of a runbook or playbook, to investigate. For example, when you enable Amazon GuardDuty, it generates different findings. You should have a runbook entry for each finding type, for example, if a trojan is discovered, your runbook has simple instructions that instruct someone to investigate and remediate.',
// 			},
// 			{
// 				ChoiceId: 'sec_detect_investigate_events_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'detect-investigate-events',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you detect and investigate security events?',
// 				QuestionDescription:
// 					'Capture and analyze events from logs and metrics to gain visibility. Take action on security events and potential threats to help secure your workload.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.detect-investigate-events.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'network-protection',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you protect your network resources?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_network_protection_create_layers',
// 				Title: 'Create network layers',
// 				Description:
// 					'Group components that share sensitivity requirements into layers to minimize the potential scope of impact of unauthorized access. For example, a database cluster in a virtual private cloud (VPC) with no need for internet access should be placed in subnets with no route to or from the internet. Traffic should only flow from the adjacent next least sensitive resource. Consider a web application sitting behind a load balancer. Your database should not be accessible directly from the load balancer. Only the business logic or web server should have direct access to your database.',
// 			},
// 			{
// 				ChoiceId: 'sec_network_protection_layered',
// 				Title: 'Control traffic at all layers',
// 				Description:
// 					'When architecting your network topology, you should examine the connectivity requirements of each component. For example, if a component requires internet accessibility (inbound and outbound), connectivity to VPCs, edge services, and external data centers.',
// 			},
// 			{
// 				ChoiceId: 'sec_network_protection_auto_protect',
// 				Title: 'Automate network protection',
// 				Description:
// 					'Automate protection mechanisms to provide a self-defending network based on threat intelligence and anomaly detection. For example, intrusion detection and prevention tools that can adapt to current threats and reduce their impact. A web application firewall is an example of where you can automate network protection, for example, by using the AWS WAF Security Automations solution to automatically block requests originating from IP addresses associated with known threat actors.',
// 			},
// 			{
// 				ChoiceId: 'sec_network_protection_inspection',
// 				Title: 'Implement inspection and protection',
// 				Description:
// 					'Inspect and filter your traffic at each layer. You can inspect your VPC configurations for potential unintended access using VPC Network Access Analyzer. You can specify your network access requirements and identify potential network paths that do not meet them. For components transacting over HTTP-based protocols, a web application firewall can help protect from common attacks. AWS WAF is a web application firewall that lets you monitor and block HTTP(s) requests that match your configurable rules that are forwarded to an Amazon API Gateway API, Amazon CloudFront, or an Application Load Balancer. To get started with AWS WAF, you can use AWS Managed Rules in combination with your own, or use existing partner integrations.',
// 			},
// 			{
// 				ChoiceId: 'sec_network_protection_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'network-protection',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you protect your network resources?',
// 				QuestionDescription:
// 					'Any workload that has some form of network connectivity, whether it’s the internet or a private network, requires multiple layers of defense to help protect from external and internal network-based threats.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.network-protection.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'protect-compute',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you protect your compute resources?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_protect_compute_vulnerability_management',
// 				Title: 'Perform vulnerability management',
// 				Description:
// 					'Frequently scan and patch for vulnerabilities in your code, dependencies, and in your infrastructure to help protect against new threats.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_compute_reduce_surface',
// 				Title: 'Reduce attack surface',
// 				Description:
// 					'Reduce your exposure to unintended access by hardening operating systems and minimizing the components, libraries, and externally consumable services in use. Start by reducing unused components, whether they are operating system packages or applications, for Amazon Elastic Compute Cloud (Amazon EC2)-based workloads, or external software modules in your code, for all workloads. You can find many hardening and security configuration guides for common operating systems and server software. For example, you can start with the Center for Internet Security and iterate.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_compute_implement_managed_services',
// 				Title: 'Implement managed services',
// 				Description:
// 					'Implement services that manage resources, such as Amazon Relational Database Service (Amazon RDS), AWS Lambda, and Amazon Elastic Container Service (Amazon ECS), to reduce your security maintenance tasks as part of the shared responsibility model. For example, Amazon RDS helps you set up, operate, and scale a relational database, automates administration tasks such as hardware provisioning, database setup, patching, and backups. This means you have more free time to focus on securing your application in other ways described in the AWS Well-Architected Framework. Lambda lets you run code without provisioning or managing servers, so you only need to focus on the connectivity, invocation, and security at the code level–not the infrastructure or operating system.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_compute_auto_protection',
// 				Title: 'Automate compute protection',
// 				Description:
// 					'Automate your protective compute mechanisms including vulnerability management, reduction in attack surface, and management of resources. The automation will help you invest time in securing other aspects of your workload, and reduce the risk of human error.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_compute_actions_distance',
// 				Title: 'Enable people to perform actions at a distance',
// 				Description:
// 					'Removing the ability for interactive access reduces the risk of human error, and the potential for manual configuration or management. For example, use a change management workflow to deploy Amazon Elastic Compute Cloud (Amazon EC2) instances using infrastructure-as-code, then manage Amazon EC2 instances using tools such as AWS Systems Manager instead of allowing direct access or through a bastion host. AWS Systems Manager can automate a variety of maintenance and deployment tasks, using features including automation workflows, documents (playbooks), and the run command. AWS CloudFormation stacks build from pipelines and can automate your infrastructure deployment and management tasks without using the AWS Management Console or APIs directly.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_compute_validate_software_integrity',
// 				Title: 'Validate software integrity',
// 				Description:
// 					'Implement mechanisms (for example, code signing) to validate that the software, code and libraries used in the workload are from trusted sources and have not been tampered with. For example, you should verify the code signing certificate of binaries and scripts to confirm the author, and ensure it has not been tampered with since created by the author. AWS Signer can help ensure the trust and integrity of your code by centrally managing the code- signing lifecycle, including signing certification and public and private keys. You can learn how to use advanced patterns and best practices for code signing with AWS Lambda. Additionally, a checksum of software that you download, compared to that of the checksum from the provider, can help ensure it has not been tampered with.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_compute_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'protect-compute',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you protect your compute resources?',
// 				QuestionDescription:
// 					'Compute resources in your workload require multiple layers of defense to help protect from external and internal threats. Compute resources include EC2 instances, containers, AWS Lambda functions, database services, IoT devices, and more.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.protect-compute.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'data-classification',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you classify your data?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_data_classification_identify_data',
// 				Title: 'Identify the data within your workload',
// 				Description:
// 					'It’s critical to understand the type and classification of data your workload is processing, the associated business processes, where the data is stored, and who is the data owner. You should also have an understanding of the applicable legal and compliance requirements of your workload, and what data controls need to be enforced. Identifying data is the first step in the data classification journey.',
// 			},
// 			{
// 				ChoiceId: 'sec_data_classification_define_protection',
// 				Title: 'Define data protection controls',
// 				Description:
// 					'Protect data according to its classification level. For example, secure data classified as public by using relevant recommendations while protecting sensitive data with additional controls.',
// 			},
// 			{
// 				ChoiceId: 'sec_data_classification_auto_classification',
// 				Title: 'Automate identification and classification',
// 				Description:
// 					'Automating the identification and classification of data can help you implement the correct controls. Using automation for this instead of direct access from a person reduces the risk of human error and exposure. You should evaluate using a tool, such as Amazon Macie, that uses machine learning to automatically discover, classify, and protect sensitive data in AWS. Amazon Macie recognizes sensitive data, such as personally identifiable information (PII) or intellectual property, and provides you with dashboards and alerts that give visibility into how this data is being accessed or moved.',
// 			},
// 			{
// 				ChoiceId: 'sec_data_classification_lifecycle_management',
// 				Title: 'Define data lifecycle management',
// 				Description:
// 					'Your defined lifecycle strategy should be based on sensitivity level as well as legal and organization requirements. Aspects including the duration for which you retain data, data destruction processes, data access management, data transformation, and data sharing should be considered. When choosing a data classification methodology, balance usability versus access. You should also accommodate the multiple levels of access and nuances for implementing a secure, but still usable, approach for each level. Always use a defense in depth approach and reduce human access to data and mechanisms for transforming, deleting, or copying data. For example, require users to strongly authenticate to an application, and give the application, rather than the users, the requisite access permission to perform action at a distance. In addition, ensure that users come from a trusted network path and require access to the decryption keys. Use tools, such as dashboards and automated reporting, to give users information from the data rather than giving them direct access to the data.',
// 			},
// 			{
// 				ChoiceId: 'sec_data_classification_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'data-classification',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you classify your data?',
// 				QuestionDescription:
// 					'Classification provides a way to categorize data, based on criticality and sensitivity in order to help you determine appropriate protection and retention controls.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.data-classification.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'protect-data-rest',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you protect your data at rest?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_protect_data_rest_key_mgmt',
// 				Title: 'Implement secure key management',
// 				Description:
// 					'Secure key management includes the storage, rotation, access control, and monitoring of key material required to secure data at rest for your workload.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_rest_encrypt',
// 				Title: 'Enforce encryption at rest',
// 				Description:
// 					'You should enforce the use of encryption for data at rest. Encryption maintains the confidentiality of sensitive data in the event of unauthorized access or accidental disclosure.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_rest_automate_protection',
// 				Title: 'Automate data at rest protection',
// 				Description:
// 					'Use automated tools to validate and enforce data at rest controls continuously, for example, verify that there are only encrypted storage resources. You can automate validation that all EBS volumes are encrypted using AWS Config Rules. AWS Security Hub can also verify several different controls through automated checks against security standards. Additionally, your AWS Config Rules can automatically remediate noncompliant resources.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_rest_access_control',
// 				Title: 'Enforce access control',
// 				Description:
// 					'To help protect your data at rest, enforce access control using mechanisms, such as isolation and versioning, and apply the principle of least privilege. Prevent the granting of public access to your data.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_rest_use_people_away',
// 				Title: 'Use mechanisms to keep people away from data',
// 				Description:
// 					'Keep all users away from directly accessing sensitive data and systems under normal operational circumstances. For example, use a change management workflow to manage Amazon Elastic Compute Cloud (Amazon EC2) instances using tools instead of allowing direct access or a bastion host. This can be achieved using AWS Systems Manager Automation, which uses automation documents that contain steps you use to perform tasks. These documents can be stored in source control, be peer reviewed before running, and tested thoroughly to minimize risk compared to shell access. Business users could have a dashboard instead of direct access to a data store to run queries. Where CI/CD pipelines are not used, determine which controls and processes are required to adequately provide a normally disabled break-glass access mechanism.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_rest_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'protect-data-rest',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you protect your data at rest?',
// 				QuestionDescription:
// 					'Protect your data at rest by implementing multiple controls, to reduce the risk of unauthorized access or mishandling.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.protect-data-rest.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'protect-data-transit',
// 		PillarId: 'security',
// 		QuestionTitle: 'How do you protect your data in transit?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_protect_data_transit_key_cert_mgmt',
// 				Title: 'Implement secure key and certificate management',
// 				Description:
// 					'Transport Layer Security (TLS) certificates are used to secure network communications and establish the identity of websites, resources, and workloads over the internet, as well as private networks.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_transit_encrypt',
// 				Title: 'Enforce encryption in transit',
// 				Description:
// 					'Enforce your defined encryption requirements based on your organization’s policies, regulatory obligations and standards to help meet organizational, legal, and compliance requirements. Only use protocols with encryption when transmitting sensitive data outside of your virtual private cloud (VPC). Encryption helps maintain data confidentiality even when the data transits untrusted networks.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_transit_auto_unintended_access',
// 				Title: 'Automate detection of unintended data access',
// 				Description:
// 					'Use tools such as Amazon GuardDuty to automatically detect suspicious activity or attempts to move data outside of defined boundaries. For example, GuardDuty can detect Amazon Simple Storage Service (Amazon S3) read activity that is unusual with the Exfiltration:S3/AnomalousBehavior finding. In addition to GuardDuty, Amazon VPC Flow Logs, which capture network traffic information, can be used with Amazon EventBridge to trigger detection of abnormal connections–both successful and denied. Amazon S3 Access Analyzer can help assess what data is accessible to who in your Amazon S3 buckets.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_transit_authentication',
// 				Title: 'Authenticate network communications',
// 				Description:
// 					'Verify the identity of communications by using protocols that support authentication, such as Transport Layer Security (TLS) or IPsec.',
// 			},
// 			{
// 				ChoiceId: 'sec_protect_data_transit_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'protect-data-transit',
// 				PillarId: 'security',
// 				QuestionTitle: 'How do you protect your data in transit?',
// 				QuestionDescription:
// 					'Protect your data in transit by implementing multiple controls to reduce the risk of unauthorized access or loss.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.protect-data-transit.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'incident-response',
// 		PillarId: 'security',
// 		QuestionTitle:
// 			'How do you anticipate, respond to, and recover from incidents?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_incident_response_identify_personnel',
// 				Title: 'Identify key personnel and external resources',
// 				Description:
// 					'Identify internal and external personnel, resources, and legal obligations that would help your organization respond to an incident.',
// 			},
// 			{
// 				ChoiceId: 'sec_incident_response_develop_management_plans',
// 				Title: 'Develop incident management plans',
// 				Description:
// 					'The first document to develop for incident response is the incident response plan. The incident response plan is designed to be the foundation for your incident response program and strategy.',
// 			},
// 			{
// 				ChoiceId: 'sec_incident_response_prepare_forensic',
// 				Title: 'Prepare forensic capabilities',
// 				Description:
// 					'Ahead of a security incident, consider developing forensics capabilities to support security event investigations.',
// 			},
// 			{
// 				ChoiceId: 'sec_incident_response_playbooks',
// 				Title: 'Develop and test security incident response playbooks',
// 				Description:
// 					'A key part of preparing your incident response processes is developing playbooks. Incident response playbooks provide a series of prescriptive guidance and steps to follow when a security event occurs. Having clear structure and steps simplifies the response and reduces the likelihood for human error.',
// 			},
// 			{
// 				ChoiceId: 'sec_incident_response_pre_provision_access',
// 				Title: 'Pre-provision access',
// 				Description:
// 					'Verify that incident responders have the correct access pre-provisioned in AWS to reduce the time needed for investigation through to recovery.',
// 			},
// 			{
// 				ChoiceId: 'sec_incident_response_run_game_days',
// 				Title: 'Run simulations',
// 				Description:
// 					'As organizations grow and evolve over time, so does the threat landscape, making it important to continually review your incident response capabilities. Running simulations (also known as game days) is one method that can be used to perform this assessment. Simulations use real-world security event scenarios designed to mimic a threat actor’s tactics, techniques, and procedures (TTPs) and allow an organization to exercise and evaluate their incident response capabilities by responding to these mock cyber events as they might occur in reality.',
// 			},
// 			{
// 				ChoiceId: 'sec_incident_response_establish_incident_framework',
// 				Title: 'Establish a framework for learning from incidents',
// 				Description:
// 					'Implementing a lessons learned framework and root cause analysis capability will not only help improve incident response capabilities, but also help prevent the incident from recurring. By learning from each incident, you can help avoid repeating the same mistakes, exposures, or misconfigurations, not only improving your security posture, but also minimizing time lost to preventable situations.',
// 			},
// 			{
// 				ChoiceId: 'sec_incident_response_pre_deploy_tools',
// 				Title: 'Pre-deploy tools',
// 				Description:
// 					'Verify that security personnel have the right tools pre-deployed to reduce the time for investigation through to recovery.',
// 			},
// 			{
// 				ChoiceId: 'sec_incident_response_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'incident-response',
// 				PillarId: 'security',
// 				QuestionTitle:
// 					'How do you anticipate, respond to, and recover from incidents?',
// 				QuestionDescription:
// 					'Even with mature preventive and detective controls, your organization should implement mechanisms to respond to and mitigate the potential impact of security incidents. Your preparation strongly affects the ability of your teams to operate effectively during an incident, to isolate, contain and perform forensics on issues, and to restore operations to a known good state. Putting in place the tools and access ahead of a security incident, then routinely practicing incident response through game days, helps ensure that you can recover while minimizing business disruption.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.incident-response.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'application-security',
// 		PillarId: 'security',
// 		QuestionTitle:
// 			'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sec_appsec_perform_regular_penetration_testing',
// 				Title: 'Perform regular penetration testing',
// 				Description:
// 					'Perform regular penetration testing of your software. This mechanism helps identify potential software issues that cannot be detected by automated testing or a manual code review. It can also help you understand the efficacy of your detective controls. Penetration testing should try to determine if the software can be made to perform in unexpected ways, such as exposing data that should be protected, or granting broader permissions than expected.',
// 			},
// 			{
// 				ChoiceId: 'sec_appsec_deploy_software_programmatically',
// 				Title: 'Deploy software programmatically',
// 				Description:
// 					'Perform software deployments programmatically where possible. This approach reduces the likelihood that a deployment fails or an unexpected issue is introduced due to human error.',
// 			},
// 			{
// 				ChoiceId:
// 					'sec_appsec_regularly_assess_security_properties_of_pipelines',
// 				Title: 'Regularly assess security properties of the pipelines',
// 				Description:
// 					'Apply the principles of the Well-Architected Security Pillar to your pipelines, with particular attention to the separation of permissions. Regularly assess the security properties of your pipeline infrastructure. Effectively managing the security of the pipelines allows you to deliver the security of the software that passes through the pipelines.',
// 			},
// 			{
// 				ChoiceId: 'sec_appsec_train_for_application_security',
// 				Title: 'Train for application security',
// 				Description:
// 					'Provide training to the builders in your organization on common practices for the secure development and operation of applications. Adopting security focused development practices helps reduce the likelihood of issues that are only detected at the security review stage.',
// 			},
// 			{
// 				ChoiceId: 'sec_appsec_automate_testing_throughout_lifecycle',
// 				Title:
// 					'Automate testing throughout the development and release lifecycle',
// 				Description:
// 					'Automate the testing for security properties throughout the development and release lifecycle. Automation makes it easier to consistently and repeatably identify potential issues in software prior to release, which reduces the risk of security issues in the software being provided.',
// 			},
// 			{
// 				ChoiceId: 'sec_appsec_manual_code_reviews',
// 				Title: 'Manual code reviews',
// 				Description:
// 					'Perform a manual code review of the software that you produce. This process helps verify that the person who wrote the code is not the only one checking the code quality.',
// 			},
// 			{
// 				ChoiceId:
// 					'sec_appsec_centralize_services_for_packages_and_dependencies',
// 				Title: 'Centralize services for packages and dependencies',
// 				Description:
// 					'Provide centralized services for builder teams to obtain software packages and other dependencies. This allows the validation of packages before they are included in the software that you write, and provides a source of data for the analysis of the software being used in your organization.',
// 			},
// 			{
// 				ChoiceId:
// 					'sec_appsec_build_program_that_embeds_security_ownership_in_teams',
// 				Title:
// 					'Build a program that embeds security ownership in workload teams',
// 				Description:
// 					'Build a program or mechanism that empowers builder teams to make security decisions about the software that they create. Your security team still needs to validate these decisions during a review, but embedding security ownership in builder teams allows for faster, more secure workloads to be built. This mechanism also promotes a culture of ownership that positively impacts the operation of the systems you build.',
// 			},
// 			{
// 				ChoiceId: 'sec_appsec_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'application-security',
// 				PillarId: 'security',
// 				QuestionTitle:
// 					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
// 				QuestionDescription:
// 					'Training people, testing using automation, understanding dependencies, and validating the security properties of tools and applications help to reduce the likelihood of security issues in production workloads.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.application-security.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'sus_region',
// 		PillarId: 'sustainability',
// 		QuestionTitle: 'How do you select Regions for your workload?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sus_sus_region_a2',
// 				Title:
// 					'Choose Region based on both business requirements and sustainability goals',
// 				Description:
// 					'Choose a Region for your workload based on both your business requirements and sustainability goals to optimize its KPIs, including performance, cost, and carbon footprint.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_region_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'sus_region',
// 				PillarId: 'sustainability',
// 				QuestionTitle: 'How do you select Regions for your workload?',
// 				QuestionDescription:
// 					'The choice of Region for your workload significantly affects its KPIs, including performance, cost, and carbon footprint. To effectively improve these KPIs, you should choose Regions for your workloads based on both business requirements and sustainability goals.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.sus_region.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'sus_user',
// 		PillarId: 'sustainability',
// 		QuestionTitle: 'How do you align cloud resources to your demand?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sus_sus_user_a2',
// 				Title: 'Scale workload infrastructure dynamically',
// 				Description:
// 					'Use elasticity of the cloud and scale your infrastructure dynamically to match supply of cloud resources to demand and avoid overprovisioned capacity in your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_user_a3',
// 				Title: 'Align SLAs with sustainability goals',
// 				Description:
// 					'Review and optimize workload service-level agreements (SLA) based on your sustainability goals to minimize the resources required to support your workload while continuing to meet business needs.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_user_a5',
// 				Title:
// 					'Optimize geographic placement of workloads based on their networking requirements',
// 				Description:
// 					'Select cloud location and services for your workload that reduce the distance network traffic must travel and decrease the total network resources required to support your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_user_a4',
// 				Title: 'Stop the creation and maintenance of unused assets',
// 				Description:
// 					'Decommission unused assets in your workload to reduce the number of cloud resources required to support your demand and minimize waste.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_user_a6',
// 				Title: 'Optimize team member resources for activities performed',
// 				Description:
// 					'Optimize resources provided to team members to minimize the environmental sustainability impact while supporting their needs.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_user_a7',
// 				Title: 'Implement buffering or throttling to flatten the demand curve',
// 				Description:
// 					'Buffering and throttling flatten the demand curve and reduce the provisioned capacity required for your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_user_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'sus_user',
// 				PillarId: 'sustainability',
// 				QuestionTitle: 'How do you align cloud resources to your demand?',
// 				QuestionDescription:
// 					'The way users and applications consume your workloads and other resources can help you identify improvements to meet sustainability goals. Scale infrastructure to continually match demand and verify that you use only the minimum resources required to support your users. Align service levels to customer needs. Position resources to limit the network required for users and applications to consume them. Remove unused assets. Provide your team members with devices that support their needs and minimize their sustainability impact.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.sus_user.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'sus_software',
// 		PillarId: 'sustainability',
// 		QuestionTitle:
// 			'How do you take advantage of software and architecture patterns to support your sustainability goals?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sus_sus_software_a2',
// 				Title:
// 					'Optimize software and architecture for asynchronous and scheduled jobs',
// 				Description:
// 					'Use efficient software and architecture patterns such as queue-driven to maintain consistent high utilization of deployed resources.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_software_a3',
// 				Title: 'Remove or refactor workload components with low or no use',
// 				Description:
// 					'Remove components that are unused and no longer required, and refactor components with little utilization to minimize waste in your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_software_a4',
// 				Title: 'Optimize areas of code that consume the most time or resources',
// 				Description:
// 					'Optimize your code that runs within different components of your architecture to minimize resource usage while maximizing performance.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_software_a5',
// 				Title: 'Optimize impact on devices and equipment',
// 				Description:
// 					'Understand the devices and equipment used in your architecture and use strategies to reduce their usage. This can minimize the overall environmental impact of your cloud workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_software_a6',
// 				Title:
// 					'Use software patterns and architectures that best support data access and storage patterns',
// 				Description:
// 					'Understand how data is used within your workload, consumed by your users, transferred, and stored. Use software patterns and architectures that best support data access and storage to minimize the compute, networking, and storage resources required to support the workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_software_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'sus_software',
// 				PillarId: 'sustainability',
// 				QuestionTitle:
// 					'How do you take advantage of software and architecture patterns to support your sustainability goals?',
// 				QuestionDescription:
// 					'Implement patterns for performing load smoothing and maintaining consistent high utilization of deployed resources to minimize the resources consumed. Components might become idle from lack of use because of changes in user behavior over time. Revise patterns and architecture to consolidate under-utilized components to increase overall utilization. Retire components that are no longer required. Understand the performance of your workload components, and optimize the components that consume the most resources. Be aware of the devices your customers use to access your services, and implement patterns to minimize the need for device upgrades.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.sus_software.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'sus_data',
// 		PillarId: 'sustainability',
// 		QuestionTitle:
// 			'How do you take advantage of data management policies and patterns to support your sustainability goals?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sus_sus_data_a2',
// 				Title: 'Implement a data classification policy',
// 				Description:
// 					'Classify data to understand its criticality to business outcomes and choose the right energy-efficient storage tier to store the data.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_data_a3',
// 				Title: 'Use technologies that support data access and storage patterns',
// 				Description:
// 					'Use storage technologies that best support how your data is accessed and stored to minimize the resources provisioned while supporting your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_data_a4',
// 				Title: 'Use policies to manage the lifecycle of your datasets',
// 				Description:
// 					'Manage the lifecycle of all of your data and automatically enforce deletion to minimize the total storage required for your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_data_a6',
// 				Title: 'Remove unneeded or redundant data',
// 				Description:
// 					'Remove unneeded or redundant data to minimize the storage resources required to store your datasets.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_data_a7',
// 				Title: 'Use shared file systems or storage to access common data',
// 				Description:
// 					'Adopt shared file systems or storage to avoid data duplication and enable more efficient infrastructure for your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_data_a9',
// 				Title: 'Back up data only when difficult to recreate',
// 				Description:
// 					'Avoid backing up data that has no business value to minimize storage resources requirements for your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_data_a5',
// 				Title:
// 					'Use elasticity and automation to expand block storage or file system',
// 				Description:
// 					'Use elasticity and automation to expand block storage or file system as data grows to minimize the total provisioned storage.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_data_a8',
// 				Title: 'Minimize data movement across networks',
// 				Description:
// 					'Use shared file systems or object storage to access common data and minimize the total networking resources required to support data movement for your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_data_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'sus_data',
// 				PillarId: 'sustainability',
// 				QuestionTitle:
// 					'How do you take advantage of data management policies and patterns to support your sustainability goals?',
// 				QuestionDescription:
// 					'Implement data management practices to reduce the provisioned storage required to support your workload, and the resources required to use it. Understand your data, and use storage technologies and configurations that best support the business value of the data and how it’s used. Lifecycle data to more efficient, less performant storage when requirements decrease, and delete data that’s no longer required.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.sus_data.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'sus_hardware',
// 		PillarId: 'sustainability',
// 		QuestionTitle:
// 			'How do you select and use cloud hardware and services in your architecture to support your sustainability goals?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sus_sus_hardware_a2',
// 				Title: 'Use the minimum amount of hardware to meet your needs',
// 				Description:
// 					'Use the minimum amount of hardware for your workload to efficiently meet your business needs.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_hardware_a3',
// 				Title: 'Use instance types with the least impact',
// 				Description:
// 					'Continually monitor and use new instance types to take advantage of energy efficiency improvements.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_hardware_a4',
// 				Title: 'Use managed services',
// 				Description:
// 					'Use managed services to operate more efficiently in the cloud.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_hardware_a5',
// 				Title: 'Optimize your use of hardware-based compute accelerators',
// 				Description:
// 					'Optimize your use of accelerated computing instances to reduce the physical infrastructure demands of your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_hardware_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'sus_hardware',
// 				PillarId: 'sustainability',
// 				QuestionTitle:
// 					'How do you select and use cloud hardware and services in your architecture to support your sustainability goals?',
// 				QuestionDescription:
// 					'Look for opportunities to reduce workload sustainability impacts by making changes to your hardware management practices. Minimize the amount of hardware needed to provision and deploy, and select the most efficient hardware and services for your individual workload.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.sus_hardware.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// 	{
// 		QuestionId: 'sus_dev',
// 		PillarId: 'sustainability',
// 		QuestionTitle:
// 			'How do your organizational processes support your sustainability goals?',
// 		Choices: [
// 			{
// 				ChoiceId: 'sus_sus_dev_a2',
// 				Title:
// 					'Adopt methods that can rapidly introduce sustainability improvements',
// 				Description:
// 					'Adopt methods and processes to validate potential improvements, minimize testing costs, and deliver small improvements.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_dev_a3',
// 				Title: 'Keep your workload up-to-date',
// 				Description:
// 					'Keep your workload up-to-date to adopt efficient features, remove issues, and improve the overall efficiency of your workload.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_dev_a4',
// 				Title: 'Increase utilization of build environments',
// 				Description:
// 					'Increase the utilization of resources to develop, test, and build your workloads.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_dev_a5',
// 				Title: 'Use managed device farms for testing',
// 				Description:
// 					'Use managed device farms to efficiently test a new feature on a representative set of hardware.',
// 			},
// 			{
// 				ChoiceId: 'sus_sus_dev_no',
// 				Title: 'None of these',
// 				Description: '',
// 			},
// 		],
// 		SelectedChoices: [],
// 		IsApplicable: true,
// 		Risk: 'UNANSWERED',
// 		LensAlias: 'wellarchitected',
// 		AdditionalDetails: {
// 			code: 200,
// 			data: {
// 				QuestionId: 'sus_dev',
// 				PillarId: 'sustainability',
// 				QuestionTitle:
// 					'How do your organizational processes support your sustainability goals?',
// 				QuestionDescription:
// 					'Look for opportunities to reduce your sustainability impact by making changes to your development, test, and deployment practices.',
// 				HelpfulResourceUrl:
// 					'https://wa.aws.amazon.com/TypeII/en/wellarchitected/wellarchitected.sus_dev.helpful-resources.en.html',
// 				ChoiceAnswers: [],
// 				IsApplicable: true,
// 				Risk: 'UNANSWERED',
// 			},
// 		},
// 		RelatedAssessmentResults: [],
// 		Notes: '',
// 	},
// ];

export default questions;
