import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SenderNameDialogProps {
  open: boolean;
  onSave: (senderName: string) => void;
  onSkip: () => void;
}

export function SenderNameDialog({ open, onSave, onSkip }: SenderNameDialogProps) {
  const [senderName, setSenderName] = useState('');

  const handleSave = () => {
    if (senderName.trim()) {
      onSave(senderName.trim());
      setSenderName(''); // Reset for next use
    }
  };

  const handleSkip = () => {
    setSenderName(''); // Reset for next use
    onSkip();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && senderName.trim()) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleSkip}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Your Email Sender Name</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senderName">
              How would you like your name to appear when sending emails?
            </Label>
            <Input 
              id="senderName"
              placeholder="e.g., John Smith"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full"
              autoFocus
            />
            <p className="text-sm text-gray-500">
              This will be displayed as "Your Name &lt;your@email.com&gt;" in outgoing emails.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleSkip}>
              Skip (Use Email Only)
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!senderName.trim()}
              className="min-w-[100px]"
            >
              Save Name
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}