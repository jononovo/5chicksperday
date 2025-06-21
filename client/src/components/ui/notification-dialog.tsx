import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | React.ReactNode;
  buttonText: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "outline";
  };
  className?: string;
}

export function NotificationDialog({
  open,
  onOpenChange,
  title,
  description,
  buttonText,
  badge,
  className
}: NotificationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-md bg-white border border-gray-200 rounded-lg shadow-lg",
        className
      )}>
        <DialogHeader className="text-center space-y-4">
          {badge && (
            <div className="flex justify-center">
              <Badge variant={badge.variant || "default"} className="px-3 py-1">
                {badge.text}
              </Badge>
            </div>
          )}
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-base leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center pt-4">
          <Button 
            onClick={() => onOpenChange(false)}
            className="px-8 py-2 bg-black text-white hover:bg-gray-800 rounded-md transition-colors"
          >
            {buttonText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}