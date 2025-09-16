export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'error';

export interface EmployeeImage {
  id: string;
  file: File;
  originalUrl: string;
  processedUrl: string | null;
  status: ProcessingStatus;
  error?: string;
}

export interface Base64Image {
    base64: string;
    mimeType: string;
}