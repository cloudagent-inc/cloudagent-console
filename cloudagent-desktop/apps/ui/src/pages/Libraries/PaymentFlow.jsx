import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function PaymentFlow({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-primary-800 text-xl">
            Payments are not available
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            The desktop app does not include hosted billing, credits, or Stripe
            checkout.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentFormFields() {
  return null;
}
