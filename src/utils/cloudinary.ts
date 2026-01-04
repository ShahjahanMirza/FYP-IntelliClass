// Cloudinary configuration and upload utilities
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dk4i5sxqq';
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY || '724224496477429';
// NrufH498l_I55ABLVm0MW5IcnxE
// Cloudinary configuration

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  original_filename: string;
  format: string;
  bytes: number;
  created_at: string;
  resource_type?: string;
  url?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Upload file to Cloudinary
 * @param file - File to upload
 * @param onProgress - Progress callback function
 * @param folder - Folder to upload to (default: 'assignments')
 * @returns Promise with upload result
 */
export const uploadToCloudinary = async (
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  folder = 'assignments'
): Promise<CloudinaryUploadResult> => {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary cloud name not configured');
  }

  console.log('Starting Cloudinary upload:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    cloudName: CLOUDINARY_CLOUD_NAME,
    hasApiKey: !!CLOUDINARY_API_KEY
  });

  // Determine resource type based on file
  let resourceType = 'auto';
  if (file.type === 'application/pdf') {
    resourceType = 'raw'; // PDFs should use 'raw' resource type
  } else if (file.type.startsWith('image/')) {
    resourceType = 'image';
  }

  // Try unsigned upload with different presets
  const presetsToTry = ['ml_default', 'unsigned_uploads', 'intelliclass'];
  
  for (const preset of presetsToTry) {
    try {
      console.log(`Attempting unsigned upload with preset: ${preset}`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', preset);
      formData.append('folder', folder);

      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

      const result = await attemptUpload(uploadUrl, formData, onProgress);
      console.log(`Upload successful with preset: ${preset}`);
      return result;

    } catch (error: any) {
      console.warn(`Upload with preset ${preset} failed:`, error.message);
      // Continue to next preset
    }
  }

  // If all presets fail, try without preset (requires Cloudinary settings to allow)
  try {
    console.log('Attempting upload without preset');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    
    // For unsigned uploads without preset, we need API key
    if (CLOUDINARY_API_KEY) {
      formData.append('api_key', CLOUDINARY_API_KEY);
      formData.append('timestamp', Math.round(Date.now() / 1000).toString());
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    const result = await attemptUpload(uploadUrl, formData, onProgress);
    console.log('Upload successful without preset');
    return result;

  } catch (error: any) {
    console.error('All upload methods failed:', error);
    
    // Provide helpful error message
    throw new Error(
      `Cloudinary upload failed. Please ensure you have created an unsigned upload preset named "ml_default" or "unsigned_uploads" in your Cloudinary dashboard. ` +
      `Go to Settings > Upload > Upload presets > Add upload preset > Set "Signing Mode" to "Unsigned". ` +
      `Original error: ${error.message}`
    );
  }
};

/**
 * Generate the correct Cloudinary URL for fetching a file
 * @param result - Cloudinary upload result
 * @returns Correct URL for fetching the file
 */
export const getCloudinaryFetchUrl = (result: CloudinaryUploadResult): string => {
  // If the result already has the correct URL, use it
  if (result.secure_url) {
    // For PDFs and other raw files, ensure we use the raw URL
    if (result.format === 'pdf' || result.resource_type === 'raw') {
      // Replace /image/upload/ with /raw/upload/ if needed
      return result.secure_url.replace('/image/upload/', '/raw/upload/');
    }
    return result.secure_url;
  }

  // Fallback: construct URL manually
  const resourceType = result.format === 'pdf' ? 'raw' : 'image';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${result.public_id}.${result.format}`;
};

// Helper function to attempt upload with a specific configuration
const attemptUpload = (uploadUrl: string, formData: FormData, onProgress?: (progress: UploadProgress) => void): Promise<CloudinaryUploadResult> => {

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100)
          };
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch (error) {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        // Log detailed error information
        console.error('Cloudinary upload failed:', {
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText,
          url: uploadUrl
        });

        let errorMessage = `Upload failed with status: ${xhr.status}`;
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          if (errorResponse.error && errorResponse.error.message) {
            errorMessage += ` - ${errorResponse.error.message}`;
          }
        } catch (e) {
          // If response is not JSON, include raw response
          if (xhr.responseText) {
            errorMessage += ` - ${xhr.responseText}`;
          }
        }

        reject(new Error(errorMessage));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed due to network error'));
    });

    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  });
};

/**
 * Delete file from Cloudinary
 * @param publicId - Public ID of the file to delete
 * @returns Promise with deletion result
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  // Note: Deletion requires server-side implementation with API secret
  // This is a placeholder for the client-side interface
  console.warn('File deletion should be implemented on the server side for security');
  
  // In a real implementation, you would call your backend API
  // which would handle the deletion using the Cloudinary Admin API
  throw new Error('File deletion not implemented - requires server-side implementation');
};

/**
 * Get optimized URL for file display
 * @param publicId - Public ID of the file
 * @param options - Transformation options
 * @returns Optimized URL
 */
export const getOptimizedUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: 'auto' | number;
    format?: 'auto' | string;
  } = {}
): string => {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary cloud name not configured');
  }

  const { width, height, quality = 'auto', format = 'auto' } = options;
  
  let transformations = [];
  
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (quality) transformations.push(`q_${quality}`);
  if (format) transformations.push(`f_${format}`);
  
  const transformString = transformations.length > 0 ? `${transformations.join(',')}/` : '';
  
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformString}${publicId}`;
};

/**
 * Validate file for upload
 * @param file - File to validate
 * @returns Validation result
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/avif',
    'image/gif'
  ];

  const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'avif', 'gif'];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 10MB limit'
    };
  }

  // Check MIME type first
  let isValidType = allowedTypes.includes(file.type);

  // If MIME type check fails, check file extension as fallback
  if (!isValidType) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    isValidType = extension ? allowedExtensions.includes(extension) : false;
  }

  if (!isValidType) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return {
      valid: false,
      error: `File type not supported. File: ${file.name} (${file.type || 'unknown type'}${extension ? `, .${extension}` : ''}). Allowed types: PDF, PNG, JPG, JPEG, AVIF, GIF`
    };
  }

  return { valid: true };
};

/**
 * Validate file for class materials upload
 * @param file - File to validate
 * @returns Validation result
 */
export const validateMaterialFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024; // 5MB for materials
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    // Images
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/avif',
    'image/gif',
    'image/webp',
    // Archives
    'application/zip',
    'application/x-zip-compressed'
  ];

  const allowedExtensions = [
    // Documents
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt',
    // Images
    'png', 'jpg', 'jpeg', 'avif', 'gif', 'webp',
    // Archives
    'zip'
  ];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit'
    };
  }

  // Check MIME type first
  let isValidType = allowedTypes.includes(file.type);

  // If MIME type check fails, check file extension as fallback
  if (!isValidType) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    isValidType = extension ? allowedExtensions.includes(extension) : false;
  }

  if (!isValidType) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return {
      valid: false,
      error: `File type not supported. File: ${file.name} (${file.type || 'unknown type'}${extension ? `, .${extension}` : ''}). Allowed types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, PNG, JPG, JPEG, AVIF, GIF, WEBP, ZIP`
    };
  }

  return { valid: true };
};

/**
 * Upload multiple files to Cloudinary for class materials
 * @param files - Array of files to upload
 * @param onProgress - Progress callback function
 * @param classId - Class ID for folder organization
 * @returns Promise with upload results
 */
export const uploadMaterialsToCloudinary = async (
  files: File[],
  onProgress?: (fileIndex: number, progress: UploadProgress) => void,
  classId?: string
): Promise<{ results: CloudinaryUploadResult[]; errors: string[] }> => {
  const results: CloudinaryUploadResult[] = [];
  const errors: string[] = [];

  const folder = classId ? `materials/${classId}` : 'materials';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      // Validate each file
      const validation = validateMaterialFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      // Upload file
      const result = await uploadToCloudinary(
        file,
        onProgress ? (progress) => onProgress(i, progress) : undefined,
        folder
      );

      results.push(result);
    } catch (error: any) {
      errors.push(`${file.name}: ${error.message || 'Upload failed'}`);
    }
  }

  return { results, errors };
};
