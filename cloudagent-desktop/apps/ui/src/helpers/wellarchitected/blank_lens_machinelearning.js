const questions = [
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST1_1',
				Title: 'Define overall return on investment (ROI) and opportunity cost',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Evaluate the opportunity cost of ML for each use case to solve the business problem. Ensure cost eﬀective decisions are made with respect to long-term resource allocation. Minimize the possible future risks and failures through upfront understanding of the ML development process and its resource requirements. Adopt automation and optimization that can result in reduced cost and improved performance.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-01.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Define overall return on investment (ROI) and opportunity cost',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-01.html',
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
				Title: 'Identify if machine learning is the right solution',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Evaluate if there are alternatives, such as a simple rule-based approach, that could do a better job than ML. Weigh the cost of adopting ML against the opportunity cost of not leaning on ML transformation. Specialized resources, such as data scientist time or model time-to-market, might be the most expensive and constrained resources. The most cost-effective hardware choice might not be cost optimized if it constrains experimentation and development speed.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-03.html',
				},
				ImprovementPlan: {
					DisplayText: 'Identify if machine learning is the right solution',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-03.html',
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
				Title: 'Monitor usage and cost by ML activity',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use cloud resource tagging to manage, identify, organize, search for, and ﬁlter resources. Tags help categorize resources by purpose, owner, environment, or other criteria. Associate costs with resources using ML activity categories, such as re-training and hosting, by using tagging to manage and optimize cost in deployment phases. Tagging can be useful for generating billing reports with breakdown of cost by associated resources.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-27.html',
				},
				ImprovementPlan: {
					DisplayText: 'Monitor usage and cost by ML activity',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-27.html',
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
				Title: 'Monitor Return on Investment for ML models',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Once a model is deployed into production, establish a reporting capability to track the value which is being delivered. For example: 1/if a model is used to support customer acquisition - how many new customers are acquired and what is their spend when the model’s advice is used compared with a baseline. 2/if a model is used to predict when maintenance is needed - what savings are being made by optimizing the maintenance cycle. Effective reporting will enable you to compare the value delivered by an ML model against the ongoing execution cost and to take appropriate action. If the ROI is very positive, are there ways in which this might be scaled, to similar challenges for example. If the ROI is negative, could this be addressed by remedial action such as reducing the model latency by using server less inference, or reducing the run time cost by changing the compromise between model accuracy and model complexity, or layering in an additional simpler model to triage or filter the cases that are submitted to the full model.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-28.html',
				},
				ImprovementPlan: {
					DisplayText: 'Monitor Return on Investment for ML models',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-28.html',
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
		QuestionTitle:
			'How do you align expenditure to your business objectives and create usage awareness?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'The cloud makes it easier to accurately identify the usage and cost of systems, which then allows transparent attribution of IT costs to individual workload owners. This helps measure return on investment (ROI) and gives workload owners an opportunity to optimize their resources and reduce costs. The capability to attribute resource costs to the individual organization or product owners drives efficient usage behavior and helps reduce waste. Accurate cost attribution allows you to know which products are truly profitable, and allows you to make more informed decisions about where to allocate budget.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-01.html',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'The cloud makes it easier to accurately identify the usage and cost of systems, which then allows transparent attribution of IT costs to individual workload owners. This helps measure return on investment (ROI) and gives workload owners an opportunity to optimize their resources and reduce costs. The capability to attribute resource costs to the individual organization or product owners drives efficient usage behavior and helps reduce waste. Accurate cost attribution allows you to know which products are truly profitable, and allows you to make more informed decisions about where to allocate budget.',
			QuestionId: 'COST1',
			QuestionTitle:
				'How do you align expenditure to your business objectives and create usage awareness?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST2_1',
				Title: 'Select an optimal ML framework',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Organize, track, compare and evaluate machine learning (ML) experiments and model versions. Identify the most cost-eﬀective and optimal combination of instance types and ML frameworks. Examples of ML frameworks include TensorFlow, PyTorch, and Scikit-learn.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-12.html',
				},
				ImprovementPlan: {
					DisplayText: 'Select an optimal ML framework',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-12.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_2',
				Title: 'Select optimal algorithms',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Identify the basic machine learning paradigm that addresses your ML problem type. Basic machine learning paradigms include: supervised learning, unsupervised learning and reinforcement learning. Identify the acceptable level of tradeoﬀ between explainability and success metrics per business requirements. Run prototypes and experiments to explore high performing algorithms. Select the optimal cost-efficient algorithms that meet all the business requirements. Improved runtime performance of a tuned algorithm within business requirements, is one step towards optimizing the cost of ML.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-22.html',
				},
				ImprovementPlan: {
					DisplayText: 'Select optimal algorithms',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-22.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_3',
				Title: 'Tradeoff analysis on custom versus pre-trained models',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Optimize the cost through tradeoﬀ analysis based on custom versus pre-trained models. This tradeoﬀ analysis should keep the security and performance efficiency in perspective and within the acceptable thresholds.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-04.html',
				},
				ImprovementPlan: {
					DisplayText: 'Tradeoff analysis on custom versus pre-trained models',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-04.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_4',
				Title: 'Use managed data labeling',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose a managed labeling tool that provides automation and access to cost-eﬀective labeling workforce. It should also provide ﬂexibility to choose a variable number of labelers for a given input. The tool should have a user interface, and learn to label data by itself over time.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-05.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use managed data labeling',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-05.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_5',
				Title: 'Use data wrangler tools for interactive analysis',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Prepare data through data wrangler tools for interactive data analysis and model building. The no-code/low-code, automation, and visual capabilities improve the productivity and reduce the cost for interactive analysis.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-06.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use data wrangler tools for interactive analysis',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-06.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_6',
				Title: 'Use automated machine learning',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use automated data analyzer systems when building a model. These systems experiment with and select the best algorithm from the list of high-performing algorithms. They automatically test diﬀerent solutions and parameter settings to achieve optimal models. The automated system speeds up the process, while eliminating manual experimentation and comparisons.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-13.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use automated machine learning',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-13.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_7',
				Title: 'Enable data and compute proximity',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure that the Region used for training and developing models is the same as the one used for data. This approach helps minimize the time and cost of transferring data to the computation environment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-21.html',
				},
				ImprovementPlan: {
					DisplayText: 'Enable data and compute proximity',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-21.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_8',
				Title: 'Select optimal computing instance size',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Right size the training instances according to the ML algorithm used for maximum efficiency and cost reduction. Use debugging capabilities to understand the right resources to use during training. Simple models might not train faster on larger instances because they might not be able to beneﬁt from additional compute resources. These models might even train slower due to the high GPU communication overhead. Start with smaller instances and scale as necessary.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-09.html',
				},
				ImprovementPlan: {
					DisplayText: 'Select optimal computing instance size',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-09.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_9',
				Title: 'Use distributed training',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Enable distributed training for a faster training time, when an algorithm allows it. Use multiple instances in a training cluster. Use managed services to help ensure all training instances are automatically shut down when training is completed.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-15.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use distributed training',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-15.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_10',
				Title: 'Use appropriate deployment option',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use real-time inference for low latency and ultra-high throughput for use cases with steady traffic patterns. Use batch transform for offline inference on data batches for use cases with large datasets. Deploy models at edge to optimize, secure, monitor, and maintain machine learning models on fleets of edge devices such as smart cameras, robots, personal computers, and mobile devices.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-24.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use appropriate deployment option',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-24.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_11',
				Title: 'Explore cost effective hardware options',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Machine learning models that power AI applications are becoming increasingly complex resulting in rising underlying compute infrastructure costs. Up to 90% of the infrastructure spend for developing and running ML applications is often on inference. Look for cost-effective infrastructure solutions for deploying their ML applications in production.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-25.html',
				},
				ImprovementPlan: {
					DisplayText: 'Explore cost effective hardware options',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-25.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_12',
				Title: 'Right-size the model hosting instance fleet',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use efficient compute resources to run models in production. In many cases, up to 90% of the infrastructure spend for developing and running an ML application is on inference, making it critical to use high-performance, cost-effective ML inference infrastructure. Selecting the right way to host and the right type of instance can have a large impact on the total cost of ML projects. Use automatic scaling (autoscaling) for your hosted models. Auto scaling dynamically adjusts the number of instances provisioned for a model in response to changes in your workload.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-26.html',
				},
				ImprovementPlan: {
					DisplayText: 'Right-size the model hosting instance fleet',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-26.html',
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
		QuestionId: 'COST2',
		QuestionTitle:
			'How do you ensure cost-effective resource selection and usage?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Using the appropriate instances, resources, tools and services for your workload is key to cost savings. Appropriate service selection can also reduce usage and costs.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-12.html',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Using the appropriate instances, resources, tools and services for your workload is key to cost savings. Appropriate service selection can also reduce usage and costs.',
			QuestionId: 'COST2',
			QuestionTitle:
				'How do you ensure cost-effective resource selection and usage?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST3_1',
				Title: 'Use managed services to reduce total cost of ownership (TCO)',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Evaluate adopting managed services and pay-per-usage. Using managed services enables organizations to operate more efficiently with reduced resources and reduced cost.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-02.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Use managed services to reduce total cost of ownership (TCO)',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST3_2',
				Title: 'Stop resources when not in use',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Stop resources that are not in use to reduce cost. For example, hosted Jupyter environments used to explore small samples of data, can be stopped when not actively in use. Where practical, commit the work, stop them, and restart when needed. The same approach can be used to stop the computing and the data storage services.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-16.html',
				},
				ImprovementPlan: {
					DisplayText: 'Stop resources when not in use',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-16.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST3_3',
				Title: 'Enable feature reusability',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Reduce duplication and the rerunning of feature engineering code across teams and projects by using feature storage. The store should have online and oﬄine storage, and data encryption capabilities. An online store with low-latency retrieval capabilities is ideal for real-time inference. An oﬄine store maintains a history of feature values and is suited for training and batch scoring.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-08.html',
				},
				ImprovementPlan: {
					DisplayText: 'Enable feature reusability',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-08.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST3_4',
				Title: 'Enable debugging and logging',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure that there are sufficient logs and metrics recorded to capture the runtime and resource consumption. The collected logs and metrics can be analyzed to identify the areas for improvement. Monitor compute and data storage consumption. Instrument the machine learning code, and use debugging tools to capture metrics at runtime.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-23.html',
				},
				ImprovementPlan: {
					DisplayText: 'Enable debugging and logging',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-23.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST3_5',
				Title: 'Use managed data processing capabilities',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'With managed data processing, you can use a simplified, managed experience to run your data processing workloads, such as feature engineering, data validation, model evaluation, and model interpretation.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-07.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use managed data processing capabilities',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-07.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST3_6',
				Title: 'Setup budget and use resource tagging to track costs',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'If you need visibility of your ML cost, set up budgets and consider tagging your notebook instances. Examples of tags include the name of the project, the business unit, and environment (such as development, testing, or production). Tags are useful for cost optimization and can provide a clear visibility into where money is being spent.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-20.html',
				},
				ImprovementPlan: {
					DisplayText: 'Setup budget and use resource tagging to track costs',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-20.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST3_7',
				Title: 'Monitor endpoint usage and right-size the instance fleet',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure efficient compute resources are used to run models in production. Monitor your endpoint usage and right-size the instance fleet. Use automatic scaling (autoscaling) for your hosted models. Autoscaling dynamically adjusts the number of instances provisioned for a model in response to changes in your workload.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-29.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Monitor endpoint usage and right-size the instance fleet',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-29.html',
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
		QuestionId: 'COST3',
		QuestionTitle: 'How do you manage demand and supply resources?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'For a workload that has balanced spend and performance, ensure that everything you pay for is used and avoid significantly underutilizing instances. A skewed utilization metric in either direction has an adverse impact on your organization, in either operational costs (degraded performance due to overutilization), or wasted AWS expenditures (due to over-provisioning).',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-02.html',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'For a workload that has balanced spend and performance, ensure that everything you pay for is used and avoid significantly underutilizing instances. A skewed utilization metric in either direction has an adverse impact on your organization, in either operational costs (degraded performance due to overutilization), or wasted AWS expenditures (due to over-provisioning).',
			QuestionId: 'COST3',
			QuestionTitle: 'How do you manage demand and supply resources?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST4_1',
				Title: 'Select local training for small scale experiments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Evaluate the requirements to train an ML model in the cloud versus on a local machine. Use local option when experimenting across diﬀerent algorithms and conﬁgurations with small data sizes. For large data, launch a cloud-based training cluster with one or more compute instances. Right size the compute instances in the training cluster based on the workload.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-11.html',
				},
				ImprovementPlan: {
					DisplayText: 'Select local training for small scale experiments',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-11.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST4_2',
				Title: 'Start training with small datasets',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Start experimentation with smaller datasets on a small compute instance or local system. This approach allows you to iterate quickly at low cost. After the experimentation period, scale up to train with the full dataset available on a separate compute cluster. Choose the appropriate storage layer for training data based on the performance requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-17.html',
				},
				ImprovementPlan: {
					DisplayText: 'Start training with small datasets',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-17.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST4_3',
				Title: 'Use hyperparameter optimization technologies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use automatic hyperparameter tuning to run many training jobs and ﬁnd the best version of your model. Use the algorithm and ranges of hyperparameters that you specify. Use appropriate hyperparameter ranges, as well as metrics that are realistic and meet the business requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-19.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use hyperparameter optimization technologies',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-19.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST4_4',
				Title: 'Use warm-start and checkpointing hyperparameter tuning',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Where feasible, use warm start hyperparameter tuning. Warm start can consist of using a parent job for a model trained previously or using transfer learning. Warm start of hyperparameter tuning jobs eliminates the need to start a tuning job from scratch. Create a new hyperparameter tuning job that is based on selected parent jobs or pre-trained models. Use checkpointing capabilities to restart a training job from the last saved checkpoint. Reuse previous trainings as prior knowledge, or use checkpointing to accelerate the tuning process and reduce the cost.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-18.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use warm-start and checkpointing hyperparameter tuning',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-18.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST4_5',
				Title: 'Use managed training capabilities',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Machine learning model training can be an iterative, compute intensive, and time-consuming process. Instead of using the notebook itself, which might be running on a small instance, consider offloading the training to a managed cluster of compute resources including both CPUs and GPUs to train the model.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-14.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use managed training capabilities',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-14.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST4_6',
				Title: 'Use managed build environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Consider using managed notebooks instead of local ones, or notebooks hosted on a server. Managed notebooks come bundled with security, network, storage, compute capabilities that take a lot of time and resources to develop locally. Managed ML build environment also makes it easy to decide the type of machine you prefer so you don’t need to manage any complex AMIs or security groups—this makes it very easy to get started. It can also provide access to GPUs and big machines with large amounts of RAM that might not be possible on a local setup.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-10.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use managed build environments',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-10.html',
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
		QuestionId: 'COST4',
		QuestionTitle: 'How do you optimize cost during model training?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Using the appropriate instances, resources, tools and services for your workload is key to cost savings. Appropriate service selection can also reduce usage and costs.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlcost-11.html',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Using the appropriate instances, resources, tools and services for your workload is key to cost savings. Appropriate service selection can also reduce usage and costs.',
			QuestionId: 'COST4',
			QuestionTitle: 'How do you optimize cost during model training?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'ops1_1',
				Title: 'Develop the right skills with accountability and empowerment',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Artiﬁcial intelligence (AI) has many diﬀerent and growing branches, such as machine learning, deep learning, and computer vision. Given the complexity and fast-growing nature of ML technologies, plan to hire specialists with the understanding that additional training will be needed as ML evolves. Keep teams learning new skills, engaged, and motivated while encouraging accountability and empowerment at all times. Building ML models is a complex and iterative process that can infuse bias or unfair predictions against a certain entity. It's important to promote and enforce the ethical use of AI across enterprises.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-01.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Develop the right skills with accountability and empowerment',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops1_2',
				Title: 'Establish ML roles and responsibilities',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Understand the roles, responsibilities, ownership, and required interactions across teams to maximize overall eﬀectiveness. An ML project typically consists of multiple roles, with deﬁned tasks and responsibilities for each. In many cases, the separation of roles and responsibilities is not clear and there is overlap.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-04.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish ML roles and responsibilities',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-04.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops1_3',
				Title: 'Discuss and agree on the level of model explainability',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Discuss and agree with the business stakeholders on the acceptable level of model explainability required for the use case. Use the agreed level as a metric for evaluations and tradeoﬀ analysis across the ML lifecycle. Explainability can help with understanding the cause of a prediction, auditing, and meeting regulatory requirements. It can be useful for building trust ensuring that the model is working as expected.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-02.html',
				},
				ImprovementPlan: {
					DisplayText: 'Discuss and agree on the level of model explainability',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-02.html',
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
		QuestionTitle:
			'How does your organizational structure and culture support your business outcomes?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Organizational structure and organizational culture have a direct impact on business outcomes. Your teams must understand their part in achieving business outcomes. Teams need to understand their roles in the success of other teams, the role of other teams in their success, and have shared goals. Understanding responsibility, ownership, how decisions are made, and who has authority to make decisions will help focus efforts and maximize the benefits from your teams.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-01.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Organizational structure and organizational culture have a direct impact on business outcomes. Your teams must understand their part in achieving business outcomes. Teams need to understand their roles in the success of other teams, the role of other teams in their success, and have shared goals. Understanding responsibility, ownership, how decisions are made, and who has authority to make decisions will help focus efforts and maximize the benefits from your teams.',
			QuestionId: 'OPS1',
			QuestionTitle:
				'How does your organizational structure and culture support your business outcomes?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'ops2_1',
				Title: 'Establish model improvement strategies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Plan improvement drivers for optimizing model performance before ML model development starts. Examples of improvement drivers include: collecting more data, cross-validation, feature engineering, tuning hyperparameters, and ensemble methods.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-06.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish model improvement strategies',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-06.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops2_2',
				Title: 'Establish feedback loops across ML lifecycle phases',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Establish a feedback mechanism to share and communicate successful development experiments, analysis of failures, and operational activities. This facilitates continuous improvement on future iterations of the ML workload. ML feedback loops are driven by model drifts and requires ML practitioners to analyze and revisit monitoring and retraining strategies over time. ML feedback loops allow experimentation with data augmentation, and different algorithms and training approaches until an optimal outcome is achieved. Document your ﬁndings to identify key learnings and improve processes over time.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-08.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish feedback loops across ML lifecycle phases',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-08.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops2_3',
				Title: 'Establish a lineage tracker system',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Maintain a system that tracks changes for each release. These changes include documentation, environment, model, data, code, and infrastructure. Having this system allows you to go back and quickly reproduce a problem on a prior release, allowing rollbacks and reproducibility.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-07.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish a lineage tracker system',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-07.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops2_4',
				Title: 'Create tracking and version control mechanisms',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Due to its exploratory and iterative nature, it’s easy to lose track of ML model development and its evolution. You need to experiment with multiple combinations of data, algorithms, and parameters, all while observing the impact of incremental changes on model accuracy. Log and track your model experiments with configuration settings and hyperparameters. Document and version control any data processing-related ﬁndings, processes, and improvement to enable easier future referencing and reuse. Use a model registry to register and version control your ML models. Automate your model deployment with CI/CD processes. To learn more about knowledge management, refer the best practice documented in OPS11-BP04',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-11.html',
				},
				ImprovementPlan: {
					DisplayText: 'Create tracking and version control mechanisms',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-11.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops2_5',
				Title: 'Profile data to improve quality',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Proﬁle data to use data characteristics like distribution, descriptive statistics, data types, and data patterns. Review source data for content and quality. Filter out or correct any data not passing the reviews. This will contribute to quality improvement.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-10.html',
				},
				ImprovementPlan: {
					DisplayText: 'Profile data to improve quality',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-10.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops2_6',
				Title: 'Monitor model compliance to business requirements',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Machine learning models degrade over time due to changes in the real world, such as data drift and concept drift. If not monitored, these changes could lead to models becoming inaccurate or even obsolete over time. It’s important to have a periodic monitoring process in place to make sure that your ML models continue to comply to your business requirements, and that deviations are captured and acted upon promptly.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-03.html',
				},
				ImprovementPlan: {
					DisplayText: 'Monitor model compliance to business requirements',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-03.html',
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
			'How do you plan for continuous development and improvement?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Use tools and processes that enable continuous improvement to improve the effectiveness and efficiency of your operations.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-06.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Use tools and processes that enable continuous improvement to improve the effectiveness and efficiency of your operations.',
			QuestionId: 'OPS2',
			QuestionTitle:
				'How do you plan for continuous development and improvement?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'ops3_1',
				Title: 'Automate operations through MLOps and CI/CD',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automate ML workload operations using infrastructure as code (IaC) and conﬁguration as code (CaC). Select appropriate MLOps mechanisms to orchestrate your ML workflows and integrate with CI/CD pipelines for automated deployments. This approach ensures consistency across your staging and production deployment environments. Enable model observability and version control across your hosting infrastructure.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-12.html',
				},
				ImprovementPlan: {
					DisplayText: 'Automate operations through MLOps and CI/CD',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-12.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops3_2',
				Title:
					'Synchronize architecture and configuration, and check for skew across environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure that all systems and conﬁgurations are identical across development and deployment phases. Otherwise, the same algorithm can result in diﬀerent inference results depending on diﬀerences in system architectures. Ensure that the model gets the same range of accuracy in development, staging, and production environments. Perform this check as part of the normal promotion process.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-16.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Synchronize architecture and configuration, and check for skew across environments',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-16.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops3_3',
				Title:
					'Establish reliable packaging patterns to access approved public libraries',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Establish reliable patterns for data scientists to access approved public libraries by creating separate kernels for common ML frameworks. Examples of such common ML frameworks include TensorFlow, PyTorch, Scikit-learn, and Keras. This includes using internal repositories to give access to public libraries and creating separate kernels for common ML frameworks.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-13.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Establish reliable packaging patterns to access approved public libraries',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-13.html',
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
		QuestionTitle: 'How do you manage scalable development and deployment? ',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Adopt approaches that improve the flow of changes into production, that enable refactoring, fast feedback on quality, and bug fixing. These accelerate beneficial changes entering production, limit issues deployed, and enable rapid identification and remediation of issues introduced through deployment activities.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-12.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Adopt approaches that improve the flow of changes into production, that enable refactoring, fast feedback on quality, and bug fixing. These accelerate beneficial changes entering production, limit issues deployed, and enable rapid identification and remediation of issues introduced through deployment activities.',
			QuestionId: 'OPS3',
			QuestionTitle: 'How do you manage scalable development and deployment? ',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'ops4_1',
				Title: 'Establish deployment environment metrics',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Measure machine learning operations metrics to determine the performance of a deployed environment. These metrics include memory and CPU/GPU usage, disk utilization, ML endpoint invocations, and latency.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-14.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish deployment environment metrics',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-14.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops4_2',
				Title: 'Prepare an ML profile template',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Prepare an ML proﬁle template to capture workload artifacts across ML lifecycle phases. The template helps enable evaluating the current maturity status of a workload and plan for improvements accordingly. Artifact examples to capture for the deployment phase include: model instance size, model update schedule, and model deployment location. This template should have artifact metrics with thresholds to evaluate and rank the level of maturity. Enable the ML proﬁle template to reﬂect workload maturity status with snapshots of existing proﬁles, and alternative target proﬁles. Provide documentation with rationale for choosing one option over another that meets the business requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-05.html',
				},
				ImprovementPlan: {
					DisplayText: 'Prepare an ML profile template',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-05.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops4_3',
				Title: 'Enable model observability and tracking',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Establish model monitoring mechanisms to identify and proactively avoid any inference issues. ML models can degrade in performance over time due to drifts. Monitor metrics that are attributed to your model’s performance. For real time inference endpoints, measure the operational health of the underlying compute resources hosting the endpoint and the health of endpoint responses. Establish lineage to trace hosted models back to versioned inputs and model artifacts for analysis.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-15.html',
				},
				ImprovementPlan: {
					DisplayText: 'Enable model observability and tracking',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-15.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'ops4_4',
				Title: 'Review fairness and explainability',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Establish model endpoint monitoring. Identify and react to any potential issues or opportunities for improvement. Monitor metrics that measure the operational health of the underlying compute resources hosting the endpoint and the health of endpoint responses. Ensure traceability of hosting metrics back to versioned inputs for analysis.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-09.html',
				},
				ImprovementPlan: {
					DisplayText: 'Enable monitoring health of model endpoint',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-09.html',
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
		QuestionTitle:
			'How do you understand the operational health of your ML workload?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Define, capture, and analyze operations metrics to gain visibility to workload and operations events so that you can take appropriate action.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mloe-14.html',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'Define, capture, and analyze operations metrics to gain visibility to workload and operations events so that you can take appropriate action.',
			QuestionId: 'OPS4',
			QuestionTitle:
				'How do you understand the operational health of your ML workload?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF1_1',
				Title: 'Determine key performance indicators',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use guidance from business stakeholders to capture key performance indicators (KPIs) relevant to the business use case. The KPIs should be directly linked to business value to guide acceptable model performance. Consider that machine learning inferences are probabilistic and will not provide exact results. Identify a minimum acceptable accuracy and maximum acceptable error in the KPIs. This helps enable achieving the required business value and manage the risk of variable results.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-01.html',
				},
				ImprovementPlan: {
					DisplayText: 'Determine key performance indicators',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF1_2',
				Title: 'Define relevant evaluation metrics',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To validate and monitor model performance, establish numerical metrics that directly relate to the KPIs. These KPIs are established in the business goal identiﬁcation phase. Evaluate whether the performance metrics accurately reﬂect the business’ tolerance for the error. For instance, false positives might lead to excessive maintenance costs in predictive maintenance use cases. Numerical metrics, such as precision and recall, would help diﬀerentiate the business requirements and be closer aligned to business value. Consider developing custom metrics that tune the model directly for the business objectives. Examples of standard metrics for ML models include: Classiﬁcation - Confusion matrix (precision, recall, accuracy, F1 score), Receiver operating characteristic (ROC)-area under curve (AUC), Logarithmic loss (log-loss); Regression - Root mean square error (RMSE), Mean absolute percentage error (MAPE)',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-03.html',
				},
				ImprovementPlan: {
					DisplayText: 'Define relevant evaluation metrics',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-03.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF1_3',
				Title: 'Evaluate model explainability',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Evaluate model performance as constrained by the explainability requirements of the business. Compliance requirements, business objectives, or both might require that the inferences from a model be directly explainable. Evaluate the explainability needs, and the trade-oﬀ between explainability and model complexity. Then select the model type or evaluation metrics. This approach provides transparency into the reasons that a particular inference was attained given the input data.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-13.html',
				},
				ImprovementPlan: {
					DisplayText: 'Evaluate model explainability',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-13.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF1_4',
				Title: 'Perform a performance trade-off analysis',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Perform alternative trade-off analysis to obtain optimal performance and accuracy for a given use-case data and business requirement. Accuracy versus complexity trade-off: The simpler a machine learning model is, the more explainable are its predictions. Deep learning predictions can potentially outperform linear regression or a decision tree algorithm, but at the cost of added complexity in interpretability and explainability. Bias versus fairness trade-oﬀ: Deﬁne a process for managing risks of bias and fairness in model performance. Business value most often aligns with models that have considered historical or sampling biases in the training data. Further consideration should be given to the disparate impact of inaccurate model predictions. For example, underrepresented groups are often more impacted by historical biases, which might perpetuate unfair practices. Bias versus variance trade-oﬀ (supervised ML): The goal is to achieve a trained model with the lowest bias versus variance tradeoﬀ for a given data set. To help overcome bias and variance errors, you can use: Cross validation, More data, Regularization, Simpler models, Dimension reduction (Principal Component Analysis), Stop training early. Precision versus recall trade-off (supervised ML): This analysis can be important when precision is more important than recall or vice versa. For example, optimization of precision is more important when the goal is to reduce false positives. However, optimization of recall is more important when the goal is to reduce false negatives. It's not possible to have both high precision and high recall—if one is increased, the other decreases. A trade-oﬀ analysis helps identify the optimal option for analysis.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-09.html',
				},
				ImprovementPlan: {
					DisplayText: 'Perform a performance trade-off analysis',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-09.html',
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
		QuestionId: 'PERF1',
		QuestionTitle:
			'How do you evaluate ML performance efficiency and plan for improvement?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Cloud technologies are rapidly evolving and you must ensure that workload components are using the latest technologies and approaches to continually improve performance. You must continually evaluate and consider changes to your workload components to ensure you are meeting its performance and cost objectives. When you architect solutions, think about trade-offs to ensure an optimal approach. Depending on your situation, you could trade consistency, durability, and space for time or latency, to deliver higher performance.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-01.html',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Cloud technologies are rapidly evolving and you must ensure that workload components are using the latest technologies and approaches to continually improve performance. You must continually evaluate and consider changes to your workload components to ensure you are meeting its performance and cost objectives. When you architect solutions, think about trade-offs to ensure an optimal approach. Depending on your situation, you could trade consistency, durability, and space for time or latency, to deliver higher performance.',
			QuestionId: 'PERF1',
			QuestionTitle:
				'How do you evaluate ML performance efficiency and plan for improvement?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF2_1',
				Title: 'Use a modern data architecture',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Get the best insights from exponentially growing data using a modern data architecture. This architecture enables easy movement of data between a data lake and purpose-built stores including a data warehouse, relational databases, non-relational databases, ML and big data processing, and log analytics. A data lake provides a single place to run analytics across mixed data structures collected from disparate sources. Purpose-built analytics services provide the speed required for speciﬁc use cases like real-time dashboards and log analytics.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-04.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use a modern data architecture',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-04.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF2_2',
				Title: 'Use purpose-built AI and ML services and resources',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Consider how part or all of the workload could be handled by pre-built AI services or ML resources. Better performance can often be delivered more efficiently by using pre-optimized components included in AI and ML managed services. Select an optimal mix of bespoke and pre-built components to meet the workload requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-02.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use purpose-built AI and ML services and resources',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF2_3',
				Title: 'Review for updated data/features for retraining',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Establish a framework to run data exploration and feature engineering at pre-determined time intervals based on data volatility and availability. New features that have not been considered in the model training can aﬀect the accuracy of model inferences.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-17.html',
				},
				ImprovementPlan: {
					DisplayText: 'Review for updated data/features for retraining',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-17.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF2_4',
				Title: 'Optimize training and inference instance types',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Determine how the model type and data velocity aﬀect the choice of training and inference instance types. Identify the right instance type that supports memory intensive training, or compute intensive training with high throughput and low latency real-time inference. The speed of model inferences is directly impacted by model complexity. Selection of high compute instances can accelerate inference speed. GPUs are often the preferred processor type to train many deep learning models. CPUs are often sufficient for the inference workloads.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-05.html',
				},
				ImprovementPlan: {
					DisplayText: 'Optimize training and inference instance types',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-05.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF2_5',
				Title: 'Explore alternatives for performance improvement',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Perform benchmarking to improve the machine learning model performance. Benchmarking in ML involves evaluation and comparison of ML workloads with different algorithms, features, and architecture resources. It enables identifying the combination with optimal performance. Options you can use when benchmarking include: 1/Use more data to broaden the statistical range and improve the success metric of the model. 2/Apply feature engineering to extract important signals in the data for the model. 3/Make alternative algorithm selections for an optimal ﬁt to the speciﬁcs of the data. 4/Ensemble methods that combine the diﬀerent advantages of multiple models. 5/Tune the hyperparameters for a given algorithm to calibrate the model for the data.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-06.html',
				},
				ImprovementPlan: {
					DisplayText: 'Explore alternatives for performance improvement',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-06.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF2_6',
				Title:
					'Evaluate machine learning deployment options (cloud versus edge)',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Evaluate if machine learning applications require near-instantaneous inference results or require inference without network connectivity. Oﬀering the lowest latency possible might require the removal of costly roundtrips to the nearest API endpoints. A reduction in latency can be achieved by running the inference directly on the device itself (on the edge). A common use-case for such a requirement is predictive maintenance in factories.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-11.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Evaluate machine learning deployment options (cloud versus edge)',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-11.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF2_7',
				Title: 'Choose an optimal deployment option in the cloud',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'If models are suitable for cloud deployment, you should determine how to deploy them for best performance efficiency according to frequency, latency, and runtime requirements in your use cases.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-12.html',
				},
				ImprovementPlan: {
					DisplayText: 'Choose an optimal deployment option in the cloud',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-12.html',
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
		QuestionId: 'PERF2',
		QuestionTitle: 'How do you evolve your architecture and infrastructure?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'The optimal solution for a particular workload varies, and solutions often combine multiple approaches. Well-architected workloads use multiple solutions and enable different features to improve performance. When you architect solutions, think about trade-offs to ensure an optimal approach. Depending on your situation, you could trade consistency, durability, and space for time or latency, to deliver higher performance.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-03.html',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'The optimal solution for a particular workload varies, and solutions often combine multiple approaches. Well-architected workloads use multiple solutions and enable different features to improve performance. When you architect solutions, think about trade-offs to ensure an optimal approach. Depending on your situation, you could trade consistency, durability, and space for time or latency, to deliver higher performance.',
			QuestionId: 'PERF2',
			QuestionTitle: 'How do you evolve your architecture and infrastructure?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF3_1',
				Title: 'Establish a model performance evaluation pipeline',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Capture key metrics related to model performance using an end-to-end performance pipeline to evaluate the success of a model. Choose speciﬁc metrics based on the use case and the business KPIs. Sample key metrics include training or validation errors, and prediction accuracy. Speciﬁc model performance metrics include Root Mean Squared Error (RMSE), accuracy, precision, recall, F1 score, and area under the curve (AUC). Establish a fully automated performance testing pipeline system to initiate evaluation every time there is an updated model or data.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-07.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish a model performance evaluation pipeline',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-07.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF3_2',
				Title: 'Monitor, detect, and handle model performance degradation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Model performance could degrade over time for reasons such as data quality, model quality, model bias, and model explainability. Continuously monitor the quality of the ML model in real time. Identify the right time and frequency to retrain and update the model. Conﬁgure alerts to notify and initiate actions if any drift in model performance is observed.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-15.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Monitor, detect, and handle model performance degradation',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-15.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF3_3',
				Title: 'Establish feature statistics',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Establish key statistics to measure changes in the data that aﬀect model outcomes. The eﬀect of changes in data on model inference depends on the sensitivity of the model to data features. Analyze the feature importance and sensitivity of the model to select the features to monitor. Monitor the statistics of features that have the largest influence on inferences. Place acceptability limits on the range of data to alert when important features drift outside the statistical range of the training data. Signiﬁcant drifts in important features would suggest model re-training.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-08.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish feature statistics',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-08.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF3_4',
				Title: 'Evaluate data drift',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Understand the eﬀects of data drift on model performance. In cases where the data has drifted, the model could generate inaccurate predictions. Consider a strategy that monitors and adapts to data drift through re-training.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-14.html',
				},
				ImprovementPlan: {
					DisplayText: 'Evaluate data drift',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-14.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF3_5',
				Title: 'Establish an automated re-training framework',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Monitor the data and the model predictions. Run analyses of model performance against deﬁned metrics to identify errors due to data and concept drift. Automate model re-training to mitigate these errors on ﬁxed scheduled intervals, or when model variance reaches a deﬁned threshold. Automated model retraining can also be started as enough new data becomes available.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-16.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish an automated re-training framework',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-16.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF3_6',
				Title: 'Include human-in-the-loop monitoring',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use human-in-the-loop monitoring to monitor model performance eﬃciently. When automating decision processes, the human labeling of model results is a reliable quality test for model inferences. Compare human labels with model inferences to estimate model performance degradation. Perform mitigation as model re-training.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-18.html',
				},
				ImprovementPlan: {
					DisplayText: 'Include human-in-the-loop monitoring',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-18.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF3_7',
				Title: 'Detect performance issues when using transfer learning',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Monitor and ensure that the inherited prediction weights from a transferred model yield the desired results. This approach helps minimize the risk of weak learning and incorrect outputs using pre-trained models.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-10.html',
				},
				ImprovementPlan: {
					DisplayText: 'Detect performance issues when using transfer learning',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-10.html',
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
		QuestionId: 'PERF3',
		QuestionTitle: 'How do you monitor, review and improve ML Performance?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'After you implement your workload, you must monitor its performance so that you can remediate any issues before they impact your customers. Monitoring metrics should be used to raise alarms when thresholds are breached.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlper-06.html',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'After you implement your workload, you must monitor its performance so that you can remediate any issues before they impact your customers. Monitoring metrics should be used to raise alarms when thresholds are breached.',
			QuestionId: 'PERF3',
			QuestionTitle: 'How do you monitor, review and improve ML Performance?',
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
				Title: 'Adopt a machine learning microservice strategy',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Where appropriate, a complex business problem can be usefully decomposed into a series of machine learning models with a loosely coupled implementation. This can be accomplished by adopting a microservice instead of a monolithic architecture. This approach replaces one large resource with multiple small resources and can reduce the impact of a single failure on the overall workload. This strategy enables distributed development and improves scalability, enabling easier change management.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-02.html',
				},
				ImprovementPlan: {
					DisplayText: 'Adopt a machine learning microservice strategy',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL1_2',
				Title: 'Use APIs to abstract change from model consuming applications',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use a ﬂexible application and API design to abstract change from model consuming applications. Ensure that changes to an ML model are introduced with minimal or no interruption to existing workload capabilities. Minimize the changes across other downstream applications.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-01.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Use APIs to abstract change from model consuming applications',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-01.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL1_3',
				Title: 'Allow automatic scaling of the model endpoint',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement capabilities that allow the automatic scaling of model endpoints. This helps ensure the reliable processing of predictions to meet changing workload demands. Include monitoring on endpoints to identify a threshold that initiates the addition or removal of resources to support current demand.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-12.html',
				},
				ImprovementPlan: {
					DisplayText: 'Allow automatic scaling of the model endpoint',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-12.html',
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
		QuestionTitle:
			'How do you design your ML workload architecture to prevent failures?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'A reliable workload starts with upfront design decisions for both software and infrastructure. Your architecture choices will impact your workload behavior across all five Well-Architected pillars. For reliability, there are specific patterns you must follow.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-01.html',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'A reliable workload starts with upfront design decisions for both software and infrastructure. Your architecture choices will impact your workload behavior across all five Well-Architected pillars. For reliability, there are specific patterns you must follow.',
			QuestionId: 'REL1',
			QuestionTitle:
				'How do you design your ML workload architecture to prevent failures?',
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
				Title: 'Automate managing data changes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automate managing changes to training data using version control technology. This will enable reproducibility to re-create the exact version of a model in the event of a failure.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-05.html',
				},
				ImprovementPlan: {
					DisplayText: 'Automate managing data changes',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-05.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL2_2',
				Title: 'Use a data catalog',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Process data across multiple data stores using data catalog technology. An advanced data catalog service can enable ETL process integration. This approach enables more reliability and efficiency.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-03.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use a data catalog',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-03.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL2_3',
				Title: 'Use a data pipeline',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Automate the processing, movement, and transformation of data between diﬀerent compute and storage services. This automation enables data processing that is fault tolerant, repeatable, and highly available.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-04.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use a data pipeline',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-04.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL2_4',
				Title: 'Automate endpoint changes through a pipeline',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Manual change management is error prone, and incurs a high effort cost. Use automated pipelines (that integrate with a change management tracking system) to deploy changes to your model endpoints. Versioned pipeline inputs and artifacts allow you to track the changes and automatically rollback after a failed change.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-10.html',
				},
				ImprovementPlan: {
					DisplayText: 'Automate endpoint changes through a pipeline',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-10.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL2_5',
				Title: 'Ensure feature consistency across training and inference',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure consistent, scalable, and highly available features between training and inference using a feature storage. This results in reducing the training-serving skew by keeping feature consistency between training and inference.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-07.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Ensure feature consistency across training and inference',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-07.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL2_6',
				Title: 'Ensure model validation with relevant data',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Put processes in place to include real and representative data for testing and validation. Data that does not include all possible patterns and scenarios will result in failures once model is in production. Check for a distribution mismatch between training, validation, and test data as well as the inference data.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-08.html',
				},
				ImprovementPlan: {
					DisplayText: 'Ensure model validation with relevant data',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-08.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL2_7',
				Title: 'Establish data bias detection and mitigation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Detect and mitigate bias to avoid inaccurate model results. Establish bias detection methodologies at data preparation stage before training starts. Monitor, detect, and mitigate bias after the model is in production. Establish feedback loops to track the drift over time and initiate a re-training.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-09.html',
				},
				ImprovementPlan: {
					DisplayText: 'Establish data bias detection and mitigation',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-09.html',
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
		QuestionTitle: 'How do you design your ML workload to adopt to changes? ',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Controlled changes are necessary to deploy new functionality, and to ensure that the workloads and the operating environment are running known software and can be patched or replaced in a predictable manner.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-06.html',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Controlled changes are necessary to deploy new functionality, and to ensure that the workloads and the operating environment are running known software and can be patched or replaced in a predictable manner.',
			QuestionId: 'REL2',
			QuestionTitle: 'How do you design your ML workload to adopt to changes? ',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'REL3_1',
				Title: 'Use an appropriate deployment and testing strategy',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Run a trade-off analysis across available and relevant deployment/testing strategies (such as blue/green, canary, shadow, and A/B testing) and select the one that meets your business requirements. Implement metrics that evaluate model performance to identify when a rollback or roll-forward is required. When architecting for rollback or roll-forward, evaluate the following for each model 1/Where is the model artifact stored? 2/Are model artifacts versioned? 3/What changes are included in each version? 4/ What version of the model is deployed for a deployed endpoint?',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-11.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use an appropriate deployment and testing strategy',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-11.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL3_2',
				Title: 'Enable CI/CD/CT automation with traceability',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Enable source code, data, and artifact version control of ML workloads to enable roll back to a speciﬁc version. Incorporate continuous integration (CI), continuous delivery (CD), and continuous training (CT) practices to ML workload operations. This will enable automation with added traceability.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-07.html',
				},
				ImprovementPlan: {
					DisplayText: 'Enable CI/CD/CT automation with traceability',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-07.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL3_3',
				Title:
					'Ensure a recoverable endpoint with a managed version control strategy',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure an endpoint responsible for hosting model predictions, and all components responsible for generating that endpoint, are fully recoverable. Some of these components include model artifacts, container images, and endpoint conﬁgurations. Ensure all required components are version controlled, and traceable in a lineage tracker system.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-13.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Ensure a recoverable endpoint with a managed version control strategy',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-13.html',
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
		QuestionId: 'REL3',
		QuestionTitle:
			'How do you prepare your ML workload to manage and withstand failures?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'In any system of reasonable complexity, it is expected that failures will occur. Reliability requires that your workload be aware of failures as they occur and take action to avoid impact on availability. Workloads must be able to both withstand failures and automatically repair issues.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlrel-11.html',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'In any system of reasonable complexity, it is expected that failures will occur. Reliability requires that your workload be aware of failures as they occur and take action to avoid impact on availability. Workloads must be able to both withstand failures and automatically repair issues.',
			QuestionId: 'REL3',
			QuestionTitle:
				'How do you prepare your ML workload to manage and withstand failures?',
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
					'Validate ML data permissions, privacy, software, and license terms',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'ML libraries and packages handle data processing, model development, training, and hosting. Establish a process to review the privacy and license agreements for all software and ML libraries needed throughout the ML lifecycle. Ensure these agreements comply with your organization’s legal, privacy, and security terms and conditions. These terms should not add any limitations on your organization’s business plans.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-01.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Validate ML data permissions, privacy, software, and license terms',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-01.html',
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
				Title: 'Secure data and modeling environment',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Secure any system or environment that hosts data or enables model development. Store training data in secured storage and repositories. Run data preparation in a secure cloud. Tightly control access to the destination compute instances as data moves from the data repositories to the instances. Encrypt data at rest in the storage infrastructure and in transit to the compute infrastructure.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-04.html',
				},
				ImprovementPlan: {
					DisplayText: 'Secure data and modeling environment',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-04.html',
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
				Title: 'Secure governed ML environment',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Protect ML operations environments using managed services with best practices including: detective and preventive guardrails, monitoring, security, and incident management. Explore data in a managed and secure development environment. Centrally manage the conﬁguration of development environments and enable self-service provisioning for the users.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-08.html',
				},
				ImprovementPlan: {
					DisplayText: 'Secure governed ML environment',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-08.html',
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
		QuestionTitle: 'How do you control access to your ML workload?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Identity and access management are key parts of an information security program, ensuring that only authorized and authenticated users and components are able to access your resources, and only in a manner that you intend. Infrastructure protection encompasses control methodologies, such as defense in depth, necessary to meet best practices and organizational or regulatory obligations.  ',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-01.html',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Identity and access management are key parts of an information security program, ensuring that only authorized and authenticated users and components are able to access your resources, and only in a manner that you intend. Infrastructure protection encompasses control methodologies, such as defense in depth, necessary to meet best practices and organizational or regulatory obligations.  ',
			QuestionId: 'SEC1',
			QuestionTitle: 'How do you control access to your ML workload?',
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
				Title: 'Ensure least privilege access',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Protect all resources across various phases of the ML lifecycle using the principle of least privilege. These resources include: data, algorithms, code, hyperparameters, trained model artifacts, and infrastructure. Provide dedicated network environments with dedicated resources and services to operate any individual project.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-03.html',
				},
				ImprovementPlan: {
					DisplayText: 'Ensure least privilege access',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-03.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC2_2',
				Title: 'Restrict access to intended legitimate consumers',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use least-privileged permissions to invoke the deployed model endpoint. For consumers who are external to the workload environment, provide access via a secure API.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-12.html',
				},
				ImprovementPlan: {
					DisplayText: 'Restrict access to intended legitimate consumers',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-12.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC2_3',
				Title: 'Protect sensitive data privacy',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Protect sensitive data used in training against unintended disclosure. Identify and classify the sensitive data. Handle the sensitive data using strategies including: removing, masking, tokenizing, and principal component analysis (PCA). Document best governance practices for future reuse and references.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-05.html',
				},
				ImprovementPlan: {
					DisplayText: 'Protect sensitive data privacy',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-05.html',
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
		QuestionTitle: 'How do you control access to your ML workload?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Identity and access management are key parts of an information security program, ensuring that only authorized and authenticated users and components are able to access your resources, and only in a manner that you intend. Infrastructure protection encompasses control methodologies, such as defense in depth, necessary to meet best practices and organizational or regulatory obligations.  ',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-03.html',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Identity and access management are key parts of an information security program, ensuring that only authorized and authenticated users and components are able to access your resources, and only in a manner that you intend. Infrastructure protection encompasses control methodologies, such as defense in depth, necessary to meet best practices and organizational or regulatory obligations.  ',
			QuestionId: 'SEC2',
			QuestionTitle: 'How do you control access to your ML workload?',
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
				Title: 'Enforce data lineage',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Monitor and track data origins and transformations over time. Strictly control data access. Perform preventative controls, auditing, and monitoring to demonstrate data lineage. Implement integrity checks against training data to detect any unexpected deviances caused by loss, corruption, or manipulation. Data lineage enables visibility and helps tracing root cause of data processing errors.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-06.html',
				},
				ImprovementPlan: {
					DisplayText: 'Enforce data lineage',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-06.html',
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
				Title: 'Keep only relevant data',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Preserve data across computing environments (such as development and staging) and only store use-case relevant data to reduce data exposure risks. Implement mechanisms to enforce a lifecycle management process across the data. Decide when to automatically remove stale data.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-07.html',
				},
				ImprovementPlan: {
					DisplayText: 'Keep only relevant data',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-07.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC3_3',
				Title: 'Secure inter-node cluster communications',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'For frameworks such as TensorFlow, it’s common to share information like coefficients as part of the inter-node cluster communications. The algorithms require that exchanged information stay synchronized across nodes. Secure this information through encryption in transit.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-09.html',
				},
				ImprovementPlan: {
					DisplayText: 'Secure inter-node cluster communications',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-09.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC3_4',
				Title: 'Protect against data poisoning threats',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Protect against data injection and data manipulation that pollutes the training dataset. Data injections can add corrupt training data that can result in incorrect model and outputs. Data manipulations can change existing data (for example, labels) that can result in inaccurate and weak predictive models. Identify and address corrupt data and inaccurate models using security methods and anomaly detection algorithms. Ensure immutability of datasets by providing protection against ransomware and malicious code in installed third-party packages.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-10.html',
				},
				ImprovementPlan: {
					DisplayText: 'Protect against data poisoning threats',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-10.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC3_5',
				Title: 'Design data encryption and obfuscation',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Consider how personal data should be protected. Field level encryption or obfuscation can be used to protect personally identifiable data.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-02.html',
				},
				ImprovementPlan: {
					DisplayText: 'Design data encryption and obfuscation',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-02.html',
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
		QuestionTitle: 'How do you protect data?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Before architecting any system, foundational practices that influence security should be in place. For example, data classification provides a way to categorize organizational data based on levels of sensitivity, and encryption protects data by way of rendering it unintelligible to unauthorized access. These tools and techniques are important because they support objectives such as preventing financial loss or complying with regulatory obligations.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-05.html',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Before architecting any system, foundational practices that influence security should be in place. For example, data classification provides a way to categorize organizational data based on levels of sensitivity, and encryption protects data by way of rendering it unintelligible to unauthorized access. These tools and techniques are important because they support objectives such as preventing financial loss or complying with regulatory obligations.',
			QuestionId: 'SEC3',
			QuestionTitle: 'How do you protect data?',
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
				Title: 'Monitor human interactions with data for anomalous activity',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure that data access logging is enabled. Audit for anomalous data access events, such as access events from abnormal locations, or activity exceeding the baseline for that entity. Use services and tools that support anomalous activity alerting, and combine their use with data classiﬁcation to assess risk. Evaluate using services to aid in monitoring data access events.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-13.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Monitor human interactions with data for anomalous activity',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-13.html',
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
				Title: 'Protect against adversarial and malicious activities',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Add protection inside and outside of the deployed code to detect malicious inputs that might result in incorrect predictions. Automatically detect unauthorized changes by examining the inputs in detail. Repair and validate the inputs before they are added back to the pool.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-11.html',
				},
				ImprovementPlan: {
					DisplayText: 'Protect against adversarial and malicious activities',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-11.html',
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
		QuestionTitle:
			'How do you monitor, detect and protect your workload from risks and threats?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'You can use detective controls to identify a potential security threat or incident. They are an essential part of governance frameworks and can be used to support a quality process, a legal or compliance obligation, and for threat identification and response efforts. There are different types of detective controls.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsec-13.html',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'You can use detective controls to identify a potential security threat or incident. They are an essential part of governance frameworks and can be used to support a quality process, a legal or compliance obligation, and for threat identification and response efforts. There are different types of detective controls.',
			QuestionId: 'SEC4',
			QuestionTitle:
				'How do you monitor, detect and protect your workload from risks and threats?',
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
				Title: 'Define the overall environmental impact or benefit',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Measure your workload’s impact and its contribution to the overall sustainability goals of the organization.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-01.html',
				},
				ImprovementPlan: {
					DisplayText: 'Define the overall environmental impact or benefit',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-01.html',
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
				Title: 'Consider AI services and pre-trained models',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Consider whether the workload needs to be developed as a custom model. Many workloads can use managed AI services accessible through an API. Using these services means that you won’t need to provision your own resources to collect, store, and process training data and to prepare, train, tune, and deploy an ML model. If adopting a fully managed AI service is not appropriate, evaluate if you can use pre-existing datasets, algorithms, or models. You can also fine-tune an existing model starting from a pre-trained model. Using pre-trained models from third parties can reduce the resources needed for data preparation and model training.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-02.html',
				},
				ImprovementPlan: {
					DisplayText: 'Consider AI services and pre-trained models',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-02.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS1_3',
				Title: 'Select sustainable regions',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Choose the Regions where you implement your workloads based on both your business requirements and sustainability goals.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-03.html',
				},
				ImprovementPlan: {
					DisplayText: 'Select sustainable regions',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-03.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS1_4',
				Title:
					'Implement data lifecycle policies aligned with your sustainability goals',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Classify data to understand its significance to your workload and your business outcomes. Use this information to determine when you can move data to more energy-efficient storage or safely delete it. Define data retention periods that support your sustainability goals while meeting, but not exceeding, your business requirements.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-05.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement data lifecycle policies aligned with your sustainability goals',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-05.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS1_5',
				Title: 'Define sustainable performance criteria',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Make trade-offs between your model’s accuracy and its carbon footprint. When we focus only on the model’s accuracy, we “ignore the economic, environmental, or social cost of reaching the reported accuracy.” Because the relationship between model accuracy and complexity is at best logarithmic, training a model longer or looking for better hyperparameters only leads to a small increase in performance.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-07.html',
				},
				ImprovementPlan: {
					DisplayText: 'Define sustainable performance criteria',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-07.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS1_6',
				Title: 'Align SLAs with sustainability goals',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Define service level agreements (SLAs) that support your sustainability goals while meeting your business requirements. Define SLAs to meet your business requirements, not exceed them. Make trade-offs that significantly reduce environmental impacts in exchange for acceptable decreases in service levels.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-11.html',
				},
				ImprovementPlan: {
					DisplayText: 'Align SLAs with sustainability goals',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-11.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS1_7',
				Title: 'Measure material efficiency',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Measure efficiency of your workload in provisioned resources per unit of work, to measure not only the business success of the workload, but also its material efficiency. Use this measure as a baseline for your sustainability improvement process.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-15.html',
				},
				ImprovementPlan: {
					DisplayText: 'Measure material efficiency',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-15.html',
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
			'Align sustainability goals with business objectives and create awareness',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Sustainability focuses on environmental impacts, especially energy consumption and efficiency, since they are important levers for architects to guide direct action on how to reduce resource usage. Define service level agreements (SLAs) that support your sustainability goals while meeting your business requirements. Define SLAs to meet business requirements, not exceed them. Make trade-offs that significantly reduce environmental impacts in exchange for acceptable decreases in service levels.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-01.html',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'Sustainability focuses on environmental impacts, especially energy consumption and efficiency, since they are important levers for architects to guide direct action on how to reduce resource usage. Define service level agreements (SLAs) that support your sustainability goals while meeting your business requirements. Define SLAs to meet business requirements, not exceed them. Make trade-offs that significantly reduce environmental impacts in exchange for acceptable decreases in service levels.',
			QuestionId: 'SUS1',
			QuestionTitle:
				'Align sustainability goals with business objectives and create awareness',
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
				Title: 'Select energy-efficient algorithms',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To minimize resource usage, replace algorithms with more efficient versions that produce the same result.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-08.html',
				},
				ImprovementPlan: {
					DisplayText: 'Select energy-efficient algorithms',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-08.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_2',
				Title: 'Minimize idle resources',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Adopt a managed and serverless architecture for your data pipeline so that it only provisions resources when work needs to be done. By doing so, you are not maintaining compute infrastructure 24/7 and you minimize idle resources.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-04.html',
				},
				ImprovementPlan: {
					DisplayText: 'Minimize idle resources',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-04.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_3',
				Title: 'Adopt sustainable storage options',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Reduce the volume of data to be stored and adopt sustainable storage options to limit the carbon impact of your workload. For artifacts like models and log files that must be kept for long-term compliance and audit requirements, use efficient compression algorithms and use energy efficient cold storage.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-06.html',
				},
				ImprovementPlan: {
					DisplayText: 'Adopt sustainable storage options',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-06.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_4',
				Title: 'Archive or delete unnecessary training artifacts',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Remove training artifacts that are unused and no longer required to limit wasted resources. Determine when you can archive training artifacts to more energy-efficient storage or safely delete them.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-09.html',
				},
				ImprovementPlan: {
					DisplayText: 'Archive or delete unnecessary training artifacts',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-09.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_5',
				Title: 'Use efficient model tuning methods',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement an efficient strategy to optimize hyperparameter values to minimize the resources required to complete model training. Avoid a brute force strategy wherever possible, as it tests hyperparameter values without concern for the number of resources used.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-10.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use efficient model tuning methods',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-10.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_6',
				Title: 'Use efficient silicon',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Use the most efficient instance type compatible with your ML workload.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-12.html',
				},
				ImprovementPlan: {
					DisplayText: 'Use efficient silicon',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-12.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_7',
				Title: 'Optimize models for inference',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Improve efficiency of your models and thus use less resources for inference by compiling the models into optimized forms.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-13.html',
				},
				ImprovementPlan: {
					DisplayText: 'Optimize models for inference',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-13.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_8',
				Title: 'Deploy multiple models behind a single endpoint',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Host multiple models behind a single endpoint to improve endpoint utilization. Sharing endpoint resources is more sustainable and less expensive than deploying a single model behind one endpoint.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-14.html',
				},
				ImprovementPlan: {
					DisplayText: 'Deploy multiple models behind a single endpoint',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-14.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS2_9',
				Title: 'Retrain only when necessary',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Because of model drift, robustness requirements, or new ground truth data being available, models usually need to be retrained. Instead of retraining arbitrarily, monitor your ML model in production, automate your model drift detection and only retrain when your model’s predictive performance has fallen below defined KPIs.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-16.html',
				},
				ImprovementPlan: {
					DisplayText: 'Retrain only when necessary',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-16.html',
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
			'How do you ensure sustainable resource selection and usage?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/machinelearning',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceDisplayText:
				'Choose algorithms that produce desired results with minimal resource usage. Continuously evaluate optmization opportunities in choosing the most efficient algorithm version, model deployment instance type, inference instances and modes of deployment along with the use of serverless pipelines where possible. Selecting the right region, resource type, storage type and inference endpoint type help in building more sustainable workloads.',
			HelpfulResourceUrl:
				'https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/mlsus-08.html',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'Choose algorithms that produce desired results with minimal resource usage. Continuously evaluate optmization opportunities in choosing the most efficient algorithm version, model deployment instance type, inference instances and modes of deployment along with the use of serverless pipelines where possible. Selecting the right region, resource type, storage type and inference endpoint type help in building more sustainable workloads.',
			QuestionId: 'SUS2',
			QuestionTitle:
				'How do you ensure sustainable resource selection and usage?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
];

export default questions;
