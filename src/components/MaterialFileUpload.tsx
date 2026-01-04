import React, { useState, useRef } from 'react';
import { FileUpIcon, LoaderIcon, CheckCircleIcon, XCircleIcon, FileIcon, TrashIcon } from 'lucide-react';
import { uploadMaterials, validateMaterialFile, UploadResult, UploadProgress } from '../utils/storage';

interface MaterialFileUploadProps {
  onUploadComplete: (results: UploadResult[]) => void;
  onUploadError: (errors: string[]) => void;
  onUploadStart?: () => void;
  classId?: string;
  disabled?: boolean;
  className?: string;
  maxFiles?: number;
}

interface FileWithProgress {
  file: File;
  progress?: UploadProgress;
  result?: UploadResult;
  error?: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

const MaterialFileUpload: React.FC<MaterialFileUploadProps> = ({
  onUploadComplete,
  onUploadError,
  onUploadStart,
  classId,
  disabled = false,
  className = '',
  maxFiles = 10
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithProgress[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setErrors([]);
    setUploadResults([]);

    // Validate total file count
    if (files.length > maxFiles) {
      setErrors([`You can only upload up to ${maxFiles} files at once`]);
      return;
    }

    // Validate each file and create FileWithProgress objects
    const validatedFiles: FileWithProgress[] = [];
    const validationErrors: string[] = [];

    files.forEach(file => {
      const validation = validateMaterialFile(file);
      if (validation.valid) {
        validatedFiles.push({
          file,
          status: 'pending'
        });
      } else {
        validationErrors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
    }

    setSelectedFiles(validatedFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setErrors(['Please select files first']);
      return;
    }

    setIsUploading(true);
    setErrors([]);
    setUploadResults([]);

    if (onUploadStart) {
      onUploadStart();
    }

    try {
      const files = selectedFiles.map(f => f.file);
      
      // Update progress for each file
      const { results, errors: uploadErrors } = await uploadMaterials(
        files,
        classId || 'general',
        (fileIndex, progress) => {
          setSelectedFiles(prev => prev.map((fileWithProgress, index) => 
            index === fileIndex 
              ? { ...fileWithProgress, progress, status: 'uploading' }
              : fileWithProgress
          ));
        }
      );

      // Update final status for each file
      setSelectedFiles(prev => prev.map((fileWithProgress, index) => {
        const result = results[index];
        const error = uploadErrors.find(err => err.startsWith(fileWithProgress.file.name));
        
        return {
          ...fileWithProgress,
          result,
          error,
          status: result ? 'completed' : 'error'
        };
      }));

      if (results.length > 0) {
        setUploadResults(results);
        onUploadComplete(results);
      }

      if (uploadErrors.length > 0) {
        setErrors(uploadErrors);
        onUploadError(uploadErrors);
      }

    } catch (err: any) {
      const errorMessage = err.message || 'Upload failed. Please try again.';
      setErrors([errorMessage]);
      onUploadError([errorMessage]);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFiles([]);
    setUploadResults([]);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
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
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.avif,.gif,.webp,.zip"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
          id="material-file-upload-input"
        />
        
        <label
          htmlFor="material-file-upload-input"
          className={`cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center transition-colors ${
            disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <FileUpIcon className="h-5 w-5 mr-2" />
          Choose Files
        </label>

        {selectedFiles.length > 0 && uploadResults.length === 0 && (
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
              `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`
            )}
          </button>
        )}

        {uploadResults.length > 0 && (
          <button
            type="button"
            onClick={resetUpload}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center transition-colors"
          >
            Upload New Files
          </button>
        )}
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Selected Files:</h4>
          {selectedFiles.map((fileWithProgress, index) => (
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  {getFileIcon(fileWithProgress.file.name)}
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileWithProgress.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(fileWithProgress.file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {fileWithProgress.status === 'pending' && !isUploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                  
                  {fileWithProgress.status === 'uploading' && (
                    <LoaderIcon className="h-4 w-4 text-blue-600 animate-spin" />
                  )}
                  
                  {fileWithProgress.status === 'completed' && (
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                  )}
                  
                  {fileWithProgress.status === 'error' && (
                    <XCircleIcon className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {fileWithProgress.progress && fileWithProgress.status === 'uploading' && (
                <div className="mt-2">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${fileWithProgress.progress.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {fileWithProgress.progress.percentage.toFixed(0)}% uploaded
                  </p>
                </div>
              )}

              {/* Error Message */}
              {fileWithProgress.error && (
                <p className="text-xs text-red-600 mt-1">{fileWithProgress.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start">
            <XCircleIcon className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Upload Errors</p>
              <ul className="text-xs text-red-600 mt-1 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* File Requirements */}
      <div className="text-xs text-gray-500">
        <p>
          Accepted file types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, PNG, JPG, JPEG, AVIF, GIF, WEBP, ZIP
        </p>
        <p>Maximum size: 5MB per file • Maximum files: {maxFiles}</p>
      </div>
    </div>
  );
};

export default MaterialFileUpload;
