import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getRegionOptions, generateRandomString } from '../helpers/shared';

const LaunchStack = ({
  isMissingRequiredConfiguration,
  cfTemplate,
  artifactTitle,
  label,
  fluid,
  size,
  onStackNameGenerated,
  launchRegion,
}) => {
  const [state, setState] = useState({
    launchStackLoading: false,
    showLaunchStackLink: false,
    launchRegion: launchRegion || '',
    launchStackTemplateUrl: '',
    stackName: '',
  });

  useEffect(() => {
    // Generate a stable stack name per component mount
    const name = `cf-template-CloudAgent-${generateRandomString(3)}`;
    setState((prev) => ({ ...prev, stackName: name }));
    if (typeof onStackNameGenerated === 'function') {
      onStackNameGenerated(name);
    }
  }, []);

  useEffect(() => {
    if (!launchRegion) return;
    setState((prev) =>
      prev.launchRegion === launchRegion
        ? prev
        : { ...prev, launchRegion }
    );
  }, [launchRegion]);

  const handleLaunchStackButton = async (cfTemplate) => {
    setState((prev) => ({ ...prev, launchStackLoading: true }));
    handleUploadTemplateToS3(cfTemplate);
  };

  const handleUploadTemplateToS3 = async (cfTemplate) => {
    try {
      const module = await import('../api/uploadTemplateToS3');
      const response = await module.uploadTemplateToS3(cfTemplate);

      if (response.length > 0) {
        setState((prev) => ({
          ...prev,
          launchStackLoading: false,
          launchStackTemplateUrl: response.replace(/"/g, ''),
          showLaunchStackLink: true,
        }));
        if (typeof onStackNameGenerated === 'function') {
          onStackNameGenerated(state.stackName);
        }
      }
    } catch (error) {
      console.error('Error uploading template:', error);
      setState((prev) => ({ ...prev, launchStackLoading: false }));
    }
  };

  const getLaunchUrl = () => {
    const baseUrl = 'https://console.aws.amazon.com/cloudformation/home?';
    const region = state.launchRegion ? `region=${state.launchRegion}` : '';
    const stackName = `stackName=${state.stackName}`;
    const template = `templateURL=${state.launchStackTemplateUrl}`;

    return `${baseUrl}${region}#/stacks/quickcreate?${stackName}&${template}`;
  };

  if (!state.showLaunchStackLink) {
    const isDisabled = isMissingRequiredConfiguration || state.launchStackLoading;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="default"
              className={`${isMissingRequiredConfiguration ? 'opacity-50' : ''} ${
                !isDisabled ? 'animate-pulse-glow' : ''
              }`}
              disabled={isDisabled}
              onClick={() =>
                !isMissingRequiredConfiguration &&
                handleLaunchStackButton(cfTemplate)
              }
            >
              {state.launchStackLoading
                ? 'Loading...'
                : label || 'Launch in AWS Account'}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-white">
            {isMissingRequiredConfiguration
              ? 'Complete missing parameters in template to enable this option'
              : 'Launch CloudFormation template in your AWS account (You must be already logged in or log in when prompted)'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className=" text-center flex flex-row items-center gap-4">
      <a
        href={getLaunchUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-block ${fluid ? 'w-3/5' : ''}`}
      >
        <Button
          variant="outline"
          className="w-full border-blue-500 text-blue-500 hover:bg-blue-50"
        >
          Click to Launch
        </Button>
      </a>

      {/* <Select
        value={state.launchRegion}
        onValueChange={(value) =>
          setState((prev) => ({ ...prev, launchRegion: value }))
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select Region" value={'us-east-1'} />
        </SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="default" disabled>
            Select a region
          </SelectItem>
          {getRegionOptions().map((option) => (
            <SelectItem key={option.value} value={option.value || 'default'}>
              {option.text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select> */}
    </div>
  );
};

export default LaunchStack;
