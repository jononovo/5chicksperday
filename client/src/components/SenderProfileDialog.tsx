import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, User, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SenderProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode: 'create' | 'edit';
  currentEmail?: string;
  currentSenderName?: string;
}

export function SenderProfileDialog({ 
  isOpen, 
  onClose, 
  onSuccess,
  mode,
  currentEmail,
  currentSenderName
}: SenderProfileDialogProps) {
  const [senderName, setSenderName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize sender name based on mode
  useEffect(() => {
    if (mode === 'edit' && currentSenderName) {
      setSenderName(currentSenderName);
    } else if (mode === 'create') {
      setSenderName("");
    }
  }, [mode, currentSenderName, isOpen]);

  const updateSenderNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/user/sender-name", { senderName: name });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update sender name");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: mode === 'create' ? "Sender Profile Created" : "Sender Profile Updated",
        description: "Your professional name will now appear in all outreach emails",
      });
      // Invalidate user preferences cache
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Profile",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const disconnectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/gmail/disconnect");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disconnect Gmail");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Gmail Disconnected",
        description: "Your Gmail account has been disconnected successfully",
      });
      // Invalidate all Gmail-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to Disconnect",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!senderName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name for professional emails",
        variant: "destructive",
      });
      return;
    }
    updateSenderNameMutation.mutate(senderName.trim());
  };

  const handleClose = () => {
    setSenderName("");
    onClose();
  };

  const handleDisconnect = () => {
    disconnectGmailMutation.mutate();
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create':
        return "Set Up Your Sender Profile";
      case 'edit':
        return "Manage Sender Profile";
      default:
        return "Sender Profile";
    }
  };

  const getDialogDescription = () => {
    switch (mode) {
      case 'create':
        return "Set up your professional identity for outreach emails. Your name will appear as 'Your Name <email@domain.com>' making your emails more personal and professional.";
      case 'edit':
        return "Update your sender profile or manage your Gmail connection. Changes will apply to all future outreach emails.";
      default:
        return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDialogDescription()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Gmail Account Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Connected Gmail Account
            </Label>
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">
                {currentEmail || 'Gmail Connected'}
              </span>
            </div>
          </div>

          <Separator />

          {/* Sender Name Section */}
          <div className="space-y-3">
            <Label htmlFor="senderName" className="text-sm font-medium">
              Professional Name
            </Label>
            <Input
              id="senderName"
              placeholder="John Smith"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSave();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              This name will appear in your outreach emails as: <strong>{senderName || 'Your Name'} &lt;{currentEmail || 'email@domain.com'}&gt;</strong>
            </p>
          </div>

          {/* Account Actions Section - Only show in edit mode */}
          {mode === 'edit' && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Account Management
                </Label>
                <div className="space-y-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        Disconnect Gmail Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Gmail Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will disconnect your Gmail account and remove email sending capabilities. 
                          You can reconnect anytime, but you'll need to re-authorize the connection.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDisconnect}
                          disabled={disconnectGmailMutation.isPending}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          {disconnectGmailMutation.isPending ? "Disconnecting..." : "Disconnect"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  <p className="text-xs text-muted-foreground">
                    To use a different Gmail account, disconnect this one and click "Connect Gmail" to authorize a new account.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {mode === 'create' && (
            <Button variant="outline" onClick={handleClose}>
              Skip for now
            </Button>
          )}
          {mode === 'edit' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={updateSenderNameMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateSenderNameMutation.isPending 
              ? "Saving..." 
              : mode === 'create' 
                ? "Create Profile" 
                : "Update Profile"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}