/**
 * Azure onboarding templates for service principal creation.
 * Imported from asecurecloud — only Subs-SP and MgtGrp-SP templates
 * are used in Phase 1 (Azure subscriptions only, no Entra ID / M365).
 *
 * @param {Object} options
 * @param {string} options.templateName - One of: 'Subs-SP.ps1', 'Subs-SP.tf', 'MgtGrp-SP.ps1', 'MgtGrp-SP.tf'
 * @param {string} [options.managementGroupId] - Management group ID (for MgtGrp templates)
 * @param {string[]} [options.subscriptionIds] - Array of subscription IDs (for Subs templates)
 * @param {string} options.providerName - Display name for the provider (e.g. "CloudAgent")
 */
export const getAzureOnboardingTemplate = ({
	templateName,
	managementGroupId = '',
	subscriptionIds = [],
	providerName = 'CloudAgent',
}) => {
	switch (templateName) {
		case 'MgtGrp-SP.ps1':
			return `
param (
    $DisplayName = "${providerName}-SP", 
    $managementGroupID = "${managementGroupId}")

$managementScope = "/providers/Microsoft.Management/managementGroups/" + $managementGroupID

$client_secret=(az ad sp create-for-rbac --years 1 --name $DisplayName --role "Reader" --query 'password' -o tsv --scopes $managementScope)

$appID = (az ad sp list --display-name $DisplayName --query "[].{appID:appId}" --output tsv)

$tenantID = (az ad sp list --display-name $DisplayName --query "[].{tenant:appOwnerOrganizationId}" --output tsv)

$apis = (
    "7ab1d382-f21e-4acd-a863-ba3e13f7da61",
    "df021288-bdef-4463-88db-98f22de89214",
    "246dd0d5-5bd0-4def-940b-0421030a5b68",
    "b0afded3-3588-46d8-8b3d-9842eff778da",
    "dc5007c0-2d7d-4c42-879c-2dab87571379",
    "607c7344-0eed-41e5-823a-9695ebe1b7b0",
    "6e472fd1-ad78-48da-a0f0-97ab2c6b769e",
    "38d9df27-64da-44fd-b7c5-a6fbac20248f"
)

foreach ($api in $apis) {
    az ad app permission add --id $appID --api 00000003-0000-0000-c000-000000000000 --api-permissions $api=Role
}

az ad app permission admin-consent --id $appID 

Write-Host "Assigning Reader role to the application at the management group scope"
az role assignment create --assignee $appID --role "Reader" --scope $managementScope

Write-Host "client secret: "$client_secret
Write-Host "Application/Client ID: "$appID
Write-Host "Tenant ID: "$tenantID
`;

		case 'MgtGrp-SP.tf':
			return `provider "azuread" {}

provider "null" {}

variable "service_principal_name" {
  description = "The name of the ${providerName} service principal"
  default     = "${providerName}-MGT-SP"
}

variable "rbac_role_name" {
  default = "Reader"
}

variable "mgmt-group-id" {
  default     = "${managementGroupId}"
  description = "The management group ID to assign the service principal to."
}

data "azuread_client_config" "current" {}

data "azuread_application_published_app_ids" "well_known" {}

locals {
  graph_permissions = {
    "User.Read.All"                          = "df021288-bdef-4463-88db-98f22de89214"
    "Policy.Read.All"                        = "246dd0d5-5bd0-4def-940b-0421030a5b68"
    "AuditLog.Read.All"                      = "b0afded3-3588-46d8-8b3d-9842eff778da"
    "Directory.Read.All"                     = "7ab1d382-f21e-4acd-a863-ba3e13f7da61"
    "IdentityRiskyUser.Read.All"             = "dc5007c0-2d7d-4c42-879c-2dab87571379"
    "IdentityRiskyServicePrincipal.Read.All" = "607c7344-0eed-41e5-823a-9695ebe1b7b0"
    "IdentityRiskEvent.Read.All"             = "6e472fd1-ad78-48da-a0f0-97ab2c6b769e"
    "UserAuthenticationMethod.Read.All"      = "38d9df27-64da-44fd-b7c5-a6fbac20248f"
    "SecurityEvents.Read.All"                = "bf394140-e372-4bf9-a898-299cfc7564e5"
  }
}

resource "azuread_service_principal" "msgraph" {
  client_id    = data.azuread_application_published_app_ids.well_known.result.MicrosoftGraph
  use_existing = true
}

resource "azuread_application" "aad-app" {
  display_name = var.service_principal_name
  owners       = [data.azuread_client_config.current.object_id]
  required_resource_access {
    resource_app_id = data.azuread_application_published_app_ids.well_known.result.MicrosoftGraph

    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["User.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["Policy.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["AuditLog.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["Directory.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["IdentityRiskyUser.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["IdentityRiskyServicePrincipal.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["IdentityRiskEvent.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["UserAuthenticationMethod.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["SecurityEvents.Read.All"]
      type = "Role"
    }
  }
}

resource "azuread_service_principal" "aad-sp" {
  client_id   = azuread_application.aad-app.client_id
  owners      = [data.azuread_client_config.current.object_id]
  description = "This service principal is used by ${providerName} for security assessments."
}

resource "azuread_service_principal_password" "aad-sp-pw" {
  service_principal_id = azuread_service_principal.aad-sp.id
  end_date = timeadd(timestamp(), "8760h")
}

################### admin consent for the application permissions#################

resource "azuread_app_role_assignment" "app-assignment" {
  for_each    = local.graph_permissions
  app_role_id = azuread_service_principal.msgraph.app_role_ids[each.key]

  principal_object_id = azuread_service_principal.aad-sp.object_id
  resource_object_id  = azuread_service_principal.msgraph.object_id
}

########### ManagementGroup RBAC role assignment to the service principal##########

resource "null_resource" "sp-rbac" {
  triggers = {
    principal_id = azuread_service_principal.aad-sp.object_id
  }

  provisioner "local-exec" {
    command = <<EOT
      az role assignment create \\
        --assignee \${azuread_service_principal.aad-sp.object_id} \\
        --role "\${var.rbac_role_name}" \\
        --scope "/providers/Microsoft.Management/managementGroups/\${var.mgmt-group-id}"
    EOT
  }
}

################ Output to gather for ${providerName} onboarding ####################

output "tenant_id" {
  description = "The tenant id of the AzureAD."
  value       = data.azuread_client_config.current.tenant_id
}

output "client_id" {
  description = "The application or client id of AzureAD application."
  value       = azuread_application.aad-app.client_id
}

output "client_secret" {
  description = "Password for service principal. Use: terraform output -raw client_secret"
  value       = azuread_service_principal_password.aad-sp-pw.value
  sensitive   = true
}

output "Important_Message" {
  description = "Message to display at the end of terraform apply"
  value = trimspace(<<EOF
Please use these 3 outputs to onboard this environment into your ${providerName} account.
EOF
  )
}
`;

		case 'Subs-SP.ps1':
			return `param (
    $DisplayName = "${providerName}-SP"
)

# Array of subscription IDs
$subscription_ids = @(${subscriptionIds.map((s) => `"${s}"`).join(', ')})    

foreach ($subscription_id in $subscription_ids) {
    $scope = "/subscriptions/" + $subscription_id

    Write-Host "Provisioning access for subscription ID: $subscription_id"

    $client_secret = (az ad sp create-for-rbac --years 1 --name $DisplayName --role "Reader" --query 'password' -o tsv --scopes $scope)

    $appID = (az ad sp list --display-name $DisplayName --query "[].{appID:appId}" --output tsv)

    $tenantID = (az ad sp list --display-name $DisplayName --query "[].{tenant:appOwnerOrganizationId}" --output tsv)

    $apis = @(
        "7ab1d382-f21e-4acd-a863-ba3e13f7da61",
        "df021288-bdef-4463-88db-98f22de89214",
        "246dd0d5-5bd0-4def-940b-0421030a5b68",
        "b0afded3-3588-46d8-8b3d-9842eff778da",
        "dc5007c0-2d7d-4c42-879c-2dab87571379",
        "607c7344-0eed-41e5-823a-9695ebe1b7b0",
        "6e472fd1-ad78-48da-a0f0-97ab2c6b769e",
        "38d9df27-64da-44fd-b7c5-a6fbac20248f"
    )

    foreach ($api in $apis) {
        az ad app permission add --id $appID --api 00000003-0000-0000-c000-000000000000 --api-permissions $api=Role
    }

    az ad app permission admin-consent --id $appID

    Write-Host "Assigning Reader role to the application at the subscription scope for subscription ID: $subscription_id"
    az role assignment create --assignee $appID --role "Reader" --scope $scope

    Write-Host "client secret: $client_secret"
    Write-Host "Application/Client ID: $appID"
    Write-Host "Tenant ID: $tenantID"
}
`;

		case 'Subs-SP.tf':
			return `
provider "azurerm" {
  features {}
  subscription_id = var.subscription_id[0]
}

provider "azuread" {}

variable "service_principal_name" {
  description = "The name of the ${providerName} service principal"
  default     = "${providerName}-SP"
}

variable "rbac_role_names" {
  default     = ["Reader", "Backup Reader"]
  description = "The RBAC roles to assign to the service principal"
}

variable "subscription_id" {
  default     = [${subscriptionIds.map((s) => `"${s}"`).join(', ')}]
  description = "The subscription ID to assign the service principal to."
}

data "azuread_client_config" "current" {}

data "azuread_application_published_app_ids" "well_known" {}

locals {
  graph_permissions = {
    "User.Read.All"                          = "df021288-bdef-4463-88db-98f22de89214"
    "Policy.Read.All"                        = "246dd0d5-5bd0-4def-940b-0421030a5b68"
    "AuditLog.Read.All"                      = "b0afded3-3588-46d8-8b3d-9842eff778da"
    "Directory.Read.All"                     = "7ab1d382-f21e-4acd-a863-ba3e13f7da61"
    "IdentityRiskyUser.Read.All"             = "dc5007c0-2d7d-4c42-879c-2dab87571379"
    "IdentityRiskyServicePrincipal.Read.All" = "607c7344-0eed-41e5-823a-9695ebe1b7b0"
    "IdentityRiskEvent.Read.All"             = "6e472fd1-ad78-48da-a0f0-97ab2c6b769e"
    "UserAuthenticationMethod.Read.All"      = "38d9df27-64da-44fd-b7c5-a6fbac20248f"
    "SecurityEvents.Read.All"                = "bf394140-e372-4bf9-a898-299cfc7564e5"
  }
}

resource "azuread_service_principal" "msgraph" {
  client_id    = data.azuread_application_published_app_ids.well_known.result.MicrosoftGraph
  use_existing = true
}

resource "azuread_application" "aad-app" {
  display_name = var.service_principal_name
  owners       = [data.azuread_client_config.current.object_id]
  required_resource_access {
    resource_app_id = data.azuread_application_published_app_ids.well_known.result.MicrosoftGraph

    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["User.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["Policy.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["AuditLog.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["Directory.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["IdentityRiskyUser.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["IdentityRiskyServicePrincipal.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["IdentityRiskEvent.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["UserAuthenticationMethod.Read.All"]
      type = "Role"
    }
    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["SecurityEvents.Read.All"]
      type = "Role"
    }
  }
}

resource "azuread_service_principal" "aad-sp" {
  client_id   = azuread_application.aad-app.client_id
  owners      = [data.azuread_client_config.current.object_id]
  description = "This service principal is used by ${providerName} for security assessments."
}

resource "azuread_service_principal_password" "aad-sp-pw" {
  service_principal_id = azuread_service_principal.aad-sp.id
  end_date = timeadd(timestamp(), "8760h")
}

################### admin consent for the application permissions#################

resource "azuread_app_role_assignment" "app-assignment" {
  for_each    = local.graph_permissions
  app_role_id = azuread_service_principal.msgraph.app_role_ids[each.key]

  principal_object_id = azuread_service_principal.aad-sp.object_id
  resource_object_id  = azuread_service_principal.msgraph.object_id
}

######### Subscriptions RBAC role assignment to the service principal##############

resource "azurerm_role_assignment" "sp-rbac-sub" {
  for_each = {
    for pair in setproduct(var.subscription_id, var.rbac_role_names) : "\${pair[0]}-\${pair[1]}" => {
      subscription_id = pair[0]
      role_name       = pair[1]
    }
  }
  scope                = "/subscriptions/\${each.value.subscription_id}"
  role_definition_name = each.value.role_name
  principal_id         = azuread_service_principal.aad-sp.object_id
}

################ Output to gather for ${providerName} onboarding ####################

output "tenant_id" {
  description = "The tenant id of the AzureAD."
  value       = data.azuread_client_config.current.tenant_id
}

output "client_id" {
  description = "The application or client id of AzureAD application."
  value       = azuread_application.aad-app.client_id
}

output "client_secret" {
  description = "Password for service principal. Use: terraform output -raw client_secret"
  value       = azuread_service_principal_password.aad-sp-pw.value
  sensitive   = true
}

output "Important_Message" {
  description = "Message to display at the end of terraform apply"
  value = trimspace(<<EOF
Please use these 3 outputs to onboard this environment into your ${providerName} account.
EOF
  )
}
`;

		default:
			return '';
	}
};
