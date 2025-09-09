import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays, isBefore, isAfter } from "date-fns";
import { 
  CalendarDays, 
  Mail, 
  Eye, 
  Send, 
  TrendingUp, 
  Users, 
  Building2,
  Clock,
  Pause,
  Play,
  ExternalLink,
  AlertCircle,
  Target,
  Trophy,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OutreachPreferences {
  enabled: boolean;
  schedule: {
    days: string[];
    time: string;
  };
  contactsPerDay: number;
  timezone: string;
  vacationMode?: {
    enabled: boolean;
    startDate?: string;
    endDate?: string;
  };
}

interface PipelineStats {
  availableCompanies: number;
  availableContacts: number;
  sentThisWeek: {
    companies: number;
    contacts: number;
  };
  sentThisMonth: {
    companies: number;
    contacts: number;
  };
  sentAllTime: {
    companies: number;
    contacts: number;
  };
}

interface OutreachStatus {
  hasEnoughContacts: boolean;
  nextOutreachDate: string | null;
  todaysSent: boolean;
  todaysToken?: string;
}

export default function Streak() {
  const { toast } = useToast();
  
  // State for preferences
  const [preferences, setPreferences] = useState<OutreachPreferences>({
    enabled: true,
    schedule: {
      days: ["Monday", "Tuesday", "Wednesday"],
      time: "09:00"
    },
    contactsPerDay: 5,
    timezone: "America/New_York",
    vacationMode: {
      enabled: false
    }
  });
  
  const [vacationDates, setVacationDates] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  
  // Fetch current preferences
  const { data: savedPreferences, isLoading: preferencesLoading } = useQuery<OutreachPreferences>({
    queryKey: ["/api/daily-outreach/preferences"],
    enabled: true
  });
  
  // Fetch pipeline stats
  const { data: pipelineStats, isLoading: statsLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/daily-outreach/pipeline"],
    refetchInterval: 30000 // Refresh every 30 seconds
  });
  
  // Fetch outreach status
  const { data: outreachStatus, isLoading: statusLoading } = useQuery<OutreachStatus>({
    queryKey: ["/api/daily-outreach/check"],
    refetchInterval: 30000
  });
  
  // Update preferences when fetched
  useEffect(() => {
    if (savedPreferences) {
      setPreferences(savedPreferences);
      if (savedPreferences.vacationMode?.startDate) {
        setVacationDates({
          from: new Date(savedPreferences.vacationMode.startDate),
          to: savedPreferences.vacationMode?.endDate ? new Date(savedPreferences.vacationMode.endDate) : undefined
        });
      }
    }
  }, [savedPreferences]);
  
  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: OutreachPreferences) => {
      return apiRequest("/api/daily-outreach/preferences", "POST", newPreferences);
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Your outreach preferences have been updated."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-outreach/preferences"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Generate test email mutation
  const generateTestEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/daily-outreach/test-email");
      if (!response.ok) throw new Error("Failed to generate test email");
      return response.json();
    }
  });
  
  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (recipientEmail: string) => {
      return apiRequest("/api/daily-outreach/test-sendgrid", "POST", { recipientEmail });
    },
    onSuccess: () => {
      toast({
        title: "Test email sent",
        description: "Check your inbox for the test email."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error sending test email",
        description: error.details?.[0]?.message || error.error || "Failed to send test email. Check SendGrid configuration.",
        variant: "destructive"
      });
    }
  });
  
  const handleDayToggle = (day: string) => {
    const newDays = preferences.schedule.days.includes(day)
      ? preferences.schedule.days.filter(d => d !== day)
      : [...preferences.schedule.days, day];
    
    const newPreferences = {
      ...preferences,
      schedule: {
        ...preferences.schedule,
        days: newDays
      }
    };
    
    setPreferences(newPreferences);
    savePreferencesMutation.mutate(newPreferences);
  };
  
  const handleTimeChange = (time: string) => {
    const newPreferences = {
      ...preferences,
      schedule: {
        ...preferences.schedule,
        time
      }
    };
    
    setPreferences(newPreferences);
    savePreferencesMutation.mutate(newPreferences);
  };
  
  const handleVacationModeToggle = (enabled: boolean) => {
    const newPreferences = {
      ...preferences,
      vacationMode: {
        ...preferences.vacationMode,
        enabled,
        startDate: enabled && vacationDates.from ? format(vacationDates.from, "yyyy-MM-dd") : undefined,
        endDate: enabled && vacationDates.to ? format(vacationDates.to, "yyyy-MM-dd") : undefined
      }
    };
    
    setPreferences(newPreferences);
    savePreferencesMutation.mutate(newPreferences);
  };
  
  const handleVacationDatesChange = (dates: { from: Date | undefined; to: Date | undefined }) => {
    setVacationDates(dates);
    
    if (preferences.vacationMode?.enabled) {
      const newPreferences = {
        ...preferences,
        vacationMode: {
          ...preferences.vacationMode,
          enabled: true,
          startDate: dates.from ? format(dates.from, "yyyy-MM-dd") : undefined,
          endDate: dates.to ? format(dates.to, "yyyy-MM-dd") : undefined
        }
      };
      
      setPreferences(newPreferences);
      savePreferencesMutation.mutate(newPreferences);
    }
  };
  
  const openTodaysOutreach = () => {
    if (outreachStatus?.todaysToken) {
      window.open(`/outreach/${outreachStatus.todaysToken}`, '_blank');
    } else {
      toast({
        title: "No outreach available",
        description: "Today's outreach has not been generated yet.",
        variant: "destructive"
      });
    }
  };
  
  const previewTodaysEmail = async () => {
    try {
      const result = await generateTestEmailMutation.mutateAsync();
      
      // Create a new window with the HTML content
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.write(result.data.html);
        previewWindow.document.close();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate preview email.",
        variant: "destructive"
      });
    }
  };
  
  const sendTestEmail = async () => {
    const userEmail = prompt("Enter your email address to receive a test email:");
    if (!userEmail) return;
    
    await sendTestEmailMutation.mutateAsync(userEmail);
  };
  
  const isLowOnContacts = pipelineStats && pipelineStats.availableContacts < 15;
  
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-8 w-8 text-yellow-500" />
          Streak Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your daily outreach campaigns and track your progress
        </p>
      </div>
      
      {/* Quick Actions Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Access today's outreach and test email functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={openTodaysOutreach}
              disabled={!outreachStatus?.todaysToken}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Today's Outreach
            </Button>
            
            <Button 
              variant="outline"
              onClick={previewTodaysEmail}
              className="flex items-center gap-2"
              disabled={generateTestEmailMutation.isPending}
            >
              <Eye className="h-4 w-4" />
              Preview Today's Email
            </Button>
            
            <Button 
              variant="outline"
              onClick={sendTestEmail}
              className="flex items-center gap-2"
              disabled={sendTestEmailMutation.isPending}
            >
              <Send className="h-4 w-4" />
              Send Test Email
            </Button>
          </div>
          
          {outreachStatus?.todaysSent && (
            <Badge variant="secondary" className="mt-3">
              ✓ Today's emails have been sent
            </Badge>
          )}
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Pipeline Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available Companies</span>
                <span className="font-semibold text-lg">{pipelineStats?.availableCompanies || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available Contacts</span>
                <span className={cn(
                  "font-semibold text-lg",
                  isLowOnContacts && "text-orange-500"
                )}>
                  {pipelineStats?.availableContacts || 0}
                </span>
              </div>
              
              {isLowOnContacts && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Running low!</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add more contacts to maintain your outreach schedule.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Outreach Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Outreach Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">This Week</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{pipelineStats?.sentThisWeek?.companies || 0} companies</span>
                  <span>{pipelineStats?.sentThisWeek?.contacts || 0} contacts</span>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">This Month</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{pipelineStats?.sentThisMonth?.companies || 0} companies</span>
                  <span>{pipelineStats?.sentThisMonth?.contacts || 0} contacts</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">All Time</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>{pipelineStats?.sentAllTime?.companies || 0} companies</span>
                  <span>{pipelineStats?.sentAllTime?.contacts || 0} contacts</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Settings Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Outreach Settings
          </CardTitle>
          <CardDescription>
            Configure your daily outreach schedule and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="schedule" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="vacation">Vacation Mode</TabsTrigger>
            </TabsList>
            
            <TabsContent value="schedule" className="space-y-4 mt-4">
              <div>
                <Label className="text-base mb-3 block">Outreach Days</Label>
                <div className="flex flex-wrap gap-3">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={day}
                        checked={preferences.schedule.days.includes(day)}
                        onCheckedChange={() => handleDayToggle(day)}
                      />
                      <Label 
                        htmlFor={day} 
                        className="text-sm font-normal cursor-pointer"
                      >
                        {day.slice(0, 3)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor="time" className="text-base mb-3 block">
                  Send Time
                </Label>
                <Select value={preferences.schedule.time} onValueChange={handleTimeChange}>
                  <SelectTrigger id="time" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="timezone" className="text-base mb-3 block">
                  Timezone
                </Label>
                <Select value={preferences.timezone} onValueChange={(tz) => {
                  const newPreferences = { ...preferences, timezone: tz };
                  setPreferences(newPreferences);
                  savePreferencesMutation.mutate(newPreferences);
                }}>
                  <SelectTrigger id="timezone" className="w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            
            <TabsContent value="vacation" className="space-y-4 mt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="vacation-mode"
                  checked={preferences.vacationMode?.enabled || false}
                  onCheckedChange={handleVacationModeToggle}
                />
                <Label htmlFor="vacation-mode" className="cursor-pointer">
                  Enable Vacation Mode
                </Label>
              </div>
              
              {preferences.vacationMode?.enabled && (
                <div className="mt-4 p-4 border rounded-lg">
                  <Label className="text-base mb-3 block">Vacation Dates</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {vacationDates.from ? (
                          vacationDates.to ? (
                            <>
                              {format(vacationDates.from, "LLL dd, y")} -{" "}
                              {format(vacationDates.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(vacationDates.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick your vacation dates</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={vacationDates.from}
                        selected={{ from: vacationDates.from, to: vacationDates.to }}
                        onSelect={(range: any) => handleVacationDatesChange(range || { from: undefined, to: undefined })}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {vacationDates.from && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Emails will be paused from {format(vacationDates.from, "MMMM d")}
                      {vacationDates.to && ` to ${format(vacationDates.to, "MMMM d")}`}.
                      {vacationDates.to && ` They will resume on ${format(addDays(vacationDates.to, 1), "MMMM d")}.`}
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}