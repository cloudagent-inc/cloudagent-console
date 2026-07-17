import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

function Govenance({ formData, setFormData }) {
  const isCloudFormation =
    (formData?.deploymentPreferences?.method || 'cloudformation') === 'cloudformation';

  return (
    <div className="space-y-6">
      {isCloudFormation && (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          CloudFormation Change Approvals
        </h3>
        <div className="space-y-4">
          <div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="immediate-deploy"
                  name="changeSet"
                  value={false}
                  checked={!formData.deploymentPreferences.changeSet}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      deploymentPreferences: {
                        ...prev.deploymentPreferences,
                        changeSet: false,
                      },
                    }))
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <Label
                  htmlFor="immediate-deploy"
                  className="font-medium text-gray-700"
                >
                  Deploy immediately
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="changeset-deploy"
                  name="changeSet"
                  value={true}
                  checked={formData.deploymentPreferences.changeSet}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      deploymentPreferences: {
                        ...prev.deploymentPreferences,
                        changeSet: true,
                      },
                    }))
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <Label
                  htmlFor="changeset-deploy"
                  className="font-medium text-gray-700"
                >
                  Create change set for review
                </Label>
              </div>
            </div>
          </div>

          {formData.deploymentPreferences.changeSet && (
            <div>
              <Label className="mb-2 block">Notification Settings</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="email-notifications"
                    checked={
                      formData.deploymentPreferences.changeSetNotifications?.email
                        ?.enabled || false
                    }
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        deploymentPreferences: {
                          ...prev.deploymentPreferences,
                          changeSetNotifications: {
                            ...prev.deploymentPreferences
                              .changeSetNotifications,
                            email: {
                              ...prev.deploymentPreferences
                                .changeSetNotifications?.email,
                              enabled: e.target.checked,
                            },
                          },
                        },
                      }))
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <Label
                    htmlFor="email-notifications"
                    className="font-medium text-gray-700"
                  >
                    Email notifications
                  </Label>
                </div>

                {formData.deploymentPreferences.changeSetNotifications?.email
                  ?.enabled && (
                  <div className="ml-6">
                    <Label className="mb-2 block text-sm text-gray-600">
                      Email Address(es) (comma separated)
                    </Label>
                    <Input
                      value={
                        formData.deploymentPreferences.changeSetNotifications
                          ?.email?.address || ''
                      }
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          deploymentPreferences: {
                            ...prev.deploymentPreferences,
                            changeSetNotifications: {
                              ...prev.deploymentPreferences
                                .changeSetNotifications,
                              email: {
                                ...prev.deploymentPreferences
                                  .changeSetNotifications?.email,
                                address: e.target.value,
                              },
                            },
                          },
                        }))
                      }
                      placeholder="Enter email address for notifications"
                      className="w-full"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="slack-notifications"
                    disabled
                    className="h-4 w-4 text-gray-400 focus:ring-gray-500 border-gray-300 cursor-not-allowed"
                  />
                  <Label
                    htmlFor="slack-notifications"
                    className="font-medium text-gray-400 cursor-not-allowed"
                  >
                    Slack notifications (Coming soon)
                  </Label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Required Resource Tags
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Required Resource Tags</Label>
            <div className="space-y-3">
              {Array.isArray(formData.deploymentPreferences.requiredTags) &&
              formData.deploymentPreferences.requiredTags.length > 0 ? (
                formData.deploymentPreferences.requiredTags.map(
                  (tag, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Input
                            value={tag.key || ''}
                            onChange={(e) => {
                              const newTags = [
                                ...formData.deploymentPreferences.requiredTags,
                              ];
                              newTags[index] = {
                                ...newTags[index],
                                key: e.target.value,
                              };
                              setFormData((prev) => ({
                                ...prev,
                                deploymentPreferences: {
                                  ...prev.deploymentPreferences,
                                  requiredTags: newTags,
                                },
                              }));
                            }}
                            placeholder="Tag key (e.g., environment)"
                            className="mb-2"
                          />
                          <Input
                            value={tag.value || ''}
                            onChange={(e) => {
                              const newTags = [
                                ...formData.deploymentPreferences.requiredTags,
                              ];
                              newTags[index] = {
                                ...newTags[index],
                                value: e.target.value,
                              };
                              setFormData((prev) => ({
                                ...prev,
                                deploymentPreferences: {
                                  ...prev.deploymentPreferences,
                                  requiredTags: newTags,
                                },
                              }));
                            }}
                            placeholder="Required value (optional)"
                            className="mb-2"
                          />
                          <Input
                            value={tag.notes || ''}
                            onChange={(e) => {
                              const newTags = [
                                ...formData.deploymentPreferences.requiredTags,
                              ];
                              newTags[index] = {
                                ...newTags[index],
                                notes: e.target.value,
                              };
                              setFormData((prev) => ({
                                ...prev,
                                deploymentPreferences: {
                                  ...prev.deploymentPreferences,
                                  requiredTags: newTags,
                                },
                              }));
                            }}
                            placeholder="Optional: Describe usage (e.g., 'Required for EC2 instances')"
                            className="text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newTags =
                              formData.deploymentPreferences.requiredTags.filter(
                                (_, i) => i !== index
                              );
                            setFormData((prev) => ({
                              ...prev,
                              deploymentPreferences: {
                                ...prev.deploymentPreferences,
                                requiredTags: newTags,
                              },
                            }));
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                )
              ) : (
                <div className="text-sm text-gray-500">
                  No required tags configured
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newTags = [
                    ...(formData.deploymentPreferences.requiredTags || []),
                    { key: '', value: '', notes: '' },
                  ];
                  setFormData((prev) => ({
                    ...prev,
                    deploymentPreferences: {
                      ...prev.deploymentPreferences,
                      requiredTags: newTags,
                    },
                  }));
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tag
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Govenance;


