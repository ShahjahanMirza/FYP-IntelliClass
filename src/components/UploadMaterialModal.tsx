import React, { useState } from 'react';
import { XIcon, UploadIcon } from 'lucide-react';
import { UploadResult } from '../utils/storage';
import { createClassMaterials } from '../utils/supabase';
import MaterialFileUpload from './MaterialFileUpload';
import { toast } from 'react-hot-toast';

interface UploadMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  teacherId: string;
  onMaterialsUploaded: () => void;
}

interface MaterialFormData {
  title: string;
  description: string;
}

const UploadMaterialModal: React.FC<UploadMaterialModalProps> = ({
  isOpen,
  onClose,
  classId,
  teacherId,
  onMaterialsUploaded
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadResult[]>([]);
  const [materialsData, setMaterialsData] = useState<MaterialFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFilesUploaded = (results: UploadResult[]) => {
    setUploadedFiles(results);
    // Initialize form data for each uploaded file
    const initialData = results.map(result => ({
      title: result.fileName.replace(/\.[^/.]+$/, ''), // Remove file extension
      description: ''
    }));
    setMaterialsData(initialData);
    setIsUploading(false); // Reset uploading state
    toast.success(`${results.length} file${results.length > 1 ? 's' : ''} uploaded successfully!`);
  };

  const handleUploadError = (errors: string[]) => {
    setIsUploading(false); // Reset uploading state
    errors.forEach(error => toast.error(error));
  };

  const handleMaterialDataChange = (index: number, field: keyof MaterialFormData, value: string) => {
    setMaterialsData(prev => prev.map((data, i) => 
      i === index ? { ...data, [field]: value } : data
    ));
  };

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload files first');
      return;
    }

    // Validate that all materials have titles
    const invalidMaterials = materialsData.some((data, index) => !data.title.trim());
    if (invalidMaterials) {
      toast.error('Please provide titles for all materials');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare materials data for database
      const materialsToCreate = uploadedFiles.map((file, index) => ({
        class_id: classId,
        teacher_id: teacherId,
        title: materialsData[index].title.trim(),
        description: materialsData[index].description.trim() || undefined,
        file_url: file.url,
        file_name: file.fileName,
        file_type: file.fileType,
        file_size: file.fileSize,
        storage_path: file.path
      }));

      const { data, error } = await createClassMaterials(materialsToCreate);

      if (error) {
        throw new Error(error.message || 'Failed to save materials');
      }

      toast.success(`${materialsToCreate.length} material${materialsToCreate.length > 1 ? 's' : ''} uploaded successfully!`);
      onMaterialsUploaded();
      handleClose();

    } catch (error: any) {
      console.error('Error saving materials:', error);
      toast.error(error.message || 'Failed to save materials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUploadedFiles([]);
    setMaterialsData([]);
    setIsSubmitting(false);
    setIsUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Class Materials</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting || isUploading}
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* File Upload Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Select Files</h3>
            <MaterialFileUpload
              onUploadComplete={handleFilesUploaded}
              onUploadError={handleUploadError}
              onUploadStart={() => setIsUploading(true)}
              classId={classId}
              disabled={isSubmitting}
              maxFiles={10}
            />
          </div>

          {/* Materials Details Section */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Material Details</h3>
              
              {uploadedFiles.map((file, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start space-x-4">
                    {/* File Preview */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                        <UploadIcon className="h-8 w-8 text-blue-600" />
                      </div>
                    </div>

                    {/* File Info and Form */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                        <p className="text-xs text-gray-500">
                          {file.fileType.split('/').pop()?.toUpperCase() || 'FILE'} • {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      {/* Title Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title *
                        </label>
                        <input
                          type="text"
                          value={materialsData[index]?.title || ''}
                          onChange={(e) => handleMaterialDataChange(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter material title"
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Description Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          value={materialsData[index]?.description || ''}
                          onChange={(e) => handleMaterialDataChange(index, 'description', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter material description"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting || isUploading}
          >
            Cancel
          </button>
          
          {uploadedFiles.length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                `Save ${uploadedFiles.length} Material${uploadedFiles.length > 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadMaterialModal;
