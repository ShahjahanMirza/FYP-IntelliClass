import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LoaderIcon, CheckCircleIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { extractText, gradeSubmission } from '../utils/api';
import { getAssignmentDetails, createSubmission, getSubmission, updateSubmission, createNotification } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { UploadResult } from '../utils/storage';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import ErrorBoundary from '../components/ErrorBoundary';
import { toast } from 'react-toastify';
import ScrollToTopButton from '../components/ScrollToTopButton';

// Lazy load FileUpload component
const FileUpload = React.lazy(() => import('../components/FileUpload'));
const SubmitAssignment = () => {
  const {
    classId,
    assignmentId
  } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadResult | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (!assignmentId) {
          throw new Error('Assignment ID is required');
        }

        if (!user) {
          throw new Error('User not authenticated');
        }

        const { data: assignment, error } = await getAssignmentDetails(assignmentId);

        if (error) {
          throw error;
        }

        if (!assignment) {
          throw new Error('Assignment not found');
        }

        setAssignment(assignment);

        // Check if user already has a submission for this assignment
        const { data: submissionData, error: submissionError } = await getSubmission(assignmentId, user.id);

        if (submissionData) {
          setExistingSubmission(submissionData);
          setExtractedText(submissionData.ocr_text || '');
        }
        // If no submission exists, that's fine - user can create one

      } catch (err: any) {
        setError(err.message || 'Failed to load assignment details');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [assignmentId, classId, user]);
  const handleFileUpload = async (result: UploadResult) => {
    setUploadedFile(result);
    setError(null);
    toast.success('File uploaded successfully! Processing text...');

    // Automatically trigger OCR processing
    await handleProcessOcr(result);
  };

  const handleUploadError = (error: string) => {
    let userFriendlyError = error;

    // Make error messages more user-friendly
    if (error.includes('File size exceeds')) {
      userFriendlyError = 'File is too large. Please upload a file smaller than 10MB.';
    } else if (error.includes('File type not supported')) {
      userFriendlyError = 'File type not supported. Please upload a PDF, PNG, JPG, JPEG, AVIF, or GIF file.';
    } else if (error.includes('Upload failed')) {
      userFriendlyError = 'Upload failed. Please check your internet connection and try again.';
    } else if (error.includes('No file selected')) {
      userFriendlyError = 'Please select a file to upload.';
    }

    setError(userFriendlyError);
    toast.error(userFriendlyError);
  };

  const handleProcessOcr = async (fileResult?: UploadResult) => {
  const fileToProcess = fileResult || uploadedFile;

  if (!fileToProcess) {
    setError('Please upload a file first');
    return;
  }

  setIsProcessingOcr(true);
  setError(null);

  try {
    // Fetch file from Supabase Storage URL
    const fetchUrl = fileToProcess.url;
    console.log('Fetching file from Supabase Storage URL:', fetchUrl);

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('Blob details:', { type: blob.type, size: blob.size });

    // Create file object for OCR
    const file = new File([blob], fileToProcess.fileName, { type: fileToProcess.fileType });
    console.log('Created file object:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const result = await extractText(file);
    console.log('OCR result:', result);

    if (result.extracted_text) {
      setExtractedText(result.extracted_text);
      console.log('Extracted text:', result.extracted_text.substring(0, 100) + '...');
      toast.success('Text extracted successfully!');

      // Automatically submit the assignment after OCR completion
      if (fileResult) {
        await handleAutoSubmit(fileToProcess, result.extracted_text);
      }
    } else {
      const errorMessage = result.error || 'Failed to extract text from the file';
      console.error('OCR failed:', errorMessage);
      throw new Error(errorMessage);
    }
  } catch (err: any) {
    let errorMessage = 'Error processing OCR. Please try again.';

    if (err.message?.includes('Failed to fetch')) {
      errorMessage = 'Unable to access the uploaded file. Please try uploading again.';
    } else if (err.message?.includes('timeout')) {
      errorMessage = 'OCR processing timed out. Please try again with a smaller file.';
    } else if (err.message) {
      errorMessage = err.message;
    }

    setError(errorMessage);
    console.error('Error processing OCR:', err);
    toast.error(errorMessage);
  } finally {
    setIsProcessingOcr(false);
  }
};

  const handleAutoSubmit = async (fileResult: UploadResult, ocrText: string) => {
    if (!user || !assignment) {
      console.error('Missing user or assignment data for auto-submit');
      return;
    }

    setIsSubmitting(true);

    try {
      toast.info('Submitting assignment and processing grade...');

      // Create or update submission in database
      const submissionData = {
        assignment_id: assignmentId!,
        student_id: user.id,
        file_url: fileResult.url,
        file_name: fileResult.fileName,
        ocr_text: ocrText
      };

      let submissionResult;
      if (existingSubmission) {
        // Update existing submission
        submissionResult = await updateSubmission(existingSubmission.id, {
          file_url: fileResult.url,
          file_name: fileResult.fileName,
          ocr_text: ocrText
        });
      } else {
        // Create new submission
        submissionResult = await createSubmission(submissionData);
      }

      if (submissionResult.error) {
        throw new Error(submissionResult.error.message || 'Failed to save submission');
      }

      // Grade the submission automatically
      const gradingResult = await gradeSubmission(
        'Compare OCR\'d content with Generated document',
        ocrText,
        assignment,
        undefined,
        undefined
      );

      if (gradingResult.success && submissionResult.data) {
        const finalMarks = gradingResult.final_marks || gradingResult.grade || 0;
        const review = gradingResult.review || gradingResult.feedback || 'No feedback provided';
        
        // Update submission with grade
        await updateSubmission(submissionResult.data.id, {
          grade: finalMarks,
          feedback: review,
          graded_at: new Date().toISOString(),
          graded_by: 'system' // Automatic grading
        });

        // Create notification for student about grade
        await createNotification({
          user_id: user.id,
          title: 'Assignment Graded',
          message: `Your assignment "${assignment.title}" has been automatically graded. Score: ${finalMarks}/${assignment.max_marks}`,
          type: 'grade',
          related_id: submissionResult.data.id
        });

        toast.success(`Assignment submitted and graded! Score: ${finalMarks}/${assignment.max_marks}`);
      } else {
        toast.success('Assignment submitted successfully! Grading in progress...');
      }

      // Navigate back to assignment details
      setTimeout(() => {
        navigate(`/dashboard/classes/${classId}/assignments/${assignmentId}`);
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to submit assignment. Please try again.');
      console.error('Error in auto-submit:', err);
      toast.error(err.message || 'Failed to submit assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!uploadedFile) {
      setError('Please upload a file before submitting');
      setIsSubmitting(false);
      return;
    }

    if (!extractedText) {
      setError('Please process OCR before submitting');
      setIsSubmitting(false);
      return;
    }

    if (!user) {
      setError('User not authenticated');
      setIsSubmitting(false);
      return;
    }

    try {
      // Create or update submission in database
      const submissionData = {
        assignment_id: assignmentId!,
        student_id: user.id,
        file_url: uploadedFile.url,
        file_name: uploadedFile.fileName,
        ocr_text: extractedText
      };

      let submissionResult;
      if (existingSubmission) {
        // Update existing submission
        submissionResult = await updateSubmission(existingSubmission.id, {
          file_url: uploadedFile.url,
          file_name: uploadedFile.fileName,
          ocr_text: extractedText
        });
      } else {
        // Create new submission
        submissionResult = await createSubmission(submissionData);
      }

      if (submissionResult.error) {
        throw new Error(submissionResult.error.message || 'Failed to save submission');
      }

      // Grade the submission automatically
      const gradingResult = await gradeSubmission(
        'Compare OCR\'d content with Generated document',
        extractedText,
        assignment,
        undefined,
        undefined
      );

      if (gradingResult.success && submissionResult.data) {
        const finalMarks = gradingResult.final_marks || gradingResult.grade || 0;
        const review = gradingResult.review || gradingResult.feedback || 'No feedback provided';
        
        // Update submission with grade
        await updateSubmission(submissionResult.data.id, {
          grade: finalMarks,
          feedback: review,
          graded_at: new Date().toISOString(),
          graded_by: 'system' // Automatic grading
        });

        // Create notification for student about grade
        await createNotification({
          user_id: user.id,
          title: 'Assignment Graded',
          message: `Your assignment "${assignment.title}" has been automatically graded. Score: ${finalMarks}/${assignment.max_marks}`,
          type: 'grade',
          related_id: submissionResult.data.id
        });
      }

      toast.success('Assignment submitted successfully!');
      navigate(`/dashboard/classes/${classId}/assignments/${assignmentId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit assignment. Please try again.');
      console.error('Error submitting assignment:', err);
      toast.error(err.message || 'Failed to submit assignment');
    } finally {
      setIsSubmitting(false);
    }
  };
  if (isLoading) {
    return <div className="h-64">
        <LoadingSpinner size="medium" />
      </div>;
  }
  
  if (error) {
    return <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton to={`/dashboard/classes/${classId}/assignments/${assignmentId}`} />
        </div>
        <ErrorAlert 
          message={error} 
          onDismiss={() => setError(null)} 
        />
      </div>;
  }
  return <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <BackButton to={`/dashboard/classes/${classId}/assignments/${assignmentId}`} />
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold mb-2">Submit Assignment</h1>
            <h2 className="text-lg text-gray-700 mb-4">{assignment.title}</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium mb-2">Assignment Content:</h3>
              <ReactMarkdown 
                  components={{
                    p: ({children}) => <p className="prose prose-sm max-w-none mb-2">{children}</p>,
                    h1: ({children}) => <h1 className="prose prose-sm max-w-none text-xl font-bold mb-2">{children}</h1>,
                    h2: ({children}) => <h2 className="prose prose-sm max-w-none text-lg font-semibold mb-2">{children}</h2>,
                    h3: ({children}) => <h3 className="prose prose-sm max-w-none text-md font-medium mb-2">{children}</h3>,
                    ul: ({children}) => <ul className="prose prose-sm max-w-none list-disc ml-4 mb-2">{children}</ul>,
                    ol: ({children}) => <ol className="prose prose-sm max-w-none list-decimal ml-4 mb-2">{children}</ol>,
                    li: ({children}) => <li className="prose prose-sm max-w-none mb-1">{children}</li>,
                    code: ({children}) => <code className="prose prose-sm max-w-none bg-gray-100 px-1 rounded">{children}</code>,
                    pre: ({children}) => <pre className="prose prose-sm max-w-none bg-gray-100 p-2 rounded overflow-x-auto">{children}</pre>
                  }}
                >
                  {assignment.content}
                </ReactMarkdown>
            </div>

            {existingSubmission && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                <h3 className="font-medium text-yellow-800 mb-2">
                  Submission Already Graded
                </h3>
                <p className="text-sm text-yellow-700 mb-2">
                  You have already submitted this assignment and it has been graded. You cannot update your submission.
                </p>
                <div className="text-sm text-yellow-600">
                  <p>Previous submission: {existingSubmission.file_name}</p>
                  <p>Submitted: {new Date(existingSubmission.submitted_at).toLocaleString()}</p>
                  {existingSubmission.grade && (
                    <p>Grade: {existingSubmission.grade}/{assignment.max_marks}</p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-medium text-blue-800 mb-2">
                Automatic Assignment Submission
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Upload a document (PDF) or image (PNG, JPG, JPEG, AVIF) of your work.
                The system will automatically extract text, submit your assignment, and grade it for you!
              </p>

              <ErrorBoundary>
                <Suspense fallback={<div className="flex items-center justify-center p-4"><LoadingSpinner size="small" /></div>}>
                  <FileUpload
                    onUploadComplete={handleFileUpload}
                    onUploadError={handleUploadError}
                    assignmentId={assignmentId}
                    disabled={isSubmitting || isProcessingOcr || !!existingSubmission}
                    className="mb-4"
                  />
                </Suspense>
              </ErrorBoundary>

              {isProcessingOcr && (
                <div className="mb-4 flex items-center text-blue-600">
                  <LoaderIcon className="h-5 w-5 mr-2 animate-spin" />
                  <span>Processing text extraction and submission...</span>
                </div>
              )}

              {error && uploadedFile && !isProcessingOcr && !extractedText && (
                <div className="mb-4">
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-3">
                    <p className="text-red-700">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleProcessOcr()}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors"
                  >
                    Retry Text Extraction
                  </button>
                </div>
              )}

              {extractedText && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="flex items-center p-4 pb-2 text-green-600">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">OCR Extraction Complete</h3>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-h-64 overflow-y-auto">
                      <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                        {extractedText}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-2">
                      Scroll to view full extracted text
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {extractedText ? (
              <span className="text-green-600 flex items-center">
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Assignment submitted and graded automatically!
              </span>
            ) : (
              <span>Upload a file to automatically submit and grade your assignment</span>
            )}
          </div>
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            onClick={() => navigate(`/dashboard/classes/${classId}/assignments/${assignmentId}`)}
            disabled={isSubmitting || isProcessingOcr}
          >
            {isSubmitting || isProcessingOcr ? 'Processing...' : 'Back to Assignment'}
          </button>
        </div>
      </form>
      <ScrollToTopButton />
    </div>;
};
export default SubmitAssignment;