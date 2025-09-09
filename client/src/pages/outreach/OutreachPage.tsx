import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, SkipForward, Building2, User, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContactInfo {
  name: string;
  role: string;
  email: string;
  company: {
    name: string;
    description?: string;
  };
}

interface OutreachEmail {
  contactId: number;
  contactName: string;
  contactEmail: string;
  contactRole: string;
  companyName: string;
  companyDescription?: string;
  subject: string;
  content: string;
  priority: number;
}

interface OutreachPageData {
  token: string;
  email: OutreachEmail;
  contactInfo: ContactInfo;
  userEmail: string;
  userName: string;
  position: number;
  totalCount: number;
}

export default function OutreachPage() {
  const { token } = useParams() as { token: string };
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pageData, setPageData] = useState<OutreachPageData | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [hovering, setHovering] = useState(false);
  
  const subjectRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadPageData();
  }, [token]);

  useEffect(() => {
    if (pageData) {
      setSubject(pageData.email.subject);
      setContent(pageData.email.content);
    }
  }, [pageData]);

  const loadPageData = async () => {
    try {
      const response = await fetch(`/api/daily-outreach/page/${token}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Invalid or expired link",
            description: "This outreach link is no longer valid.",
            variant: "destructive"
          });
          return;
        }
        throw new Error('Failed to load outreach page');
      }
      
      const data = await response.json();
      setPageData(data);
    } catch (error) {
      console.error('Error loading page:', error);
      toast({
        title: "Error",
        description: "Failed to load outreach page. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!pageData) return;
    
    setSending(true);
    try {
      const response = await fetch(`/api/daily-outreach/send/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: pageData.email.contactId,
          subject,
          content
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      
      const result = await response.json();
      
      if (result.hasNext && result.nextContact) {
        // Load next contact
        setPageData(result.nextContact);
        toast({
          title: "Email sent!",
          description: `Moving to contact ${result.nextContact.position} of ${result.nextContact.totalCount}`,
        });
      } else {
        // All done
        toast({
          title: "All done!",
          description: "You've completed all your outreach for today.",
        });
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleSkip = async () => {
    if (!pageData) return;
    
    try {
      const response = await fetch(`/api/daily-outreach/skip/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: pageData.email.contactId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to skip contact');
      }
      
      const result = await response.json();
      
      if (result.hasNext && result.nextContact) {
        // Load next contact
        setPageData(result.nextContact);
        toast({
          title: "Contact skipped",
          description: `Moving to contact ${result.nextContact.position} of ${result.nextContact.totalCount}`,
        });
      } else {
        // All done
        toast({
          title: "All done!",
          description: "You've completed reviewing all contacts.",
        });
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    } catch (error) {
      console.error('Error skipping contact:', error);
      toast({
        title: "Error",
        description: "Failed to skip contact. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Card className="p-8 max-w-md">
          <h2 className="text-xl font-semibold mb-2">Invalid or Expired Link</h2>
          <p className="text-gray-600">This outreach link is no longer valid. Please request a new one.</p>
        </Card>
      </div>
    );
  }

  const contextOpacity = isEditing ? 'opacity-80' : hovering ? 'opacity-90' : 'opacity-10';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">5D</span>
            </div>
            <span className="text-gray-500 text-sm">5Ducks</span>
          </div>
          <span className="text-gray-500 text-sm">
            Contact {pageData.position} of {pageData.totalCount}
          </span>
        </div>

        {/* Main Email Card */}
        <Card className="bg-white shadow-xl p-8">
          {/* Email Fields */}
          <div className="space-y-4">
            {/* From/To Fields */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-12">From:</span>
                <span className="text-sm font-medium">{pageData.userEmail}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-12">To:</span>
                <span className="text-sm font-medium">{pageData.email.contactEmail}</span>
              </div>
            </div>

            {/* Subject Line */}
            <div className="mt-6">
              <Input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
                placeholder="Subject line"
                className="text-lg font-medium border-0 border-b rounded-none px-0 focus:ring-0 focus:border-blue-500"
              />
            </div>

            {/* Email Body */}
            <div className="mt-6">
              <Textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
                placeholder="Email content"
                className="min-h-[300px] resize-none border-0 px-0 text-base leading-relaxed focus:ring-0"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-8">
              <Button
                onClick={handleSend}
                disabled={sending || !subject || !content}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
              <Button
                onClick={handleSkip}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            </div>
          </div>

          {/* Context Card - Semi-transparent hover card */}
          <AnimatePresence>
            <motion.div
              className={`absolute bottom-8 left-8 right-8 transition-opacity duration-300 ${contextOpacity}`}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: isEditing ? 0.8 : hovering ? 0.9 : 0.1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="border-t pt-4">
                <div className="flex items-start gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <div>
                      <div className="font-medium">{pageData.contactInfo.company.name}</div>
                      {pageData.contactInfo.company.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {pageData.contactInfo.company.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <div>
                      <div className="font-medium">{pageData.contactInfo.name}</div>
                      <div className="text-xs text-gray-500">{pageData.contactInfo.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Progress Indicator */}
        <div className="mt-8 flex justify-center">
          <div className="flex gap-2">
            {Array.from({ length: pageData.totalCount }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < pageData.position - 1
                    ? 'bg-blue-600'
                    : i === pageData.position - 1
                    ? 'bg-blue-400'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}