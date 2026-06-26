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
import { Loader2 } from 'lucide-react';

export default function InfoModal({
  isOpen,
  onClose,
  onConfirm,
  icon,
  title,
  description,
  cancelText,
  okText,
  type,
  additionalInfo,
  loading,
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px] bg-white w-[95%] md:w-[100%] rounded-xl">
        <DialogHeader>
          {type === 'warning' ? (
            <div className="w-fit bg-yellow-100 p-2 border-[10px] border-yellow-50 rounded-full mb-2">
              {icon}
            </div>
          ) : (
            <div className="w-fit bg-blue-50 p-2 border-[10px] border-primary-100 rounded-full mb-2">
              {icon}
            </div>
          )}
          <DialogTitle className="text-2xl font-[600] text-primary-800 text-left">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-400 pt-2 text-left">
            {description}
          </DialogDescription>
          {additionalInfo && (
            <p className="text-primary-600 text-left">{additionalInfo}</p>
          )}
        </DialogHeader>
        <DialogFooter className="w-full sm:justify-center gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-[100%] md:w-[50%]"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            variant="default"
            className="w-[100%] md:w-[50%]"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {okText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
