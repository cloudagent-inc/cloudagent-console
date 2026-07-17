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
import { Loader2, Package } from 'lucide-react';

export default function PackageModal({
  isOpen,
  onClose,
  onConfirm,
  packageCost,
  newBalance,
  loading,
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px] bg-white">
        <DialogHeader>
          <div className="w-fit bg-blue-50 p-2 border-[10px] border-primary-100 rounded-full mb-2">
            <Package className="h-6 w-6 text-blue-500" />
          </div>
          <DialogTitle className="text-2xl font-[600] text-primary-800">
            Get Package
          </DialogTitle>
          <DialogDescription className="text-gray-400 pt-2">
            This package will cost {packageCost} Credits and you will be able to
            access all Agents instantly! This purchase cannot be refunded.
          </DialogDescription>
        </DialogHeader>
        <div className="text-primary-600 font-medium">
          Your new balance will be {newBalance} Credits.
        </div>
        <DialogFooter className="w-full sm:justify-center gap-2">
          <Button variant="outline" onClick={onClose} className="w-[50%] ">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="default"
            className="w-[50%]"
            disabled={loading}
          >
            {loading && <Loader2 className="h-5 w-5 mr-2" />}
            Get Package
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
