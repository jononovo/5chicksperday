import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, UserX, RefreshCw, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type DialogMode = 'create' | 'edit' | 'manage';

interface SenderProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: DialogMode;
  currentSenderName?: string;
  currentGmailEmail?: string;
  onSuccess?: () => void;
  onGmailDisconnect?: () => void;
}

export function SenderProfileDialog({ 
  isOpen, 
  onClose, 
  mode,
  currentSenderName = "",
  currentGmailEmail = "",
  onSuccess,
  onGmailDisconnect
}: SenderProfileDialogProps) {
  const [senderName, setSenderName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSwapConfirm, setShowSwapConfirm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize sender name when dialog opens
  useEffect(() => {
    if (isOpen && currentSenderName) {
      setSenderName(currentSenderName);
    } else if (isOpen && !currentSenderName) {
      setSenderName("");
    }
  }, [isOpen, currentSenderName]);

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
      const action = mode === 'create' ? 'set' : 'updated';
      toast({
        title: `Sender Name ${action === 'set' ? 'Set' : 'Updated'}`,
        description: `Your emails will now show your professional name`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Name",
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
        description: "You can now connect a different Gmail account",
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/auth-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      onGmailDisconnect?.();
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

  const deleteSenderProfileMutation = useMutation({
    mutationFn: async () => {
      // Just disconnect Gmail - this will also clear sender name automatically
      const disconnectResponse = await apiRequest("GET", "/api/gmail/disconnect");
      if (!disconnectResponse.ok) {
        const error = await disconnectResponse.json();
        throw new Error(error.message || "Failed to disconnect Gmail");
      }
      return disconnectResponse.json();
    },
    onSuccess: () => {
      toast({
        title: "Sender Profile Deleted",
        description: "Your sender profile has been completely removed",
      });
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/auth-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      onGmailDisconnect?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to Delete Profile",
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
    setShowDeleteConfirm(false);
    setShowSwapConfirm(false);
    onClose();
  };

  const handleSwapAccount = () => {
    setShowSwapConfirm(false);
    disconnectGmailMutation.mutate();
  };

  const handleDeleteProfile = () => {
    setShowDeleteConfirm(false);
    deleteSenderProfileMutation.mutate();
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create':
        return "Set Your Email Name";
      case 'edit':
        return "Update Email Name";
      case 'manage':
        return "Manage Sender Profile";
      default:
        return "Sender Profile";
    }
  };

  const getDialogDescription = () => {
    switch (mode) {
      case 'create':
        return "Enter your name to appear in emails as \"Your Name <email@domain.com>\" instead of just your email address. This makes your outreach more professional and personal.";
      case 'edit':
        return "Update your name that appears in outreach emails.";
      case 'manage':
        return "Manage your sender profile settings and Gmail connection.";
      default:
        return "";
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              {getDialogDescription()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {mode === 'manage' && currentGmailEmail && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Mail className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800 font-medium">
                    Connected: {currentGmailEmail}
                  </span>
                </div>
                <Separator />
              </div>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="senderName" className="text-right">
                Name
              </Label>
              <Input
                id="senderName"
                placeholder="John Smith"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSave();
                  }
                }}
              />
            </div>

            {mode === 'manage' && (
              <div className="space-y-3 pt-4">
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Account Management</h4>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowSwapConfirm(true)}
                    className="w-full justify-start"
                    disabled={disconnectGmailMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Connect Different Gmail Account
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={deleteSenderProfileMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Sender Profile
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {mode === 'create' ? 'Skip for now' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={updateSenderNameMutation.isPending}
            >
              {updateSenderNameMutation.isPending ? "Saving..." : 
               mode === 'create' ? "Save Name" : "Update Name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Account Confirmation Dialog */}
      <AlertDialog open={showSwapConfirm} onOpenChange={setShowSwapConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connect Different Gmail Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect your current Gmail account ({currentGmailEmail}) and allow you to connect a different one. 
              Your sender name will be preserved for the new account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSwapAccount}>
              Disconnect & Connect New
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Profile Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sender Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will completely remove your sender profile and disconnect your Gmail account. 
              You'll need to reconnect Gmail and set up your sender name again to send emails.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProfile}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}