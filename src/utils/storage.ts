// Supabase Storage utilities - replaces Cloudinary
import { supabase } from './supabase';

export interface UploadResult {
  url: string;
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Upload file to Supabase Storage
 */
export const uploadFile = async (
  file: File,
  bucket: 'submissions' | 'materials' | 'avatars',
  folder?: string
): Promise<UploadResult> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to upload files');

  // Generate unique file path
  const fileExt = file.name.split('.').pop();
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const fileName = `${timestamp}_${randomId}.${fileExt}`;
  const filePath = folder ? `${user.id}/${folder}/${fileName}` : `${user.id}/${fileName}`;

  console.log('Uploading to Supabase Storage:', { bucket, filePath, fileSize: file.size });

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size
  };
};

/**
 * Upload submission file
 */
export const uploadSubmission = async (
  file: File,
  assignmentId: string
): Promise<UploadResult> => {
  return uploadFile(file, 'submissions', assignmentId);
};

/**
 * Upload class material
 */
export const uploadMaterial = async (
  file: File,
  classId: string
): Promise<UploadResult> => {
  return uploadFile(file, 'materials', classId);
};

/**
 * Upload avatar
 */
export const uploadAvatar = async (file: File): Promise<UploadResult> => {
  return uploadFile(file, 'avatars');
};

/**
 * Delete file from storage
 */
export const deleteFile = async (
  bucket: 'submissions' | 'materials' | 'avatars',
  path: string
): Promise<void> => {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }
};

/**
 * Get public URL for a file
 */
export const getFileUrl = (
  bucket: 'submissions' | 'materials' | 'avatars',
  path: string
): string => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Validate file for submission upload
 */
export const validateSubmissionFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/avif'
  ];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  const isValidType = allowedTypes.includes(file.type) || 
    ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(
      file.name.split('.').pop()?.toLowerCase() || ''
    );

  if (!isValidType) {
    return { valid: false, error: 'File type not supported. Use PDF or images.' };
  }

  return { valid: true };
};

/**
 * Validate file for material upload
 */
export const validateMaterialFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'zip'];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !allowedExtensions.includes(ext)) {
    return { valid: false, error: `File type not supported. Allowed: ${allowedExtensions.join(', ')}` };
  }

  return { valid: true };
};

/**
 * Upload multiple materials with progress tracking
 */
export const uploadMaterials = async (
  files: File[],
  classId: string,
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<{ results: UploadResult[]; errors: string[] }> => {
  const results: UploadResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Simulate progress start
    if (onProgress) {
      onProgress(i, { loaded: 0, total: file.size, percentage: 0 });
    }

    try {
      const result = await uploadMaterial(file, classId);
      results.push(result);
      
      // Simulate progress complete
      if (onProgress) {
        onProgress(i, { loaded: file.size, total: file.size, percentage: 100 });
      }
    } catch (error: any) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  return { results, errors };
};
