import React, { useState } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CSVImportModal({ isOpen, onClose }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    stats?: any;
  } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadResult(null);
      
      // Preview the CSV file
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').slice(0, 6); // Show first 5 rows + header
        const preview = lines.map(line => {
          const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
          return {
            company: columns[0] || '',
            role: columns[1] || '',
            name: columns[2] || '',
            email: columns[3] || ''
          };
        });
        setPreviewData(preview);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/contacts/import-csv', {
        method: 'POST',
        body: formData,
        headers: {
          ...(localStorage.getItem('authToken') && { 
            'Authorization': `Bearer ${localStorage.getItem('authToken')}` 
          })
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setUploadResult({
          success: true,
          message: result.message,
          stats: result.results
        });
        
        toast({
          title: "CSV Import Successful",
          description: `Imported ${result.results?.imported || 0} contacts successfully.`,
        });
        
        // Refresh relevant queries
        queryClient.invalidateQueries({ queryKey: ['companies'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        
      } else {
        setUploadResult({
          success: false,
          message: result.message || 'Import failed'
        });
        
        toast({
          title: "Import Failed",
          description: result.message || "Failed to import CSV file.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('CSV import error:', error);
      setUploadResult({
        success: false,
        message: 'An error occurred during import'
      });
      
      toast({
        title: "Import Error",
        description: "An error occurred while importing the CSV file.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setUploadResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSV Import - Contact Data
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with contact information. Expected format: company, role, name, email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="mt-2"
            />
          </div>

          {previewData.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview (first 5 rows)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Company</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} className={index === 0 ? 'bg-blue-50' : ''}>
                        <td className="p-2 truncate max-w-[120px]">{row.company}</td>
                        <td className="p-2 truncate max-w-[120px]">{row.role}</td>
                        <td className="p-2 truncate max-w-[120px]">{row.name}</td>
                        <td className="p-2 truncate max-w-[120px]">{row.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className={`border rounded-lg p-4 ${
              uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {uploadResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={`font-medium ${
                  uploadResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {uploadResult.success ? 'Import Successful' : 'Import Failed'}
                </span>
              </div>
              <p className={`text-sm ${
                uploadResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {uploadResult.message}
              </p>
              {uploadResult.stats && (
                <div className="mt-2 text-sm text-green-700">
                  <p>Processed: {uploadResult.stats.processed} contacts</p>
                  <p>Companies: {uploadResult.stats.companies} created/updated</p>
                  <p>Contacts: {uploadResult.stats.contacts} created</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? 'Uploading...' : 'Import CSV'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}