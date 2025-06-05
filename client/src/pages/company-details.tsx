import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Building2,
  Users,
  Globe,
  Trophy,
  Mail,
  ArrowLeft,
  Star,
  TrendingUp,
  RefreshCw,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Company, Contact } from "@shared/schema";

interface CompanyDetailsProps {
  user?: any;
  isAuthLoading?: boolean;
  authError?: Error | null;
}

export default function CompanyDetails({ user, isAuthLoading = false, authError }: CompanyDetailsProps = {}) {
  const [, params] = useRoute("/companies/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Ensure companyId is properly parsed from params
  const companyId = params?.id ? parseInt(params.id, 10) : null;

  console.log('CompanyDetails - Loading company ID:', companyId);

  const { data: company, isLoading: companyLoading } = useQuery<Company>({
    queryKey: [`/api/companies/${companyId}`],
    enabled: !!companyId,
    staleTime: 0, // Don't use cached data
    cacheTime: 0, // Don't cache the response
    retry: false, // Don't retry failed requests
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false // Don't refetch on window focus
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: [`/api/companies/${companyId}/contacts`],
    enabled: !!companyId,
    staleTime: 0,
    cacheTime: 0,
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });

  // Log the fetched data
  console.log('CompanyDetails - Fetched data:', {
    requestedId: companyId,
    fetchedCompany: company ? { id: company.id, name: company.name } : null,
    contactsCount: contacts.length,
    contacts: contacts.map(c => ({ id: c.id, name: c.name }))
  });

  const contactSearchMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      const response = await apiRequest("POST", `/api/companies/${companyId}/enrich-contacts`);
      if (!response.ok) {
        throw new Error('Failed to enrich contacts');
      }
      return response.json();
    },
    onSuccess: async () => {
      await refetchContacts();
      toast({
        title: "Contacts Updated",
        description: "Successfully refreshed company contact information.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update contact information",
        variant: "destructive",
      });
    },
  });

  if (companyLoading) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading company details...</p>
      </div>
    );
  }

  if (!company && !companyLoading) {
    return (
      <div className="container mx-auto py-8">
        <p>Company not found. ID: {companyId}</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Search
        </Button>
      </div>
    );
  }

  if (!company) {
    return null;
  }

  const handleEnrichContacts = () => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company selected",
        variant: "destructive",
      });
      return;
    }
    contactSearchMutation.mutate();
  };

  const metrics = [
    {
      name: "Website Ranking",
      value: company.ranking || 0,
      icon: Globe,
    },
    {
      name: "Company Size",
      value: company.size || 0,
      icon: Users,
    },
    {
      name: "LinkedIn Score",
      value: company.linkedinProminence || 0,
      icon: TrendingUp,
    },
    {
      name: "Customer Count",
      value: company.customerCount || 0,
      icon: Building2,
    },
  ];

  const chartData = [
    { name: "Website Ranking", value: company.ranking || 0 },
    { name: "LinkedIn Score", value: company.linkedinProminence || 0 },
    { name: "Customer Base", value: company.customerCount || 0 },
    { name: "Rating", value: company.rating || 0 },
  ];

  // Function to go back to previous page if possible, or to home as fallback
  const handleBack = () => {
    // Check if there's a history to go back to
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to home page if no history
      navigate("/");
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={handleBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">{company.name}</CardTitle>
                {company.description && (
                  <CardDescription className="mt-2">
                    {company.description}
                  </CardDescription>
                )}
              </div>
              <Badge
                className="text-lg py-2"
                variant={company.totalScore && company.totalScore > 70 ? "default" : "secondary"}
              >
                Score: {company.totalScore ?? 'N/A'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric) => (
                <Card key={metric.name}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <metric.icon className="h-5 w-5 text-muted-foreground" />
                      <p className="text-sm font-medium">{metric.name}</p>
                    </div>
                    <p className="text-2xl font-bold mt-2">{metric.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Key Contacts
              </CardTitle>
              <Button
                variant="outline"
                onClick={handleEnrichContacts}
                disabled={contactSearchMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${contactSearchMutation.isPending ? 'animate-spin' : ''}`} />
                Enrich Contacts
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.role}</TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>
                      <Badge variant={contact.probability && contact.probability >= 90 ? "default" : "secondary"}>
                        {contact.probability || 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {(company.services?.length > 0 || company.validationPoints?.length > 0) && (
          <div className="grid md:grid-cols-2 gap-8">
            {company.services && company.services.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Services Offered</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {company.services.map((service, index) => (
                      <Badge key={index} variant="secondary">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {company.validationPoints && company.validationPoints.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Validation Points</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {company.validationPoints.map((point, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-5 w-5" />
                <span>Company Website:</span>
                {company.website ? (
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {company.website}
                  </a>
                ) : (
                  <span className="italic">No website available</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Link2 className="h-5 w-5" />
                <span>Company Profile:</span>
                {company.alternativeProfileUrl ? (
                  <a
                    href={company.alternativeProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {company.alternativeProfileUrl}
                  </a>
                ) : (
                  <span className="italic">No profile link available</span>
                )}
              </div>
              {company.age && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-5 w-5" />
                  <span>Company Age:</span>
                  <span>{company.age} years</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}