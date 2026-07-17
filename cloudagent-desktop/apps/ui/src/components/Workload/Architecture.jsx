import React from 'react';
import { Label } from '@/components/ui/label';

function Architecture({ formData, setFormData, applyPreset }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Architecture Preferences
          </h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="preset-select" className="text-sm text-gray-600">
              Apply Preset:
            </Label>
            <select
              id="preset-select"
              onChange={(e) => {
                if (e.target.value) {
                  applyPreset(e.target.value);
                  e.target.value = '';
                }
              }}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              defaultValue=""
            >
              <option value="">Select a preset...</option>
              <option value="Production App/Environment">
                Production App/Environment
              </option>
              <option value="Sandbox/Testing">Sandbox/Testing</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Instance Size</Label>
              <select
                value={
                  formData.deploymentPreferences.architecturePreferences
                    ?.instanceSize || 'No Preference'
                }
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deploymentPreferences: {
                      ...prev.deploymentPreferences,
                      architecturePreferences: {
                        ...prev.deploymentPreferences.architecturePreferences,
                        instanceSize: e.target.value,
                      },
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="No Preference">No Preference</option>
                <option value="Large">Large</option>
                <option value="Small">Small</option>
              </select>
            </div>

            <div>
              <Label className="mb-2 block">Database Preferences</Label>
              <select
                value={
                  formData.deploymentPreferences.architecturePreferences
                    ?.databasePreference || 'No Preference'
                }
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deploymentPreferences: {
                      ...prev.deploymentPreferences,
                      architecturePreferences: {
                        ...prev.deploymentPreferences.architecturePreferences,
                        databasePreference: e.target.value,
                      },
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="No Preference">No Preference</option>
                <option value="Aurora">Aurora</option>
                <option value="MySQL">MySQL</option>
                <option value="Postgres">Postgres</option>
              </select>
            </div>

            <div>
              <Label className="mb-2 block">NoSQL Preference</Label>
              <select
                value={
                  formData.deploymentPreferences.architecturePreferences
                    ?.nosqlPreference || 'No Preference'
                }
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deploymentPreferences: {
                      ...prev.deploymentPreferences,
                      architecturePreferences: {
                        ...prev.deploymentPreferences.architecturePreferences,
                        nosqlPreference: e.target.value,
                      },
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="No Preference">No Preference</option>
                <option value="DynamoDB">DynamoDB</option>
                <option value="RDS MongoDB">RDS MongoDB</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Static Websites</Label>
              <select
                value={
                  formData.deploymentPreferences.architecturePreferences
                    ?.staticWebsite || 'No Preference'
                }
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deploymentPreferences: {
                      ...prev.deploymentPreferences,
                      architecturePreferences: {
                        ...prev.deploymentPreferences.architecturePreferences,
                        staticWebsite: e.target.value,
                      },
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="No Preference">No Preference</option>
                <option value="Cloudfront + S3">Cloudfront + S3</option>
                <option value="Amplify">Amplify</option>
              </select>
            </div>

            <div>
              <Label className="mb-2 block">Dynamic Websites</Label>
              <select
                value={
                  formData.deploymentPreferences.architecturePreferences
                    ?.dynamicWebsite || 'No Preference'
                }
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deploymentPreferences: {
                      ...prev.deploymentPreferences,
                      architecturePreferences: {
                        ...prev.deploymentPreferences.architecturePreferences,
                        dynamicWebsite: e.target.value,
                      },
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="No Preference">No Preference</option>
                <option value="ECS + ALB">ECS + ALB</option>
                <option value="EC2 + ALB">EC2 + ALB</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Architecture;


