import { apiRequest } from "./queryClient";

export interface SearchJobResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: string;
  companiesFound?: number;
  contactsFound?: number;
  emailsFound?: number;
  error?: string;
  results?: any;
  createdAt: string;
  completedAt?: string;
}

export interface StartSearchResponse {
  jobId: string;
  status: string;
  message: string;
}

/**
 * Client for comprehensive search API operations
 */
export class ComprehensiveSearchClient {
  /**
   * Start a new comprehensive search job
   */
  static async startSearch(query: string): Promise<StartSearchResponse> {
    const response = await fetch('/api/search/comprehensive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start search');
    }

    return response.json();
  }

  /**
   * Get status of a search job
   */
  static async getJobStatus(jobId: string): Promise<SearchJobResponse> {
    const response = await apiRequest(`/api/search/job/${jobId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get job status');
    }

    return response.json();
  }

  /**
   * List active search jobs
   */
  static async getActiveJobs(): Promise<SearchJobResponse[]> {
    const response = await apiRequest('/api/search/jobs/active');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get active jobs');
    }

    return response.json();
  }

  /**
   * List completed search jobs
   */
  static async getCompletedJobs(): Promise<SearchJobResponse[]> {
    const response = await apiRequest('/api/search/jobs/completed');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get completed jobs');
    }

    return response.json();
  }

  /**
   * Poll job status until completion
   */
  static async pollJobUntilComplete(
    jobId: string,
    onProgress?: (job: SearchJobResponse) => void,
    pollInterval = 2000
  ): Promise<SearchJobResponse> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const job = await this.getJobStatus(jobId);
          
          if (onProgress) {
            onProgress(job);
          }

          if (job.status === 'completed') {
            resolve(job);
          } else if (job.status === 'failed') {
            reject(new Error(job.error || 'Search job failed'));
          } else {
            // Continue polling
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }
}