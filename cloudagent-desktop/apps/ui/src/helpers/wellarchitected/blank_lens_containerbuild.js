const questions = [
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST1_1',
				Title: 'Define retention period of container images',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Building a containerized application can result in multiple images for the same service. Depending on your organization policy, you might want to keep a subset of your container images to be used in a case of a rollback scenario. An example of such a policy might be that you don’t roll back more than three versions, or more than three months in time. That means, that not all container images of a specific application should be kept. Deleting old images can save costs as container registries charge by size of images stored in the registry. You can achieve this deletion policy by creating automation processes, or use service features, for example: Amazon ECR supports a lifecycle policy that can be used to expire (delete) images based on rules such as image age, count, specific tags and more.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/practice-cloud-financial-management.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Define lifecycle policies to expire (delete) images based on a specific retention period.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/practice-cloud-financial-management.html',
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
				Title: 'Designing efficient container build process',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Building containers is a process that consumes compute and storage resources and can lead to unnecessary costs if not using it properly. The build process consumes resources for each build, and there are some considerations that have to be taken for it to be efficient from a cost perspective.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/expenditure-and-usage-awareness.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Designing an efficient container build process from a cost perspective.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/expenditure-and-usage-awareness.html',
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
				Title: 'Application dependencies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The container image is usually being built alongside with the application build step. During this build step, all necessary dependencies, libraries, and modules that are being used by the application code are downloaded to the container image. Using unnecessary dependencies will make the build time longer, and will result in wasting compute resources of the build system.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/expenditure-and-usage-awareness.html',
				},
				ImprovementPlan: {
					DisplayText: 'Identify and remove unnecessary dependencies.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/expenditure-and-usage-awareness.html',
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
				Title: 'Common container image dependencies',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Some operating system packages are needed for multiple applications in the organization for a specific runtime (for example, Python and Java). Building a parent container image that preinstalls all common operating system packages and dependencies for the specific runtime will result in a more efficient build process. Without this common image, each individual container image would be installing the same packages, thus wasting compute and network resources. This practice will also shorten the time for container images built from a specific runtime, since all of its common operating system packages and dependencies are already included in the parent container image. As a result, this will reduce costs for building all other container images that use this parent image. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/expenditure-and-usage-awareness.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Build a parent container image that preinstalls all common operating system packages and dependencies for the specific runtime',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/expenditure-and-usage-awareness.html',
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
		QuestionTitle:
			'How do you design your container build process to avoid unnecessary cost?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Designing an efficient container build process avoids unnecessary costs by optimizing image size, leveraging caching, parallelizing builds, and preventing resource waste.',
			QuestionId: 'COST1',
			QuestionTitle:
				'How do you design your container build process to avoid unnecessary cost?',
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
				Title: 'Containerized application start-up time',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Container image size affects the time needed for an image to be pulled from a container registry. Large image sizes (hundreds, or thousands of MB), can lead to a slow startup time of the application, which can lead to wasted compute resources while waiting for images to be pulled Slow scale-out operations Container image size also affects the scaling time needed for a containerized application to become ready to receive traffic. This time can translate to a waste of resources. In small-scale replicas of your application, the waste might not be notable, but when dealing with a dynamic autoscaled environment, a 30-second delay between a triggered scale-out event and a container ready to run can result in hundreds of compute minutes wasted per month.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				ImprovementPlan: {
					DisplayText: 'Reduce container image size.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
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
				Title: 'Storage requirements for containers',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Consider your instance’s storage requirements depending on your container image size. The size of your container image has a direct effect on the instance storage size that the container will run on. This can result in the need for a larger storage size for your instances. Container image size also affects the storage requirements of the container registry, since the container image will be stored in the registry. Stored images in Amazon ECR are priced per GB-month.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Define your instance’s storage and registry requirements depending on your container image size.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST2_no',
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
		QuestionId: 'COST2',
		QuestionTitle:
			'Ensure that your container images contain only what is relevant for your application to run',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'It is important to only include relevant components in container images to optimize image size, improve security by reducing attack surface, and simplify maintenance and debugging.',
			QuestionId: 'COST2',
			QuestionTitle:
				'Ensure that your container images contain only what is relevant for your application to run',
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
				Title: 'Reducing image layers',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'A container image consists of read-only layers that represent a Dockerfile instruction. Each instruction creates one additional layer on top of the previous layer. Running multiple consecutive commands can result in a large container image size, even if we delete content in the container image itself. An example of that might be installing a package, and deleting the cached downloaded files that are not needed anymore after installing the package. The following example shows that we installed some-package and then delete the cached files. Even though we used the rm command to remove the cached file, the container image contains a layer representing the rm -rf ... command, and is still containing a layer with the actual cached files, resulting in a larger container image. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				ImprovementPlan: {
					DisplayText: 'Adopt proper techniques to reduce image layers.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST3_no',
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
		QuestionId: 'COST3',
		QuestionTitle: 'How do you reduce your container images size?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Reducing container image size improves startup time, decreases storage resource requirements, and limits the attack surface for improved security.',
			QuestionId: 'COST3',
			QuestionTitle: 'How do you reduce your container images size?',
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
				Title: 'Does your application handle signal handling?',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'When designing applications that will be containerized, it is important to include signal handling within the code and/or the container itself. Handling signals is a fundamental practice for writing applications, especially when writing applications that will run inside a container. The application should handle system signals and react according to the application logic. Although this is not directly related to cost, handling signals is a key element for using cost saving practices like automatic scaling or using Amazon EC2 Spot Instances. When a scale-in event, or replacement or termination of a Spot Instance occurs, the container orchestrator system or tools will send a SIGTERM signal to the application notifying the application to shut itself down gracefully. If it fails to do so, the process may end up being terminated while performing work, which can prohibit the use of auto scaling or spot in general.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Handle signals to leverage cost saving practices like automatic scaling or using Amazon EC2 Spot Instances.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST4_no',
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
		QuestionId: 'COST4',
		QuestionTitle:
			'How do you design your containerized application to support automatic scaling and graceful termination?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Designing containerized applications to support automatic scaling and graceful termination enables the application to dynamically respond to changes in demand and infrastructure availability, improving reliability and efficiency.',
			QuestionId: 'COST4',
			QuestionTitle:
				'How do you design your containerized application to support automatic scaling and graceful termination?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST5_1',
				Title: 'Aware of different instance families and CPU architecture',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Different instance families offer different performance for the same amount of hardware (CPU and memory). An example is using a newer instead of an older generation of instances, or using instances with different CPU architecture, such as ARM. To use a different instance architecture, you have to change your build process. Since the default behavior of the build process is to create a container image that is designed to run on the architecture of the instance that it was built on, you have to create multiple images for each CPU architecture. To create multiple images, run the same build process on an x86 instance, and on an ARM-based instance. Use tagging suffixes to differentiate between the different architectures.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Design your containerized application to support multiple CPU architectures and different instance families.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/cost-effective-resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST5_no',
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
		QuestionId: 'COST5',
		QuestionTitle:
			'How do you design your containerized application to support multiple CPU architectures?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Supporting multiple CPU architectures in a containerized application provides portability and flexibility to run the application across different infrastructure environments.',
			QuestionId: 'COST5',
			QuestionTitle:
				'How do you design your containerized application to support multiple CPU architectures?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST6_1',
				Title:
					'Minimise container startup time at application or container level',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Longer startup times for containerized applications can result in wasted compute resources. Shortening startup times can be done on the application-level (code optimization), or on the container level. For example, if the application needs external dependencies to be present in the container, it should be already installed during the build process, or it should be included in the parent image, and not downloaded at startup using an entrypoint script or dockerfile commands.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/manage-demand-and-supply-resources.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Review application and container configuration to shorten startup times.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/manage-demand-and-supply-resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST6_no',
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
		QuestionId: 'COST6',
		QuestionTitle:
			'How do you minimize cost for your containerized application during startup time?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'Minimizing cost during startup time for a containerized application is important because containers are often cycled rapidly, so optimizing startup resource usage reduces unnecessary infrastructure and operational expenses.',
			QuestionId: 'COST6',
			QuestionTitle:
				'How do you minimize cost for your containerized application during startup time?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'COST7_1',
				Title: 'Have a system in place for container build process',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Creating any build process requires developing, maintaining, and operating a build system. This can be done by a variety of methods, such as using OSS tooling for job automation, or using self-developed systems that are able to run build scripts for your application. However, running and maintaining this kind of system involves software development costs, operational costs, compute, and storage costs for running the system. Alternatively you can use build and pipeline services, such as Amazon EC2 Image Builder, AWS CodeBuild, and AWS CodePipeline. Using managed services removes the operational overhead and allows developers to consume pipeline runs and build jobs on a pay-as-you-go basis.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/manage-demand-and-supply-resources.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Evaluate the use of build and pipeline services, such as Amazon EC2 Image Builder, AWS CodeBuild, and AWS CodePipeline.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/manage-demand-and-supply-resources.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'COST7_no',
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
		QuestionId: 'COST7',
		QuestionTitle:
			'What systems are you using to create your container build process?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'costOptimization',
			QuestionDescription:
				'It is important to have automated systems to create the container build process because this streamlines container image creation, enables consistency and reproducibility of the build, and allows seamless implementation of updates and modifications.',
			QuestionId: 'COST7',
			QuestionTitle:
				'What systems are you using to create your container build process?',
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
				Title: 'Understand the lineage of your container image',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Understanding the lineage of your container image helps you efficiently develop, run, manage, and maintain your containers. It also helps maintain your security posture. You can find more details in the Security Pillar whitepaper.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'When you start building a new project, use a base image from a verified source, such as an official Ubuntu image.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
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
				Title: 'Have parity between your deployment environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'A major benefit of using containers is to provide the ability for the development team to develop new updates and features using an identical artifact that runs in production. As much as possible, development, testing, QA, and production environments in that it will be eventually deployed should be as similar as possible.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'All environments should share best practices for everything, with the differences between them being the ability to scale and the data operated upon.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS1_3',
				Title:
					'Build the image once and use the same image in all environments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Once the new image has been built with the updates in place for deployment, promote the same image into the next environment, testing, QA, and production, to provide for consistency across all environments. This will reduce the number of changes introduced in each new environment and provide for more consistent behavior.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Promote the same image into the next environment, testing, QA, and production, to provide for consistency across all environments.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS1_4',
				Title: 'Use a CI/CD build process',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Like with your applications, you should use a CI/CD pipeline to build and test your images through every stage in your development process. The CI process usually starts upon a trigger that is sent from a version control system (usually git). Whether your application requires compilation or not, there are several steps to take to build the container.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Start using a CI/CD pipeline to build and test your images through every stage in your development process.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS1_5',
				Title: 'Multi-stage builds',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Small container images have undeniable performance advantages. The pull from the registry is faster because less data is transferred over the network, and the container startup time is also reduced. This can be achieved by using multi-stage builds.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Split the build-phase of the image from the final image that will be used to run the application.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS1_6',
				Title:
					'Implement a minimal container image design to achieve your business and security objectives',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'It is important to build into your container image only what is necessary.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Pictures and other static assets should be stored in a data store, for example Amazon Simple Storage Service (Amazon S3) in AWS, and served through a content delivery network (CDN).',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS1_7',
				Title:
					'Using package managers to deploy your containerized applications',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'When building a containerized application, the deployable unit can be not only the container image, but its per-environment configuration that is deployed alongside with the container image to the target environment. To achieve this, users can use packaging tooling such as Helm and Kustomize for Kubernetes, AWS Copilot for Amazon Elastic Container Service (Amazon ECS), Docker Swarm for Docker, and more.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
				},
				ImprovementPlan: {
					DisplayText:
						'When building your containerized application, the target artifact should be a package that contains a reference to the container image and its common configurations across all environments.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/prepare.html',
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
		QuestionTitle:
			'How do you manage the lifecycle of your containers and images?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'It is important to adopt proper standards and tools to manage the lifecycle of container images from development to production deployment.',
			QuestionId: 'OPS1',
			QuestionTitle:
				'How do you manage the lifecycle of your containers and images?',
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
				Title: 'Implement health checks to determine container state',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Implement container health checks. Health checks are one way to determine the health of your running container. They enable your orchestration tooling to direct connection traffic to the container only when it is ready to accept connections, or stop routing connections to the container if the health checks show that the container is no longer running as expected. In the latter case, the orchestration tooling will tear down the misbehaving container and replace it with a new healthy one.For example, with Amazon ECS you can define health checks as part of the task definition, and perform load balancer health checks for your running application.  ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'For Kubernetes and Amazon Elastic Kubernetes Service, you can take advantage of features such as liveness probes to detect deadlock condition, readiness probes to determine if the pod is prepared to receive requests, and startup probes to know when the application running in the container has started.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/operate.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'OPS2_2',
				Title: 'Have your logs available outside the running container',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Ensure that the logs generated by your running containers are collected and accessible externally. This will enable you to use log monitors to gain more insights into the behavior and functionality of your running container. Your application should be writing its logs to STDOUT and STDERR so that a logging agent can ship the logs to your log monitoring system. As with other application workloads, you must understand the metrics and messages that you have collected from your workload. Not only must you understand the data emitted by your containers, but you must also have a standardized log format to easily evaluate the data with your logging tools. Logging collector and forwarder tools give you the ability to standardize your log format across multiple containerized services.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/operate.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Define your log messages to be consistently structured to enable correlation of logs across multiple microservices in your central logging system.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/operate.html',
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
			'How do you know whether your containerized workload is achieving its business goals?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'operationalExcellence',
			QuestionDescription:
				'To ensure the success of your running container, you must understand the health of your containerized workload as well as what your customers are experiencing when they interact with your application.',
			QuestionId: 'OPS2',
			QuestionTitle:
				'How do you know whether your containerized workload is achieving its business goals?',
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
				Title: 'Use small parent images',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The OS parent image that is used to create the target images has a huge impact on the final container image size.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/selection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Check the most optimized environment based on language used to build performant containers.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/selection.html',
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
				Title: 'Run a single process per container',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'It is highly recommended to limit the number of processes in each container to one. This approach simplifies the implementation of separations of concerns using simple services. Each container should only be responsible for a single aspect of the application that facilitates horizontal scaling of this particular aspect. If it’s necessary to run more than one process per container, use a proper process supervisor (like supervisord) and an init system (like tini).',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/selection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Limit the number of processes in each container to one: each container should only be responsible for a single aspect of the application.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/selection.html',
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
				Title: 'Exclude files with from your build process',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'The .dockerignore file is similar to .gitignore and is used to exclude files that are not necessary for the build, or are of a sensitive nature. This can be useful if it’s not possible to restructure the source code directory to limit the build context.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/selection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Leverage .dockerignore file to exclude files that are not necessary for the build, or are of a sensitive nature.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/selection.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF1_no',
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
		QuestionId: 'PERF1',
		QuestionTitle: 'How do you reduce the size of your container image?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Smaller container images directly improve performance related to pulling, deploying, caching, storage usage, security, and migrating containers.',
			QuestionId: 'PERF1',
			QuestionTitle: 'How do you reduce the size of your container image?',
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
				Title: 'Use a container registry close to your cluster',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'One of the essential factors in the speed of deploying container images from a registry is locality. The registry should be as close to the cluster as possible, which means that both the cluster and the registry should be in the same AWS Region. For multi-region deployments, this means that the CI/CD chain should publish a container image to multiple Regions. An additional way to optimize the pull time of your container image is to keep the container image as small as possible. In Tradeoffs multi-stage builds are discussed in detail to reduce the image size.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/selection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Create the cluster and the registry in the same AWS Region.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/selection.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF2_no',
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
		QuestionId: 'PERF2',
		QuestionTitle: 'How do you reduce the pull time of your container image?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Optimizing pull performance through smaller images, layer caching, geographically closer registries, and other best practices is key for achieving faster deployments, rapid scaling, quicker failure recovery, and a better developer experience.',
			QuestionId: 'PERF2',
			QuestionTitle: 'How do you reduce the pull time of your container image?',
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
				Title: 'Use a tag other than latest',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Using the latest tag for the parent image could potentially lead to issues because the latest version of the image might include breaking changes compared to the version that is currently used.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/review.html',
				},
				ImprovementPlan: {
					DisplayText: 'Avoid using the latest tag for the parent image.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/review.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF3_no',
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
		QuestionId: 'PERF3',
		QuestionTitle:
			'How do you make sure to get consistent results for your target images?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Getting consistent results for target images ensures predictable behavior, avoids unexpected errors due to inconsistencies, and simplifies troubleshooting when issues arise.',
			QuestionId: 'PERF3',
			QuestionTitle:
				'How do you make sure to get consistent results for your target images?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF4_1',
				Title: 'Implement a notification mechanism for updated parent images',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'If you’re using a team- or enterprise-wide image, you should implement a notification mechanism based as part of your CI/CD chain to distribute the information about a new parent image to the teams. The teams should build target images with the new parent images and measure the performance impact of the changes by running a proper test suite.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/review.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement a notification mechanism based as part of your CI/CD chain to distribute the information about a new parent image to the teams.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/review.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF4_no',
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
		QuestionId: 'PERF4',
		QuestionTitle:
			'How do you make sure to use updated versions for parent images?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Using updated versions for parent images ensures you have the latest security patches, bug fixes, and compatibility with dependencies, reducing vulnerabilities and improving stability and reliability.',
			QuestionId: 'PERF4',
			QuestionTitle:
				'How do you make sure to use updated versions for parent images?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF5_1',
				Title: 'Implement an automated performance testing strategy',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'System performance can degrade over time. It’s important to have an automated testing and monitoring system in place to identify degradation of performance. Every time you build target images based on new parent images, you should measure the performance impact of the changes in the parent image. This also includes the overall build process, because we have to make sure that a testing and monitoring system covers the CI/CD chain. Performance metrics and image sizes have to be collected using services like Amazon CloudWatch and teams must be alarmed if anomalies have been detected.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/monitoring.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Create an automated testing and monitoring system to identify degradation of performance.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/monitoring.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF5_no',
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
		QuestionId: 'PERF5',
		QuestionTitle:
			'How do you make sure you get consistent performance results over time?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Getting consistent performance over time for a container image allows for predictable resource planning and workload deployments, avoiding unexpected behavior that could impact reliability or cause outages.',
			QuestionId: 'PERF5',
			QuestionTitle:
				'How do you make sure you get consistent performance results over time?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'PERF6_1',
				Title: ' Use caching during build',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'A container image is created using layers. Each statement in a Dockerfile (like RUN or COPY) creates a new layer. These layers are stored in a local image cache and can be reused in the next build. The cache can be invalidated by changing the Dockerfile, which means that all subsequent steps to build the image must be rerun. Naturally, this has a great influence on the speed the image is built. Thus, the order of the commands in your Dockerfile can have a dramatic effect on build performance.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/tradeoffs.html',
				},
				ImprovementPlan: {
					DisplayText: 'Leverage caching mechanisms during build.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/tradeoffs.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF6_2',
				Title: 'Use the CPU architecture with best price to performance ratio',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"AWS Graviton-based Amazon EC2 instances deliver up to 40% better price performance over comparable current generation x86-based instances for a broad spectrum of workloads. Instead of using one build-server for x86 and ARM in combination with QEMU for CPU emulation, it might be a more efficient architecture to use at least one build server per CPU architecture. For example, it is possible to create multi-architecture container images to support AWS Graviton-based Amazon EC2 instances and x86 using AWS CodeBuild and AWS CodePipeline. As described in the blog post 'Creating multi-architecture Docker images to support Graviton2 using AWS CodeBuild and AWS CodePipeline', this approach includes three CodeBuild projects to create an x86 container image, an ARM64 container image, and a manifest list. A manifest list is a list of image layers that is created by specifying one or more (ideally more than one) image names. This approach is used to create multi-architecture container images. ",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/tradeoffs.html',
				},
				ImprovementPlan: {
					DisplayText: 'Leverage AWS Graviton-based instances.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/tradeoffs.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'PERF6_no',
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
		QuestionId: 'PERF6',
		QuestionTitle: 'How do you optimize the size of your target image?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'performance',
			QuestionDescription:
				'Optimizing the size of the target container image improves pull and deployment speed, reduces storage resource usage, enables faster scaling, and lowers the security attack surface.',
			QuestionId: 'PERF6',
			QuestionTitle: 'How do you optimize the size of your target image?',
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
				Title: 'Use RAM and CPU limits',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'By default, a running container will use the full RAM and CPU of the host system. This can lead to performance bottlenecks on the host and put your workload in a degraded state. Setting RAM and CPU limits on your running container will improve the availability of the host system and the workload.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/foundations.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Configure requests and limits keys to define how much memory and CPU a specific container will consume when running.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/foundations.html',
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
		QuestionTitle:
			'How do you limit the amount of CPU and memory a container consumes?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Whatever container orchestrator you are using, specifying resource requests and limits for your containerized applications is highly critical.',
			QuestionId: 'REL1',
			QuestionTitle:
				'How do you limit the amount of CPU and memory a container consumes?',
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
				Title: 'Use volumes to persist data',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'There are times when workloads have to store data across multiple containers. For example, an image-processing application that saves images for processing. Given the ephemeral nature of a container workload, data on the container will be lost once the container is restarted and longer exists. Use mounted volumes, whether block or network file system (NFS), to persist file data for an application.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/workload-architecture.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Mounted volumes allow for file data sharing among multiple running containers and for persisting logs or configuration files. For persisting data, use external database such as Amazon Relational Database Service, Amazon DynamoDB, or Amazon Aurora.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/workload-architecture.html',
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
			'How do you handle persistent data in a container application?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Given the ephemeral nature of a container workload, data on the container will be lost once the container is restarted and longer exists. For this reason, handling persistent data properly in a container application is crucial.',
			QuestionId: 'REL2',
			QuestionTitle:
				'How do you handle persistent data in a container application?',
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
				Title: 'Create local testing processes',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'When building a containerized application, you want to be able to test your application as early as possible. That means that you have to think about how developers will be able to test their containerized application locally. First you will have to decide whether the container build for local testing will run on the developer’s machine or in a remote machine, because this will have an impact on the tooling that developers use on their machines. Second, you will have to provide a local deployment mechanism. For this, you can use single containers that run as part of an automation script or deploy the containers locally using a local version of your target orchestrator.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/workload-architecture.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Deploy necessary infrastructure components like databases in a lightweight fashion in order to test your application with the real infrastructure instead of mocked APIs.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/workload-architecture.html',
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
				Title:
					'Design your testing environments to support your container build pipeline',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'When building a containerized application, it can be easily deployed throughout multiple environments. In order to validate that your application is running properly, you will have to test your containerized applications. With the container’s ecosystem, you can have multiple manifests for all of the applications in an environment, and you can easily provision a ready-to-use environment with all dependent services already deployed in it. This process of temporary, or ephemeral testing environments, can be achieved in lower effort given the ease of reproducing fully configured environments that are based on containers. Whether you’re using the GitOps methodology for a Kubernetes based application, or a centralized deployment configuration, you should try to create reproducible environments to support testing of your containerized application.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/workload-architecture.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Create reproducible environments to support testing of your containerized application.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/workload-architecture.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL3_no',
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
		QuestionId: 'REL3',
		QuestionTitle: 'How do you automate building and testing of containers?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Being able to build and test your containerized application using automated tools can speed up the development phase and reduce the time to market.',
			QuestionId: 'REL3',
			QuestionTitle: 'How do you automate building and testing of containers?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'REL4_1',
				Title: 'Create a standardized parent image',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Based on a lean parent image, a team- or enterprise-wide image can be created that provides optimizations to all teams. This could also be multiple parent images depending on the containerized application frameworks and languages. An organization could potentially start with a lean image containing company-specific configurations, and teams can add additional software that is necessary to run the different applications. This could be, for example, a Java Runtime Edition (JRE) or a specific Python version. One disadvantage of this solution is that if a parent image is changed, all images that use it - directly or indirectly - must also be recreated.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/change-management.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Start with a lean image containing company-specific configurations, then teams can add additional software that is necessary to run the different applications.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/change-management.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL4_2',
				Title: 'Use an image hierarchy approach',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Try to maintain an image hierarchy in your container image strategy. A hierarchy or layered approach to container images helps with maintenance, cascading of updates to base images, and allows for the reuse of container images. In addition, it helps maintain the security posture of the broader organization by using the same images that have the security controls image managed by a central team. Operations like patching of a parent image should trigger a rebuild with changes to child images.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/change-management.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Separate images into the following categories: Intermediate base image, Application server, Application source code or binary.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/change-management.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL4_3',
				Title: 'Use source control and tagging on all container images',
				Description: '',
				HelpfulResource: {
					DisplayText:
						"Maintain the Dockerfile for all container images in a source control repository in the image hierarchy and ensure proper tagging of container images. In addition, use a contentious integration process to create a direct correlation between the container's images in source control and the image tag. This best practice is critical to determine what changed in the container image from a prior release. For example, tag 1.0 indicates that this tag will always point to the latest patch release 1.0.1, 1.0.2, 1.0.3, and so on.",
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/change-management.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Maintain the Dockerfile for all container images in a source control repository and ensure proper tagging of container images.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/change-management.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL4_no',
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
		QuestionId: 'REL4',
		QuestionTitle: 'How do I cascade updates to a parent or base image?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Managing updates in a proper way helps maintain consistent change management process and security posture.',
			QuestionId: 'REL4',
			QuestionTitle: 'How do I cascade updates to a parent or base image?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
	{
		ChoiceAnswerSummaries: [],
		Choices: [
			{
				ChoiceId: 'REL5_1',
				Title:
					'Plan for health checks in all containers builds and deployments',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'It is common to initially develop container applications without thinking of the availability of the services in the container. When running container applications, there is no way of knowing whether the services running within a container are up or not. Adding a health check or probe to the container provides testing of the services in the container. Health check options are available in Docker using the HEALTHCHECK command, however, containerd does not have this option.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/failure-management.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Examine the orchestrations systems health check and probing options.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/failure-management.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'REL5_no',
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
		QuestionId: 'REL5',
		QuestionTitle: 'How do you monitor the health of a container?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'reliability',
			QuestionDescription:
				'Monitoring the health of a container is crucial to ensure the availability of the services and business continuity.',
			QuestionId: 'REL5',
			QuestionTitle: 'How do you monitor the health of a container?',
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
					'Define the user directive in the Dockerfile used to compile the image',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'By default, containers provide process isolation. This means that processes running inside of a container are isolated from processes and data that exist in other containers as well as the container host’s operating system. However, it is important to note that the default behavior is to run the container using the root user when running a container. When the processes inside the container are running as the root user, not only do they have full administrative access to containers, they also have the same administrative level access to the container host. Having an application running within a container through the root user expands the attack surface of the environment. This could provide bad actors with the ability to escalate privilege to the container host infrastructure if the application is compromised.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/identity-and-access-management.html',
				},
				ImprovementPlan: {
					DisplayText:
						'There are multiple ways to mitigate this risk. The most straightforward method is to define the user directive in the Dockerfile used to compile the image',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/identity-and-access-management.html',
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
			'How do you ensure that your container images are using least privilege identity?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'When the processes inside the container are running as the root user, not only do they have full administrative access to containers, they also have the same administrative level access to the container host. Having an application running within a container through the root user expands the attack surface of the environment.',
			QuestionId: 'SEC1',
			QuestionTitle:
				'How do you ensure that your container images are using least privilege identity?',
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
					'Limit administrator access to build infrastructure (CI pipeline)',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Securing an organization’s build pipeline should be considered a high priority, as the pipeline typically accesses databases, proprietary code, and secrets or credentials across dev, test, and prod environments.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/identity-and-access-management.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Follow the best practice of granting the least privileged access to the container build infrastructure.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/identity-and-access-management.html',
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
		QuestionTitle: 'How do you control access to your build infrastructure?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'Securing build pipelines is a major focus for organizations moving to a DevSecOps strategy.',
			QuestionId: 'SEC2',
			QuestionTitle: 'How do you control access to your build infrastructure?',
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
				Title: 'Ensure that your images are scanned for vulnerabilities',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'There are two basic categories to consider when discussing image scanning: static scanning and dynamic scanning. Static scanning is performed before the image is deployed. This is important because it allows organizations to detect vulnerabilities in a container image before a container is deployed into an environment.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/detective-controls.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Many registry offerings provide native static image scanning that can scan container images for common vulnerabilities and exposures (CVEs) without having to integrate and maintain a third-party image scanning tool.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/detective-controls.html',
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
		QuestionTitle:
			'How do you detect and address vulnerabilities within your container image?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'After images are built, it is important to maintain a regular cadence of scanning those images to ensure no new or existing vulnerabilities have surfaced.',
			QuestionId: 'SEC3',
			QuestionTitle:
				'How do you detect and address vulnerabilities within your container image?',
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
				Title: 'Minimize attack surface',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'In any security context, reducing attack surface is top of mind. This can be accomplished when designing and building your container in a variety of ways.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/infrastructure-protection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Implement best practices to design and build your containers to minimize attack surface.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/infrastructure-protection.html',
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
				Title: 'Understand the lineage of your container image',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'If not building images from scratch, you should only run images from trusted registries that have been signed with a trusted signature to ensure integrity. Regarding signing images, it is recommended to utilize signed images to ensure that the contents of the container have not been modified before they are deployed.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/infrastructure-protection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'In general, don’t incorporate images directly from a public repository into your container pipeline, use private registries instead to maintain complete control and visibility over their container image catalog.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/infrastructure-protection.html',
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
		QuestionTitle: 'How do you manage your container image boundaries?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'In the context of container workloads, infrastructure protection is often a topic with respect to the container as a vector to access the underlying compute infrastructure. It is also important to understand where your container images are coming from.',
			QuestionId: 'SEC4',
			QuestionTitle: 'How do you manage your container image boundaries?',
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
				Title: 'Do not hardcode sensitive data into your container image',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'User credentials should never be hardcoded into your container image.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/data-protection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Consider using a secret management protocol that is compatible with the container orchestration system being used to manage the container workloads.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/data-protection.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SEC5_2',
				Title: 'Ensure that persistent data is stored outside of the container',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Since containers are intended to be ephemeral, use volumes to store persistent data that will remain intact long after a container’s lifecycle has completed.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/data-protection.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Use volumes to store persistent data that will remain intact long after a container’s lifecycle has completed.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/data-protection.html',
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
		QuestionTitle:
			'How do you handle data within your containerized applications?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'security',
			QuestionDescription:
				'With respect to handling data in the build and design of the container, it is important that no sensitive information is stored in the container itself. Also, if your containerized application writes or consumes persistent data, ensure that data is stored outside of the container.',
			QuestionId: 'SEC5',
			QuestionTitle:
				'How do you handle data within your containerized applications?',
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
				Title:
					'Design containerized applications that it reduces underlying resources',
				Description: '',
				HelpfulResource: {
					DisplayText:
						' When designing containerized application, you should keep your build manifests up-to-date and aligned with your application needs. A containerized application image starts from a Dockerfile. The Dockerfile includes all commands required to include the configuration and dependencies for the containerized application. If there are some dependencies that are no longer required, removing them from the Dockerfile can: 1/ Reduce the time that it takes to build the container image. This affects host resource consumption by the build process. 2/ Reduce the container image size and therefore reduce the time it takes for this image to be pulled to an instance. This affects host resources usage for running and storing the container images.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/software-and-architecture-patterns.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Keep your build manifests up-to-date and aligned with your application needs.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/software-and-architecture-patterns.html',
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
			'How do you design your containerized application to reduce resources?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'It is important to design containerized applications to reduce resource usage because containers share resources on a host system, so minimizing CPU, memory, storage, and network usage allows more containers to run efficiently on the same infrastructure.',
			QuestionId: 'SUS1',
			QuestionTitle:
				'How do you design your containerized application to reduce resources?',
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
				Title: 'Use instance types with least impact',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'To be able to use instance types with the least environmental impact (from the Sustainability Pillar whitepaper), you have to ensure your containerized application is able to run on a variety of instance types and architectures. This can be done by creating images that support multi-architecture as described in the Cost Optimization Pillar whitepaper. For example, you can use a build service that supports multi-architecture build servers and combine them to a multi-architecture image using the CI pipeline. You can also use tools that generate multi-architecture images from a single Dockerfile, such as Docker Buildx.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/hardware-patterns.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Ensure your containerized application is able to run on a variety of instance types and architectures.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/hardware-patterns.html',
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
			'How do you support your containerized application to run on energy-efficient hardware?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'It is crucial for containerized applications to support energy-efficient hardware because running on lower-power CPUs, SSDs, and memory can reduce energy costs and environmental impact for large-scale container deployments.',
			QuestionId: 'SUS2',
			QuestionTitle:
				'How do you support your containerized application to run on energy-efficient hardware?',
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
					'Use dynamically created build servers for building your containerized workload ',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Using dynamically created build servers (such as AWS CodeBuild), ensures that while building your containerized images, the needed infrastructure is being provisioned when the build process starts, and being terminated as soon as the build process ends. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/development-and-deployment-process.html',
				},
				ImprovementPlan: {
					DisplayText: 'Evaluate the use of AWS CodeBuild.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/development-and-deployment-process.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS3_2',
				Title:
					'Use pre-defined or built runtimes to reduce your build time, and reuse needed dependencies for the build process',
				Description: '',
				HelpfulResource: {
					DisplayText:
						' When building different types of containerized applications, using common and standardized runtimes for the build process reduces the operational management of creating and maintaining custom images. Also, by using the specific type of runtime for your build server, it verifies that no common dependency is being downloaded and configured as part of the build process. All relevant dependencies are being incorporated into the different runtimes of your build servers, and are being used many times by different build processes for different applications. An example of multiple build runtimes can be found in the AWS CodeBuild documentation. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/development-and-deployment-process.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Check multiple build runtimes available in AWS CodeBuild.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/development-and-deployment-process.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS3_3',
				Title: 'Update your parent and base image regularly',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'Update your base and parent images to the latest versions, as sometimes there is a performance improvement that is introduced in newer versions. These improvements are translated into a sustainability improvement as it affects the resource consumption of the underlying infrastructure, and as a result improves the overall efficiency. ',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/development-and-deployment-process.html',
				},
				ImprovementPlan: {
					DisplayText:
						'Create a mechanism to automate and simplify the update of parent and base images to the latest versions.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/development-and-deployment-process.html',
				},
				Context: {
					passed: [],
					failed: [],
					notapplicable: [],
					accountContext: [],
				},
			},
			{
				ChoiceId: 'SUS3_4',
				Title: 'Delete unused or obsolete container images',
				Description: '',
				HelpfulResource: {
					DisplayText:
						'As described in the Cost Optimization Pillar whitepaper, create mechanisms to verify that unused or obsolete container images are deleted. This can be achieved, for example, by registry lifecycle policies, as exists in Amazon ECR.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/development-and-deployment-process.html',
				},
				ImprovementPlan: {
					DisplayText: 'Configure lifecycle policies in Amazon ECR.',
					Url:
						'https://docs.aws.amazon.com/wellarchitected/latest/container-build-lens/development-and-deployment-process.html',
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
			'How do you design your build tooling and services to improve efficiency?',
		Risk: 'UNANSWERED',
		SelectedChoices: [],
		LensAlias: 'arn:aws:wellarchitected::aws:lens/containerbuild',
		AdditionalDetails: {
			ChoiceAnswers: [],
			HelpfulResourceUrl: '',
			IsApplicable: true,
			PillarId: 'sustainability',
			QuestionDescription:
				'It is important to design efficient build tooling and services for containerized applications in order to optimize image creation speed, resource usage, and reproducibility, enabling rapid deployment and scaling of container-based systems.',
			QuestionId: 'SUS3',
			QuestionTitle:
				'How do you design your build tooling and services to improve efficiency?',
			Risk: 'UNANSWERED',
		},
		RelatedAssessmentResults: [],
		Notes: '',
	},
];

export default questions;
