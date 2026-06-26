const questions = [
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gencost1_1',
				Title: 'Right-size model selection to optimize inference costs',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Foundation model costs vary greatly across the various foundation model providers, model families and sizes, and model hosting paradigms. It can be advantageous to use cost as a factor when selecting models. Understand the models available to you, as well as the requirements of your workload, to make an informed, cost-aware decision.',
				},
				ImprovementPlan: {
					DisplayText: 'Right-size model selection to optimize inference costs',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gencost01-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gencost1_no',
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
		QuestionId: 'gencost1',
		QuestionTitle: 'How do you select the appropriate model to optimize costs?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Foundation model costs vary greatly across the various foundation model providers, model families and sizes, and model hosting paradigms. It may be advantageous to evaluate cost as a factor when selecting models. This question describes best practices to achieving cost-aware model selection.',
			QuestionId: 'gencost1',
			QuestionTitle:
				'How do you select the appropriate model to optimize costs?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gencost2_1',
				Title:
					'Balance cost and performance when selecting inference paradigms',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Hosting a foundation model for inference requires many choices, and many of these decisions can affect the cost of your workload. One of these choices includes the selection of a managed, serverless deployment of a foundation model against a self-hosted option.',
				},
				ImprovementPlan: {
					DisplayText:
						'Balance cost and performance when selecting inference paradigms',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gencost02-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gencost2_2',
				Title: 'Optimize resource consumption to minimize hosting costs',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Hosting a foundation model for inference requires myriad choices, all of which affect cost. These cost dimensions can be optimized to reduce cost while meeting performance goals.',
				},
				ImprovementPlan: {
					DisplayText:
						'Optimize resource consumption to minimize hosting costs',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gencost02-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gencost2_no',
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
		QuestionId: 'gencost2',
		QuestionTitle:
			'How do you select a cost-effective pricing model (for example, provisioned, on-demand, hosted, or batch)?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Foundation model hosting and inference can be conducted in a variety of ways. Some workloads demand immediate responses, while some can be done in batch. Some are hosted on unmanaged infrastructure, and some are hosted using serverless technologies. The inference and hosting paradigm selected influences total cost and should be done with cost in mind.',
			QuestionId: 'gencost2',
			QuestionTitle:
				'How do you select a cost-effective pricing model (for example, provisioned, on-demand, hosted, or batch)?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gencost3_1',
				Title: 'Reduce prompt token length',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Long prompts tend to be filled with lots of context, additional information, and requests for a foundation model when it is conducting inference. Reducing prompt length lowers the amount of compute needed to serve inference.',
				},
				ImprovementPlan: {
					DisplayText: 'Reduce prompt token length',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gencost03-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gencost3_2',
				Title: 'Control model response length',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"The costs of a foundation model are often measured in the lengths of the model's responses. This best practice describes how to control model responses to reduce costs.",
				},
				ImprovementPlan: {
					DisplayText: 'Control model response length',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gencost03-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gencost3_no',
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
		QuestionId: 'gencost3',
		QuestionTitle: 'How do you engineer prompts to optimize cost?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Prompts are engineered to optimize workloads cost as well as workload performance.',
			QuestionId: 'gencost3',
			QuestionTitle: 'How do you engineer prompts to optimize cost?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gencost4_1',
				Title: 'Reduce vector length on embedded tokens',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Using a smaller vector size for data embeddings results in a reduced response length for data-driven generative AI workflows. By keeping vector lengths small, we can save on model output as well as vector database computation requirements.',
				},
				ImprovementPlan: {
					DisplayText: 'Reduce vector length on embedded tokens',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gencost04-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gencost4_no',
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
		QuestionId: 'gencost4',
		QuestionTitle: 'How do you optimize vector stores for cost?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Generative AI architectures like Retrieval Augmented Generation (RAG) require a robust data backend to remain effective. Vector stores can add to the overall cost of running your application and should be optimized.',
			QuestionId: 'gencost4',
			QuestionTitle: 'How do you optimize vector stores for cost?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gencost5_1',
				Title: 'Create stopping conditions to control long-running workflows',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Agentic workflows can be long-running, which incurs additional cost to your application. Develop controls to limit agents from running for extended periods of time without stopping.',
				},
				ImprovementPlan: {
					DisplayText:
						'Create stopping conditions to control long-running workflows',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gencost05-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gencost5_no',
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
		QuestionId: 'gencost5',
		QuestionTitle: 'How do you optimize agent workflows for cost?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Agentic architectures promise significant automation potential across all domains. However, they can incur necessary additional cost if misconfigured.',
			QuestionId: 'gencost5',
			QuestionTitle: 'How do you optimize agent workflows for cost?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genops1_1',
				Title: 'Periodically evaluate functional performance',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement periodic evaluations using stratified sampling and custom metrics to maintain the performance and reliability of large language models. This practice verifies that models remain accurate and relevant over time by regularly assessing their performance against ground truth data and specific evaluation criteria. By employing stratified sampling, organizations can obtain a representative subset of data that reflects the diversity of real-world inputs, leading to more reliable performance metrics. Custom metrics allow for tailored assessments that align with specific business goals and user expectations. This practice helps customers achieve consistent model performance, detect and address model drift promptly, and integrate evaluation results into continuous improvement processes.',
				},
				ImprovementPlan: {
					DisplayText: 'Periodically evaluate functional performance',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops01-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops1_2',
				Title: 'Collect and monitor user feedback',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Supplement model performance evaluation with direct feedback from users. Implement continuous feedback loops to optimize application performance and enhance user satisfaction. Systematically collect, analyze, and act on user feedback to drive continuous improvement. By integrating this approach, you can achieve higher operational excellence and reliability, which keeps applications performant and aligned with user expectations. This proactive strategy helps to improve user satisfaction and foster a culture of ongoing enhancement and innovation.',
				},
				ImprovementPlan: {
					DisplayText: 'Collect and monitor user feedback',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops01-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops1_no',
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
		QuestionId: 'genops1',
		QuestionTitle:
			'How do you achieve and verify consistent model output quality?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Achieving consistent model output quality involves periodic evaluations using user feedback, ground truth data, and sampling techniques.',
			QuestionId: 'genops1',
			QuestionTitle:
				'How do you achieve and verify consistent model output quality?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genops2_1',
				Title: 'Monitor all application layers',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Implement comprehensive monitoring and logging across all layers of your generative AI application to maintain operational health, provide reliability, and optimize performance. This best practice aims to provide clear visibility into the application's behavior at every level, from user interactions to core model performance. By tracking key metrics, organizations can quickly identify and address issues, enhance user experiences, and make data-driven decisions to improve their AI systems.",
				},
				ImprovementPlan: {
					DisplayText: 'Monitor all application layers',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops02-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops2_2',
				Title: 'Monitor foundation model metrics',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"It's critical to set up continuous monitoring and alerting for foundation models for performance, security, and cost-efficiency. This best practice offers a structured approach to monitor models that fosters rapid identification and resolution of issues like data drift, model degradation, and security threats. Adopting this practice enhances reliability, efficiency, and trust in your applications, driving better business outcomes and user satisfaction. It can also help you with regulatory compliance and optimizes resource utilization.",
				},
				ImprovementPlan: {
					DisplayText: 'Monitor foundation model metrics',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops02-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops2_3',
				Title:
					'Implement rate limiting and throttling to mitigate the risk of system overload',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement rate limiting and throttling for AI application stability and performance. These practices control request processing rates to prevent system overload, which provides consistent application health and a better user experience. By adopting these measures, you can achieve balanced workload distribution, reduce service disruption risks, and enhance application reliability. This approach safeguards against excessive demand, optimizes resource utilization, and improves cost efficiency and performance.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement rate limiting and throttling to mitigate the risk of system overload',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops02-bp03.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops2_no',
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
		QuestionId: 'genops2',
		QuestionTitle:
			'How do you monitor and manage the operational health of your applications?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				"This question focuses on the strategies and tools you use to track key metrics, set up alerts, and respond to issues. To maintain the operational health and performance of your generative AI applications, it's crucial to implement comprehensive monitoring and management strategies across all layers the application. While traditional best practices apply, foundation models interact with software and data differently than traditional systems.",
			QuestionId: 'genops2',
			QuestionTitle:
				'How do you monitor and manage the operational health of your applications?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genops3_1',
				Title: 'Implement prompt template management',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement and maintain a versioned prompt template management system to achieve consistent and optimized performance of language models. This best practice aims to provide a structured approach to managing prompt templates, which helps teams systematically version, test, and optimize prompts. By adhering to this practice, you can achieve greater predictability in model behavior, enhance traceability of changes, and improve overall operational efficiency. This leads to more reliable language model deployments, reduced risks associated with prompt modifications, and the ability to quickly roll back to previous versions if needed. Ultimately, this best practice helps you deliver higher-quality outputs and maintain compliance with security and governance standards.',
				},
				ImprovementPlan: {
					DisplayText: 'Implement prompt template management',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops03-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops3_2',
				Title: 'Enable tracing for agents and RAG workflows',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement comprehensive tracing for generative AI agents and RAG workflows to enhance operational excellence and performance efficiency. This practice offers clear visibility into model decision-making, which helps you identify inefficiencies, optimize performance, and debug efficiently. By adopting tracing, customers achieve more reliable and efficient workflows, which improves model accuracy, speeds up decision-making, and enhances overall system performance. This approach supports continuous improvement while keeping data secure throughout the tracing process.',
				},
				ImprovementPlan: {
					DisplayText: 'Enable tracing for agents and RAG workflows',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops03-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops3_no',
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
		QuestionId: 'genops3',
		QuestionTitle:
			'How do you maintain traceability for your models, prompts, and assets?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'How do you manage and version your prompts, models, and associated assets to establish traceability, reproducibility, and continuous improvement in your generative AI workflows? This includes the practices and tools used for maintaining a structured approach to prompt engineering, model versioning, and performance evaluation, including methods for testing variants, capturing baselines, and optimizing based on defined metrics and ground truth data.',
			QuestionId: 'genops3',
			QuestionTitle:
				'How do you maintain traceability for your models, prompts, and assets?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genops4_1',
				Title:
					'Automate generative AI application lifecycle with infrastructure as code (IaC)',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implementing and managing IaC is crucial for consistent, version-controlled, and automated infrastructure deployment across environments. This practice streamlines deployment, reduces errors, and enhances team collaboration. IaC helps customers achieve efficiency, reliability, and scalability in infrastructure management, which allows for rapid iteration, straightforward rollback, and improved governance and results in secure deployments aligned with compliance standards.',
				},
				ImprovementPlan: {
					DisplayText:
						'Automate generative AI application lifecycle with infrastructure as code (IaC)',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops04-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops4_2',
				Title:
					'Follow GenAIOps practices to optimize the application lifecycle',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To optimize generative AI workloads, organizations should implement GenAIOps, a best practice that automates the development, deployment, and management of models. This approach establishes CI/CD pipelines for training, tuning, and deploying foundation models. GenAIOps enhances operational efficiency, reduces time-to-market, and enables consistent, high-quality model performance. It creates a robust, automated framework that supports the entire generative AI project lifecycle from development to production deployment. Through GenAIOps, customers can achieve greater agility, improved model reliability, and quick adaptation to changing business requirements, driving innovation and competitive advantage.',
				},
				ImprovementPlan: {
					DisplayText:
						'Follow GenAIOps practices to optimize the application lifecycle',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops04-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops4_no',
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
		QuestionId: 'genops4',
		QuestionTitle:
			'How do you automate the lifecycle management of your generative AI workloads?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Explore the strategies for automating the lifecycle management of generative AI workloads using infrastructure as code (IaC) principles.  Include aspects such as tool selection, CI/CD implementation, environment management, version control, and governance practices. The focus is on creating reproducible, scalable, and maintainable infrastructure for AI applications across different stages of development and deployment, while ensuring consistency, security, and compliance.',
			QuestionId: 'genops4',
			QuestionTitle:
				'How do you automate the lifecycle management of your generative AI workloads?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genops5_1',
				Title: 'Learn when to customize models',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Prioritize prompt engineering and RAG before model customization to optimize resources and enhance performance in developing generative AI solutions. This best practice aims to guide you in making informed decisions about when and how to customize AI models, which helps you verify that they achieve the best balance between efficiency and effectiveness. By starting with prompt engineering and RAG, you can leverage existing model capabilities to meet their needs, reducing the time, cost, and complexity associated with model customization. This approach allows organizations to quickly iterate on solutions, minimize resource consumption, and focus on achieving desired outcomes with minimal upfront investment.',
				},
				ImprovementPlan: {
					DisplayText: 'Learn when to customize models',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genops05-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genops5_no',
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
		QuestionId: 'genops5',
		QuestionTitle:
			'How do you determine when to execute Gen AI model customization?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Explore the strategic approach to generative AI model customization, and consider factors like task specificity, data availability, and resource constraints. Align model advanced customization with operational needs. Begin with prompt engineering and progress to more advanced methods like RAG, fine-tuning, or building custom models. Use cloud-based tools for model evaluation and customization, which helps maintaining security and regular updates. Balance model performance with resource requirements and maintenance costs throughout the customization process.',
			QuestionId: 'genops5',
			QuestionTitle:
				'How do you determine when to execute Gen AI model customization?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genperf1_1',
				Title: 'Define a ground truth data set of prompts and responses',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ground truth data facilitates model testing for use case specific scenarios and should be developed and curated for generative AI workloads.',
				},
				ImprovementPlan: {
					DisplayText:
						'Define a ground truth data set of prompts and responses',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genperf01-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genperf1_2',
				Title: 'Collect performance metrics from generative AI workloads',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Foundation model performance on specific tasks is measured in many different ways. It is important to measure and discern the performance of a model over time when selecting foundation models for generative AI workloads.',
				},
				ImprovementPlan: {
					DisplayText:
						'Collect performance metrics from generative AI workloads',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genperf01-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genperf1_no',
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
		QuestionId: 'genperf1',
		QuestionTitle:
			'How do you capture and improve the performance of your generative AI models in production?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Foundation models perform well on a wide-variety of tasks, and their general performance is tracked using leaderboards and other public metric tracking solutions. However, foundation models are not always suited to specific tasks. An example task might be having a foundation model draft documents in accordance with a specific format, using a specific selection of words (like mathematics or legal documents). Here we describe how to improve the performance of a model for specific tasks.',
			QuestionId: 'genperf1',
			QuestionTitle:
				'How do you capture and improve the performance of your generative AI models in production?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genperf2_1',
				Title: 'Load test model endpoints',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Foundation model performance is dependent on several factors, including the hosting architecture and the average prompt complexity. Load testing model endpoints using the average complexity prompt helps to determine a baseline level of performance, which informs future architecture decisions and ongoing operational considerations.',
				},
				ImprovementPlan: {
					DisplayText: 'Load test model endpoints',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genperf02-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genperf2_2',
				Title: 'Optimize inference parameters to improve response quality',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Foundation model performance can be affected by inference hyperparameters. Optimize inference hyperparameters for your use case to help maintain consistent performance and control the non-deterministic nature of foundation models.',
				},
				ImprovementPlan: {
					DisplayText:
						'Optimize inference parameters to improve response quality',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genperf02-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genperf2_3',
				Title: 'Select and customize the appropriate model for your use case',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'There are several industry-leading model providers, and each offers different model families and sizes. When you select a model, choose the appropriate model family and size for your use case to provide consistent performance.',
				},
				ImprovementPlan: {
					DisplayText:
						'Select and customize the appropriate model for your use case',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genperf02-bp03.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genperf2_no',
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
		QuestionId: 'genperf2',
		QuestionTitle:
			'How do you verify your generative AI workload maintains acceptable performance levels?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Foundation models are inherently non-deterministic. They introduce an element of randomness into systems which must be accounted for. Furthermore, while they are flexible and multi-purposed, foundation models are compute-intensive resources that may require tuning and customization to meet your organization requirements.',
			QuestionId: 'genperf2',
			QuestionTitle:
				'How do you verify your generative AI workload maintains acceptable performance levels?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genperf3_1',
				Title: 'Use managed solutions for model hosting and customization',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'There are several industry-leading model providers, and each offers different model families and sizes. When selecting a model, consistent performance can be achieved by selecting the appropriate model family and size for your use case.',
				},
				ImprovementPlan: {
					DisplayText:
						'Use managed solutions for model hosting and customization',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genperf03-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genperf3_no',
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
		QuestionId: 'genperf3',
		QuestionTitle:
			'How do you optimize computational resources required for high-performance distributed computation tasks?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Foundation models require high processing power to customize and deliver inference at scale. Optimize high-performance compute used for foundation models to help meet performance requirements.',
			QuestionId: 'genperf3',
			QuestionTitle:
				'How do you optimize computational resources required for high-performance distributed computation tasks?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genperf4_1',
				Title:
					'Test vector store features for latency and relevant performance',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Optimizing a data retrieval system for generative AI typically has more to do with data architecture and meta data than the foundation model selected. This best practice encourages high data quality and data architecture to accelerate data-driven generative AI workloads.',
				},
				ImprovementPlan: {
					DisplayText:
						'Test vector store features for latency and relevant performance',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genperf04-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genperf4_2',
				Title: 'Optimize vector sizes for your use case',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Embedding models may offer support for different sizes of vectors when embedding data. Optimizing the vector size for an embedding may introduce long-term performance gains.',
				},
				ImprovementPlan: {
					DisplayText: 'Optimize vector sizes for your use case',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genperf04-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genperf4_no',
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
		QuestionId: 'genperf4',
		QuestionTitle:
			'How do you improve the performance of data retrieval systems?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Data retrieval systems like vector databases support some of the most popular design patterns for generative AI systems. A performance bottleneck in a data retrieval system can have cascading downstream effects, which are difficult to identify and account for.',
			QuestionId: 'genperf4',
			QuestionTitle:
				'How do you improve the performance of data retrieval systems?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genrel1_1',
				Title:
					'Scale and balance foundation model throughput as a function of utilization',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Collect information on the generative AI workload's utilization. Use this information to determine the required throughput for your foundation model.",
				},
				ImprovementPlan: {
					DisplayText:
						'Scale and balance foundation model throughput as a function of utilization',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel01-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel1_no',
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
		QuestionId: 'genrel1',
		QuestionTitle:
			'How do you determine throughput quotas (or needs) for foundation models?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Foundation models perform complex tasks over detailed input, and they have limited throughput on the amount of inference requests they can service at a time. This is particularly true for managed and serverless model hosting paradigms.',
			QuestionId: 'genrel1',
			QuestionTitle:
				'How do you determine throughput quotas (or needs) for foundation models?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genrel2_1',
				Title:
					'Implement redundant network connections between model endpoints and supporting infrastructure',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement network connection redundancy between components in your generative AI application.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement redundant network connections between model endpoints and supporting infrastructure',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel02-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel2_no',
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
		QuestionId: 'genrel2',
		QuestionTitle:
			'How do you maintain reliable communication between different components of your generative AI architecture?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Generative AI workloads can be composed of several independent systems. Foundation models are often complemented by databases, data processing pipelines, prompt catalogs, and even APIs for agents. These systems communicate over a network and require reliable connectivity.',
			QuestionId: 'genrel2',
			QuestionTitle:
				'How do you maintain reliable communication between different components of your generative AI architecture?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genrel3_1',
				Title:
					'Use logic to manage prompt flows and gracefully recover from failure',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Leverage conditions, loops, and other logical structures at the prompt management or application layer to reduce the risk of an unreliable experience.',
				},
				ImprovementPlan: {
					DisplayText:
						'Use logic to manage prompt flows and gracefully recover from failure',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel03-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel3_2',
				Title: 'Implement timeout mechanisms on agentic workflows',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement controls to detect and terminate long-running unexpected workflows.',
				},
				ImprovementPlan: {
					DisplayText: 'Implement timeout mechanisms on agentic workflows',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel03-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel3_no',
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
		QuestionId: 'genrel3',
		QuestionTitle:
			'How do you implement remediation actions for generative AI workload loops, retries, and failures?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Generative AI workloads can be susceptible to logical loops, retries, and potentially even failures. Addressing these through the appropriate best practice helps to keeping your application reliable and improves user experience.',
			QuestionId: 'genrel3',
			QuestionTitle:
				'How do you implement remediation actions for generative AI workload loops, retries, and failures?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genrel4_1',
				Title: 'Implement a prompt catalog',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Prompt catalogs store and manage prompts and prompt versions. They act as a reliable store for prompts for generative AI workloads.',
				},
				ImprovementPlan: {
					DisplayText: 'Implement a prompt catalog',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel04-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel4_2',
				Title: 'Implement a model catalog',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Model catalogs store and manage model versions. They act as a reliable store for models which may need to be deployed or rolled back at any time. They also facilitate decoupled deployment automation.',
				},
				ImprovementPlan: {
					DisplayText: 'Implement a model catalog',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel04-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel4_no',
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
		QuestionId: 'genrel4',
		QuestionTitle:
			'How do you maintain versions for prompts, model parameters, and foundation models?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Prompts differentiate model performance from one workload to another. Curating prompts can be a time-consuming process, and it is important to have a reliable store for prompts. Foundation model performance differs from version to version, as does the impact of inference hyperparameters on model performance. Standardize and version these variations to create a more reliable experience.',
			QuestionId: 'genrel4',
			QuestionTitle:
				'How do you maintain versions for prompts, model parameters, and foundation models?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genrel5_1',
				Title:
					'Load-balance inference requests across all regions of availability',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Inference to a foundation model may be available over a local or large area of availability. Verify that you have resources available across that area to service inference requests reliably regardless of where they are coming from.',
				},
				ImprovementPlan: {
					DisplayText:
						'Load-balance inference requests across all regions of availability',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel05-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel5_2',
				Title: 'Replicate embedding data across all regions of availability',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Inference to a foundation model may be available over a local availability region, or could be a large region of availability. Make sure your data is available across all regions of availability to adequately service inference requests.',
				},
				ImprovementPlan: {
					DisplayText:
						'Replicate embedding data across all regions of availability',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel05-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel5_3',
				Title:
					'Verify that agent capabilities are available across all regions of availability',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Agents require supporting infrastructure to service requests from foundation models. Using agents across a region of availability requires the supporting infrastructure to be available in that region.',
				},
				ImprovementPlan: {
					DisplayText:
						'Verify that agent capabilities are available across all regions of availability',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel05-bp03.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel5_no',
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
		QuestionId: 'genrel5',
		QuestionTitle:
			'How do you distribute inference workloads over multiple regions of availability?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Generative AI applications can be as simple as prompt-response workflows against a single foundation model or as advanced as multi-agent orchestration. The various components associated with a generative AI workload are required to service a region of availability. Availability could be over a well-defined zone or it could be expansive covering large geographic areas. Architecting for this variability is a complex problem.',
			QuestionId: 'genrel5',
			QuestionTitle:
				'How do you distribute inference workloads over multiple regions of availability?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'genrel6_1',
				Title:
					'Design for fault-tolerance for high-performance distributed computation tasks',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Fault-tolerant infrastructure identifies issues in long-running, high-performance distributed computation tasks and remediates them before they can disrupt the task. Because these tasks are expensive and time-consuming, use fault-tolerant infrastructure to reliably perform model customization jobs.',
				},
				ImprovementPlan: {
					DisplayText:
						'Design for fault-tolerance for high-performance distributed computation tasks',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/genrel06-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'genrel6_no',
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
		QuestionId: 'genrel6',
		QuestionTitle:
			'How do you design high-performance distributed computation tasks to maximize successful completion?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Model customization and other high-performance distributed computation tasks for generative AI can be long-running, expensive, and brittle. It is important to deliberately architect these distributed, high-performance computation tasks for reliability so the resulting foundation model is performant and trained in a timely manner.',
			QuestionId: 'genrel6',
			QuestionTitle:
				'How do you design high-performance distributed computation tasks to maximize successful completion?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensec1_1',
				Title: 'Grant least privilege access to foundation model endpoints',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Granting least privileged access to foundation model endpoints helps limit unintended access and encourages a zero-trust security framework. This best practice describes how to secure foundation model endpoints associated with generative AI workloads.',
				},
				ImprovementPlan: {
					DisplayText:
						'Grant least privilege access to foundation model endpoints',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec01-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec1_2',
				Title:
					'Implement private network communication between foundation models and applications',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implementing a scoped down data perimeter on foundation model endpoints helps reduce the surface-area of potential threat vectors and encourages a zero-trust security architecture. This best practice describes how to implement private network communications for your generative AI workloads.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement private network communication between foundation models and applications',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec01-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec1_3',
				Title:
					'Implement least privilege access permissions for foundation models accessing data stores',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Foundation models can aggregate and generate rich insights from data they have been trained on or interact with from the APIs providing inputs and outputs. It is important to treat generative AI systems and their foundation models just as you would treat privileged users when providing access to data. This best practice describes how to provide generative AI APIs and services with appropriate access to data.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement least privilege access permissions for foundation models accessing data stores',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec01-bp03.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec1_4',
				Title:
					'Implement access monitoring to generative AI services and foundation models',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Generative AI services and foundation models can be resource intensive to use and can be misused. Implementing access monitoring on these services and models helps to identify, triage and resolve unintended access quickly.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement access monitoring to generative AI services and foundation models',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec01-bp04.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec1_no',
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
		QuestionId: 'gensec1',
		QuestionTitle: 'How do you manage access to generative AI endpoints?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Foundation models are available for use through managed, serverless, or self-hosted endpoints. Each paradigm comes with its own security considerations and requirements. This question seeks to understand the security considerations specific to endpoints associated with generative AI workloads.',
			QuestionId: 'gensec1',
			QuestionTitle: 'How do you manage access to generative AI endpoints?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensec2_1',
				Title:
					'Implement guardrails to mitigate harmful or incorrect model responses',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Guardrails are powerful, expansive techniques associated with reducing the risk of harmful, biased or incorrect model responses. This best practice discusses why and how to implement guardrails in generative AI workloads, as well as other complementary techniques.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement guardrails to mitigate harmful or incorrect model responses',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec02-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec2_no',
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
		QuestionId: 'gensec2',
		QuestionTitle:
			'How do you prevent generative AI applications from generating harmful, biased, or factually incorrect responses?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'It is possible for foundation models to generate harmful, biased, or factually incorrect responses, particularly when guardrails are not implemented appropriately or at all. This risk creates additional considerations for generative AI applications before they are put into a production environment. This question addresses the best practices associated with mitigating risk of harmful, biased or factually incorrect responses.',
			QuestionId: 'gensec2',
			QuestionTitle:
				'How do you prevent generative AI applications from generating harmful, biased, or factually incorrect responses?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensec3_1',
				Title:
					'Implement control plane and data access monitoring to generative AI services and foundation models',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implementing comprehensive monitoring across both control and data planes enhances the protection of generative AI workloads against service-level misconfigurations. This monitoring and auditing approach enables tracking of key aspects such as application performance, workload quality, and security',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement control plane and data access monitoring to generative AI services and foundation models',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec03-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec3_no',
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
		QuestionId: 'gensec3',
		QuestionTitle:
			'How do you monitor and audit events associated with your generative AI workloads?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				"To enhance the security and performance of generative AI systems, it's beneficial to implement comprehensive monitoring and auditing of events. This approach enables prompt identification.",
			QuestionId: 'gensec3',
			QuestionTitle:
				'How do you monitor and audit events associated with your generative AI workloads?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensec4_1',
				Title: 'Implement a secure prompt catalog',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Prompt catalogs facilitate the engineering, testing, versioning and storage of prompts. Implementing a prompt catalog improves the security of system and user prompts.',
				},
				ImprovementPlan: {
					DisplayText: 'Implement a secure prompt catalog',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec04-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec4_2',
				Title: 'Sanitize and validate user inputs to foundation models',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Generative AI applications commonly request user input. This user input is often open, unstructured, and loosely formatted, creating a risk of prompt injection and improper content.',
				},
				ImprovementPlan: {
					DisplayText: 'Sanitize and validate user inputs to foundation models',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec04-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec4_no',
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
		QuestionId: 'gensec4',
		QuestionTitle: 'How do you secure system and user prompts?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Prompts are crucial elements to a generative AI workload. They define how a user or application interacts with a foundation model. Engineering and testing prompts is an important process and requires time and effort to optimize. System and user prompt security is an important element of security for generative AI workloads.',
			QuestionId: 'gensec4',
			QuestionTitle: 'How do you secure system and user prompts?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensec5_1',
				Title:
					'Implement least privilege access and permissions boundaries for agentic workflows',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implementing least privilege and permissions bounded agents limits the scope of agentic workflows and helps prevent them from taking actions beyond their intended purpose on behalf of the user. This best practice describes how to reduce the risk of excessive agency.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement least privilege access and permissions boundaries for agentic workflows',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec05-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec5_no',
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
		QuestionId: 'gensec5',
		QuestionTitle: 'How do you prevent excessive agency for models?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Excessive agency is an OWASP Top 10 security threat for LLMs and is typically introduced to systems through agentic architectures. Because agents are designed to take action on behalf of a user, the risk of excessive agency is that an agent could take actions beyond their intended purpose.',
			QuestionId: 'gensec5',
			QuestionTitle: 'How do you prevent excessive agency for models?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensec6_1',
				Title:
					'Implement data purification filters for model training workflows',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Data poisoning is best handled at the data layer, before training or customization has taken place. Data purification filters can be introduced to data pipelines when curating a dataset for training or customization.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement data purification filters for model training workflows',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensec06-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensec6_no',
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
		QuestionId: 'gensec6',
		QuestionTitle: 'How do you detect and remediate data poisoning risks?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Data poisoning is a type of exploit that can occur during model training or customization. This happens when data not meant for model training or customization is used for training or customization, resulting in potentially undesirable effects for the finished model. Data poisoning can be difficult to detect and can be challenging to remediate.',
			QuestionId: 'gensec6',
			QuestionTitle: 'How do you detect and remediate data poisoning risks?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensus1_1',
				Title:
					'Implement auto scaling and serverless architectures to optimize resource utilization',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Adopt efficient and sustainable AI/ML practices to minimize resource usage, reduce costs, and lower environmental impact. Use serverless architectures, auto scaling, and specialized hardware to optimize resource utilization. This approach enhances performance efficiency, aligns with cost optimization, and supports sustainability goals. Implementing these practices enables responsible and economical deployment of generative AI workloads and promotes effective scaling without unnecessary resource waste.',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement auto scaling and serverless architectures to optimize resource utilization',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensus01-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensus1_2',
				Title: 'Use efficient model customization services',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To maximize efficiency and sustainability in large-scale generative AI model deployments, adopt best practices for distributed training and parameter-efficient fine-tuning. These techniques optimize resource utilization and reduce energy consumption, leading to cost savings and enhanced performance. This helps maintain a balance between computational demands and environmental considerations, promoting responsible cloud resource use.',
				},
				ImprovementPlan: {
					DisplayText: 'Use efficient model customization services',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensus01-bp02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensus1_no',
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
		QuestionId: 'gensus1',
		QuestionTitle:
			'How do you minimize the computational resources needed for training, customizing, and hosting generative AI workloads?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'To optimize the computational resources for training, customizing, and hosting generative AI workloads, consider adopting serverless architectures and auto scaling capabilities. Use managed services that offer efficient resource utilization and infrastructure management. Implement strategies such as instance optimization, container caching, and fast model loading to enhance performance and reduce environmental impact. Explore specialized instances designed for generative AI to achieve higher throughput and lower costs.',
			QuestionId: 'gensus1',
			QuestionTitle:
				'How do you minimize the computational resources needed for training, customizing, and hosting generative AI workloads?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensus2_1',
				Title:
					'Optimize data processing and storage to minimize energy consumption',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Organizations should optimize data processing and storage, which aims to enhance the sustainability and cost-effectiveness of their data processing and storage systems, particularly for generative AI workloads. Optimizing the use of computational resources helps you minimize energy consumption and operational costs while maintaining high performance and scalability.',
				},
				ImprovementPlan: {
					DisplayText:
						'Optimize data processing and storage to minimize energy consumption',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensus02-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensus2_no',
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
		QuestionId: 'gensus2',
		QuestionTitle:
			'How can you optimize data processing and storage to minimize energy consumption and maximize efficiency?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'To optimize computational resources for data processing pipelines, storage systems, and infrastructure in generative AI workloads, consider adopting serverless architectures and auto scaling mechanisms. Employ columnar formats and compression to minimize transfer and processing requirements. Implement serverless query and ETL services to reduce the need for persistent infrastructure, which promotes efficient resource utilization and sustainability.',
			QuestionId: 'gensus2',
			QuestionTitle:
				'How can you optimize data processing and storage to minimize energy consumption and maximize efficiency?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'gensus3_1',
				Title: 'Leverage smaller models to reduce carbon footprint',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To manage computational demands and costs of deploying large language models, implement model optimization techniques. This best practice aims to increase AI operational efficiency by reducing resource consumption while meeting performance goals. Strategies like quantization, pruning, and model distillation help lower operational expenses, improve response times, and promote environmental sustainability. This approach enables you to deploy efficient, cost-effective, and eco-friendly AI solutions, allowing for application scaling without excessive costs or environmental impact.',
				},
				ImprovementPlan: {
					DisplayText: 'Leverage smaller models to reduce carbon footprint',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/gensus03-bp01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'gensus3_no',
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
		QuestionId: 'gensus3',
		QuestionTitle:
			'How do you maintain model efficiency and resource optimization when working with large language models?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/genai',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'Explore strategies for enhancing model efficiency and resource optimization in large language models, focusing on techniques like quantization, pruning, and fine-tuning smaller models for specific tasks. Consider the benefits of model distillation to create efficient, task-specific models. Aim to balance performance with computational requirements, helping achieve optimal resource utilization in generative AI applications.',
			QuestionId: 'gensus3',
			QuestionTitle:
				'How do you maintain model efficiency and resource optimization when working with large language models?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
];

export default questions;
