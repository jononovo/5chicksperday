import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { StrategySetupForm } from "@/components/strategy-setup-form";
import { 
  Flame, TrendingUp, Users, Building2, Mail, Clock, Calendar as CalendarIcon,
  Pause, Play, ExternalLink, RefreshCw, AlertCircle, Trophy, Target, Zap,
  Settings, Send, Eye, Edit3, CheckCircle2, XCircle, Sparkles
} from "lucide-react";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastOutreachDate: string | null;
  totalDaysActive: number;
}

interface OutreachStats {
  available: {
    companies: number;
    contacts: number;
    needsMore: boolean;
  };
  thisWeek: {
    companiesReached: number;
    contactsEmailed: number;
    emailsSent: number;
    responses: number;
  };
  thisMonth: {
    companiesReached: number;
    contactsEmailed: number;
    emailsSent: number;
    responses: number;
  };
  allTime: {
    companiesReached: number;
    contactsEmailed: number;
    emailsSent: number;
    responses: number;
  };
}

interface UserPreferences {
  enabled: boolean;
  schedule: {
    days: string[];
    time: string;
  };
  timezone: string;
  emailsPerBatch: number;
  vacationMode: {
    enabled: boolean;
    startDate: string | null;
    endDate: string | null;
  };
}

interface TodaysBatch {
  batchId: string;
  token: string;
  createdAt: string;
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    companyName: string;
    email: string;
  }>;
  emailsSent: number;
  status: 'pending' | 'sent' | 'partial';
}

export default function Streak() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'tuesday', 'wednesday']);
  const [vacationDates, setVacationDates] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [showStrategySetup, setShowStrategySetup] = useState(false);

  // Fetch streak data
  const { data: streakData, isLoading: streakLoading } = useQuery<StreakData>({
    queryKey: ['/api/outreach/streak'],
  });

  // Fetch outreach statistics
  const { data: stats, isLoading: statsLoading } = useQuery<OutreachStats>({
    queryKey: ['/api/outreach/stats'],
  });

  // Fetch user preferences
  const { data: preferences, isLoading: prefsLoading } = useQuery<UserPreferences>({
    queryKey: ['/api/outreach/preferences'],
  });

  // Fetch today's batch
  const { data: todaysBatch, isLoading: batchLoading } = useQuery<TodaysBatch>({
    queryKey: ['/api/outreach/today'],
  });

  // Check if user has strategic profile
  const { data: hasStrategy, isLoading: strategyLoading } = useQuery<{ hasProfile: boolean; profileCount: number }>({
    queryKey: ['/api/strategic-profiles/check'],
  });

  // Update preferences mutation
  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<UserPreferences>) => {
      const response = await fetch('/api/outreach/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/preferences'] });
      toast({
        title: "Settings Updated",
        description: "Your outreach preferences have been saved.",
      });
    },
  });

  // Generate batch mutation
  const generateBatch = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/outreach/generate-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      });
      if (!response.ok) throw new Error('Failed to generate batch');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/stats'] });
      toast({
        title: "Batch Generated",
        description: "Your daily outreach emails are ready!",
      });
      // Open the batch in a new tab
      if (data && data.token) {
        window.open(`/outreach/${data.token}`, '_blank');
      }
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize selected days from preferences
  useEffect(() => {
    if (preferences?.schedule?.days) {
      setSelectedDays(preferences.schedule.days);
    }
  }, [preferences]);

  const handleDayToggle = (day: string) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day];
    setSelectedDays(newDays);
    updatePreferences.mutate({
      schedule: {
        ...preferences?.schedule,
        days: newDays,
        time: preferences?.schedule?.time || '09:00',
      }
    });
  };

  const getStreakEmoji = (streak: number) => {
    if (streak === 0) return "🌱";
    if (streak < 3) return "🔥";
    if (streak < 7) return "🎯";
    if (streak < 14) return "⚡";
    if (streak < 30) return "🚀";
    return "🏆";
  };

  const getMotivationalMessage = (streak: number) => {
    if (streak === 0) return "Start your streak today!";
    if (streak < 3) return "Great start! Keep going!";
    if (streak < 7) return "You're on fire! Almost a week!";
    if (streak < 14) return "Incredible consistency!";
    if (streak < 30) return "You're unstoppable!";
    return "Legendary performance!";
  };

  const isLoading = streakLoading || statsLoading || prefsLoading;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header with Streak */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Flame className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Outreach Streak</h1>
            </div>
            <p className="text-blue-100">Track your daily outreach progress and maintain momentum</p>
          </div>
          {streakData && (
            <div className="text-center">
              <div className="text-5xl mb-2">{getStreakEmoji(streakData.currentStreak)}</div>
              <div className="text-4xl font-bold">{streakData.currentStreak}</div>
              <div className="text-sm text-blue-100">day streak</div>
              <div className="text-xs text-blue-200 mt-1">{getMotivationalMessage(streakData.currentStreak)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Warning */}
      {stats?.available?.needsMore && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Low Pipeline Alert:</strong> You have only {stats.available.contacts} contacts available. 
            Consider running more searches to maintain consistent outreach.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Companies</span>
                </div>
                <span className="text-2xl font-bold">{stats?.available?.companies || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Contacts</span>
                </div>
                <span className="text-2xl font-bold">{stats?.available?.contacts || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{stats?.thisWeek?.contactsEmailed || 0}</div>
              <div className="text-sm text-muted-foreground">Contacts Reached</div>
              <div className="text-xs text-green-600">
                {stats?.thisWeek?.responses || 0} responses
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{stats?.thisMonth?.contactsEmailed || 0}</div>
              <div className="text-sm text-muted-foreground">Contacts Reached</div>
              <div className="text-xs text-green-600">
                {stats?.thisMonth?.responses || 0} responses
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">All Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{stats?.allTime?.contactsEmailed || 0}</div>
              <div className="text-sm text-muted-foreground">Total Outreach</div>
              <div className="text-xs text-green-600">
                {stats?.allTime?.companiesReached || 0} companies
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="today" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Today's Outreach</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Today's Outreach Tab */}
        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Outreach</CardTitle>
              <CardDescription>
                Manage your daily batch of 5 qualified leads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {todaysBatch ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <div className="font-semibold">Today's Batch Ready</div>
                      <div className="text-sm text-muted-foreground">
                        Created at {format(new Date(todaysBatch.createdAt), 'h:mm a')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/outreach/${todaysBatch.token}`, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Emails
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/outreach/${todaysBatch.token}/preview`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Preview HTML
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium mb-2">Contacts in Today's Batch:</div>
                    {todaysBatch.contacts.map((contact, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {contact.role} at {contact.companyName}
                          </div>
                        </div>
                        <Badge variant="outline">{contact.email}</Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="text-lg font-medium mb-2">No batch generated today</div>
                  <div className="text-sm text-muted-foreground mb-4">
                    {!hasStrategy?.hasProfile 
                      ? "Set up your email strategy to start generating personalized outreach"
                      : "Generate a batch to start reaching out to your leads"}
                  </div>
                  {!hasStrategy?.hasProfile ? (
                    <Button 
                      onClick={() => setShowStrategySetup(true)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Email Strategy
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => generateBatch.mutate()}
                      disabled={generateBatch.isPending || !stats?.available?.contacts}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Generate Today's Batch
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Outreach Settings</CardTitle>
              <CardDescription>
                Configure your daily outreach preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enabled">Daily Outreach</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send daily outreach emails
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={preferences?.enabled || false}
                  onCheckedChange={(checked) => updatePreferences.mutate({ enabled: checked })}
                />
              </div>

              {/* Schedule Days */}
              <div className="space-y-3">
                <Label>Outreach Days</Label>
                <div className="flex flex-wrap gap-2">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={day}
                        checked={selectedDays.includes(day)}
                        onCheckedChange={() => handleDayToggle(day)}
                      />
                      <Label htmlFor={day} className="text-sm capitalize cursor-pointer">
                        {day.slice(0, 3)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label htmlFor="time">Delivery Time</Label>
                <Select
                  value={preferences?.schedule?.time || '09:00'}
                  onValueChange={(value) => updatePreferences.mutate({
                    schedule: {
                      ...preferences?.schedule,
                      days: preferences?.schedule?.days || selectedDays,
                      time: value,
                    }
                  })}
                >
                  <SelectTrigger id="time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="07:00">7:00 AM</SelectItem>
                    <SelectItem value="08:00">8:00 AM</SelectItem>
                    <SelectItem value="09:00">9:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="11:00">11:00 AM</SelectItem>
                    <SelectItem value="14:00">2:00 PM</SelectItem>
                    <SelectItem value="15:00">3:00 PM</SelectItem>
                    <SelectItem value="16:00">4:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Batch Size */}
              <div className="space-y-2">
                <Label htmlFor="batchSize">Emails per Day</Label>
                <Select
                  value={String(preferences?.emailsPerBatch || 5)}
                  onValueChange={(value) => updatePreferences.mutate({ emailsPerBatch: parseInt(value) })}
                >
                  <SelectTrigger id="batchSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <SelectItem key={num} value={String(num)}>{num} emails</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vacation Mode */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="vacation">Vacation Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Pause outreach while you're away
                    </p>
                  </div>
                  <Switch
                    id="vacation"
                    checked={preferences?.vacationMode?.enabled || false}
                    onCheckedChange={(checked) => updatePreferences.mutate({
                      vacationMode: {
                        enabled: checked,
                        startDate: preferences?.vacationMode?.startDate || null,
                        endDate: preferences?.vacationMode?.endDate || null,
                      }
                    })}
                  />
                </div>

                {preferences?.vacationMode?.enabled && (
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {vacationDates.from ? format(vacationDates.from, 'MMM d') : 'Start date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={vacationDates.from}
                          onSelect={(date) => setVacationDates({ ...vacationDates, from: date })}
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {vacationDates.to ? format(vacationDates.to, 'MMM d') : 'End date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={vacationDates.to}
                          onSelect={(date) => setVacationDates({ ...vacationDates, to: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Outreach History</CardTitle>
              <CardDescription>
                View your past outreach activity and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4" />
                <div className="text-lg font-medium mb-2">Coming Soon</div>
                <div className="text-sm">
                  Your outreach history and performance metrics will appear here
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Strategy Setup Form */}
      <StrategySetupForm
        open={showStrategySetup}
        onClose={() => setShowStrategySetup(false)}
        onSuccess={() => {
          setShowStrategySetup(false);
          queryClient.invalidateQueries({ queryKey: ['/api/strategic-profiles/check'] });
          queryClient.invalidateQueries({ queryKey: ['/api/outreach/today'] });
          // Automatically generate first batch after strategy setup
          setTimeout(() => {
            generateBatch.mutate();
          }, 1000);
        }}
      />
    </div>
  );
}