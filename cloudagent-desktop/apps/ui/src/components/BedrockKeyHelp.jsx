import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Small help icon + modal explaining how to get an Amazon Bedrock API key.
export default function BedrockKeyHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How to get an Amazon Bedrock API key"
        title="How to get an Amazon Bedrock API key"
        className="inline-flex items-center align-middle text-slate-400 transition-colors hover:text-slate-600"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Amazon Bedrock</DialogTitle>
            <DialogDescription>
              CloudAgent calls Bedrock models with an API key from your AWS account.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>
              Sign in to your{' '}
              <a
                href="https://console.aws.amazon.com"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                AWS account
              </a>
              {' '}(or create one first).
            </li>
            <li>
              In the Amazon Bedrock console, open{' '}
              <a
                href="https://console.aws.amazon.com/bedrock/home#/api-keys/long-term/create"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                API keys
              </a>
              {' '}and generate a <span className="font-medium">long-term</span> API key
              (short-term keys expire within 12 hours).
            </li>
            <li>
              Check that the model you picked is enabled for your account under{' '}
              <span className="font-medium">Model access</span> in the Bedrock console —
              some models need to be enabled before first use.
            </li>
            <li>Paste the key into the API key field here and save.</li>
          </ol>
          <p className="text-xs text-slate-500">
            Prefer AWS credentials? Models served through the Bedrock Converse API can be
            used without an API key — leave the field empty and CloudAgent uses your AWS
            profile / SSO credentials instead.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
