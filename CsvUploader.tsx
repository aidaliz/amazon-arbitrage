'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function CsvUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError(null);
    setSuccess(null);
  };

  const validateFile = (file: File): boolean => {
    // Check if file is CSV
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return false;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return false;
    }

    return true;
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (!validateFile(file)) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);

    // Create FormData
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 10;
          if (newProgress >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return newProgress;
        });
      }, 500);

      // Send the file to the API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload file');
      }

      const data = await response.json();
      setSuccess(`Successfully uploaded ${file.name}. Processing ${data.asinCount} ASINs.`);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFile(null);
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="csv-upload"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-10 h-10 mb-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">CSV file with ASINs from Keepa</p>
          </div>
          <input
            id="csv-upload"
            type="file"
            className="hidden"
            accept=".csv"
            onChange={handleFileChange}
            ref={fileInputRef}
            disabled={isUploading}
          />
        </label>
      </div>

      {file && (
        <div className="flex items-center space-x-2 text-sm">
          <svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
          <span className="text-gray-500">{file.name}</span>
          <span className="text-gray-400">({(file.size / 1024).toFixed(2)} KB)</span>
        </div>
      )}

      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${uploadProgress}%` }}
          ></div>
          <p className="text-xs text-gray-500 mt-1">Uploading: {uploadProgress}%</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className={`px-4 py-2 text-white rounded-md ${
            !file || isUploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isUploading ? 'Uploading...' : 'Upload CSV'}
        </button>
      </div>
    </div>
  );
}
