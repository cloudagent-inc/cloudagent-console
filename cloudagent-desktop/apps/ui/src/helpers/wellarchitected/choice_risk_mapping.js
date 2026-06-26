const riskMapping = {
	'Aware of service quotas and constraints': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_manage_service_limits_aware_quotas_and_constraints.html',
	},
	'Manage service quotas across accounts and regions': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_manage_service_limits_limits_considered.html',
	},
	'Accommodate fixed service quotas and constraints through architecture': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_manage_service_limits_aware_fixed_limits.html',
	},
	'Monitor and manage quotas': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_manage_service_limits_monitor_manage_limits.html',
	},
	'Automate quota management': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_manage_service_limits_automated_monitor_limits.html',
	},
	'Ensure that a sufficient gap exists between the current quotas and the maximum usage to accommodate failover': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_manage_service_limits_suff_buffer_limits.html',
	},
	'Use highly available network connectivity for your workload public endpoints': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_network_topology_ha_conn_users.html',
	},
	'Provision redundant connectivity between private networks in the cloud and on-premises environments': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_network_topology_ha_conn_private_networks.html',
	},
	'Ensure IP subnet allocation accounts for expansion and availability': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_network_topology_ip_subnet_allocation.html',
	},
	'Prefer hub-and-spoke topologies over many-to-many mesh': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_network_topology_prefer_hub_and_spoke.html',
	},
	'Enforce non-overlapping private IP address ranges in all private address spaces where they are connected': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_network_topology_non_overlap_ip.html',
	},
	'Choose how to segment your workload': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_service_architecture_monolith_soa_microservice.html',
	},
	'Build services focused on specific business domains and functionality': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_service_architecture_business_domains.html',
	},
	'Provide service contracts per API': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_service_architecture_api_contracts.html',
	},
	'Identify which kind of distributed system is required': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_prevent_interaction_failure_identify.html',
	},
	'Implement loosely coupled dependencies': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_prevent_interaction_failure_loosely_coupled_system.html',
	},
	'Do constant work': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_prevent_interaction_failure_constant_work.html',
	},
	'Make all responses idempotent': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_prevent_interaction_failure_idempotent.html',
	},
	'Implement graceful degradation to transform applicable hard dependencies into soft dependencies': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_graceful_degradation.html',
	},
	'Throttle requests': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_throttle_requests.html',
	},
	'Control and limit retry calls': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_limit_retries.html',
	},
	'Fail fast and limit queues': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_fail_fast.html',
	},
	'Set client timeouts': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_client_timeouts.html',
	},
	'Make services stateless where possible': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_stateless.html',
	},
	'Implement emergency levers': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_emergency_levers.html',
	},
	'Monitor all components for the workload (Generation)': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_monitor_resources.html',
	},
	'Define and calculate metrics (Aggregation)': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_notification_aggregation.html',
	},
	'Send notifications (Real-time processing and alarming)': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_notification_monitor.html',
	},
	'Automate responses (Real-time processing and alarming)': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_automate_response_monitor.html',
	},
	Analytics: {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_storage_analytics.html',
	},
	'Conduct reviews regularly': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_review_monitoring.html',
	},
	'Monitor end-to-end tracing of requests through your system': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_monitor_aws_resources_end_to_end.html',
	},
	'Use automation when obtaining or scaling resources': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_adapt_to_changes_autoscale_adapt.html',
	},
	'Obtain resources upon detection of impairment to a workload': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_adapt_to_changes_reactive_adapt_auto.html',
	},
	'Obtain resources upon detection that more resources are needed for a workload': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_adapt_to_changes_proactive_adapt_auto.html',
	},
	'Load test your workload': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_adapt_to_changes_load_tested_adapt.html',
	},
	'Use runbooks for standard activities such as deployment': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_planned_changemgmt.html',
	},
	'Integrate functional testing as part of your deployment': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_functional_testing.html',
	},
	'Integrate resiliency testing as part of your deployment': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_resiliency_testing.html',
	},
	'Deploy using immutable infrastructure': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_immutable_infrastructure.html',
	},
	'Deploy changes with automation': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_tracking_change_management_automated_changemgmt.html',
	},
	'Identify and back up all data that needs to be backed up, or reproduce the data from sources': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_identified_backups_data.html',
	},
	'Secure and encrypt backups': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_secured_backups_data.html',
	},
	'Perform data backup automatically': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_automated_backups_data.html',
	},
	'Perform periodic recovery of the data to verify backup integrity and processes': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_periodic_recovery_testing_data.html',
	},
	'Deploy the workload to multiple locations': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_fault_isolation_multiaz_region_system.html',
	},
	'Select the appropriate locations for your multi-location deployment': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_fault_isolation_select_location.html',
	},
	'Automate recovery for components constrained to a single location': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_fault_isolation_single_az_system.html',
	},
	'Use bulkhead architectures to limit scope of impact': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_fault_isolation_use_bulkhead.html',
	},
	'Monitor all components of the workload to detect failures': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_monitoring_health.html',
	},
	'Fail over to healthy resources': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_failover2good.html',
	},
	'Automate healing on all layers': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_auto_healing_system.html',
	},
	'Rely on the data plane and not the control plane during recovery': {
		risk:
			'Medium: For certain types of service degradations, control plains are affected. Dependencies on extensive use of the control plane for remediation may increase recovery time (RTO) and mean time to recovery (MTTR).',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_avoid_control_plane.html',
	},
	'Use static stability to prevent bimodal behavior': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_static_stability.html',
	},
	'Send notifications when events impact availability': {
		risk:
			'Medium. Failure to implement appropriate monitoring and events notification mechanisms can result in failure to detect patterns of problems, including those addressed by auto healing. A team will only be made aware of system degradation when users contact customer service or by chance.',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_notifications_sent_system.html',
	},
	'Architect your product to meet availability targets and uptime service level agreements (SLAs)': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures_service_level_agreements.html',
	},
	'Use playbooks to investigate failures': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_playbook_resiliency.html',
	},
	'Perform post-incident analysis': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_rca_resiliency.html',
	},
	'Test functional requirements': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_test_functional.html',
	},
	'Test scaling and performance requirements': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_test_non_functional.html',
	},
	'Test resiliency using chaos engineering': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_failure_injection_resiliency.html',
	},
	'Conduct game days regularly': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_game_days_resiliency.html',
	},
	'Define recovery objectives for downtime and data loss': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_objective_defined_recovery.html',
	},
	'Use defined recovery strategies to meet the recovery objectives': {
		risk:
			'High. Without a planned, implemented, and tested DR strategy, you are unlikely to achieve recovery objectives in the event of a disaster.',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_disaster_recovery.html',
	},
	'Test disaster recovery implementation to validate the implementation': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_dr_tested.html',
	},
	'Manage configuration drift at the DR site or Region': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_config_drift.html',
	},
	'Automate recovery': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_auto_recovery.html',
	},
	'Evaluate external customer needs': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_priorities_ext_cust_needs.html',
	},
	'Evaluate internal customer needs': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_priorities_int_cust_needs.html',
	},
	'Evaluate governance requirements': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_priorities_governance_reqs.html',
	},
	'Evaluate compliance requirements': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_priorities_compliance_reqs.html',
	},
	'Evaluate threat landscape': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_priorities_eval_threat_landscape.html',
	},
	'Evaluate tradeoffs': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_priorities_eval_tradeoffs.html',
	},
	'Manage benefits and risks': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_priorities_manage_risk_benefit.html',
	},
	'Resources have identified owners': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ops_model_def_resource_owners.html',
	},
	'Processes and procedures have identified owners': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ops_model_def_proc_owners.html',
	},
	'Operations activities have identified owners responsible for their performance': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ops_model_def_activity_owners.html',
	},
	'Team members know what they are responsible for': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ops_model_know_my_job.html',
	},
	'Mechanisms exist to identify responsibility and ownership': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ops_model_find_owner.html',
	},
	'Mechanisms exist to request additions, changes, and exceptions': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ops_model_req_add_chg_exception.html',
	},
	'Responsibilities between teams are predefined or negotiated': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ops_model_def_neg_team_agreements.html',
	},
	'Executive Sponsorship': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_executive_sponsor.html',
	},
	'Team members are empowered to take action when outcomes are at risk': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_team_emp_take_action.html',
	},
	'Escalation is encouraged': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_team_enc_escalation.html',
	},
	'Communications are timely, clear, and actionable': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_effective_comms.html',
	},
	'Experimentation is encouraged': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_team_enc_experiment.html',
	},
	'Team members are enabled and encouraged to maintain and grow their skill sets': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_team_enc_learn.html',
	},
	'Team members are encouraged to maintain and grow their skill sets': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_team_enc_learn.html',
	},
	'Resource teams appropriately': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_team_res_appro.html',
	},
	'Diverse opinions are encouraged and sought within and across teams': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_org_culture_diverse_inc_access.html',
	},
	'Identify key performance indicators': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_observability_identify_kpis.html',
	},
	'Implement application telemetry': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_observability_application_telemetry.html',
	},
	'Implement user experience telemetry': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_observability_customer_telemetry.html',
	},
	'Implement dependency telemetry': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_observability_dependency_telemetry.html',
	},
	'Implement distributed tracing': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_observability_dist_trace.html',
	},
	'Use version control': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_version_control.html',
	},
	'Test and validate changes': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_test_val_chg.html',
	},
	'Use configuration management systems': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_conf_mgmt_sys.html',
	},
	'Use build and deployment management systems': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_build_mgmt_sys.html',
	},
	'Perform patch management': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_patch_mgmt.html',
	},
	'Share design standards': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_share_design_stds.html',
	},
	'Implement practices to improve code quality': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_code_quality.html',
	},
	'Use multiple environments': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_multi_env.html',
	},
	'Make frequent, small, reversible changes': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_freq_sm_rev_chg.html',
	},
	'Fully automate integration and deployment': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_dev_integ_auto_integ_deploy.html',
	},
	'Plan for unsuccessful changes': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_mit_deploy_risks_plan_for_unsucessful_changes.html',
	},
	'Test deployments': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_mit_deploy_risks_test_val_chg.html',
	},
	'Employ safe deployment strategies': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_mit_deploy_risks_deploy_mgmt_sys.html',
	},
	'Automate testing and rollback': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_mit_deploy_risks_auto_testing_and_rollback.html',
	},
	'Ensure personnel capability': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ready_to_support_personnel_capability.html',
	},
	'Use runbooks to perform procedures': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ready_to_support_use_runbooks.html',
	},
	'Use playbooks to investigate issues': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ready_to_support_use_playbooks.html',
	},
	'Make informed decisions to deploy systems and changes': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ready_to_support_informed_deploy_decisions.html',
	},
	'Create support plans for production workloads': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ready_to_support_enable_support_plans.html',
	},
	'Analyze workload metrics': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_workload_observability_analyze_workload_metrics.html',
	},
	'Analyze workload logs': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_workload_observability_analyze_workload_logs.html',
	},
	'Analyze workload traces': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_workload_observability_analyze_workload_traces.html',
	},
	'Create actionable alerts': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_workload_observability_create_alerts.html',
	},
	'Create dashboards': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_workload_observability_create_dashboards.html',
	},
	'Measure operations goals and KPIs with metrics': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_operations_health_measure_ops_goals_kpis.html',
	},
	'Communicate status and trends to ensure visibility into operation': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_operations_health_communicate_status_trends.html',
	},
	'Review operations metrics and prioritize improvement': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_operations_health_review_ops_metrics_prioritize_improvement.html',
	},
	'Use a process for event, incident, and problem management': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_event_incident_problem_process.html',
	},
	'Have a process per alert': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_process_per_alert.html',
	},
	'Prioritize operational events based on business impact': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_prioritize_events.html',
	},
	'Define escalation paths': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_define_escalation_paths.html',
	},
	'Define a customer communication plan for outages': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_push_notify.html',
	},
	'Communicate status through dashboards': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_dashboards.html',
	},
	'Automate responses to events': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_auto_event_response.html',
	},
	'Have a process for continuous improvement': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_process_cont_imp.html',
	},
	'Perform post-incident analysis': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_perform_rca_process.html',
	},
	'Implement feedback loops': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_feedback_loops.html',
	},
	'Perform knowledge management': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_knowledge_management.html',
	},
	'Define drivers for improvement': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_drivers_for_imp.html',
	},
	'Validate insights': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_validate_insights.html',
	},
	'Perform operations metrics reviews': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_metrics_review.html',
	},
	'Document and share lessons learned': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_share_lessons_learned.html',
	},
	'Allocate time to make improvements': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_allocate_time_for_imp.html',
	},
	'Learn about and understand available cloud services and features': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_architecture_understand_cloud_services_and_features.html',
	},
	'Use guidance from your cloud provider or an appropriate partner to learn about architecture patterns and best practices': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_architecture_guidance_architecture_patterns_best_practices.html',
	},
	'Factor cost into architectural decisions': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_architecture_factor_cost_into_architectural_decisions.html',
	},
	'Evaluate how trade-offs impact customers and architecture efficiency': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_architecture_evaluate_trade_offs.html',
	},
	'Use policies and reference architectures': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_architecture_use_policies_and_reference_architectures.html',
	},
	'Use benchmarking to drive architectural decisions': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_architecture_use_benchmarking.html',
	},
	'Use a data-driven approach for architectural choices': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_architecture_use_data_driven_approach.html',
	},
	'Select the best compute options for your workload': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_compute_hardware_select_best_compute_options.html',
	},
	'Understand the available compute configuration and features': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_compute_hardware_understand_compute_configuration_features.html',
	},
	'Collect compute-related metrics': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_compute_hardware_collect_compute_related_metrics.html',
	},
	'Configure and right-size compute resources': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_compute_hardware_configure_and_right_size_compute_resources.html',
	},
	'Scale your compute resources dynamically': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_compute_hardware_scale_compute_resources_dynamically.html',
	},
	'Use optimized hardware-based compute accelerators': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_compute_hardware_compute_accelerators.html',
	},
	'Use a purpose-built data store that best supports your data access and storage requirements': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_data_use_purpose_built_data_store.html',
	},
	'Evaluate available configuration options for data store': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_data_evaluate_configuration_options_data_store.html',
	},
	'Collect and record data store performance metrics': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_data_collect_record_data_store_performance_metrics.html',
	},
	'Implement strategies to improve query performance in data store': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_data_implement_strategies_to_improve_query_performance.html',
	},
	'Implement data access patterns that utilize caching': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_data_access_patterns_caching.html',
	},
	'Understand how networking impacts performance': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_networking_understand_how_networking_impacts_performance.html',
	},
	'Evaluate available networking features': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_networking_evaluate_networking_features.html',
	},
	'Choose appropriate dedicated connectivity or VPN for your workload': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_networking_choose_appropriate_dedicated_connectivity_or_vpn.html',
	},
	'Use load balancing to distribute traffic across multiple resources': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_networking_load_balancing_distribute_traffic.html',
	},
	'Choose network protocols to improve performance': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_networking_choose_network_protocols_improve_performance.html',
	},
	"Choose your workload's location based on network requirements": {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_networking_choose_workload_location_network_requirements.html',
	},
	'Optimize network configuration based on metrics': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_networking_optimize_network_configuration_based_on_metrics.html',
	},
	'Establish key performance indicators (KPIs) to measure workload health and performance': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_process_culture_establish_key_performance_indicators.html',
	},
	'Use monitoring solutions to understand the areas where performance is most critical': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_process_culture_use_monitoring_solutions.html',
	},
	'Define a process to improve workload performance': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_process_culture_workload_performance.html',
	},
	'Load test your workload': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_process_culture_load_test.html',
	},
	'Use automation to proactively remediate performance-related issues': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_process_culture_automation_remediate_issues.html',
	},
	'Keep your workload and services up-to-date': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_process_culture_keep_workload_and_services_up_to_date.html',
	},
	'Review metrics at regular intervals': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_process_culture_review_metrics.html',
	},
	'Establish ownership of cost optimization': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_function.html',
	},
	'Establish a partnership between finance and technology': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_partnership.html',
	},
	'Establish cloud budgets and forecasts': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_budget_forecast.html',
	},
	'Implement cost awareness in your organizational processes': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_cost_awareness.html',
	},
	'Report and notify on cost optimization': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_usage_report.html',
	},
	'Monitor cost proactively': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_proactive_process.html',
	},
	'Keep up-to-date with new service releases': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_scheduled.html',
	},
	'Create a cost-aware culture': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_culture.html',
	},
	'Quantify business value from cost optimization': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_quantify_value.html',
	},
	'Develop policies based on your organization requirements': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_policies.html',
	},
	'Implement goals and targets': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_goal_target.html',
	},
	'Implement an account structure': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_account_structure.html',
	},
	'Implement groups and roles': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_groups_roles.html',
	},
	'Implement cost controls': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_controls.html',
	},
	'Track project lifecycle': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_govern_usage_track_lifecycle.html',
	},
	'Configure detailed information sources': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_monitor_usage_detailed_source.html',
	},
	'Add organization information to cost and usage': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_monitor_usage_org_information.html',
	},
	'Identify cost attribution categories': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_monitor_usage_define_attribution.html',
	},
	'Establish organization metrics': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_monitor_usage_define_kpi.html',
	},
	'Configure billing and cost management tools': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_monitor_usage_config_tools.html',
	},
	'Allocate costs based on workload metrics': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_monitor_usage_allocate_outcome.html',
	},
	'Track resources over their lifetime': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning_resources_track.html',
	},
	'Implement a decommissioning process': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning_resources_implement_process.html',
	},
	'Decommission resources': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning_resources_decommission.html',
	},
	'Decommission resources automatically': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning_resources_decomm_automated.html',
	},
	'Enforce data retention policies': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning_resources_data_retention.html',
	},
	'Identify organization requirements for cost': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_select_service_requirements.html',
	},
	'Analyze all components of the workload': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_select_service_analyze_all.html',
	},
	'Perform a thorough analysis of each component': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_select_service_thorough_analysis.html',
	},
	'Select software with cost-effective licensing': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_select_service_licensing.html',
	},
	'Select components of this workload to optimize cost in line with organization priorities': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_select_service_select_for_cost.html',
	},
	'Perform cost analysis for different usage over time': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_select_service_analyze_over_time.html',
	},
	'Perform cost modeling': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_type_size_number_resources_cost_modeling.html',
	},
	'Select resource type, size, and number based on data': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_type_size_number_resources_data.html',
	},
	'Select resource type, size, and number automatically based on metrics': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_type_size_number_resources_metrics.html',
	},
	'Perform pricing model analysis': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_pricing_model_analysis.html',
	},
	'Choose Regions based on cost': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_pricing_model_region_cost.html',
	},
	'Select third-party agreements with cost-efficient terms': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_pricing_model_third_party.html',
	},
	'Implement pricing models for all components of this workload': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_pricing_model_implement_models.html',
	},
	'Perform pricing model analysis at the management account level': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_pricing_model_master_analysis.html',
	},
	'Perform data transfer modeling': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_data_transfer_modeling.html',
	},
	'Select components to optimize data transfer cost': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_data_transfer_optimized_components.html',
	},
	'Implement services to reduce data transfer costs': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_data_transfer_implement_services.html',
	},
	'Perform an analysis on the workload demand': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_manage_demand_resources_cost_analysis.html',
	},
	'Implement a buffer or throttle to manage demand': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_manage_demand_resources_buffer_throttle.html',
	},
	'Supply resources dynamically': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_manage_demand_resources_dynamic.html',
	},
	'Develop a workload review process': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_evaluate_new_services_review_process.html',
	},
	'Review and analyze this workload regularly': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_evaluate_new_services_review_workload.html',
	},
	'Perform automation for operations': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_evaluate_cost_effort_automations_operations.html',
	},
	'Choose Region based on both business requirements and sustainability goals': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_region_a2.html',
	},
	'Scale workload infrastructure dynamically': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a2.html',
	},
	'Align SLAs with sustainability goals': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a3.html',
	},
	'Stop the creation and maintenance of unused assets': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a4.html',
	},
	'Optimize geographic placement of workloads based on their networking requirements': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a5.html',
	},
	'Optimize team member resources for activities performed': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a6.html',
	},
	'Implement buffering or throttling to flatten the demand curve': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_user_a7.html',
	},
	'Optimize software and architecture for asynchronous and scheduled jobs': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_software_a2.html',
	},
	'Remove or refactor workload components with low or no use': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_software_a3.html',
	},
	'Optimize areas of code that consume the most time or resources': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_software_a4.html',
	},
	'Optimize impact on devices and equipment': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_software_a5.html',
	},
	'Use software patterns and architectures that best support data access and storage patterns': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_software_a6.html',
	},
	'Implement a data classification policy': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a2.html',
	},
	'Use technologies that support data access and storage patterns': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a3.html',
	},
	'Use policies to manage the lifecycle of your datasets': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a4.html',
	},
	'Use elasticity and automation to expand block storage or file system': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a5.html',
	},
	'Remove unneeded or redundant data': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a6.html',
	},
	'Use shared file systems or storage to access common data': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a7.html',
	},
	'Minimize data movement across networks': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a8.html',
	},
	'Back up data only when difficult to recreate': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_data_a9.html',
	},
	'Use the minimum amount of hardware to meet your needs': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_hardware_a2.html',
	},
	'Use instance types with the least impact': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_hardware_a3.html',
	},
	'Use managed services': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_hardware_a4.html',
	},
	'Optimize your use of hardware-based compute accelerators': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_hardware_a5.html',
	},
	'Adopt methods that can rapidly introduce sustainability improvements': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_dev_a2.html',
	},
	'Keep your workload up-to-date': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_dev_a3.html',
	},
	'Increase utilization of build environments': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_dev_a4.html',
	},
	'Use managed device farms for testing': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_dev_a5.html',
	},
	'Separate workloads using accounts': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate_multi_accounts.html',
	},
	'Secure account root user and properties': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate_aws_account.html',
	},
	'Identify and validate control objectives': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate_control_objectives.html',
	},
	'Keep up-to-date with security threats': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate_updated_threats.html',
	},
	'Keep up-to-date with security recommendations': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate_updated_recommendations.html',
	},
	'Automate testing and validation of security controls in pipelines': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate_test_validate_pipeline.html',
	},
	'Identify threats and prioritize mitigations using a threat model': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate_threat_model.html',
	},
	'Evaluate and implement new security services and features regularly': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate_implement_services_features.html',
	},
	'Use strong sign-in mechanisms': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_enforce_mechanisms.html',
	},
	'Use temporary credentials': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_unique.html',
	},
	'Store and use secrets securely': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_secrets.html',
	},
	'Rely on a centralized identity provider': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_identity_provider.html',
	},
	'Audit and rotate credentials periodically': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_audit.html',
	},
	'Leverage user groups and attributes': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_groups_attributes.html',
	},
	'Define access requirements': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_define.html',
	},
	'Grant least privilege access': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_least_privileges.html',
	},
	'Establish emergency access process': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_emergency_process.html',
	},
	'Reduce permissions continuously': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_continuous_reduction.html',
	},
	'Define permission guardrails for your organization': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_define_guardrails.html',
	},
	'Manage access based on lifecycle': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_lifecycle.html',
	},
	'Analyze public and cross-account access': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_analyze_cross_account.html',
	},
	'Share resources securely within your organization': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_share_securely.html',
	},
	'Share resources securely with a third party': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_share_securely_third_party.html',
	},
	'Configure service and application logging': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_detect_investigate_events_app_service_logging.html',
	},
	'Analyze logs, findings, and metrics centrally': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_detect_investigate_events_analyze_all.html',
	},
	'Automate response to events': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_detect_investigate_events_auto_response.html',
	},
	'Implement actionable security events': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_detect_investigate_events_actionable_events.html',
	},
	'Create network layers': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_network_protection_create_layers.html',
	},
	'Control traffic at all layers': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_network_protection_layered.html',
	},
	'Automate network protection': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_network_protection_auto_protect.html',
	},
	'Implement inspection and protection': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_network_protection_inspection.html',
	},
	'Perform vulnerability management': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_compute_vulnerability_management.html',
	},
	'Reduce attack surface': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_compute_reduce_surface.html',
	},
	'Implement managed services': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_compute_implement_managed_services.html',
	},
	'Automate compute protection': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_compute_auto_protection.html',
	},
	'Enable people to perform actions at a distance': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_compute_actions_distance.html',
	},
	'Validate software integrity': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_compute_validate_software_integrity.html',
	},
	'Identify the data within your workload': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_data_classification_identify_data.html',
	},
	'Define data protection controls': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_data_classification_define_protection.html',
	},
	'Automate identification and classification': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_data_classification_auto_classification.html',
	},
	'Define data lifecycle management': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_data_classification_lifecycle_management.html',
	},
	'Implement secure key management': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_rest_key_mgmt.html',
	},
	'Enforce encryption at rest': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_rest_encrypt.html',
	},
	'Automate data at rest protection': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_rest_automate_protection.html',
	},
	'Enforce access control': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_rest_access_control.html',
	},
	'Use mechanisms to keep people away from data': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_rest_use_people_away.html',
	},
	'Implement secure key and certificate management': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_transit_key_cert_mgmt.html',
	},
	'Enforce encryption in transit': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_transit_encrypt.html',
	},
	'Automate detection of unintended data access': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_transit_auto_unintended_access.html',
	},
	'Authenticate network communications': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_transit_authentication.html',
	},
	'Identify key personnel and external resources': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_incident_response_identify_personnel.html',
	},
	'Develop incident management plans': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_incident_response_develop_management_plans.html',
	},
	'Prepare forensic capabilities': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_incident_response_prepare_forensic.html',
	},
	'Develop and test security incident response playbooks': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_incident_response_playbooks.html',
	},
	'Pre-provision access': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_incident_response_pre_provision_access.html',
	},
	'Pre-deploy tools': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_incident_response_pre_deploy_tools.html',
	},
	'Run simulations': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_incident_response_run_game_days.html',
	},
	'Establish a framework for learning from incidents': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_incident_response_establish_incident_framework.html',
	},
	'Train for application security': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_train_for_application_security.html',
	},
	'Automate testing throughout the development and release lifecycle': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_automate_testing_throughout_lifecycle.html',
	},
	'Perform regular penetration testing': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_perform_regular_penetration_testing.html',
	},
	'Manual code reviews': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_manual_code_reviews.html',
	},
	'Centralize services for packages and dependencies': {
		risk: 'Medium',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_centralize_services_for_packages_and_dependencies.html',
	},
	'Deploy software programmatically': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_deploy_software_programmatically.html',
	},
	'Regularly assess security properties of the pipelines': {
		risk: 'High',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_regularly_assess_security_properties_of_pipelines.html',
	},
	'Build a program that embeds security ownership in workload teams': {
		risk: 'Low',
		url:
			'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_appsec_build_program_that_embeds_security_ownership_in_teams.html',
	},
};

export default riskMapping;
