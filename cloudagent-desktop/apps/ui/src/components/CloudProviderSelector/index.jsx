import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Icons } from '../icons';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '@/hooks/useAnalytics';

const PROVIDERS = [
  {
    id: 'aws',
    name: 'AWS Account',
    icon: Icons.aws,
    comingSoon: false,
  },
  {
    id: 'aws_org',
    name: 'AWS Org',
    icon: Icons.aws,
    comingSoon: false,
  },
  {
    id: 'google_workspace',
    name: 'Google Workspace',
    icon: Icons.googleWorkspace,
    comingSoon: false,
  },
  {
    id: 'gcp',
    name: 'GCP',
    icon: Icons.gcp,
    comingSoon: true,
  },
  {
    id: 'azure',
    name: 'Azure',
    icon: Icons.azure,
    comingSoon: false,
  },
  {
    id: 'entra_id',
    name: 'Entra ID',
    icon: Icons.entraId,
    comingSoon: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: Icons.gitHub,
    comingSoon: true,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: Icons.gitlab,
    comingSoon: true,
  },
];

export const CloudProviderSelector = ({
  isOpen,
  onClose,
  onSelectProvider,
}) => {
  const hasTrackedOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasTrackedOpenRef.current = false;
      return;
    }
    if (hasTrackedOpenRef.current) return;
    hasTrackedOpenRef.current = true;

    analytics.track(ANALYTICS_EVENTS.CLOUD_SETUP_PROVIDER_MODAL_OPENED, {
      route: getAnalyticsRoute(),
    });
  }, [isOpen]);

  const handleProviderClick = (provider) => {
    analytics.track(ANALYTICS_EVENTS.CLOUD_SETUP_PROVIDER_SELECTED, {
      route: getAnalyticsRoute(),
      provider_id: provider.id,
      available: !provider.comingSoon,
    });
    if (!provider.comingSoon) {
      onSelectProvider(provider.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[750px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary-800">
            Add Cloud Environment
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Select a provider to connect
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 mt-6 overflow-x-auto pb-2 pt-2">
          {PROVIDERS.map((provider) => {
            const IconComponent = provider.icon;
            
            return (
              <div
                key={provider.id}
                onClick={() => handleProviderClick(provider)}
                className={cn(
                  "relative border rounded-xl p-3 transition-all flex flex-col items-center text-center min-w-[85px] flex-shrink-0",
                  provider.comingSoon
                    ? "opacity-50 cursor-not-allowed bg-gray-50"
                    : "cursor-pointer hover:border-primary-400 hover:shadow-md hover:bg-primary-50/30 active:scale-95",
                  "border-gray-200"
                )}
              >
                {provider.comingSoon && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                    Soon
                  </span>
                )}

                <div className="w-9 h-9 flex items-center justify-center mb-1.5">
                  <IconComponent className="w-7 h-7" />
                </div>
                <h3 className="font-medium text-gray-900 text-xs leading-tight">
                  {provider.name}
                </h3>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CloudProviderSelector;
