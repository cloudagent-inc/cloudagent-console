import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icons } from '../icons';
import { Loader2 } from 'lucide-react';

export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  packageCost,
  newBalance,
  deleteText = 'Delete Account',
  deleteDescription = 'Are you sure you want to delete your account?',
  deleteButtonText = 'Delete Account',
  isLoading = false,
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px] bg-white">
        <DialogHeader>
          <div className="w-fit bg-red-100 p-2 border-[10px] border-red-50 rounded-full mb-2">
            <Icons.delete className="h-6 w-6 text-blue-500" />
          </div>
          <DialogTitle className="text-2xl font-[600] text-primary-800">
            {deleteText}
          </DialogTitle>
          <DialogDescription className="text-gray-400 pt-2">
            {deleteDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="w-full sm:justify-center gap-2">
          <Button variant="outline" onClick={onClose} className="w-[50%] " disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="default"
            className="w-[50%] bg-red-400 text-white hover:bg-red-400"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              deleteButtonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
