import React, { useState, useRef } from 'react';
import { FileUpIcon, LoaderIcon, CheckCircleIcon, XCircleIcon, FileIcon } from 'lucide-react';
import { uploadSubmission, validateSubmissionFile, UploadResult } from '../utils/storage';

interface FileUploadProps {
  onUploadComplete: (result: UploadResult) => void;
  onUploadError: (error: string) => void;
  onUploadStart?: () => void;
  assignmentId?: string;
  acceptedTypes?: string[];
  maxSizeInMB?: number;
  disabled?: boolean;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  onUploadError,
  onUploadStart,
  assignmentId = 'general',
  acceptedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.avif'],
  maxSizeInMB = 10,
  disabled = false,
  className = ''
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadResult(null);
    setUploadProgress(null);

    // Validate file
    const validation = validateSubmissionFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    if (onUploadStart) {
      onUploadStart();
    }

    try {
      // Simulate progress since Supabase doesn't provide upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min((prev || 0) + 10, 90));
      }, 100);

      const result = await uploadSubmission(selectedFile, assignmentId);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      setUploadResult(result);
      onUploadComplete(result);
    } catch (err: any) {
      const errorMessage = err.message || 'Upload failed. Please try again.';
      setError(errorMessage);
      onUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* File Input */}
      <div className="flex items-center space-x-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
          id="file-upload-input"
        />
        
        <label
          htmlFor="file-upload-input"
          className={`cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center transition-colors ${
            disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <FileUpIcon className="h-5 w-5 mr-2" />
          {selectedFile ? selectedFile.name : 'Choose File'}
        </label>

        {selectedFile && !uploadResult && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={disabled || isUploading}
            className={`bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center transition-colors ${
              disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isUploading ? (
              <>
                <LoaderIcon className="h-5 w-5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload File'
            )}
          </button>
        )}

        {uploadResult && (
          <button
            type="button"
            onClick={resetUpload}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center transition-colors"
          >
            Upload New File
          </button>
        )}
      </div>

      {/* File Info */}
      {selectedFile && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center">
            <FileIcon className="h-5 w-5 text-gray-500 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)} • {selectedFile.type}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress !== null && uploadProgress < 100 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Uploading...</span>
            <span className="text-sm text-blue-600">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Success */}
      {uploadResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center">
            <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Upload Successful</p>
              <p className="text-xs text-green-600">
                File uploaded to Supabase Storage • {formatFileSize(uploadResult.fileSize)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center">
            <XCircleIcon className="h-5 w-5 text-red-600 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Upload Failed</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* File Requirements */}
      <div className="text-xs text-gray-500">
        <p>
          Accepted file types: {acceptedTypes.join(', ')} • Maximum size: {maxSizeInMB}MB
        </p>
      </div>
    </div>
  );
};

export default FileUpload;
