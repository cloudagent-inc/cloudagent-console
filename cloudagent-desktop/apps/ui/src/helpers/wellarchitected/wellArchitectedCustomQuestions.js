let waMapping = {
	security_permissions_access: {
		title: 'Permissions & Access Control',
		group: 'Security',
		question: `Do you store workload credentials securely in a purpose built service (e.g. Secret Manager)? And are those credentials rotated periodically?
Is there a policy defining access requirements, access life cycle, emergency access process, how to share access securely with a third party? Do you regularly review permissions to reduce unnecessary permissions? Finally, are there permission guardrails defined for the organization (e.g. SCP to restrict access to unused regions)
`,

		waQuestions: {
			sec_identities_secrets: {
				waMapping: 'SEC 2.3',
				waQuestionId: 'identities',
				waQuestionText: 'How do you manage identities for people and machines?',
				waChoiceText: 'Store and use secrets securely',
				condition:
					'True if they store workload credentials in purpose built services (e.g. Secrets Manager)',
				defaultTrueText:
					'Workload credentials are stored in a purpose-built service (e.g. Secrets Manager).',
				defaultFalseText:
					'Workload credentials are not stored in a purpose-built service (e.g. Secrets Manager).',
			},
			sec_identities_audit: {
				waMapping: 'SEC 2.5',
				waQuestionId: 'identities',
				waQuestionText: 'How do you manage identities for people and machines?',
				waChoiceText: 'Audit and rotate credentials periodically',
				condition: 'True if the workload credentials are rotated securely',
				defaultTrueText: 'Workload credentials are rotated securely.',
				defaultFalseText: 'Workload credentials are not rotated securely.',
			},
			sec_permissions_define: {
				waMapping: 'SEC 3.1',
				waQuestionId: 'permissions',
				waQuestionText:
					'How do you manage permissions for people and machines?',
				waChoiceText: 'Define access requirements',
				condition: 'True if there is a policy defining access requirements',
				defaultTrueText: 'A policy defining access requirements is in place.',
				defaultFalseText:
					'A policy defining access requirements is not in place.',
			},
			sec_permissions_define_guardrails: {
				waMapping: 'SEC 3.3',
				waQuestionId: 'permissions',
				waQuestionText:
					'How do you manage permissions for people and machines?',
				waChoiceText: 'Define permission guardrails for your organization',
				condition:
					'True if there are permission guardrails defined for the organization (e.g. use SCPs)',
				defaultTrueText:
					'Permission guardrails are defined for the organization (e.g. use SCPs).',
				defaultFalseText:
					'Permission guardrails are not defined for the organization (e.g. use SCPs).',
			},
			sec_permissions_emergency_process: {
				waMapping: 'SEC 3.4',
				waQuestionId: 'permissions',
				waQuestionText:
					'How do you manage permissions for people and machines?',
				waChoiceText: 'Establish emergency access process',
				condition: 'True if there is an emergency access process',
				defaultTrueText: 'There is an emergency access process in place.',
				defaultFalseText: 'There is no emergency access process in place.',
			},
			sec_permissions_continuous_reduction: {
				waMapping: 'SEC 3.6',
				waQuestionId: 'permissions',
				waQuestionText:
					'How do you manage permissions for people and machines?',
				waChoiceText: 'Reduce permissions continuously',
				condition:
					'True if permissions are reviewed regularly to reduce unnecessary permissions',
				defaultTrueText:
					'Permissions are reviewed regularly to reduce unnecessary permissions.',
				defaultFalseText:
					'Permissions are not reviewed regularly to reduce unnecessary permissions.',
			},
			sec_permissions_share_securely_third_party: {
				waMapping: 'SEC 3.7',
				waQuestionId: 'permissions',
				waQuestionText:
					'How do you manage permissions for people and machines?',
				waChoiceText: 'Share resources securely with a third party',
				condition:
					'True if there is a policy defining how to share credentials securely with third parties',
				defaultTrueText:
					'A policy for secure third-party credential sharing is in place.',
				defaultFalseText:
					'A policy for secure third-party credential sharing is not in place.',
			},
			sec_permissions_lifecycle: {
				waMapping: 'SEC 3.8',
				waQuestionId: 'permissions',
				waQuestionText:
					'How do you manage permissions for people and machines?',
				waChoiceText: 'Manage access based on life cycle',
				condition: 'True if there is a policy defining access lifecycle',
				defaultTrueText: 'There is a policy defining the access lifecycle.',
				defaultFalseText: 'There is no policy defining the access lifecycle.',
			},
		},
	},
	sec_appsec: {
		title: 'Workload & Application Security',
		group: 'Security',
		question: `Do you follow best practices for securing the workload and application such as identifying risks using a threat model, identifying and validating control objectives, separating workloads using AWS accounts, regular pentesting? Do you try using managed services to reduce your security tasks? 
Are you ensuring the security of the code deployment by deploying programmatically, including automated testing in the deployment pipelines, regularly assess the security of the pipelines, validating software integriy, and centralizing services for packages and dependencies? Are there manual code reviews as well?
Finally, are you ensuring the team is trained for application security, that there is a program that embeds security ownership in the workload team, and that new security services and features are regularly reviewed by the team?
`,

		waQuestions: {
			sec_securely_operate_multi_accounts: {
				waMapping: 'SEC 1.1',
				waQuestionId: 'securely-operate',
				waQuestionText: 'How do you securely operate your workload?',
				waChoiceText: 'Separate workloads using accounts',
				condition: 'True if they separate workloads using AWS accounts',
				defaultTrueText: 'Workloads are separated using AWS accounts.',
				defaultFalseText: 'Workloads are not separated using AWS accounts.',
			},
			sec_securely_operate_control_objectives: {
				waMapping: 'SEC 1.3',
				waQuestionId: 'securely-operate',
				waQuestionText: 'How do you securely operate your workload?',
				waChoiceText: 'Identify and validate control objectives',
				condition: 'True if they identify and validate control objectives',
				defaultTrueText: 'Control objectives are identified and validated.',
				defaultFalseText: 'Control objectives are not identified or validated.',
			},
			sec_securely_operate_automate_security_controls: {
				waMapping: 'SEC 1.7',
				waQuestionId: 'securely-operate',
				waQuestionText: 'How do you securely operate your workload?',
				waChoiceText:
					'Automate testing and validation of security controls in pipelines',
				condition:
					'True if automated testing is included in the deployment pipelines',
				defaultTrueText:
					'Security controls are tested and validated in deployment pipelines automatically.',
				defaultFalseText:
					'Security controls are not tested or validated in deployment pipelines automatically.',
			},
			sec_securely_operate_implement_services_features: {
				waMapping: 'SEC 1.8',
				waQuestionId: 'securely-operate',
				waQuestionText: 'How do you securely operate your workload?',
				waChoiceText:
					'Evaluate and implement new security services and features regularly',
				condition:
					'True if the team evaluates new security services and features regularly',
				defaultTrueText:
					'The team regularly evaluates new security services and features.',
				defaultFalseText:
					'The team does not regularly evaluate new security services and features.',
			},
			sec_securely_operate_reduce_management_scope: {
				waMapping: 'SEC 1.6',
				waQuestionId: 'securely-operate',
				waQuestionText: 'How do you securely operate your workload?',
				waChoiceText: 'Reduce security management scope',
				condition: 'True if they use managed services',
				defaultTrueText:
					'The workload uses managed services to reduce security management scope.',
				defaultFalseText:
					'The workload does not use managed services to reduce security management scope.',
			},
			sec_protect_compute_validate_software_integrity: {
				waMapping: '',
				waQuestionId: 'protect-compute',
				waQuestionText: 'How do you protect your compute resources?',
				waChoiceText: 'Validate software integrity',
				condition: 'True if they validate software integrity',
				defaultTrueText: 'Software integrity is validated.',
				defaultFalseText: 'Software integrity is not validated.',
			},
			sec_appsec_perform_regular_penetration_testing: {
				waMapping: 'SEC 11.1',
				waQuestionId: 'application-security',
				waQuestionText:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				waChoiceText: 'Perform regular penetration testing',
				condition: 'True if they perform regular pen testing',
				defaultTrueText: 'Regular penetration testing is performed.',
				defaultFalseText: 'Regular penetration testing is not performed.',
			},
			sec_appsec_deploy_software_programmatically: {
				waMapping: 'SEC 11.2',
				waQuestionId: 'application-security',
				waQuestionText:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				waChoiceText: 'Deploy software programmatically',
				condition: 'True if software is deployed programmatically',
				defaultTrueText: 'Software is deployed programmatically.',
				defaultFalseText: 'Software is not deployed programmatically.',
			},
			sec_appsec_regularly_assess_security_properties_of_pipelines: {
				waMapping: 'SEC 11.3',
				waQuestionId: 'application-security',
				waQuestionText:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				waChoiceText: 'Regularly assess security properties of the pipelines',
				condition:
					'True if they regularly assess the security of the pipelines',
				defaultTrueText:
					'The security properties of pipelines are regularly assessed.',
				defaultFalseText:
					'The security properties of pipelines are not regularly assessed.',
			},
			sec_appsec_train_for_application_security: {
				waMapping: 'SEC 11.4',
				waQuestionId: 'application-security',
				waQuestionText:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				waChoiceText: 'Train for application security',
				condition: 'True if the team is trained for application security',
				defaultTrueText: 'The team is trained for application security.',
				defaultFalseText: 'The team is not trained for application security.',
			},
			sec_appsec_automate_testing_throughout_lifecycle: {
				waMapping: 'SEC 11.5',
				waQuestionId: 'application-security',
				waQuestionText:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				waChoiceText:
					'Automate testing throughout the development and release lifecycle',
				condition:
					'True if automated testing is included in the deployment pipelines',
				defaultTrueText:
					'Automated testing is included throughout the development and release lifecycle.',
				defaultFalseText:
					'Automated testing is not included throughout the development and release lifecycle.',
			},
			sec_appsec_manual_code_reviews: {
				waMapping: 'SEC 11.6',
				waQuestionId: 'application-security',
				waQuestionText:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				waChoiceText: 'Manual code reviews',
				condition: 'True if there are manual code reviews',
				defaultTrueText: 'Manual code reviews are performed.',
				defaultFalseText: 'Manual code reviews are not performed.',
			},
			sec_appsec_centralize_services_for_packages_and_dependencies: {
				waMapping: 'SEC 11.7',
				waQuestionId: 'application-security',
				waQuestionText:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				waChoiceText: 'Centralize services for packages and dependencies',
				condition:
					'True if they are centralizing services for packages and dependencies',
				defaultTrueText:
					'Services for packages and dependencies are centralized.',
				defaultFalseText:
					'Services for packages and dependencies are not centralized.',
			},
			sec_appsec_build_program_that_embeds_security_ownership_in_teams: {
				waMapping: 'SEC 11.8',
				waQuestionId: 'application-security',
				waQuestionText:
					'How do you incorporate and validate the security properties of applications throughout the design, development, and deployment lifecycle?',
				waChoiceText:
					'Build a program that embeds security ownership in workload teams',
				condition:
					'True if there is a program that embeds security ownership in the workload team',
				defaultTrueText:
					'A program that embeds security ownership in workload teams is in place.',
				defaultFalseText:
					'A program that embeds security ownership in workload teams is not in place.',
			},
		},
	},
	sec_data: {
		title: 'Data Security',
		group: 'Security',
		question: `Do you have a process for defining data protection controls and data lifecycle management? Is data identification and classification automated? Are there mechnisms to prevent direct access to sensitive data during normal operations (e.g. using a change workflow to request the access)? Finally do you authenticate communication at the network level when accessing sensitive data (e.g. using TLS or IPSec)
Do you create network layers to group sensitive components (e.g. databases)? Do you use automated network protection mechanisms to restrict access from potential threat actors? 
`,

		waQuestions: {
			sec_network_protection_create_layers: {
				waMapping: 'SEC 5.1',
				waQuestionId: 'network-protection',
				waQuestionText: 'How do you protect your network resources?',
				waChoiceText: 'Create network layers',
				condition: 'True if they create network layers',
				defaultTrueText: 'Network layers are created to separate resources.',
				defaultFalseText:
					'Network layers are not created to separate resources.',
			},
			sec_network_protection_auto_protect: {
				waMapping: 'SEC 5.3',
				waQuestionId: 'network-protection',
				waQuestionText: 'How do you protect your network resources?',
				waChoiceText: 'Automate network protection',
				condition: 'True if they automate network protection',
				defaultTrueText: 'Network protection is automated.',
				defaultFalseText: 'Network protection is not automated.',
			},
			sec_data_classification_define_protection: {
				waMapping: 'SEC 7.2',
				waQuestionId: 'data-classification',
				waQuestionText: 'How do you classify your data?',
				waChoiceText: 'Define data protection controls',
				condition:
					'True if there is a process for defining data protection controls',
				defaultTrueText:
					'A process for defining data protection controls is in place.',
				defaultFalseText:
					'A process for defining data protection controls is not in place.',
			},
			sec_data_classification_auto_classification: {
				waMapping: 'SEC 7.4',
				waQuestionId: 'data-classification',
				waQuestionText: 'How do you classify your data?',
				waChoiceText: 'Automate identification and classification',
				condition:
					'True if data classification and identification is automated',
				defaultTrueText: 'Data classification and identification is automated.',
				defaultFalseText:
					'Data classification and identification is not automated.',
			},
			sec_data_classification_lifecycle_management: {
				waMapping: 'SEC 7.3',
				waQuestionId: 'data-classification',
				waQuestionText: 'How do you classify your data?',
				waChoiceText: 'Define scalable data lifecycle management',
				condition:
					'True if there is a process for defining data lifecycle management',
				defaultTrueText:
					'A process for defining data lifecycle management is in place.',
				defaultFalseText:
					'A process for defining data lifecycle management is not in place.',
			},
			sec_protect_data_rest_access_control: {
				waMapping: 'SEC 8.4',
				waQuestionId: 'protect-data-rest',
				waQuestionText: 'How do you protect your data at rest?',
				waChoiceText: 'Enforce access control',
				condition:
					'True if there are mechanisms for preventing direct access to sensitive data',
				defaultTrueText: 'Mechanisms prevent direct access to sensitive data.',
				defaultFalseText:
					'No mechanisms prevent direct access to sensitive data.',
			},
			sec_protect_data_transit_authentication: {
				waMapping: 'SEC 9.3',
				waQuestionId: 'protect-data-transit',
				waQuestionText: 'How do you protect your data in transit?',
				waChoiceText: 'Authenticate network communications',
				condition:
					'True if there is authentication on the network layer such as using TLS or IPSec',
				defaultTrueText:
					'Network communications are authenticated (e.g. TLS, IPSec).',
				defaultFalseText:
					'Network communications are not authenticated (e.g. TLS, IPSec).',
			},
		},
	},
	sec_incident_response: {
		title: 'Incident Response',
		group: 'Security',
		question: `Do you have an incident response (IR) process defined? This includes incident management plans, IR playbooks, and establishing frameworks for learning from incidents? This also includes preparing by identifying key personnel and resources, preparing forensic capabilities, pre-provisioning access and pre-deploying tools, and finally running simulations
`,

		waQuestions: {
			sec_incident_response_identify_personnel: {
				waMapping: 'SEC 10.1',
				waQuestionId: 'incident-response',
				waQuestionText:
					'How do you anticipate, respond to, and recover from incidents?',
				waChoiceText: 'Identify key personnel and external resources',
				condition:
					'True if they prepare by identifying key personnel and resources',
				defaultTrueText:
					'Key personnel and external resources are identified in advance.',
				defaultFalseText:
					'Key personnel and external resources are not identified in advance.',
			},
			sec_incident_response_develop_management_plans: {
				waMapping: 'SEC 10.2',
				waQuestionId: 'incident-response',
				waQuestionText:
					'How do you anticipate, respond to, and recover from incidents?',
				waChoiceText: 'Develop incident management plans',
				condition: 'True if they have incident management plans',
				defaultTrueText: 'Incident management plans are developed.',
				defaultFalseText: 'Incident management plans are not developed.',
			},
			sec_incident_response_prepare_forensic: {
				waMapping: 'SEC 10.3',
				waQuestionId: 'incident-response',
				waQuestionText:
					'How do you anticipate, respond to, and recover from incidents?',
				waChoiceText: 'Prepare forensic capabilities',
				condition: 'True if they prepare forensic capabilities',
				defaultTrueText: 'Forensic capabilities are prepared in advance.',
				defaultFalseText: 'Forensic capabilities are not prepared in advance.',
			},
			sec_incident_response_playbooks: {
				waMapping: 'SEC 10.4',
				waQuestionId: 'incident-response',
				waQuestionText:
					'How do you anticipate, respond to, and recover from incidents?',
				waChoiceText: 'Develop and test security incident response playbooks',
				condition: 'True if they developed incident response (IR) playbooks',
				defaultTrueText:
					'Incident response (IR) playbooks are developed and tested.',
				defaultFalseText:
					'Incident response (IR) playbooks are not developed or tested.',
			},
			sec_incident_response_pre_provision_access: {
				waMapping: 'SEC 10.5',
				waQuestionId: 'incident-response',
				waQuestionText:
					'How do you anticipate, respond to, and recover from incidents?',
				waChoiceText: 'Pre-provision access',
				condition: 'True if they pre-provisioned access',
				defaultTrueText: 'Access is pre-provisioned for incident response.',
				defaultFalseText:
					'Access is not pre-provisioned for incident response.',
			},
			sec_incident_response_run_game_days: {
				waMapping: 'SEC 10.6',
				waQuestionId: 'incident-response',
				waQuestionText:
					'How do you anticipate, respond to, and recover from incidents?',
				waChoiceText: 'Run simulations',
				condition: 'True if they prepared by running simulations',
				defaultTrueText: 'Simulations (e.g. game days) are regularly run.',
				defaultFalseText: 'Simulations (e.g. game days) are not regularly run.',
			},
			sec_incident_response_establish_incident_framework: {
				waMapping: 'SEC 10.7',
				waQuestionId: 'incident-response',
				waQuestionText:
					'How do you anticipate, respond to, and recover from incidents?',
				waChoiceText: 'Establish a framework for learning from incidents',
				condition:
					'True if they established a framework for learning from incidents',
				defaultTrueText:
					'A framework for learning from incidents is established.',
				defaultFalseText:
					'A framework for learning from incidents is not established.',
			},
			sec_incident_response_pre_deploy_tools: {
				waMapping: 'SEC 10.8',
				waQuestionId: 'incident-response',
				waQuestionText:
					'How do you anticipate, respond to, and recover from incidents?',
				waChoiceText: 'Pre-deploy tools',
				condition: 'True if they pepared by pre deploying tools',
				defaultTrueText:
					'Tools are pre-deployed to facilitate incident response.',
				defaultFalseText:
					'Tools are not pre-deployed to facilitate incident response.',
			},
		},
	},

	cost_1: {
		title: 'Cost Tooling',
		group: 'Cost Optimization',
		question: `Do you use any tools to manage cost (AWS Budgets and Cost Explorer or 3rd party tools with equivalent functionality) that can track all resources? 
Do the tools allow tagging resources for granular cost analysis?
Can you create budgets and forecasts with these tools? Do you use these tools to map resources to projects that might not be needed anymore? 
And is someone periodically and actively monitoring the output of these tools? 
`,
		examples: [],
		waQuestions: {
			cost_cloud_financial_management_usage_report: {
				waMapping: 'COST 1.8',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText: 'Report and notify on cost optimization',
				condition:
					'True if they use AWS Budgets or other 3rd party software to report on cost and can send notifications',
				defaultTrueText:
					'Cost reporting and notifications (e.g., AWS Budgets) are enabled.',
				defaultFalseText: 'Cost reporting and notifications are not enabled.',
			},
			cost_cloud_financial_management_proactive_process: {
				waMapping: 'COST 1.6',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText: 'Monitor cost proactively',
				condition:
					'True if there are cost monitoring tools to monitor costs and these tools are actively monitored',
				defaultTrueText:
					'Cost monitoring tools are in place and actively monitored.',
				defaultFalseText:
					'Cost monitoring tools are not in place or not actively monitored.',
			},
			cost_govern_usage_track_lifecycle: {
				waMapping: 'COST 2.6',
				waQuestionId: 'govern-usage',
				waQuestionText: 'How do you govern usage?',
				waChoiceText: 'Track project lifecycle',
				condition:
					'True if the cost monitoring tools are used to map resources to projects',
				defaultTrueText:
					'Resources are mapped to projects using cost monitoring tools.',
				defaultFalseText:
					'Resources are not mapped to projects using cost monitoring tools.',
			},
			cost_monitor_usage_detailed_source: {
				waMapping: 'COST 3.1',
				waQuestionId: 'monitor-usage',
				waQuestionText: 'How do you monitor usage and cost?',
				waChoiceText: 'Configure detailed information sources',
				condition:
					'True if tools such as Cost Explorer are used or an equivalent 3rd party tool',
				defaultTrueText:
					'Detailed cost information is configured (e.g., Cost Explorer).',
				defaultFalseText: 'Detailed cost information is not configured.',
			},
			cost_monitor_usage_config_tools: {
				waMapping: 'COST 3.4',
				waQuestionId: 'monitor-usage',
				waQuestionText: 'How do you monitor usage and cost?',
				waChoiceText: 'Configure billing and cost management tools',
				condition:
					'True if tools such as Budgets and Cost Explorer are used an equivalent 3rd party tool',
				defaultTrueText:
					'Billing and cost management tools (e.g., AWS Budgets, Cost Explorer) are configured.',
				defaultFalseText:
					'Billing and cost management tools are not configured.',
			},
			cost_monitor_usage_org_information: {
				waMapping: 'COST 3.5',
				waQuestionId: 'monitor-usage',
				waQuestionText: 'How do you monitor usage and cost?',
				waChoiceText: 'Add organization information to cost and usage',
				condition: 'True if resources are tagged for cost analysis',
				defaultTrueText:
					'Resources are tagged with organization information for cost analysis.',
				defaultFalseText:
					'Resources are not tagged with organization information for cost analysis.',
			},
			cost_decomissioning_resources_track: {
				waMapping: 'COST 4.1',
				waQuestionId: 'decomissioning-resources',
				waQuestionText: 'How do you decommission resources?',
				waChoiceText: 'Track resources over their life time',
				condition:
					'True if Cost Explorer or equivalent 3rd party tools are used to track all reosurces and support tagging for granular analysis',
				defaultTrueText:
					'Resource usage is tracked over its lifetime (e.g., via Cost Explorer).',
				defaultFalseText: 'Resource usage is not tracked over its lifetime.',
			},
			cost_select_service_analyze_all: {
				waMapping: 'COST 5.2',
				waQuestionId: 'select-service',
				waQuestionText: 'How do you evaluate cost when you select services?',
				waChoiceText: 'Analyze all components of this workload',
				condition:
					'True if Cost Explorer or equivalent 3rd party tools are used to track all resources',
				defaultTrueText:
					'All workload components are analyzed using cost tools.',
				defaultFalseText:
					'Not all workload components are analyzed using cost tools.',
			},
			cost_select_service_analyze_over_time: {
				waMapping: 'COST 5.5',
				waQuestionId: 'select-service',
				waQuestionText: 'How do you evaluate cost when you select services?',
				waChoiceText: 'Perform cost analysis for different usage over time',
				condition: 'True if cost reports are periodically reviewed',
				defaultTrueText: 'Cost reports are periodically reviewed over time.',
				defaultFalseText: 'Cost reports are not periodically reviewed.',
			},
		},
	},
	cost_2: {
		title: 'Dedicated Cost Function',
		group: 'Cost Optimization',
		question: `Do you have a dedicated team or function for managing cost? Usually this would involve someone from finance as well as the tech team, and would set budgets and forecasts. 
Does this team define policies for the organization, including employee awareness, cost guidelines (using savings plans, spot instances, etc.), mapping to business value, cost metrics and trackign attributes for workloads, and when to decomission resources. 
Does this team periodically review the data from cost tooling?
`,
		examples: [],
		waQuestions: {
			cost_cloud_financial_management_function: {
				waMapping: 'COST 1.1',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText: 'Establish ownership of cost optimization',
				condition:
					'True if there is a dedicated team or function for managing cost',
				defaultTrueText:
					'A dedicated team or function oversees cost optimization.',
				defaultFalseText:
					'No dedicated team or function oversees cost optimization.',
			},
			cost_cloud_financial_management_partnership: {
				waMapping: 'COST 1.2',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText: 'Establish a partnership between finance and technology',
				condition: 'True if someone from the finance team is involved ',
				defaultTrueText:
					'Finance and technology teams partner to manage costs.',
				defaultFalseText: 'Finance is not involved in cost management.',
			},
			cost_cloud_financial_management_budget_forecast: {
				waMapping: 'COST 1.3',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText: 'Establish cloud budgets and forecasts',
				condition: 'True if cloud budgets and forecasts are set',
				defaultTrueText: 'Cloud budgets and forecasts are established.',
				defaultFalseText: 'Cloud budgets and forecasts are not established.',
			},
			cost_cloud_financial_management_cost_awareness: {
				waMapping: 'COST 1.4',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText:
					'Implement cost awareness in your organizational processes',
				condition:
					"True if employee awareness is included in the organization's policies",
				defaultTrueText:
					'Cost awareness is embedded in organizational policies.',
				defaultFalseText:
					'Cost awareness is not included in organizational policies.',
			},
			cost_cloud_financial_management_quantify_value: {
				waMapping: 'COST 1.7',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText: 'Quantify business value from cost optimization',
				condition: 'True if cost is connected to business value',
				defaultTrueText:
					'Cost is tied to business value and measured accordingly.',
				defaultFalseText: 'Cost is not tied to business value.',
			},
			cost_cloud_financial_management_culture: {
				waMapping: 'COST 1.9',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText: 'Create a cost-aware culture',
				condition:
					"True if employee awareness is included in the organization's policies",
				defaultTrueText:
					'A cost-aware culture is fostered within the organization.',
				defaultFalseText:
					'A cost-aware culture is not fostered within the organization.',
			},
			cost_govern_usage_policies: {
				waMapping: 'COST 2.1',
				waQuestionId: 'govern-usage',
				waQuestionText: 'How do you govern usage?',
				waChoiceText:
					'Develop policies based on your organization requirements',
				condition:
					'True if there are organization policies defined that include cost',
				defaultTrueText: 'Organizational policies address cost management.',
				defaultFalseText:
					'Organizational policies do not address cost management.',
			},
			cost_govern_usage_goal_target: {
				waMapping: 'COST 2.2',
				waQuestionId: 'govern-usage',
				waQuestionText: 'How do you govern usage?',
				waChoiceText: 'Implement goals and targets',
				condition: 'True if budgets and forecasts are set',
				defaultTrueText:
					'Goals and targets for cost (budgets, forecasts) are implemented.',
				defaultFalseText: 'Goals and targets for cost are not implemented.',
			},
			cost_monitor_usage_define_attribution: {
				waMapping: 'COST 3.2',
				waQuestionId: 'monitor-usage',
				waQuestionText: 'How do you monitor usage and cost?',
				waChoiceText: 'Identify cost attribution categories',
				condition: 'True if cost guidelines are developed',
				defaultTrueText: 'Cost attribution categories are defined.',
				defaultFalseText: 'Cost attribution categories are not defined.',
			},
			cost_monitor_usage_define_kpi: {
				waMapping: 'COST 3.3',
				waQuestionId: 'monitor-usage',
				waQuestionText: 'How do you monitor usage and cost?',
				waChoiceText: 'Establish organization metrics',
				condition: 'True if cost metrics for workloads are defined',
				defaultTrueText: 'Organization metrics for cost are defined.',
				defaultFalseText: 'Organization metrics for cost are not defined.',
			},
			cost_monitor_usage_allocate_outcome: {
				waMapping: 'COST 3.6',
				waQuestionId: 'monitor-usage',
				waQuestionText: 'How do you monitor usage and cost?',
				waChoiceText: 'Allocate costs based on workload metrics',
				condition:
					'True if there are cost guidelines and workload metrics defined',
				defaultTrueText: 'Costs are allocated based on workload metrics.',
				defaultFalseText: 'Costs are not allocated based on workload metrics.',
			},
			cost_decomissioning_resources_implement_process: {
				waMapping: 'COST 4.2',
				waQuestionId: 'decomissioning-resources',
				waQuestionText: 'How do you decommission resources?',
				waChoiceText: 'Implement a decommissioning process',
				condition: 'True if there are policies for decommissioning resources',
				defaultTrueText: 'A decommissioning process is in place.',
				defaultFalseText: 'A decommissioning process is not in place.',
			},
			cost_decomissioning_resources_decommission: {
				waMapping: 'COST 4.3',
				waQuestionId: 'decomissioning-resources',
				waQuestionText: 'How do you decommission resources?',
				waChoiceText: 'Decommission resources',
				condition: 'True if there are policies for decommissioning resources',
				defaultTrueText: 'Resources are decommissioned according to policy.',
				defaultFalseText:
					'Resources are not decommissioned according to any policy.',
			},
			cost_select_service_requirements: {
				waMapping: 'COST 5.1',
				waQuestionId: 'select-service',
				waQuestionText: 'How do you evaluate cost when you select services?',
				waChoiceText: 'Identify organization requirements for cost',
				condition:
					'True if there are cost policies defined for the organization',
				defaultTrueText: 'Cost requirements for services are defined.',
				defaultFalseText: 'Cost requirements for services are not defined.',
			},
			cost_pricing_model_third_party: {
				waMapping: 'COST 7.3',
				waQuestionId: 'pricing-model',
				waQuestionText: 'How do you use pricing models to reduce cost?',
				waChoiceText: 'Select third-party agreements with cost-efficient terms',
				condition:
					'True if there are cost policies that include how to select 3rd party agreements',
				defaultTrueText: 'Cost policies guide third-party agreements.',
				defaultFalseText: 'Cost policies do not guide third-party agreements.',
			},
			cost_manage_demand_resources_cost_analysis: {
				waMapping: 'COST 9.1',
				waQuestionId: 'manage-demand-resources',
				waQuestionText: 'How do you manage demand, and supply resources?',
				waChoiceText: 'Perform an analysis on the workload demand',
				condition: 'True if the team reviews data from cost tooling',
				defaultTrueText:
					'Workload demand analysis is performed using cost tooling.',
				defaultFalseText:
					'Workload demand analysis is not performed using cost tooling.',
			},
			cost_evaluate_new_services_review_process: {
				waMapping: 'COST 10.1',
				waQuestionId: 'evaluate-new-services',
				waQuestionText: 'How do you evaluate new services?',
				waChoiceText: 'Develop a workload review process',
				condition: 'True if the team reviews data from cost tooling',
				defaultTrueText:
					'A workload review process using cost data is in place.',
				defaultFalseText:
					'No workload review process that uses cost data is in place.',
			},
			cost_evaluate_new_services_review_workload: {
				waMapping: 'COST 10.2',
				waQuestionId: 'evaluate-new-services',
				waQuestionText: 'How do you evaluate new services?',
				waChoiceText: 'Review and analyze this workload regularly',
				condition: 'True if the team reviews data from cost tooling',
				defaultTrueText:
					'Workloads are regularly reviewed and analyzed using cost data.',
				defaultFalseText:
					'Workloads are not regularly reviewed or analyzed using cost data.',
			},
		},
	},
	cost_3: {
		title: 'Technical Controls',
		group: 'Cost Optimization',
		question: `What kind of technical controls do you have (outside of monitoring): 
Do you a multi-account structure that maps to the org? 
Are there IAM groups and roles implemented to limit resource creation to authorized principals? 
Do you use IAM policies or SCPs to restrict resource creation (e.g. allowed regions)? 
Is there an automated process for decomissioning unused resources?
Are data retention policies enforced? 
	`,
		examples: [],
		waQuestions: {
			cost_govern_usage_account_structure: {
				waMapping: 'COST 2.3',
				waQuestionId: 'govern-usage',
				waQuestionText: 'How do you govern usage?',
				waChoiceText: 'Implement an account structure',
				condition:
					'True if there is a multi-account structure and it maps to the organization, Not Applicable if they have a reason to not use a multi-account structure, False if they dont have a multi-account structure that maps to the org',
				defaultTrueText:
					'A multi-account structure is implemented and aligned with the organization.',
				defaultFalseText:
					'No multi-account structure is aligned with the organization.',
			},
			cost_govern_usage_groups_roles: {
				waMapping: 'COST 2.5',
				waQuestionId: 'govern-usage',
				waQuestionText: 'How do you govern usage?',
				waChoiceText: 'Implement groups and roles',
				condition:
					'True if there are IAM groups and roles to limit who creates resources, False if there no controls to limit who can create resources',
				defaultTrueText: 'IAM groups and roles limit resource creation.',
				defaultFalseText: 'No IAM groups or roles limit resource creation.',
			},
			cost_govern_usage_controls: {
				waMapping: 'COST 2.4',
				waQuestionId: 'govern-usage',
				waQuestionText: 'How do you govern usage?',
				waChoiceText: 'Implement cost controls',
				condition:
					'True if there IAM policies or SCPs to limit resource creation or if they limit access to regions, False if they dont use SCPs and dont control resource creation by region',
				defaultTrueText:
					'IAM policies or SCPs are used to limit resource creation (e.g., region restrictions).',
				defaultFalseText:
					'No IAM policies or SCPs limit resource creation or region usage.',
			},
			cost_decomissioning_resources_decomm_automated: {
				waMapping: 'COST 4.5',
				waQuestionId: 'decomissioning-resources',
				waQuestionText: 'How do you decommission resources?',
				waChoiceText: 'Decommission resources automatically',
				condition:
					"True if there is an automated process for decommissioning resources, Not Applicable if they have a reason why they cannot do this in their organization, False if they don't have an automated process for decomissioning unused resources",
				defaultTrueText: 'Resources are automatically decommissioned.',
				defaultFalseText: 'Resources are not automatically decommissioned.',
			},
			cost_decomissioning_resources_data_retention: {
				waMapping: 'COST 4.4',
				waQuestionId: 'decomissioning-resources',
				waQuestionText: 'How do you decommission resources?',
				waChoiceText: 'Enforce data retention policies',
				condition: 'True if data retention policies are enforced',
				defaultTrueText: 'Data retention policies are enforced.',
				defaultFalseText: 'Data retention policies are not enforced.',
			},
		},
	},
	cost_4: {
		title: 'Review Process',
		group: 'Cost Optimization',
		question: `When designing a new workload or reviewing an existing one, do you include the cost in the analysis (including data transfer costs, savings plans, and region costs)?
Are resources of the workload sized following your cost policy, including select cost-effective licensing?
Do you set up technical controls to automatically meet those metrics (e.g. scaling, Caching, Buffering, Direct Connect, etc.)?
Do you keep up with the latest AWS services and releases to see if you can leverage new features (including their cost and potential cost savings)?
	`,
		examples: [
			"- Yes we include all the above items when designing a new workload and sizing resources for workloads, but we don't have any automated controls at the moment. We also keep up with latest aws services and releases",
		],
		waQuestions: {
			cost_cloud_financial_management_scheduled: {
				waMapping: 'COST 1.6',
				waQuestionId: 'cloud-financial-management',
				waQuestionText: 'How do you implement cloud financial management?',
				waChoiceText: 'Keep up-to-date with new service releases',
				condition: 'True if they keep up with latest AWS services and releases',
				defaultTrueText:
					'The organization keeps up-to-date with new AWS services and releases.',
				defaultFalseText:
					'The organization does not keep up-to-date with new AWS services and releases.',
			},
			cost_select_service_thorough_analysis: {
				waMapping: 'COST 5.3',
				waQuestionId: 'select-service',
				waQuestionText: 'How do you evaluate cost when you select services?',
				waChoiceText: 'Perform a thorough analysis of each component',
				condition: 'True if they include cost in the analysis of a workload',
				defaultTrueText: 'Cost is included in the workload analysis.',
				defaultFalseText: 'Cost is not included in the workload analysis.',
			},
			cost_select_service_licensing: {
				waMapping: 'COST 5.6',
				waQuestionId: 'select-service',
				waQuestionText: 'How do you evaluate cost when you select services?',
				waChoiceText: 'Select software with cost effective licensing',
				condition:
					'True if they select cost-effective licensing for the workload',
				defaultTrueText: 'Cost-effective software licensing is used.',
				defaultFalseText: 'Cost-effective software licensing is not used.',
			},
			cost_select_service_select_for_cost: {
				waMapping: 'COST 5.4',
				waQuestionId: 'select-service',
				waQuestionText: 'How do you evaluate cost when you select services?',
				waChoiceText:
					'Select components of this workload to optimize cost in line with organization priorities',
				condition:
					'True if workloads are sized in accordance with cost policies',
				defaultTrueText: 'Components are chosen and sized per cost policies.',
				defaultFalseText:
					'Components are not chosen or sized per cost policies.',
			},
			cost_type_size_number_resources_cost_modeling: {
				waMapping: 'COST 6.1',
				waQuestionId: 'type-size-number-resources',
				waQuestionText:
					'How do you meet cost targets when you select resource type, size and number?',
				waChoiceText: 'Perform cost modeling',
				condition:
					'True if workloads are sized in accordance with cost policies',
				defaultTrueText: 'Workload sizing is determined through cost modeling.',
				defaultFalseText:
					'Workload sizing is not determined through cost modeling.',
			},
			cost_type_size_number_resources_data: {
				waMapping: 'COST 6.2',
				waQuestionId: 'type-size-number-resources',
				waQuestionText:
					'How do you meet cost targets when you select resource type, size and number?',
				waChoiceText: 'Select resource type, size, and number based on data',
				condition:
					'True if workloads are sized in accordance with cost policies',
				defaultTrueText:
					'Resource type, size, and number are selected based on data.',
				defaultFalseText:
					'Resource type, size, and number are not selected based on data.',
			},
			cost_type_size_number_resources_metrics: {
				waMapping: 'COST 6.3',
				waQuestionId: 'type-size-number-resources',
				waQuestionText:
					'How do you meet cost targets when you select resource type, size and number?',
				waChoiceText:
					'Select resource type, size, and number automatically based on metrics',
				condition:
					'True if automatic controls are used to adjust workload sizing',
				defaultTrueText:
					'Resource sizing is automatically adjusted based on metrics.',
				defaultFalseText:
					'Resource sizing is not automatically adjusted based on metrics.',
			},
			cost_pricing_model_analysis: {
				waMapping: 'COST 7.1',
				waQuestionId: 'pricing-model',
				waQuestionText: 'How do you use pricing models to reduce cost?',
				waChoiceText: 'Perform pricing model analysis',
				condition: 'True if savings plans are factored in',
				defaultTrueText:
					'Pricing model analysis (e.g., savings plans) is performed.',
				defaultFalseText: 'Pricing model analysis is not performed.',
			},
			cost_pricing_model_region_cost: {
				waMapping: 'COST 7.2',
				waQuestionId: 'pricing-model',
				waQuestionText: 'How do you use pricing models to reduce cost?',
				waChoiceText: 'Implement regions based on cost',
				condition:
					'True if cost analysis is done and region costs are factored in, Not Applicable if there is a reason why they have to use specific regions',
				defaultTrueText: 'Region selection includes cost analysis.',
				defaultFalseText: 'Region selection does not include cost analysis.',
			},
			cost_data_transfer_modeling: {
				waMapping: 'COST 8.1',
				waQuestionId: 'data-transfer',
				waQuestionText: 'How do you plan for data transfer charges?',
				waChoiceText: 'Perform data transfer modeling',
				condition:
					'True if cost analysis is done and include data transfer costs',
				defaultTrueText: 'Data transfer modeling is performed.',
				defaultFalseText: 'Data transfer modeling is not performed.',
			},
			cost_data_transfer_optimized_components: {
				waMapping: 'COST 8.2',
				waQuestionId: 'data-transfer',
				waQuestionText: 'How do you plan for data transfer charges?',
				waChoiceText: 'Select components to optimize data transfer cost',
				condition:
					'True if workloads are sized is in accordance with the cost policy',
				defaultTrueText:
					'Components are selected to optimize data transfer costs.',
				defaultFalseText:
					'Components are not selected to optimize data transfer costs.',
			},
			cost_data_transfer_implement_services: {
				waMapping: 'COST 8.3',
				waQuestionId: 'data-transfer',
				waQuestionText: 'How do you plan for data transfer charges?',
				waChoiceText: 'Implement services to reduce data transfer costs',
				condition:
					'True if technical services and features (e.g. Caching) are set up to meet the metrics',
				defaultTrueText:
					'Services and features (e.g., caching) reduce data transfer costs.',
				defaultFalseText:
					'Services and features are not implemented to reduce data transfer costs.',
			},
			cost_manage_demand_resources_buffer_throttle: {
				waMapping: 'COST 9.2',
				waQuestionId: 'manage-demand-resources',
				waQuestionText: 'How do you manage demand, and supply resources?',
				waChoiceText: 'Implement a buffer or throttle to manage demand',
				condition:
					'True if technical services and features (e.g. Buffering) are set up to meet the metrics',
				defaultTrueText:
					'Buffering or throttling is implemented to manage demand.',
				defaultFalseText:
					'No buffering or throttling is implemented to manage demand.',
			},
			cost_manage_demand_resources_dynamic: {
				waMapping: 'COST 9.3',
				waQuestionId: 'manage-demand-resources',
				waQuestionText: 'How do you manage demand, and supply resources?',
				waChoiceText: 'Supply resources dynamically',
				condition:
					'True if technical services and features (e.g. Auto Scaling) are set up to meet the metrics',
				defaultTrueText:
					'Resources are supplied dynamically (e.g., Auto Scaling).',
				defaultFalseText: 'Resources are not supplied dynamically.',
			},
			cost_evaluate_cost_effort_automations_operations: {
				waMapping: 'COST 11.1',
				waQuestionId: 'evaluate-cost-effort',
				waQuestionText: 'How do you evaluate the cost of effort?',
				waChoiceText: 'Perform automation for operations',
				condition:
					'True if the team keeps up with new AWS services and releases, especially if they include cost in the review',
				defaultTrueText: 'Cost for new services and features are evaluated',
				defaultFalseText:
					'Cost for new services and features are not evaluated',
			},
		},
	},
	perf_1: {
		title: 'Process & Continuous Improvement',
		group: 'Performance Efficiency',
		question: `Do you have an explicit process for setting and evaluating performance efficiency? 
This includes creating policies and setting metrics, benchmarks and KPIs, setting monitoring and alerting requirements, factoring costs, keeping up with the latest releases, and evaluating tradeoffs.
The process would also cover continuous improvement by ensuring the use of monitoring systems, reviewing metrics regularly, incorporating load testing for the workload and implementing automation to remediate performance-related issues
`,
		examples: [
			"- Yes, we have a process that includes all the above but we don't do regular reviews or reevaluations at this time. We also don't have a process to document decisions properly including tradeoffs made in the design",
		],
		waQuestions: {
			perf_architecture_understand_cloud_services_and_features: {
				waMapping: 'PERF 1.1',
				waQuestionId: 'performing-architecture',
				waQuestionText:
					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
				waChoiceText:
					'Learn about and understand available cloud services and features',
				condition:
					'True if there is a process for setting performance efficiency',
				defaultTrueText:
					'A formal process exists to learn and understand available cloud services and features.',
				defaultFalseText:
					'No formal process exists to learn and understand available cloud services and features.',
			},
			perf_architecture_evaluate_trade_offs: {
				waMapping: 'PERF 1.2',
				waQuestionId: 'performing-architecture',
				waQuestionText:
					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
				waChoiceText:
					'Evaluate how trade-offs impact customers and architecture efficiency',
				condition: 'True if the process includes evaluating tradeoffs',
				defaultTrueText:
					'Trade-offs are explicitly evaluated for impact on customers and efficiency.',
				defaultFalseText:
					'Trade-offs are not explicitly evaluated for impact on customers and efficiency.',
			},
			perf_architecture_factor_cost_into_architectural_decisions: {
				waMapping: 'PERF 1.4',
				waQuestionId: 'performing-architecture',
				waQuestionText:
					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
				waChoiceText: 'Factor cost into architectural decisions',
				condition: 'True if the process includes factoring costs ',
				defaultTrueText: 'Cost is factored into architectural decisions.',
				defaultFalseText: 'Cost is not factored into architectural decisions.',
			},
			perf_architecture_use_policies_and_reference_architectures: {
				waMapping: 'PERF 1.5',
				waQuestionId: 'performing-architecture',
				waQuestionText:
					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
				waChoiceText: 'Use policies and reference architectures',
				condition:
					'True if there is a process for setting performance efficiency',
				defaultTrueText:
					'Policies and reference architectures are used to guide performance efficiency.',
				defaultFalseText:
					'Policies and reference architectures are not used to guide performance efficiency.',
			},
			perf_architecture_use_benchmarking: {
				waMapping: 'PERF 1.6',
				waQuestionId: 'performing-architecture',
				waQuestionText:
					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
				waChoiceText: 'Use benchmarking to drive architectural decisions',
				condition:
					'True if the process includes setting benchmarks and metrics',
				defaultTrueText:
					'Benchmarking data is used to inform architectural decisions.',
				defaultFalseText:
					'Benchmarking data is not used to inform architectural decisions.',
			},
			perf_architecture_use_data_driven_approach: {
				waMapping: 'PERF 1.7',
				waQuestionId: 'performing-architecture',
				waQuestionText:
					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
				waChoiceText: 'Use a data-driven approach for architectural choices',
				condition:
					'True if the process includes setting benchmarks and metrics',
				defaultTrueText:
					'A data-driven approach is used for architectural choices.',
				defaultFalseText:
					'A data-driven approach is not used for architectural choices.',
			},
			perf_process_culture_establish_key_performance_indicators: {
				waMapping: 'PERF 5.1',
				waQuestionId: 'process-culture',
				waQuestionText:
					'What process do you use to support more performance efficiency for your workload?',
				waChoiceText:
					'Establish key performance indicators (KPIs) to measure workload health and performance',
				condition: 'True if the process includes setting KPIs',
				defaultTrueText:
					'Key performance indicators are established to measure workload health.',
				defaultFalseText:
					'No key performance indicators are established to measure workload health.',
			},
			perf_process_culture_use_monitoring_solutions: {
				waMapping: 'PERF 5.2',
				waQuestionId: 'process-culture',
				waQuestionText:
					'What process do you use to support more performance efficiency for your workload?',
				waChoiceText:
					'Use monitoring solutions to understand the areas where performance is most critical',
				condition: 'True if they use monitoring solutions for the workload',
				defaultTrueText:
					'Monitoring solutions are in place for critical performance insights.',
				defaultFalseText:
					'No monitoring solutions are in place for performance insights.',
			},
			perf_process_culture_workload_performance: {
				waMapping: 'PERF 5.3',
				waQuestionId: 'process-culture',
				waQuestionText:
					'What process do you use to support more performance efficiency for your workload?',
				waChoiceText: 'Define a process to improve workload performance',
				condition:
					'True if there is a process for evaluating performance efficiency ',
				defaultTrueText:
					'A defined process exists to improve workload performance.',
				defaultFalseText:
					'No defined process exists to improve workload performance.',
			},
			perf_process_culture_review_metrics: {
				waMapping: 'PERF 5.4',
				waQuestionId: 'process-culture',
				waQuestionText:
					'What process do you use to support more performance efficiency for your workload?',
				waChoiceText: 'Review metrics at regular intervals',
				condition: 'True if the proces includes reviewing metrics',
				defaultTrueText: 'Metrics are reviewed on a regular schedule.',
				defaultFalseText: 'Metrics are not reviewed on a regular schedule.',
			},
			perf_process_culture_load_test: {
				waMapping: 'PERF 5.5',
				waQuestionId: 'process-culture',
				waQuestionText:
					'What process do you use to support more performance efficiency for your workload?',
				waChoiceText: 'Load test your workload',
				condition: 'True if they incorporate load testing for the workload',
				defaultTrueText:
					'Load testing is incorporated into the workload process.',
				defaultFalseText:
					'Load testing is not incorporated into the workload process.',
			},
			perf_process_culture_automation_remediate_issues: {
				waMapping: 'PERF 5.6',
				waQuestionId: 'process-culture',
				waQuestionText:
					'What process do you use to support more performance efficiency for your workload?',
				waChoiceText:
					'Use automation to proactively remediate performance-related issues',
				condition:
					'True if they have set up automatic remediation for performance related issues',
				defaultTrueText:
					'Automation is used to proactively remediate performance issues.',
				defaultFalseText:
					'No automated processes remediate performance issues.',
			},
			perf_process_culture_keep_workload_and_services_up_to_date: {
				waMapping: 'PERF 5.7',
				waQuestionId: 'process-culture',
				waQuestionText:
					'What process do you use to support more performance efficiency for your workload?',
				waChoiceText: 'Keep your workload and services up-to-date',
				condition:
					'True if the process includes keeping up with the latest releases',
				defaultTrueText:
					'The process includes keeping workload and services up-to-date.',
				defaultFalseText:
					'The process does not include keeping workload and services up-to-date.',
			},
		},
	},
	perf_2: {
		title: 'Evaluation & Optimization',
		group: 'Performance Efficiency',
		question: `When designing a new workload, do you do the following for Compute/Data/Database/Networking components: Evaluate different options, set up metric collections and right-size the resource based on those metrics? Do you continuously optimize based on metrics collected? 
Do you factor in options like dynamic scaling, caching, load balancing, buffering, etc. that improve performance when designing the application?
Do you consider hardware-based accelerators for compute? Or dedicated connectivity options (or VPN) for the workload?
`,
		examples: [
			"- We do all the above for all components but we don't have a database component in our workload. We also try to continuously optimize our workloads based on metrics and we use those technical controls mentioned to improve performance",
		],
		waQuestions: {
			perf_compute_hardware_select_best_compute_options: {
				waMapping: 'PERF 2.1',
				waQuestionId: 'compute-hardware',
				waQuestionText:
					'How do you select and use compute resources in your workload?',
				waChoiceText: 'Select the best compute options for your workload',
				condition: 'True if they evaluate different options ',
				defaultTrueText:
					'Different compute options are evaluated to select the best fit.',
				defaultFalseText:
					'Different compute options are not evaluated to select the best fit.',
			},
			perf_compute_hardware_collect_compute_related_metrics: {
				waMapping: 'PERF 2.2',
				waQuestionId: 'compute-hardware',
				waQuestionText:
					'How do you select and use compute resources in your workload?',
				waChoiceText: 'Collect compute-related metrics',
				condition: 'True if they set up metric collections',
				defaultTrueText: 'Compute metrics are collected.',
				defaultFalseText: 'Compute metrics are not collected.',
			},
			perf_compute_hardware_scale_compute_resources_dynamically: {
				waMapping: 'PERF 2.3',
				waQuestionId: 'compute-hardware',
				waQuestionText:
					'How do you select and use compute resources in your workload?',
				waChoiceText: 'Scale your compute resources dynamically',
				condition: 'True if they factor in scaling options in their design ',
				defaultTrueText:
					'Compute resources are scaled dynamically based on demand.',
				defaultFalseText:
					'Compute resources are not scaled dynamically based on demand.',
			},
			perf_compute_hardware_understand_compute_configuration_features: {
				waMapping: 'PERF 2.4',
				waQuestionId: 'compute-hardware',
				waQuestionText:
					'How do you select and use compute resources in your workload?',
				waChoiceText:
					'Understand the available compute configuration and features',
				condition: 'True if they evaluate different options ',
				defaultTrueText:
					'Available compute configurations and features are reviewed.',
				defaultFalseText:
					'Available compute configurations and features are not reviewed.',
			},
			perf_compute_hardware_configure_and_right_size_compute_resources: {
				waMapping: 'PERF 2.5',
				waQuestionId: 'compute-hardware',
				waQuestionText:
					'How do you select and use compute resources in your workload?',
				waChoiceText: 'Configure and right-size compute resources',
				condition: 'True if they right-size resources based on metrics',
				defaultTrueText:
					'Resources are right-sized based on collected metrics.',
				defaultFalseText: 'Resources are not right-sized based on metrics.',
			},
			perf_compute_hardware_compute_accelerators: {
				waMapping: 'PERF 2.6',
				waQuestionId: 'compute-hardware',
				waQuestionText:
					'How do you select and use compute resources in your workload?',
				waChoiceText: 'Use optimized hardware-based compute accelerators',
				condition:
					'True if they consider hardware based accelerators for compute',
				defaultTrueText: 'Hardware-based compute accelerators are considered.',
				defaultFalseText:
					'Hardware-based compute accelerators are not considered.',
			},
			perf_data_use_purpose_built_data_store: {
				waMapping: 'PERF 3.1',
				waQuestionId: 'data-management',
				waQuestionText:
					'How do you store, manage, and access data in your workload?',
				waChoiceText:
					'Use purpose-built data store that best support your data access and storage requirements',
				condition: 'True if they evaluate different options ',
				defaultTrueText:
					'Different data store options are evaluated to find the best fit.',
				defaultFalseText:
					'No evaluation is done for different data store options.',
			},
			perf_data_collect_record_data_store_performance_metrics: {
				waMapping: 'PERF 3.2',
				waQuestionId: 'data-management',
				waQuestionText:
					'How do you store, manage, and access data in your workload?',
				waChoiceText: 'Collect and record data store performance metrics',
				condition: 'True if they set up metric collections',
				defaultTrueText: 'Performance metrics for data stores are collected.',
				defaultFalseText:
					'Performance metrics for data stores are not collected.',
			},
			perf_data_evaluate_configuration_options_data_store: {
				waMapping: 'PERF 3.3',
				waQuestionId: 'data-management',
				waQuestionText:
					'How do you store, manage, and access data in your workload?',
				waChoiceText: 'Evaluate available configuration options for data store',
				condition: 'True if they evaluate different options ',
				defaultTrueText: 'Configuration options for data stores are evaluated.',
				defaultFalseText:
					'Configuration options for data stores are not evaluated.',
			},
			perf_data_implement_strategies_to_improve_query_performance: {
				waMapping: 'PERF 3.4',
				waQuestionId: 'data-management',
				waQuestionText:
					'How do you store, manage, and access data in your workload?',
				waChoiceText:
					'Implement strategies to improve query performance in data store',
				condition: 'True if they factor in scaling options in their design ',
				defaultTrueText:
					'Query performance strategies (e.g., indexing, partitioning) are implemented.',
				defaultFalseText: 'No query performance strategies are implemented.',
			},
			perf_data_access_patterns_caching: {
				waMapping: 'PERF 3.5',
				waQuestionId: 'data-management',
				waQuestionText:
					'How do you store, manage, and access data in your workload?',
				waChoiceText: 'Implement data access patterns that utilize caching',
				condition:
					'True if they factor in scaling options in their design like caching',
				defaultTrueText: 'Caching is used to improve data access patterns.',
				defaultFalseText:
					'Caching is not used to improve data access patterns.',
			},
			perf_networking_understand_how_networking_impacts_performance: {
				waMapping: 'PERF 4.1',
				waQuestionId: 'networking',
				waQuestionText:
					'How do you select and configure networking resources in your workload?',
				waChoiceText: 'Understand how networking impacts performance',
				condition: 'True if they set up metric collections',
				defaultTrueText:
					'Networking metrics are collected and analyzed for performance impact.',
				defaultFalseText:
					'Networking metrics are not collected or analyzed for performance impact.',
			},
			perf_networking_evaluate_networking_features: {
				waMapping: 'PERF 4.2',
				waQuestionId: 'networking',
				waQuestionText:
					'How do you select and configure networking resources in your workload?',
				waChoiceText: 'Evaluate available networking features',
				condition: 'True if they evaluate different options ',
				defaultTrueText: 'Different networking features are evaluated.',
				defaultFalseText: 'Networking features are not evaluated.',
			},
			perf_networking_choose_appropriate_dedicated_connectivity_or_vpn: {
				waMapping: 'PERF 4.3',
				waQuestionId: 'networking',
				waQuestionText:
					'How do you select and configure networking resources in your workload?',
				waChoiceText:
					'Choose appropriate dedicated connectivity or VPN for your workload',
				condition:
					'True if they set up dedicated connectivity options or VPN for the workload',
				defaultTrueText:
					'Dedicated connectivity or VPN solutions are used as appropriate.',
				defaultFalseText:
					'No dedicated connectivity or VPN solutions are used.',
			},
			perf_networking_load_balancing_distribute_traffic: {
				waMapping: 'PERF 4.4',
				waQuestionId: 'networking',
				waQuestionText:
					'How do you select and configure networking resources in your workload?',
				waChoiceText:
					'Use load balancing to distribute traffic across multiple resources',
				condition:
					'True if they factor in scaling options in their design like load balancing',
				defaultTrueText: 'Load balancing is utilized to distribute traffic.',
				defaultFalseText:
					'Load balancing is not utilized to distribute traffic.',
			},
			perf_networking_choose_network_protocols_improve_performance: {
				waMapping: 'PERF 4.5',
				waQuestionId: 'networking',
				waQuestionText:
					'How do you select and configure networking resources in your workload?',
				waChoiceText: 'Choose network protocols to improve performance',
				condition: 'True if they evaluate different options ',
				defaultTrueText:
					'Network protocols are chosen to optimize performance.',
				defaultFalseText:
					'Network protocols are not chosen to optimize performance.',
			},
			perf_networking_choose_workload_location_network_requirements: {
				waMapping: 'PERF 4.6',
				waQuestionId: 'networking',
				waQuestionText:
					'How do you select and configure networking resources in your workload?',
				waChoiceText:
					"Choose your workload's location based on network requirements",
				condition: 'True if they evaluate different options ',
				defaultTrueText:
					'Workload location is selected based on network requirements.',
				defaultFalseText:
					'Workload location is not selected based on network requirements.',
			},
			perf_networking_optimize_network_configuration_based_on_metrics: {
				waMapping: 'PERF 4.7',
				waQuestionId: 'networking',
				waQuestionText:
					'How do you select and configure networking resources in your workload?',
				waChoiceText: 'Optimize network configuration based on metrics',
				condition:
					'True if they continuously optimize based on metrics collected',
				defaultTrueText:
					'Network configuration is continuously optimized based on metrics.',
				defaultFalseText:
					'Network configuration is not optimized based on metrics.',
			},
		},
	},
	ops_org_culture: {
		title: 'Organization & Culture',
		group: 'Operational Excellence',
		question: `Is responsibility & ownership clear in your organization? For example, do resources, processes and operation activities have clear owners? Is there a process for identifying ownership or requesting changes when needed? 
Are there clear escalation paths when things are not clear, and is escalation encouraged? 
Are team members sufficiently resourced, are supported to grow and experiment, and are able to share differing opinions when necessary? 
Are expectations clearly set by senior leadership? And are communications clear and timely?
`,
		waQuestions: {
			ops_ops_model_def_resource_owners: {
				waMapping: 'OPS 2.1',
				waQuestionId: 'ops-model',
				waQuestionText:
					'How do you structure your organization to support your business outcomes?',
				waChoiceText: 'Resources have identified owners',
				condition:
					'True if responsibility and ownership are clear in the orgnization and resources have clear owners',
				defaultTrueText: 'All resources have clearly identified owners.',
				defaultFalseText: 'Resources do not have clearly identified owners.',
			},
			ops_ops_model_def_proc_owners: {
				waMapping: 'OPS 2.2',
				waQuestionId: 'ops-model',
				waQuestionText:
					'How do you structure your organization to support your business outcomes?',
				waChoiceText: 'Processes and procedures have identified owners',
				condition:
					'True if responsibility and ownership are clear in the orgnization and processes have clear owners',
				defaultTrueText:
					'Processes and procedures have clearly identified owners.',
				defaultFalseText:
					'Processes and procedures do not have clearly identified owners.',
			},
			ops_ops_model_def_activity_owners: {
				waMapping: 'OPS 2.3',
				waQuestionId: 'ops-model',
				waQuestionText:
					'How do you structure your organization to support your business outcomes?',
				waChoiceText:
					'Operations activities have identified owners responsible for their performance',
				condition:
					'True if responsibility and ownership are clear in the orgnization and operations activities have clear owners',
				defaultTrueText:
					'Operations activities have clearly identified owners.',
				defaultFalseText:
					'Operations activities do not have clearly identified owners.',
			},
			ops_ops_model_def_responsibilities_ownership: {
				waMapping: 'OPS 2.4',
				waQuestionId: 'ops-model',
				waQuestionText:
					'How do you structure your organization to support your business outcomes?',
				waChoiceText:
					'Mechanisms exist to manage responsibilities and ownership',
				condition:
					'True if responsibility and ownership are clear in the orgnization',
				defaultTrueText:
					'Team members have a clear understanding of their responsibilities.',
				defaultFalseText:
					'Team members do not have a clear understanding of their responsibilities.',
			},
			ops_ops_model_req_add_chg_exception: {
				waMapping: 'OPS 2.5',
				waQuestionId: 'ops-model',
				waQuestionText:
					'How do you structure your organization to support your business outcomes?',
				waChoiceText:
					'Mechanisms exist to request additions, changes, and exceptions',
				condition:
					'True if there is a process to make change requests to the owners of processes and procedures',
				defaultTrueText:
					'Mechanisms exist to make change requests to processes and procedures.',
				defaultFalseText:
					'No mechanisms exist to make change requests to processes and procedures.',
			},
			ops_ops_model_req_add_chg_exception: {
				waMapping: 'OPS 2.6',
				waQuestionId: 'ops-model',
				waQuestionText:
					'How do you structure your organization to support your business outcomes?',
				waChoiceText:
					'Mechanisms exist to request additions, changes, and exceptions',
				condition:
					'True if there is a process to make changes to ownership when needed',
				defaultTrueText:
					'A clear process exists to request changes in ownership.',
				defaultFalseText:
					'No clear process exists to request changes in ownership.',
			},
			ops_ops_model_def_neg_team_agreements: {
				waMapping: 'OPS 2.7',
				waQuestionId: 'ops-model',
				waQuestionText:
					'How do you structure your organization to support your business outcomes?',
				waChoiceText:
					'Responsibilities between teams are predefined or negotiated',
				condition:
					'True if responsibility and ownership are clear in the orgnization',
				defaultTrueText:
					'Responsibilities between teams are predefined or negotiated.',
				defaultFalseText:
					'Responsibilities between teams are not predefined or negotiated.',
			},
			ops_org_culture_executive_sponsor: {
				waMapping: 'OPS 3.1',
				waQuestionId: 'org-culture',
				waQuestionText:
					'How does your organizational culture support your business outcomes?',
				waChoiceText: 'Provide executive sponsorship',
				condition: 'True if expecations are clearly set by senior leadership',
				defaultTrueText:
					'Senior leadership sets clear expectations and provides sponsorship.',
				defaultFalseText:
					'Senior leadership does not set clear expectations or provide sponsorship.',
			},
			ops_org_culture_team_emp_take_action: {
				waMapping: 'OPS 3.4',
				waQuestionId: 'org-culture',
				waQuestionText:
					'How does your organizational culture support your business outcomes?',
				waChoiceText:
					'Team members are empowered to take action when outcomes are at risk',
				condition: 'True if team members are supported',
				defaultTrueText:
					'Team members are empowered to take action when necessary.',
				defaultFalseText:
					'Team members are not empowered to take action when necessary.',
			},
			ops_org_culture_team_enc_escalation: {
				waMapping: 'OPS 3.2',
				waQuestionId: 'org-culture',
				waQuestionText:
					'How does your organizational culture support your business outcomes?',
				waChoiceText: 'Escalation is encouraged',
				condition: 'True if escalation is encouraged',
				defaultTrueText: 'Escalation is actively encouraged.',
				defaultFalseText: 'Escalation is not encouraged.',
			},
			ops_org_culture_effective_comms: {
				waMapping: 'OPS 3.3',
				waQuestionId: 'org-culture',
				waQuestionText:
					'How does your organizational culture support your business outcomes?',
				waChoiceText: 'Communications are timely, clear, and actionable',
				condition: 'True if communications are clear and timely',
				defaultTrueText: 'Communications are timely, clear, and actionable.',
				defaultFalseText:
					'Communications are not timely, clear, or actionable.',
			},
			ops_org_culture_team_enc_experiment: {
				waMapping: 'OPS 3.5',
				waQuestionId: 'org-culture',
				waQuestionText:
					'How does your organizational culture support your business outcomes?',
				waChoiceText: 'Experimentation is encouraged',
				condition: 'True if team members are supported to experiment',
				defaultTrueText: 'Team members are encouraged to experiment.',
				defaultFalseText: 'Team members are not encouraged to experiment.',
			},
			ops_org_culture_team_enc_learn: {
				waMapping: 'OPS 3.6',
				waQuestionId: 'org-culture',
				waQuestionText:
					'How does your organizational culture support your business outcomes?',
				waChoiceText:
					'Team members are enabled and encouraged to maintain and grow their skill sets',
				condition: 'True if team members are spported to grow',
				defaultTrueText:
					'Team members are enabled and encouraged to grow their skill sets.',
				defaultFalseText:
					'Team members are not enabled or encouraged to grow their skill sets.',
			},
			ops_org_culture_team_res_appro: {
				waMapping: 'OPS 3.7',
				waQuestionId: 'org-culture',
				waQuestionText:
					'How does your organizational culture support your business outcomes?',
				waChoiceText: 'Resource teams appropriately',
				condition: 'True if team members are sufficiently resourced',
				defaultTrueText: 'Teams are sufficiently resourced.',
				defaultFalseText: 'Teams are not sufficiently resourced.',
			},
		},
	},

	ops_design_process: {
		title: 'Design Process',
		group: 'Operational Excellence',
		question: `When designing a new application, is there a clear process to take into account the requirements of customers, internal stakeholders, governance & compliance requiremnts? 
Is there an explicit process for evaluating risks and evaluating tradeoffs?  
`,
		waQuestions: {
			ops_priorities_ext_cust_needs: {
				waMapping: 'OPS 1.1',
				waQuestionId: 'priorities',
				waQuestionText: 'How do you determine what your priorities are?',
				waChoiceText: 'Evaluate external customer needs',
				condition:
					'True if there is a design process that includes taking customer requirements into account',
				defaultTrueText: 'External customer needs are evaluated during design.',
				defaultFalseText:
					'External customer needs are not evaluated during design.',
			},
			ops_priorities_int_cust_needs: {
				waMapping: 'OPS 1.2',
				waQuestionId: 'priorities',
				waQuestionText: 'How do you determine what your priorities are?',
				waChoiceText: 'Evaluate internal customer needs',
				condition:
					'True if there is a design process that includes taking into account internal stakeholders into account',
				defaultTrueText:
					'Internal stakeholder needs are evaluated during design.',
				defaultFalseText:
					'Internal stakeholder needs are not evaluated during design.',
			},
			ops_priorities_governance_reqs: {
				waMapping: 'OPS 1.3',
				waQuestionId: 'priorities',
				waQuestionText: 'How do you determine what your priorities are?',
				waChoiceText: 'Evaluate governance requirements',
				condition:
					'True if there is a clear design process that includes taking into account governance requirements into account',
				defaultTrueText: 'Governance requirements are evaluated during design.',
				defaultFalseText:
					'Governance requirements are not evaluated during design.',
			},
			ops_priorities_compliance_reqs: {
				waMapping: 'OPS 1.4',
				waQuestionId: 'priorities',
				waQuestionText: 'How do you determine what your priorities are?',
				waChoiceText: 'Evaluate compliance requirements',
				condition:
					'True if there is a design process that includes taking into account compliance requirements into account',
				defaultTrueText: 'Compliance requirements are evaluated during design.',
				defaultFalseText:
					'Compliance requirements are not evaluated during design.',
			},
			ops_priorities_eval_threat_landscape: {
				waMapping: 'OPS 1.5',
				waQuestionId: 'priorities',
				waQuestionText: 'How do you determine what your priorities are?',
				waChoiceText: 'Evaluate threat landscape',
				condition: 'True if there is a process for evaluating risks',
				defaultTrueText:
					'Threat landscape is evaluated as part of the design process.',
				defaultFalseText:
					'Threat landscape is not evaluated as part of the design process.',
			},
			ops_priorities_eval_tradeoffs: {
				waMapping: 'OPS 1.6',
				waQuestionId: 'priorities',
				waQuestionText: 'How do you determine what your priorities are?',
				waChoiceText: 'Evaluate tradeoffs while managing benefits and risks',
				condition:
					'True if there is a process for evaluating tradeoffs and risks',
				defaultTrueText: 'Tradeoffs and risks are explicitly evaluated.',
				defaultFalseText: 'Tradeoffs and risks are not explicitly evaluated.',
			},
		},
	},

	ops_change_process: {
		title: 'Change Process & Deployment Systems',
		group: 'Operational Excellence',
		question: `Do you have a process for deploying workload changes? The process would also cover how to plan for unsuccessful changes, sharing design standards across teams, test processes, etc. 
Does the change process include the following:  multiple environments (test, stage, etc.), using version control, deployment systems that can automate building, deploying and testing changes.
Do you use patch management and configuration management systems? 
Do you encourage making frequent, small, reversible changes to the environment? 
Do you employ any practices such as test-driven development, code reviews, etc. to improve code quality and reduce the chances of errors in deployments? 
`,
		examples: [
			"- Yes we do all of the things mentioned above, but we don't have the last part with regards to test-driven development, code reviews, etc. ",
		],
		waQuestions: {
			ops_dev_integ_version_control: {
				waMapping: 'OPS 5.1',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Use version control',
				condition: 'True if they use version control',
				defaultTrueText: 'Version control is utilized.',
				defaultFalseText: 'Version control is not utilized.',
			},
			ops_dev_integ_test_val_chg: {
				waMapping: 'OPS 5.2',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Test and validate changes',
				condition: 'True if they test changes',
				defaultTrueText: 'Changes are tested and validated.',
				defaultFalseText: 'Changes are not tested or validated.',
			},
			ops_dev_integ_conf_mgmt_sys: {
				waMapping: 'OPS 5.3',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Use configuration management systems',
				condition: 'True if they use configuration management systems',
				defaultTrueText: 'Configuration management systems are used.',
				defaultFalseText: 'Configuration management systems are not used.',
			},
			ops_dev_integ_build_mgmt_sys: {
				waMapping: 'OPS 5.4',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Use build and deployment management systems',
				condition: 'True if they use configuration management systems',
				defaultTrueText: 'Build and deployment management systems are used.',
				defaultFalseText:
					'Build and deployment management systems are not used.',
			},
			ops_dev_integ_patch_mgmt: {
				waMapping: 'OPS 5.5',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Perform patch management',
				condition: 'True if they use patch management systems',
				defaultTrueText: 'Patch management systems are in use.',
				defaultFalseText: 'Patch management systems are not in use.',
			},
			ops_dev_integ_share_design_stds: {
				waMapping: 'OPS 5.6',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Share design standards',
				condition:
					'True if they have a process for deploying workload changes and sharing design standards across teams',
				defaultTrueText: 'Design standards are shared across teams.',
				defaultFalseText: 'Design standards are not shared across teams.',
			},
			ops_dev_integ_code_quality: {
				waMapping: 'OPS 5.7',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Implement practices to improve code quality',
				condition: 'True if they implement proactices to improve code quality',
				defaultTrueText: 'Practices for improving code quality are in place.',
				defaultFalseText:
					'No practices are implemented to improve code quality.',
			},
			ops_dev_integ_multi_env: {
				waMapping: 'OPS 5.8',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Use multiple environments',
				condition: 'True if they use multiple environments',
				defaultTrueText:
					'Multiple environments (test, stage, prod, etc.) are used.',
				defaultFalseText: 'Multiple environments are not used.',
			},
			ops_dev_integ_freq_sm_rev_chg: {
				waMapping: 'OPS 5.9',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Make frequent, small, reversible changes',
				condition: 'True if they make small, frequent changes',
				defaultTrueText: 'Frequent, small, and reversible changes are made.',
				defaultFalseText: 'Infrequent or large changes are made.',
			},
			ops_dev_integ_auto_integ_deploy: {
				waMapping: 'OPS 5.10',
				waQuestionId: 'dev-integ',
				waQuestionText:
					'How do you reduce defects, ease remediation, and improve flow into production?',
				waChoiceText: 'Fully automate integration and deployment',
				condition: 'True if they automate deploying and testing changes',
				defaultTrueText: 'Integration and deployment are fully automated.',
				defaultFalseText: 'Integration and deployment are not fully automated.',
			},
			ops_mit_deploy_risks_plan_for_unsucessful_changes: {
				waMapping: 'OPS 6.1',
				waQuestionId: 'mit-deploy-risks',
				waQuestionText: 'How do you mitigate deployment risks?',
				waChoiceText: 'Plan for unsuccessful changes',
				condition:
					'True if they have a process that includes planning for unsucessful changes',
				defaultTrueText: 'Unsuccessful changes are planned for.',
				defaultFalseText: 'No plan exists for unsuccessful changes.',
			},
			ops_mit_deploy_risks_test_val_chg: {
				waMapping: 'OPS 6.2',
				waQuestionId: 'mit-deploy-risks',
				waQuestionText: 'How do you mitigate deployment risks?',
				waChoiceText: 'Test deployments',
				condition: 'True if they test deployments',
				defaultTrueText: 'Deployments are tested.',
				defaultFalseText: 'Deployments are not tested.',
			},
			ops_mit_deploy_risks_deploy_mgmt_sys: {
				waMapping: 'OPS 6.3',
				waQuestionId: 'mit-deploy-risks',
				waQuestionText: 'How do you mitigate deployment risks?',
				waChoiceText: 'Employ safe deployment strategies',
				condition: 'True if they use deployment systems',
				defaultTrueText:
					'Safe deployment strategies are used (deployment systems).',
				defaultFalseText:
					'Safe deployment strategies (deployment systems) are not used.',
			},
			ops_mit_deploy_risks_auto_testing_and_rollback: {
				waMapping: 'OPS 6.4',
				waQuestionId: 'mit-deploy-risks',
				waQuestionText: 'How do you mitigate deployment risks?',
				waChoiceText: 'Automate testing and rollback',
				condition:
					'True if they use systems that automate deploying and testing changes',
				defaultTrueText: 'Testing and rollback are automated.',
				defaultFalseText: 'Testing and rollback are not automated.',
			},
		},
	},
	ops_observability: {
		title: 'Workload Observability',
		group: 'Operational Excellence',
		question: `Do you have a process and system for implementing observability for your workload? 
This would include defining KPIs that align with the business objectives of the application, and collecting telemetry across different dimensions: application metrics, user experience and application dependencies. In addition, do you implement distributed tracing across the differnet components for easier debugging?
And are you ensuring that workload observability is utilized properly by creating dashboard, actionable alerts, and making sure the logs, metrics and traces are analyzed and reviewed? 
`,
		examples: [
			'- We collect all the above except for user activity which is not applicable to this workload',
		],
		waQuestions: {
			ops_observability_identify_kpis: {
				waMapping: 'OPS 4.1',
				waQuestionId: 'observability',
				waQuestionText: 'How do you implement observability in your workload?',
				waChoiceText: 'Identify key performance indicators',
				condition:
					'True if they have an observability process that includes defining KPIs',
				defaultTrueText: 'Key performance indicators are defined.',
				defaultFalseText: 'Key performance indicators are not defined.',
			},
			ops_observability_application_telemetry: {
				waMapping: 'OPS 4.2',
				waQuestionId: 'observability',
				waQuestionText: 'How do you implement observability in your workload?',
				waChoiceText: 'Implement application telemetry',
				condition: 'True if the system includes collecting application metrics',
				defaultTrueText: 'Application telemetry is implemented.',
				defaultFalseText: 'Application telemetry is not implemented.',
			},
			ops_observability_customer_telemetry: {
				waMapping: 'OPS 4.3',
				waQuestionId: 'observability',
				waQuestionText: 'How do you implement observability in your workload?',
				waChoiceText: 'Implement user experience telemetry',
				condition:
					'True if the system includes collecting user experience metrics',
				defaultTrueText: 'User experience telemetry is collected.',
				defaultFalseText: 'User experience telemetry is not collected.',
			},
			ops_observability_dependency_telemetry: {
				waMapping: 'OPS 4.4',
				waQuestionId: 'observability',
				waQuestionText: 'How do you implement observability in your workload?',
				waChoiceText: 'Implement dependency telemetry',
				condition:
					'True if the system includes monitoring external dependencies',
				defaultTrueText: 'Dependency telemetry is implemented.',
				defaultFalseText: 'Dependency telemetry is not implemented.',
			},
			ops_observability_dist_trace: {
				waMapping: 'OPS 4.5',
				waQuestionId: 'observability',
				waQuestionText: 'How do you implement observability in your workload?',
				waChoiceText: 'Implement distributed tracing',
				condition:
					'True if the system includes implementing distributed tracing for the various components',
				defaultTrueText: 'Distributed tracing is implemented.',
				defaultFalseText: 'Distributed tracing is not implemented.',
			},
			ops_workload_observability_create_alerts: {
				waMapping: 'OPS 8.1',
				waQuestionId: 'workload-observability',
				waQuestionText:
					'How do you utilize workload observability in your organization?',
				waChoiceText: 'Create actionable alerts',
				condition: 'True if they are creating actionable alerts',
				defaultTrueText: 'Actionable alerts are created.',
				defaultFalseText: 'Actionable alerts are not created.',
			},
			ops_workload_observability_analyze_workload_metrics: {
				waMapping: 'OPS 8.2',
				waQuestionId: 'workload-observability',
				waQuestionText:
					'How do you utilize workload observability in your organization?',
				waChoiceText: 'Analyze workload metrics',
				condition: 'True if they are reviewing and analyzing metrics',
				defaultTrueText: 'Workload metrics are regularly analyzed.',
				defaultFalseText: 'Workload metrics are not analyzed regularly.',
			},
			ops_workload_observability_analyze_workload_logs: {
				waMapping: 'OPS 8.3',
				waQuestionId: 'workload-observability',
				waQuestionText:
					'How do you utilize workload observability in your organization?',
				waChoiceText: 'Analyze workload logs',
				condition: 'True if they are reviewing and analyzing logs',
				defaultTrueText: 'Workload logs are reviewed and analyzed.',
				defaultFalseText: 'Workload logs are not reviewed or analyzed.',
			},
			ops_workload_observability_analyze_workload_traces: {
				waMapping: 'OPS 8.4',
				waQuestionId: 'workload-observability',
				waQuestionText:
					'How do you utilize workload observability in your organization?',
				waChoiceText: 'Analyze workload traces',
				condition: 'True if they are reviewing and analyzing traces',
				defaultTrueText: 'Workload traces are reviewed and analyzed.',
				defaultFalseText: 'Workload traces are not reviewed or analyzed.',
			},
			ops_workload_observability_create_dashboards: {
				waMapping: 'OPS 8.5',
				waQuestionId: 'workload-observability',
				waQuestionText:
					'How do you utilize workload observability in your organization?',
				waChoiceText: 'Create dashboards',
				condition: 'True if they are creating dashboards',
				defaultTrueText: 'Dashboards are created for observability.',
				defaultFalseText: 'Dashboards are not created for observability.',
			},
		},
	},

	ops_readiness: {
		title: 'Operations Readiness & Optimization',
		group: 'Operational Excellence',
		question: `When determining if the team is ready to support a workload, are you ensuring that you have clear runbooks for procedures, playbooks for investigating issues, and the team has the capability to support them? Are support plans enabled for all software and services in production workload? 
Do you define KPIs and collect metrics to measure operational goals? Is there a clear process for communicating operational events (e.g. status event page)? 
Is there a process for coninuous improvement of operations, including re-evaluating the metrics collected? For example, Post incident analysis, feedback loops, sharing insights across teams and business owners, and allocating time for improvements?
`,
		waQuestions: {
			ops_ready_to_support_personnel_capability: {
				waMapping: 'OPS 7.1',
				waQuestionId: 'ready-to-support',
				waQuestionText:
					'How do you know that you are ready to support a workload?',
				waChoiceText: 'Ensure personnel capability',
				condition:
					'True if they are ensuring the team has capabiity to support a workload',
				defaultTrueText:
					'Team members have the capability to support the workload.',
				defaultFalseText:
					'Team members do not have the capability to support the workload.',
			},
			ops_ready_to_support_const_orr: {
				waMapping: 'OPS 7.2',
				waQuestionId: 'ready-to-support',
				waQuestionText:
					'How do you know that you are ready to support a workload?',
				waChoiceText: 'Ensure consistent review of operational readiness',
				condition: 'True if there is a process for improvement of operations',
				defaultTrueText: 'Operational readiness is reviewed consistently.',
				defaultFalseText: 'Operational readiness is not reviewed consistently.',
			},
			ops_ready_to_support_use_runbooks: {
				waMapping: 'OPS 7.3',
				waQuestionId: 'ready-to-support',
				waQuestionText:
					'How do you know that you are ready to support a workload?',
				waChoiceText: 'Use runbooks to perform procedures',
				condition: 'True if they have runbooks for procedures',
				defaultTrueText: 'Runbooks are used for performing procedures.',
				defaultFalseText: 'Runbooks are not used for performing procedures.',
			},
			ops_ready_to_support_use_playbooks: {
				waMapping: 'OPS 7.4',
				waQuestionId: 'ready-to-support',
				waQuestionText:
					'How do you know that you are ready to support a workload?',
				waChoiceText: 'Use playbooks to investigate issues',
				condition: 'True if they have playbooks for investigating issues',
				defaultTrueText: 'Playbooks are used for investigating issues.',
				defaultFalseText: 'Playbooks are not used for investigating issues.',
			},
			ops_ready_to_support_informed_deploy_decisions: {
				waMapping: 'OPS 7.5',
				waQuestionId: 'ready-to-support',
				waQuestionText:
					'How do you know that you are ready to support a workload?',
				waChoiceText: 'Make informed decisions to deploy systems and changes',
				condition:
					'True if the team has the capability to support the workload',
				defaultTrueText: 'Team can make informed decisions for deployments.',
				defaultFalseText: 'Team cannot make informed deployment decisions.',
			},
			ops_ready_to_support_enable_support_plans: {
				waMapping: 'OPS 7.6',
				waQuestionId: 'ready-to-support',
				waQuestionText:
					'How do you know that you are ready to support a workload?',
				waChoiceText: 'Create support plans for production workloads',
				condition:
					'True if the team has support plans for all the software  in the workload',
				defaultTrueText:
					'Support plans are created for all production software.',
				defaultFalseText:
					'Support plans are not created for production software.',
			},
			ops_operations_health_measure_ops_goals_kpis: {
				waMapping: 'OPS 9.1',
				waQuestionId: 'operations-health',
				waQuestionText: 'How do you understand the health of your operations?',
				waChoiceText: 'Measure operations goals and KPIs with metrics',
				condition:
					'True if rhey define KPIs and collect metrics for the operational events',
				defaultTrueText: 'KPIs for operations are measured using metrics.',
				defaultFalseText: 'KPIs for operations are not measured using metrics.',
			},
			ops_operations_health_communicate_status_trends: {
				waMapping: 'OPS 9.2',
				waQuestionId: 'operations-health',
				waQuestionText: 'How do you understand the health of your operations?',
				waChoiceText:
					'Communicate status and trends to ensure visibility into operation',
				condition:
					'True if there is a process for communicating operational events (e.g. have set up an event status page)',
				defaultTrueText: 'Operational status and trends are communicated.',
				defaultFalseText: 'Operational status and trends are not communicated.',
			},
			ops_operations_health_review_ops_metrics_prioritize_improvement: {
				waMapping: 'OPS 9.3',
				waQuestionId: 'operations-health',
				waQuestionText: 'How do you understand the health of your operations?',
				waChoiceText: 'Review operations metrics and prioritize improvement',
				condition:
					'True if there is a process for contiuous improvement that includes reevaluating metrics collected',
				defaultTrueText:
					'Operations metrics are reviewed and improvements are prioritized.',
				defaultFalseText:
					'Operations metrics are not reviewed to prioritize improvements.',
			},
			ops_evolve_ops_process_cont_imp: {
				waMapping: 'OPS 11.1',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Have a process for continuous improvement',
				condition: 'True if they have a process for improvement of operations',
				defaultTrueText:
					'A process for continuous improvement of operations exists.',
				defaultFalseText:
					'No process for continuous improvement of operations exists.',
			},
			ops_evolve_ops_perform_rca_process: {
				waMapping: 'OPS 11.2',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Perform post-incident analysis',
				condition: 'True if the process includes post incident analysis',
				defaultTrueText: 'Post-incident analysis is performed.',
				defaultFalseText: 'Post-incident analysis is not performed.',
			},
			ops_evolve_ops_feedback_loops: {
				waMapping: 'OPS 11.3',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Implement feedback loops',
				condition: 'True if they implement feedback loops',
				defaultTrueText: 'Feedback loops are implemented.',
				defaultFalseText: 'Feedback loops are not implemented.',
			},
			ops_evolve_ops_knowledge_management: {
				waMapping: 'OPS 11.4',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Perform Knowledge Management',
				condition: 'True if the process includes sharing insights across teams',
				defaultTrueText:
					'Knowledge management is performed (insights are shared).',
				defaultFalseText: 'Knowledge management is not performed.',
			},
			ops_evolve_ops_drivers_for_imp: {
				waMapping: 'OPS 11.5',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Define drivers for improvement',
				condition: 'True if there is a process for improvement of operations',
				defaultTrueText: 'Drivers for operations improvement are defined.',
				defaultFalseText: 'Drivers for operations improvement are not defined.',
			},
			ops_evolve_ops_validate_insights: {
				waMapping: 'OPS 11.6',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Validate insight',
				condition:
					'True if the process includes sharing insights across teams and business owners',
				defaultTrueText:
					'Insights are validated across teams and business owners.',
				defaultFalseText:
					'Insights are not validated across teams and business owners.',
			},
			ops_evolve_ops_metrics_review: {
				waMapping: 'OPS 11.7',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Perform operations metrics reviews',
				condition: 'True if they review metrics regularly',
				defaultTrueText: 'Regular operations metrics reviews are performed.',
				defaultFalseText:
					'No regular operations metrics reviews are performed.',
			},
			ops_evolve_ops_share_lessons_learned: {
				waMapping: 'OPS 11.8',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Document and share lessons learned',
				condition: 'True if they create runbooks and playbooks for operations',
				defaultTrueText:
					'Lessons learned are documented and shared (e.g., runbooks/playbooks).',
				defaultFalseText: 'Lessons are not documented or shared.',
			},
			ops_evolve_ops_allocate_time_for_imp: {
				waMapping: 'OPS 11.9',
				waQuestionId: 'evolve-ops',
				waQuestionText: 'How do you evolve operations?',
				waChoiceText: 'Allocate time to make improvements',
				condition: 'True if they allocate time for improvements',
				defaultTrueText: 'Time is allocated for operational improvements.',
				defaultFalseText: 'No time is allocated for operational improvements.',
			},
		},
	},
	ops_events: {
		title: 'Operations Events Readiness',
		group: 'Operational Excellence',
		question: `Do you have a process for managing operations events, incidents and problems? This would include processes per events, escalation paths, and defining communication with customers (including setting up dashboards for status communication). The process would also prioritize events based on business impact.
Do you also automate responses to operational events to reduce errors that might be caused by manual processes?
`,
		waQuestions: {
			ops_event_response_event_incident_problem_process: {
				waMapping: 'OPS 10.1',
				waQuestionId: 'event-response',
				waQuestionText: 'How do you manage workload and operations events?',
				waChoiceText:
					'Use processes for event, incident, and problem management',
				condition:
					'True if there is a process for handling incidents, events and problems',
				defaultTrueText:
					'A process for event, incident, and problem management is in place.',
				defaultFalseText:
					'No process for event, incident, or problem management is in place.',
			},
			ops_event_response_process_per_alert: {
				waMapping: 'OPS 10.2',
				waQuestionId: 'event-response',
				waQuestionText: 'How do you manage workload and operations events?',
				waChoiceText: 'Have a process per alert',
				condition: 'True if there is a process per event',
				defaultTrueText: 'Each alert or event has a defined process.',
				defaultFalseText: 'There is no defined process per alert or event.',
			},
			ops_event_response_prioritize_events: {
				waMapping: 'OPS 10.3',
				waQuestionId: 'event-response',
				waQuestionText: 'How do you manage workload and operations events?',
				waChoiceText: 'Prioritize operational events based on business impact',
				condition:
					'True if the proces includes prioritizing events based on business impact',
				defaultTrueText:
					'Operational events are prioritized based on business impact.',
				defaultFalseText:
					'Operational events are not prioritized based on business impact.',
			},
			ops_event_response_define_escalation_paths: {
				waMapping: 'OPS 10.4',
				waQuestionId: 'event-response',
				waQuestionText: 'How do you manage workload and operations events?',
				waChoiceText: 'Define escalation paths',
				condition: 'True if escalation paths are defined',
				defaultTrueText: 'Escalation paths are clearly defined.',
				defaultFalseText: 'No escalation paths are defined.',
			},
			ops_event_response_push_notify: {
				waMapping: 'OPS 10.5',
				waQuestionId: 'event-response',
				waQuestionText: 'How do you manage workload and operations events?',
				waChoiceText: 'Define a customer communication plan for outages',
				condition: 'True if customer communications are defined',
				defaultTrueText: 'A customer communication plan is in place.',
				defaultFalseText: 'No customer communication plan is in place.',
			},
			ops_event_response_dashboards: {
				waMapping: 'OPS 10.6',
				waQuestionId: 'event-response',
				waQuestionText: 'How do you manage workload and operations events?',
				waChoiceText: 'Communicate status through dashboards',
				condition:
					'True if communication includes dashboards for status communication',
				defaultTrueText: 'Status is communicated through dashboards.',
				defaultFalseText: 'Status is not communicated through dashboards.',
			},
			ops_event_response_auto_event_response: {
				waMapping: 'OPS 10.7',
				waQuestionId: 'event-response',
				waQuestionText: 'How do you manage workload and operations events?',
				waChoiceText: 'Automate responses to events',
				condition: 'True if they automate responses to events',
				defaultTrueText: 'Responses to events are automated.',
				defaultFalseText: 'Responses to events are not automated.',
			},
		},
	},
	rel_1: {
		title: 'Service Quotas',
		group: 'Reliability',
		question: `Are you aware of service quotas and limits in AWS? Do you take this into account when designing an application to ensure that it is architected around AWS service limits? 
Do you use services like AWS Service Quota to monitor quotas and automate management? 
Finally, do you regularly review quotas to ensure there is a sufficient gap?
`,
		examples: [
			"- Yes, we use AWS Service Quota but haven't set it up for automated management. We also don't do regular reviews yet but are planning to do so.",
		],
		waQuestions: {
			rel_manage_service_limits_aware_quotas_and_constraints: {
				waMapping: 'REL 1.1',
				waQuestionId: 'manage-service-limits',
				waQuestionText: 'How do you manage service quotas and constraints?',
				waChoiceText: 'Aware of service quotas and constraints',
				condition: 'True if they are aware of service quotas',
				defaultTrueText:
					'Teams are aware of AWS service quotas and constraints.',
				defaultFalseText:
					'Teams are not aware of AWS service quotas and constraints.',
			},
			rel_manage_service_limits_limits_considered: {
				waMapping: 'REL 1.2',
				waQuestionId: 'manage-service-limits',
				waQuestionText: 'How do you manage service quotas and constraints?',
				waChoiceText: 'Manage service quotas across accounts and regions',
				condition: 'True if they use AWS Service Quota to manage quotas',
				defaultTrueText:
					'Service quotas are managed across accounts and regions.',
				defaultFalseText:
					'Service quotas are not managed across accounts and regions.',
			},
			rel_manage_service_limits_aware_fixed_limits: {
				waMapping: 'REL 1.3',
				waQuestionId: 'manage-service-limits',
				waQuestionText: 'How do you manage service quotas and constraints?',
				waChoiceText:
					'Accommodate fixed service quotas and constraints through architecture',
				condition:
					'True if they architect around service limits when designing an application',
				defaultTrueText:
					'Architecture accommodates fixed service quotas and constraints.',
				defaultFalseText:
					'Architecture does not accommodate fixed service quotas and constraints.',
			},
			rel_manage_service_limits_monitor_manage_limits: {
				waMapping: 'REL 1.4',
				waQuestionId: 'manage-service-limits',
				waQuestionText: 'How do you manage service quotas and constraints?',
				waChoiceText: 'Monitor and manage quotas',
				condition:
					'True if they use AWS Service Quotas (or equivelant tool) to manage and monitor quotas',
				defaultTrueText:
					'AWS Service Quotas or an equivalent tool is used to monitor and manage quotas.',
				defaultFalseText: 'No tool is used to monitor or manage quotas.',
			},
			rel_manage_service_limits_automated_monitor_limits: {
				waMapping: 'REL 1.5',
				waQuestionId: 'manage-service-limits',
				waQuestionText: 'How do you manage service quotas and constraints?',
				waChoiceText: 'Automate quota management',
				condition:
					'True if they use Servie Quota to automate management of qutoas',
				defaultTrueText: 'Quota management is automated.',
				defaultFalseText: 'Quota management is not automated.',
			},
			rel_manage_service_limits_suff_buffer_limits: {
				waMapping: 'REL 1.6',
				waQuestionId: 'manage-service-limits',
				waQuestionText: 'How do you manage service quotas and constraints?',
				waChoiceText:
					'Ensure that a sufficient gap exists between the current quotas and the maximum usage to accommodate failover',
				condition:
					'True if they regularly review quotas to ensure there is a sufficent gap',
				defaultTrueText:
					'Quotas are regularly reviewed to ensure a sufficient buffer.',
				defaultFalseText:
					'Quotas are not reviewed to ensure a sufficient buffer.',
			},
		},
	},
	rel_2: {
		title: 'Network Topology',
		group: 'Reliability',
		question: `When designing a network topology, do you consider high-availability connections for public workloads? redundant connectivity paths? 
When having multiple VPCs, are you ensuring there are no overlapping IP addresses, and that there is sufficient IP space for expansion? 
Do you avoid many-to-many mesh designs in favor of hub and spoke models? 
`,
		waQuestions: {
			rel_planning_network_topology_ha_conn_users: {
				waMapping: 'REL 2.1',
				waQuestionId: 'planning-network-topology',
				waQuestionText: 'How do you plan your network topology?',
				waChoiceText:
					'Use highly available network connectivity for your workload public endpoints',
				condition:
					'True if they consider high availability connections for public workloads',
				defaultTrueText:
					'High-availability connections are considered for public workloads.',
				defaultFalseText:
					'Public workloads do not have high-availability connections.',
			},
			rel_planning_network_topology_ha_conn_private_networks: {
				waMapping: 'REL 2.2',
				waQuestionId: 'planning-network-topology',
				waQuestionText: 'How do you plan your network topology?',
				waChoiceText:
					'Provision redundant connectivity between private networks in the cloud and on-premises environments',
				condition: 'True if if they consider redundant connectivity paths',
				defaultTrueText: 'Redundant connectivity paths are provisioned.',
				defaultFalseText: 'No redundant connectivity paths are provisioned.',
			},
			rel_planning_network_topology_ip_subnet_allocation: {
				waMapping: 'REL 2.3',
				waQuestionId: 'planning-network-topology',
				waQuestionText: 'How do you plan your network topology?',
				waChoiceText:
					'Ensure IP subnet allocation accounts for expansion and availability',
				condition:
					'True if they ensure there is sufficient ip space for expansion',
				defaultTrueText: 'Sufficient IP space is allocated to allow expansion.',
				defaultFalseText: 'IP subnet allocation is insufficient for expansion.',
			},
			rel_planning_network_topology_prefer_hub_and_spoke: {
				waMapping: 'REL 2.4',
				waQuestionId: 'planning-network-topology',
				waQuestionText: 'How do you plan your network topology?',
				waChoiceText: 'Prefer hub-and-spoke topologies over many-to-many mesh',
				condition:
					'True if they only use hub and spoke models, False if they use many-to-many mesh designs',
				defaultTrueText:
					'Hub-and-spoke topology is used rather than many-to-many mesh.',
				defaultFalseText:
					'Many-to-many mesh designs are used (no hub-and-spoke).',
			},
			rel_planning_network_topology_non_overlap_ip: {
				waMapping: 'REL 2.5',
				waQuestionId: 'planning-network-topology',
				waQuestionText: 'How do you plan your network topology?',
				waChoiceText:
					'Enforce non-overlapping private IP address ranges in all private address spaces where they are connected',
				condition: 'True if they ensure there are no overlapping ip addresses',
				defaultTrueText: 'Private IP address ranges do not overlap.',
				defaultFalseText: 'Private IP address ranges overlap.',
			},
		},
	},
	rel_3: {
		title: 'Microservices',
		group: 'Reliability',
		question: `Are you adopting SOA or microservices architecture instead of monolithic applications? 
Are services built to support specific functionality or business domains? 
Finally, do you implement contracts per API? 
`,
		waQuestions: {
			rel_service_architecture_monolith_soa_microservice: {
				waMapping: 'REL 3.1',
				waQuestionId: 'service-architecture',
				waQuestionText: 'How do you design your workload service architecture?',
				waChoiceText: 'Choose how to segment your workload',
				condition:
					'True if they are adopting service oriented architectures or microservices',
				defaultTrueText:
					'Service-oriented or microservices architecture is adopted.',
				defaultFalseText:
					'Monolithic architecture is used (no SOA or microservices).',
			},
			rel_service_architecture_business_domains: {
				waMapping: 'REL 3.2',
				waQuestionId: 'service-architecture',
				waQuestionText: 'How do you design your workload service architecture?',
				waChoiceText:
					'Build services focused on specific business domains and functionality',
				condition:
					'True if their services are built on specific functionality or business domains',
				defaultTrueText: 'Services are built around specific business domains.',
				defaultFalseText:
					'Services are not designed around specific business domains.',
			},
			rel_service_architecture_api_contracts: {
				waMapping: 'REL 3.3',
				waQuestionId: 'service-architecture',
				waQuestionText: 'How do you design your workload service architecture?',
				waChoiceText: 'Provide service contracts per API',
				condition: 'True if the implement contracts per API',
				defaultTrueText: 'API-level service contracts are provided.',
				defaultFalseText: 'No service contracts are used per API.',
			},
		},
	},
	rel_4: {
		title: 'Backups & DR',
		group: 'Reliability',
		question: `Do you have a backup & DR strategy that includes defined RTOs and RPOs, and data to be backed up? Do you deploy to multiple locations for DR? 
Are you ensuring the security of backups with proper access controls and encryption? 
Do you regularly test your backups and DR implementations? 
Do you use automation for backups and for recovery in DR situations? 
Are you ensuring that drift is managed across DR sites? Have you implemented bulkhead architectures that limit failures to small numbers of users? 
`,
		waQuestions: {
			rel_backing_up_data_identified_backups_data: {
				waMapping: 'REL 9.1',
				waQuestionId: 'backing-up-data',
				waQuestionText: 'How do you back up data?',
				waChoiceText:
					'Identify and back up all data that needs to be backed up, or reproduce the data from sources',
				condition:
					'True if they have a backup strategy that includes what data to be backed up',
				defaultTrueText: 'Data to be backed up is clearly identified.',
				defaultFalseText: 'No clear identification of what data to back up.',
			},
			rel_backing_up_data_secured_backups_data: {
				waMapping: 'REL 9.2',
				waQuestionId: 'backing-up-data',
				waQuestionText: 'How do you back up data?',
				waChoiceText: 'Secure and encrypt backups',
				condition: 'True if they ensure the security of backups',
				defaultTrueText: 'Backups are secured and encrypted.',
				defaultFalseText: 'Backups are not secured or not encrypted.',
			},
			rel_backing_up_data_automated_backups_data: {
				waMapping: 'REL 9.3',
				waQuestionId: 'backing-up-data',
				waQuestionText: 'How do you back up data?',
				waChoiceText: 'Perform data backup automatically',
				condition: 'True if they use automation for backups',
				defaultTrueText: 'Backups are performed automatically.',
				defaultFalseText: 'Backups are not performed automatically.',
			},
			rel_backing_up_data_periodic_recovery_testing_data: {
				waMapping: 'REL 9.4',
				waQuestionId: 'backing-up-data',
				waQuestionText: 'How do you back up data?',
				waChoiceText:
					'Perform periodic recovery of the data to verify backup integrity and processes',
				condition: 'True if they regularly test their backups',
				defaultTrueText: 'Backups are periodically tested for recovery.',
				defaultFalseText: 'Backups are not tested for recovery.',
			},
			rel_fault_isolation_multiaz_region_system: {
				waMapping: 'REL 10.1',
				waQuestionId: 'fault-isolation',
				waQuestionText:
					'How do you use fault isolation to protect your workload?',
				waChoiceText: 'Deploy the workload to multiple locations',
				condition: 'True if they deploy to multiple locations for DR',
				defaultTrueText: 'Workload is deployed to multiple locations for DR.',
				defaultFalseText:
					'Workload is not deployed to multiple locations for DR.',
			},
			rel_fault_isolation_single_az_system: {
				waMapping: 'REL 10.3',
				waQuestionId: 'fault-isolation',
				waQuestionText:
					'How do you use fault isolation to protect your workload?',
				waChoiceText:
					'Automate recovery for components constrained to a single location',
				condition: 'True if they automate recovery',
				defaultTrueText:
					'Recovery is automated for components in a single location.',
				defaultFalseText:
					'Recovery is not automated for single-location components.',
			},
			rel_fault_isolation_use_bulkhead: {
				waMapping: 'REL 10.4',
				waQuestionId: 'fault-isolation',
				waQuestionText:
					'How do you use fault isolation to protect your workload?',
				waChoiceText: 'Use bulkhead architectures to limit scope of impact',
				condition: 'True if they implemetn bulkhead architectures',
				defaultTrueText: 'Bulkhead architectures are implemented.',
				defaultFalseText: 'No bulkhead architecture is implemented.',
			},
			rel_planning_for_recovery_objective_defined_recovery: {
				waMapping: 'REL 13.1',
				waQuestionId: 'planning-for-recovery',
				waQuestionText: 'How do you plan for disaster recovery (DR)?',
				waChoiceText: 'Define recovery objectives for downtime and data loss',
				condition: 'True if they define RTOs and RPOs',
				defaultTrueText: 'RTOs and RPOs are defined.',
				defaultFalseText: 'No defined RTOs or RPOs.',
			},
			rel_planning_for_recovery_disaster_recovery: {
				waMapping: 'REL 13.2',
				waQuestionId: 'planning-for-recovery',
				waQuestionText: 'How do you plan for disaster recovery (DR)?',
				waChoiceText:
					'Use defined recovery strategies to meet the recovery objectives',
				condition: 'True if they have a DR strategy defined',
				defaultTrueText: 'A defined DR strategy is in place.',
				defaultFalseText: 'No DR strategy is defined.',
			},
			rel_planning_for_recovery_dr_tested: {
				waMapping: 'REL 13.3',
				waQuestionId: 'planning-for-recovery',
				waQuestionText: 'How do you plan for disaster recovery (DR)?',
				waChoiceText:
					'Test disaster recovery implementation to validate the implementation',
				condition: 'True if they regularly test their DR implementation',
				defaultTrueText: 'DR implementation is tested regularly.',
				defaultFalseText: 'DR implementation is not tested.',
			},
			rel_planning_for_recovery_config_drift: {
				waMapping: 'REL 13.4',
				waQuestionId: 'planning-for-recovery',
				waQuestionText: 'How do you plan for disaster recovery (DR)?',
				waChoiceText: 'Manage configuration drift at the DR site or region',
				condition: 'True if they manage configration drift across DR sites',
				defaultTrueText: 'Configuration drift is managed at DR sites.',
				defaultFalseText: 'Configuration drift is not managed at DR sites.',
			},
			rel_planning_for_recovery_auto_recovery: {
				waMapping: 'REL 13.5',
				waQuestionId: 'planning-for-recovery',
				waQuestionText: 'How do you plan for disaster recovery (DR)?',
				waChoiceText: 'Automate recovery',
				condition:
					'True if if they use automation for recovery in DR situations',
				defaultTrueText: 'Recovery in DR situations is automated.',
				defaultFalseText: 'Recovery in DR situations is not automated.',
			},
		},
	},
	rel_distributed_systems: {
		title: 'Distributed Systems',
		group: 'Reliability',
		question: `When implementing distributed systems, do you take into consideration which type to implement (e.g. hard vs. soft distributed systems)? Are dependecies in the system loosly couple? Are you ensuring that responses are idempotent and that you are sending consistent responses of the same size to ensure no rapid changes occur in the system? And are you ensuring that the services are stateless (where possible)?
When there are failures in the systems, do you have mechanisms for graceful degradation of components? Are you implementing mitigation controls such as throttling requests, limiting retry calls, limiting queues and setting client timeouts? Are there emergency levers for mitigating availability impact on the workload? 
`,
		waQuestions: {
			rel_prevent_interaction_failure_identify: {
				waMapping: 'REL 4.1',
				waQuestionId: 'prevent-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to prevent failures?',
				waChoiceText: 'Identify the kind of distributed systems you depend on',
				condition:
					'True if they take into consideration which type of distributed system to implement',
				defaultTrueText:
					'The type of distributed system is chosen deliberately.',
				defaultFalseText:
					'No consideration is given to the type of distributed system.',
			},
			rel_prevent_interaction_failure_loosely_coupled_system: {
				waMapping: 'REL 4.2',
				waQuestionId: 'prevent-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to prevent failures?',
				waChoiceText: 'Implement loosely coupled dependencies',
				condition: 'True if they have loosely coupled dependencies',
				defaultTrueText: 'Dependencies are loosely coupled.',
				defaultFalseText: 'Dependencies are tightly coupled.',
			},
			rel_prevent_interaction_failure_idempotent: {
				waMapping: 'REL 4.3',
				waQuestionId: 'prevent-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to prevent failures?',
				waChoiceText: 'Make all responses idempotent',
				condition: 'True if responses are idempotent',
				defaultTrueText: 'Responses are idempotent.',
				defaultFalseText: 'Responses are not idempotent.',
			},
			rel_prevent_interaction_failure_constant_work: {
				waMapping: 'REL 4.4',
				waQuestionId: 'prevent-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to prevent failures?',
				waChoiceText: 'Do constant work',
				condition: 'True if they ensure same size responses (do constant work)',
				defaultTrueText:
					'System maintains constant work (consistent response size).',
				defaultFalseText:
					'System does not maintain constant work (response size can vary widely).',
			},
			rel_mitigate_interaction_failure_graceful_degradation: {
				waMapping: 'REL 5.1',
				waQuestionId: 'mitigate-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to mitigate or withstand failures?',
				waChoiceText:
					'Implement graceful degradation to transform applicable hard dependencies into soft dependencies',
				condition: 'True if they have mechanisms for graceful degradation',
				defaultTrueText: 'Graceful degradation is implemented.',
				defaultFalseText: 'No graceful degradation is implemented.',
			},
			rel_mitigate_interaction_failure_throttle_requests: {
				waMapping: 'REL 5.2',
				waQuestionId: 'mitigate-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to mitigate or withstand failures?',
				waChoiceText: 'Throttle requests',
				condition: 'True if they throttle requests',
				defaultTrueText: 'Requests are throttled.',
				defaultFalseText: 'Requests are not throttled.',
			},
			rel_mitigate_interaction_failure_limit_retries: {
				waMapping: 'REL 5.3',
				waQuestionId: 'mitigate-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to mitigate or withstand failures?',
				waChoiceText: 'Control and limit retry calls',
				condition: 'True if they limit retry calls',
				defaultTrueText: 'Retry calls are controlled or limited.',
				defaultFalseText: 'Retry calls are not limited.',
			},
			rel_mitigate_interaction_failure_fail_fast: {
				waMapping: 'REL 5.4',
				waQuestionId: 'mitigate-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to mitigate or withstand failures?',
				waChoiceText: 'Fail fast and limit queues',
				condition: 'True if they limit queues',
				defaultTrueText: 'Queues are limited (fail fast approach).',
				defaultFalseText:
					'Queues are not limited, fail fast approach not used.',
			},
			rel_mitigate_interaction_failure_client_timeouts: {
				waMapping: 'REL 5.5',
				waQuestionId: 'mitigate-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to mitigate or withstand failures?',
				waChoiceText: 'Set client timeouts',
				condition: 'True if they set client timeouts',
				defaultTrueText: 'Client timeouts are set.',
				defaultFalseText: 'Client timeouts are not set.',
			},
			rel_mitigate_interaction_failure_stateless: {
				waMapping: 'REL 5.6',
				waQuestionId: 'mitigate-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to mitigate or withstand failures?',
				waChoiceText: 'Make systems stateless where possible',
				condition: 'True if services are stateless where possible',
				defaultTrueText: 'Services are stateless, where feasible.',
				defaultFalseText: 'Services maintain state.',
			},
			rel_mitigate_interaction_failure_emergency_levers: {
				waMapping: 'REL 5.7',
				waQuestionId: 'mitigate-interaction-failure',
				waQuestionText:
					'How do you design interactions in a distributed system to mitigate or withstand failures?',
				waChoiceText: 'Implement emergency levers',
				condition: 'True if they have emergency levers',
				defaultTrueText: 'Emergency levers are available.',
				defaultFalseText: 'No emergency levers are implemented.',
			},
		},
	},
	rel_monitoring_scalability: {
		title: 'Monitoring & Workload Scalability',
		group: 'Reliability',
		question: `Do you have monitoring in place for all the workload's components including aggregated metrics? Does this include analytics of historical trends, and regular reviews of the systems in place? Is there end-to-end tracing enabled? Do you include sending notifications for events? 
Are there automated responses for reliability events? Including failover and automated healing? 
When there are changes in demand for the workload, are you using automation for scaling resources? Including automatic scaling when resources are impaired? Do you do regular load testing of the workload?
`,
		waQuestions: {
			rel_monitor_aws_resources_monitor_resources: {
				waMapping: 'REL 6.1',
				waQuestionId: 'monitor-aws-resources',
				waQuestionText: 'How do you monitor workload resources?',
				waChoiceText: 'Monitor all components for the workload (Generation)',
				condition:
					'True if there is monitoring in place for all the workloads components',
				defaultTrueText: 'All workload components are monitored.',
				defaultFalseText: 'Not all workload components are monitored.',
			},
			rel_monitor_aws_resources_notification_aggregation: {
				waMapping: 'REL 6.2',
				waQuestionId: 'monitor-aws-resources',
				waQuestionText: 'How do you monitor workload resources?',
				waChoiceText: 'Define and calculate metrics (Aggregation)',
				condition: 'True if this includes metrics and aggregation',
				defaultTrueText: 'Metrics are defined and aggregated.',
				defaultFalseText: 'Metrics are not defined or aggregated.',
			},
			rel_monitor_aws_resources_notification_monitor: {
				waMapping: 'REL 6.3',
				waQuestionId: 'monitor-aws-resources',
				waQuestionText: 'How do you monitor workload resources?',
				waChoiceText: 'Send notifications (Real-time processing and alarming)',
				condition: 'True if they have set up notifications for events',
				defaultTrueText: 'Notifications are sent for events.',
				defaultFalseText: 'Notifications are not sent for events.',
			},
			rel_monitor_aws_resources_automate_response_monitor: {
				waMapping: 'REL 6.4',
				waQuestionId: 'monitor-aws-resources',
				waQuestionText: 'How do you monitor workload resources?',
				waChoiceText: 'Automate responses (Real-time processing and alarming)',
				condition: 'True if they have automated responses set up for events',
				defaultTrueText: 'Responses to events are automated.',
				defaultFalseText: 'Responses to events are not automated.',
			},
			rel_monitor_aws_resources_storage_analytics: {
				waMapping: 'REL 6.5',
				waQuestionId: 'monitor-aws-resources',
				waQuestionText: 'How do you monitor workload resources?',
				waChoiceText: 'Analyze Logs',
				condition: 'True if they include analytics of historical trends',
				defaultTrueText: 'Historical log analytics is performed.',
				defaultFalseText: 'Historical log analytics is not performed.',
			},
			rel_monitor_aws_resources_review_monitoring: {
				waMapping: 'REL 6.6',
				waQuestionId: 'monitor-aws-resources',
				waQuestionText: 'How do you monitor workload resources?',
				waChoiceText: 'Conduct reviews regularly',
				condition: 'True if they regularly review the systems in place',
				defaultTrueText: 'Monitoring systems are regularly reviewed.',
				defaultFalseText: 'Monitoring systems are not reviewed regularly.',
			},
			rel_monitor_aws_resources_end_to_end: {
				waMapping: 'REL 6.7',
				waQuestionId: 'monitor-aws-resources',
				waQuestionText: 'How do you monitor workload resources?',
				waChoiceText:
					'Monitor end-to-end tracing of requests through your system',
				condition: 'True if they have end-to-end tracing enabled',
				defaultTrueText: 'End-to-end request tracing is enabled.',
				defaultFalseText: 'End-to-end request tracing is not enabled.',
			},
			rel_adapt_to_changes_autoscale_adapt: {
				waMapping: 'REL 7.1',
				waQuestionId: 'adapt-to-changes',
				waQuestionText:
					'How do you design your workload to adapt to changes in demand?',
				waChoiceText: 'Use automation when obtaining or scaling resources',
				condition:
					'True if they have automation in place for scaling resources',
				defaultTrueText: 'Resource scaling is automated.',
				defaultFalseText: 'Resource scaling is not automated.',
			},
			rel_adapt_to_changes_reactive_adapt_auto: {
				waMapping: 'REL 7.2',
				waQuestionId: 'adapt-to-changes',
				waQuestionText:
					'How do you design your workload to adapt to changes in demand?',
				waChoiceText:
					'Obtain resources upon detection of impairment to a workload',
				condition:
					'True if they have automation for scaling when resources are impaired',
				defaultTrueText:
					'Resources are obtained automatically upon impairment.',
				defaultFalseText:
					'Resources are not automatically obtained upon impairment.',
			},
			rel_adapt_to_changes_proactive_adapt_auto: {
				waMapping: 'REL 7.3',
				waQuestionId: 'adapt-to-changes',
				waQuestionText:
					'How do you design your workload to adapt to changes in demand?',
				waChoiceText:
					'Obtain resources upon detection that more resources are needed for a workload',
				condition:
					'True if they have automation in place for scaling resources',
				defaultTrueText:
					'Resources are automatically obtained when demand increases.',
				defaultFalseText:
					'Resources are not automatically obtained when demand increases.',
			},
			rel_adapt_to_changes_load_tested_adapt: {
				waMapping: 'REL 7.4',
				waQuestionId: 'adapt-to-changes',
				waQuestionText:
					'How do you design your workload to adapt to changes in demand?',
				waChoiceText: 'Load test your workload',
				condition: 'True if they regularly load test the workload',
				defaultTrueText: 'Load testing of the workload is performed regularly.',
				defaultFalseText: 'Load testing is not performed regularly.',
			},
			rel_withstand_component_failures_monitoring_health: {
				waMapping: 'REL 11.1',
				waQuestionId: 'withstand-component-failures',
				waQuestionText:
					'How do you design your workload to withstand component failures?',
				waChoiceText:
					'Monitor all components of the workload to detect failures',
				condition:
					'True if there is monitoring in place for all the workloads components',
				defaultTrueText: 'All workload components are monitored for failures.',
				defaultFalseText:
					'Not all workload components are monitored for failures.',
			},
			rel_withstand_component_failures_failover2good: {
				waMapping: 'REL 11.2',
				waQuestionId: 'withstand-component-failures',
				waQuestionText:
					'How do you design your workload to withstand component failures?',
				waChoiceText: 'Fail over to healthy resources',
				condition: 'True if they have automated responses including failover',
				defaultTrueText: 'Failover to healthy resources is implemented.',
				defaultFalseText: 'Failover to healthy resources is not implemented.',
			},
			rel_withstand_component_failures_auto_healing_system: {
				waMapping: 'REL 11.3',
				waQuestionId: 'withstand-component-failures',
				waQuestionText:
					'How do you design your workload to withstand component failures?',
				waChoiceText: 'Automate healing on all layers',
				condition:
					'True if they have automated responses including automated healing',
				defaultTrueText: 'Automated healing is implemented across all layers.',
				defaultFalseText:
					'Automated healing is not implemented across all layers.',
			},
			rel_withstand_component_failures_notifications_sent_system: {
				waMapping: 'REL 11.6',
				waQuestionId: 'withstand-component-failures',
				waQuestionText:
					'How do you design your workload to withstand component failures?',
				waChoiceText: 'Send notifications when events impact availability',
				condition: 'True if they have set up notifications for events',
				defaultTrueText:
					'Notifications are sent when events impact availability.',
				defaultFalseText:
					'Notifications are not sent when events impact availability.',
			},
		},
	},
	rel_change_process: {
		title: 'Change Process',
		group: 'Reliability',
		question: `Do you have a change process that takes reliability and resiliancy into account? This includes runbooks for deployment activities, integrating functional and resiliency testing as part of the deployment, deploying using immutable infrastructure and ensuring that you use automation when deploying changes
`,
		waQuestions: {
			rel_tracking_change_management_planned_changemgmt: {
				waMapping: 'REL 8.1',
				waQuestionId: 'tracking-change-management',
				waQuestionText: 'How do you implement change?',
				waChoiceText: 'Use runbooks for standard activities such as deployment',
				condition: 'True if they have runbooks for deployments',
				defaultTrueText: 'Runbooks are used for deployment activities.',
				defaultFalseText: 'No runbooks exist for deployment activities.',
			},
			rel_tracking_change_management_functional_testing: {
				waMapping: 'REL 8.2',
				waQuestionId: 'tracking-change-management',
				waQuestionText: 'How do you implement change?',
				waChoiceText: 'Integrate functional testing as part of your deployment',
				condition:
					'True if they have functional testing as part of the deployment',
				defaultTrueText: 'Functional testing is integrated into deployments.',
				defaultFalseText:
					'Functional testing is not integrated into deployments.',
			},
			rel_tracking_change_management_resiliency_testing: {
				waMapping: 'REL 8.3',
				waQuestionId: 'tracking-change-management',
				waQuestionText: 'How do you implement change?',
				waChoiceText: 'Integrate resiliency testing as part of your deployment',
				condition: 'True if they resiliency testing as part of the deployment',
				defaultTrueText: 'Resiliency testing is integrated into deployments.',
				defaultFalseText:
					'Resiliency testing is not integrated into deployments.',
			},
			rel_tracking_change_management_immutable_infrastructure: {
				waMapping: 'REL 8.4',
				waQuestionId: 'tracking-change-management',
				waQuestionText: 'How do you implement change?',
				waChoiceText: 'Deploy using immutable infrastructure',
				condition: 'True if they deploy with immutable infrastructure',
				defaultTrueText: 'Immutable infrastructure is used during deployment.',
				defaultFalseText: 'Immutable infrastructure is not used.',
			},
			rel_tracking_change_management_automated_changemgmt: {
				waMapping: 'REL 8.5',
				waQuestionId: 'tracking-change-management',
				waQuestionText: 'How do you implement change?',
				waChoiceText: 'Deploy changes with automation',
				condition: 'True if they deploy with automation',
				defaultTrueText: 'Changes are deployed with automation.',
				defaultFalseText: 'Changes are not deployed with automation.',
			},
		},
	},
	rel_failover_reliability: {
		title: 'Reliability & Testing',
		group: 'Reliability',
		question: `Do you ensure that the workload is designed to meet availability targets and SLAs? This includes designing the workload to rely on the data plane and not the control plane during recovery and using static stability to prevent bimodal behavior.
Is there a process for testing reliability such as including playbooks for investigating failures, performing post-incident analysis, and testing functional and performance requirements? Do you test using chaos engineering and conduct game days regularly?
`,
		waQuestions: {
			rel_withstand_component_failures_avoid_control_plane: {
				waMapping: 'REL 11.4',
				waQuestionId: 'withstand-component-failures',
				waQuestionText:
					'How do you design your workload to withstand component failures?',
				waChoiceText:
					'Rely on the data plane and not the control plane during recovery',
				condition: 'True if they use the data plane for recovery',
				defaultTrueText:
					'The workload relies on the data plane for recovery, not the control plane.',
				defaultFalseText:
					'The workload does not rely on the data plane for recovery (control plane used).',
			},
			rel_withstand_component_failures_static_stability: {
				waMapping: 'REL 11.5',
				waQuestionId: 'withstand-component-failures',
				waQuestionText:
					'How do you design your workload to withstand component failures?',
				waChoiceText: 'Use static stability to prevent bimodal behavior',
				condition:
					'True if they use static stability or another method to prevent bimodal behavior',
				defaultTrueText:
					'Static stability is implemented to prevent bimodal behavior.',
				defaultFalseText:
					'Static stability is not implemented, risking bimodal behavior.',
			},
			rel_withstand_component_failures_service_level_agreements: {
				waMapping: 'REL 11.7',
				waQuestionId: 'withstand-component-failures',
				waQuestionText:
					'How do you design your workload to withstand component failures?',
				waChoiceText:
					'Architect your product to meet availability targets and uptime service level agreements (SLAs)',
				condition: 'True if they consider availability targets and SLAs',
				defaultTrueText:
					'The workload is architected to meet availability targets and SLAs.',
				defaultFalseText:
					'Availability targets and SLAs are not considered in the architecture.',
			},
			rel_testing_resiliency_playbook_resiliency: {
				waMapping: 'REL 12.1',
				waQuestionId: 'testing-resiliency',
				waQuestionText: 'How do you test reliability?',
				waChoiceText: 'Use playbooks to investigate failures',
				condition:
					'True if there is a process for testing reliability including playbooks for investigating failures',
				defaultTrueText: 'Playbooks are used to investigate failures.',
				defaultFalseText: 'No playbooks exist to investigate failures.',
			},
			rel_testing_resiliency_rca_resiliency: {
				waMapping: 'REL 12.2',
				waQuestionId: 'testing-resiliency',
				waQuestionText: 'How do you test reliability?',
				waChoiceText: 'Perform post-incident analysis',
				condition: 'True if they perform post-incident analysis',
				defaultTrueText: 'Post-incident analysis is performed.',
				defaultFalseText: 'Post-incident analysis is not performed.',
			},
			rel_testing_resiliency_test_non_functional: {
				waMapping: 'REL 12.4',
				waQuestionId: 'testing-resiliency',
				waQuestionText: 'How do you test reliability?',
				waChoiceText: 'Test scaling and performance requirements',
				condition: 'True if they test performance requirements',
				defaultTrueText: 'Scaling and performance requirements are tested.',
				defaultFalseText:
					'Scaling and performance requirements are not tested.',
			},
			rel_testing_resiliency_failure_injection_resiliency: {
				waMapping: 'REL 12.5',
				waQuestionId: 'testing-resiliency',
				waQuestionText: 'How do you test reliability?',
				waChoiceText: 'Test resiliency using chaos engineering',
				condition: 'True if they use chaos engineering',
				defaultTrueText: 'Chaos engineering is used to test resiliency.',
				defaultFalseText: 'Chaos engineering is not used to test resiliency.',
			},
			rel_testing_resiliency_game_days_resiliency: {
				waMapping: 'REL 12.6',
				waQuestionId: 'testing-resiliency',
				waQuestionText: 'How do you test reliability?',
				waChoiceText: 'Conduct game days regularly',
				condition: 'True if they conduct game days regularly',
				defaultTrueText: 'Game days are conducted regularly.',
				defaultFalseText: 'Game days are not conducted regularly.',
			},
		},
	},
	general_1: {
		title: '',
		group: 'Other',
		question:
			'Do you have a contact from the cloud provider or a partner to use for reference?',
		disableAnalysis: true,
		waQuestions: {
			perf_architecture_guidance_architecture_patterns_best_practices: {
				waMapping: 'PERF 1.3',
				waQuestionId: 'performing-architecture',
				waQuestionText:
					'How do you select the appropriate cloud resources and architecture patterns for your workload?',
				waChoiceText:
					'Use guidance from your cloud provider or an appropriate partner to learn about architecture patterns and best practices',
				condition: '',
				defaultTrueText:
					'Guidance from the cloud provider or a partner is used for architecture patterns.',
				defaultFalseText:
					'No external guidance from a provider or partner is used for architecture patterns.',
			},
		},
	},
};

export default waMapping;
