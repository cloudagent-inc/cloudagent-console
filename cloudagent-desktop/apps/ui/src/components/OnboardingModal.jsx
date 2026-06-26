import React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import OnboardingSection from '@/components/OnboardingSection';

const OnboardingModal = ({
  isOpen,
  onOpenChange,
  hasPermissions,
  hasRunReport,
  hasRunAgent,
  hasRunWorkflow,
  hasMCPExtension,
  hasDiscoveredWorkloads,
  onRefresh,
  userProfile,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-white [&>button]:hidden">
        {/* Custom header controls with better visibility */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-8 w-8 p-0 bg-white/90 hover:bg-white border-gray-300 shadow-sm"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4 text-gray-600" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0 bg-white/90 hover:bg-white border-gray-300 shadow-sm"
            title="Close"
          >
            <X className="h-4 w-4 text-gray-600" />
          </Button>
        </div>
        <OnboardingSection
          hasPermissions={hasPermissions}
          hasRunReport={hasRunReport}
          hasRunAgent={hasRunAgent}
          hasRunWorkflow={hasRunWorkflow}
          hasMCPExtension={hasMCPExtension}
          hasDiscoveredWorkloads={hasDiscoveredWorkloads}
          onClose={() => onOpenChange(false)}
          isManuallyShown={true}
          onRefresh={null}
          userProfile={userProfile}
        />
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
