import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';

// Initialize Gemini AI (Primary)
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Groq API configuration (Fallback)
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL = 'moonshotai/kimi-k2-instruct-0905';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Helper function to call Groq API
const callGroqAPI = async (prompt: string): Promise<string> => {
  console.log('Falling back to Groq API...');
  
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Groq API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
};

// Unified AI call with fallback
const generateWithFallback = async (prompt: string): Promise<string> => {
  try {
    // Try Gemini first
    console.log('Attempting Gemini API...');
    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    console.log('Gemini API succeeded');
    return text;
  } catch (geminiError: any) {
    console.warn('Gemini API failed:', geminiError.message);
    
    // Check if it's a quota/rate limit error or model not found
    const isQuotaError = geminiError.message?.includes('quota') || 
                         geminiError.message?.includes('429') ||
                         geminiError.message?.includes('rate') ||
                         geminiError.message?.includes('Resource has been exhausted') ||
                         geminiError.message?.includes('not found') ||
                         geminiError.message?.includes('not supported');
    
    if (isQuotaError) {
      console.log('Quota/rate limit exceeded or model unavailable, falling back to Groq...');
      try {
        const groqResponse = await callGroqAPI(prompt);
        console.log('Groq API succeeded');
        return groqResponse;
      } catch (groqError: any) {
        console.error('Groq API also failed:', groqError.message);
        throw new Error(`Both AI providers failed. Gemini: ${geminiError.message}, Groq: ${groqError.message}`);
      }
    }
    
    // For other errors, still try Groq as fallback
    try {
      const groqResponse = await callGroqAPI(prompt);
      console.log('Groq API succeeded (fallback)');
      return groqResponse;
    } catch (groqError: any) {
      // If Groq also fails, throw the original Gemini error
      throw geminiError;
    }
  }
};

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
    };
    reader.onerror = error => reject(error);
  });
};
// Health check
export const checkHealth = async () => {
  try {
    // Simple test to check if AI APIs are accessible
    const result = await generateWithFallback('Hello');
    return { status: 'healthy', message: 'AI API is accessible' };
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'unhealthy', message: 'AI API is not accessible' };
  }
};

// Test Gemini API connection and response structure
export const testGeminiConnection = async () => {
  console.log('=== AI CONNECTION TEST START ===');
  console.log('Environment check:');
  console.log('- VITE_GEMINI_API_KEY exists:', !!import.meta.env.VITE_GEMINI_API_KEY);
  console.log('- VITE_GROQ_API_KEY exists:', !!import.meta.env.VITE_GROQ_API_KEY);
  
  try {
    console.log('Testing AI content generation with fallback...');
    const testPrompt = 'Generate a simple test response with the word "SUCCESS" in it.';
    
    const text = await generateWithFallback(testPrompt);
    console.log('Test text content:', text);
    
    const testResult = {
      success: true,
      test_content: text,
      message: 'AI API test successful'
    };
    
    console.log('Test return object:', testResult);
    console.log('=== AI CONNECTION TEST SUCCESS ===');
    
    return testResult;
  } catch (error: any) {
    console.error('=== AI CONNECTION TEST ERROR ===');
    console.error('Error message:', error.message);
    console.error('=== AI CONNECTION TEST ERROR END ===');
    
    return {
      success: false,
      error: error.message,
      message: 'AI API test failed'
    };
  }
};

// OCR text extraction using backend API for PDFs and Gemini Vision for images
export const extractText = async (file: File) => {
  console.log('Calling extractText for file:', file.name, file.type, file.size);
  
  // Validate file type - now supporting both images and PDFs
  const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const supportedDocumentTypes = ['application/pdf'];
  const allSupportedTypes = [...supportedImageTypes, ...supportedDocumentTypes];
  
  if (!allSupportedTypes.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Please use JPEG, PNG, GIF, WebP images or PDF documents.`);
  }
  
  // Route to appropriate OCR method based on file type
  if (supportedDocumentTypes.includes(file.type)) {
    return await extractTextFromPDF(file);
  } else {
    return await extractTextFromImage(file);
  }
};

// Extract text from PDF using client-side PDF.js and Tesseract.js
const extractTextFromPDF = async (file: File) => {
  console.log('Processing PDF with client-side OCR:', file.name);
  
  try {
    // Dynamically import PDF.js
    const [pdfjsLib, pdfjsWorker, Tesseract] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      import('tesseract.js')
    ]);
    
    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
    
    // Convert PDF to images using PDF.js
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let allExtractedText = '';
    
    // Process each page of the PDF
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing PDF page ${pageNum}/${pdf.numPages}`);
      
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
      
      // Create canvas to render PDF page
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Convert canvas to blob for Tesseract
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      
      // Extract text from the rendered page using Tesseract
      const { data: { text } } = await Tesseract.default.recognize(blob, 'eng', {
        logger: (m) => console.log(`Page ${pageNum} OCR:`, m)
      });
      
      if (text.trim()) {
        allExtractedText += `\n--- Page ${pageNum} ---\n${text.trim()}\n`;
      }
    }
    
    if (!allExtractedText.trim()) {
      throw new Error('No text was extracted from the PDF. Please ensure the document contains readable text.');
    }
    
    return {
      success: true,
      extracted_text: allExtractedText.trim(),
      message: 'Text extracted successfully from PDF using client-side OCR',
      file_info: {
        name: file.name,
        type: file.type,
        size: file.size
      }
    };
  } catch (error: any) {
    console.error('PDF OCR error:', error);
    
    if (error.message?.includes('Invalid PDF')) {
      throw new Error('Invalid or corrupted PDF file. Please try a different document.');
    }
    
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

// Extract text from images using Tesseract.js
const extractTextFromImage = async (file: File) => {
  console.log('Processing image with Tesseract.js:', file.name);
  
  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error('File size too large. Please use files smaller than 10MB.');
  }
  
  try {
    console.log('Starting Tesseract OCR processing...');
    
    // Dynamically import Tesseract.js
    const Tesseract = await import('tesseract.js');
    
    // Use Tesseract.js to extract text from the image
    const { data: { text, confidence } } = await Tesseract.default.recognize(file, 'eng', {
      logger: (m) => console.log('Tesseract OCR:', m)
    });
    
    console.log('Tesseract OCR completed. Confidence:', confidence);
    console.log('Extracted text:', text);
    
    // Validate extracted text
    if (!text || text.trim().length === 0) {
      throw new Error('No text was extracted from the image. Please ensure the image contains readable text.');
    }
    
    // Check if confidence is too low (below 30%)
    if (confidence < 30) {
      console.warn('Low OCR confidence detected:', confidence);
    }
    
    return {
      success: true,
      extracted_text: text.trim(),
      message: `Text extracted successfully using Tesseract.js (confidence: ${confidence.toFixed(1)}%)`,
      file_info: {
        name: file.name,
        type: file.type,
        size: file.size
      },
      confidence: confidence
    };
  } catch (error: any) {
    console.error('Tesseract OCR error:', error);
    
    // Enhanced error handling
    if (error.message?.includes('timeout')) {
      throw new Error('OCR processing timed out. Please try again with a smaller file.');
    }
    
    if (error.message?.includes('worker')) {
      throw new Error('OCR worker failed to initialize. Please refresh the page and try again.');
    }
    
    if (error.message?.includes('invalid') || error.message?.includes('corrupt')) {
      throw new Error('Invalid or corrupted image file. Please try a different image.');
    }
    
    // If it's already a custom error message, pass it through
    if (error.message?.startsWith('Unsupported file type') || 
        error.message?.startsWith('File size too large') ||
        error.message?.startsWith('No text was extracted')) {
      throw error;
    }
    
    // Generic fallback error
    throw new Error(`Failed to extract text from the image: ${error.message || 'Unknown error occurred'}. Please try with a different image.`);
  }
};
// AI document generation using Gemini with Groq fallback
export const generateDocument = async (prompt: string, maxMarks: number = 100, daysUntilDue: number = 7) => {
  console.log('=== generateDocument DEBUG START ===');
  console.log('Input parameters:', { prompt, maxMarks, daysUntilDue });
  
  try {
    const enhancedPrompt = `Generate an educational assignment based on the following requirements:

Topic/Subject: ${prompt}
Maximum Marks: ${maxMarks}
Days Until Due: ${daysUntilDue}

Please create a comprehensive assignment that includes:
1. Clear instructions for students
2. Specific questions or tasks
3. Grading criteria
4. Expected learning outcomes

Format the response as a well-structured assignment document.`;
    
    console.log('Calling AI API with fallback...');
    
    const generatedContent = await generateWithFallback(enhancedPrompt);
    console.log('Generated content length:', generatedContent?.length || 0);
    
    const returnObject = {
      success: true,
      generated_content: generatedContent,
      max_marks: maxMarks,
      days_until_due: daysUntilDue,
      message: 'Assignment generated successfully'
    };
    
    console.log('=== generateDocument DEBUG END ===');
    
    return returnObject;
  } catch (error: any) {
    console.error('=== generateDocument ERROR ===');
    console.error('Error message:', error.message);
    console.error('=== generateDocument ERROR END ===');
    throw new Error(`Failed to generate document: ${error.message}`);
  }
};
// Submission grading using AI with fallback
export const gradeSubmission = async (gradingMode: string, ocrText: string | null, generatedContent: any | null, gradingCriteria?: string, customInstructions?: string) => {
  console.log('Calling gradeSubmission with AI fallback:', { gradingMode, ocrTextLength: ocrText?.length, generatedContent, gradingCriteria, customInstructions });
  
  try {
    let prompt = `Please grade the following student submission based on the provided criteria:

`;
    
    if (generatedContent) {
      prompt += `Assignment Content:\n${typeof generatedContent === 'string' ? generatedContent : JSON.stringify(generatedContent)}\n\n`;
    }
    
    if (ocrText) {
      prompt += `Student Submission (OCR Text):\n${ocrText}\n\n`;
    }
    
    if (gradingCriteria) {
      prompt += `Grading Criteria:\n${gradingCriteria}\n\n`;
    }
    
    if (customInstructions) {
      prompt += `Additional Instructions:\n${customInstructions}\n\n`;
    }
    
    prompt += `Please provide:
1. A numerical grade (0-100)
2. Detailed feedback explaining the grade
3. Areas for improvement
4. Strengths in the submission

Format your response as JSON with the following structure:
{
  "grade": <numerical_grade>,
  "feedback": "<detailed_feedback>",
  "strengths": "<identified_strengths>",
  "improvements": "<areas_for_improvement>"
}`;
    
    const gradingResult = await generateWithFallback(prompt);
    
    console.log('gradeSubmission AI response:', gradingResult);
    
    // Try to parse JSON response, fallback to text if parsing fails
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedResult = gradingResult.trim();
      if (cleanedResult.startsWith('```json')) {
        cleanedResult = cleanedResult.slice(7);
      } else if (cleanedResult.startsWith('```')) {
        cleanedResult = cleanedResult.slice(3);
      }
      if (cleanedResult.endsWith('```')) {
        cleanedResult = cleanedResult.slice(0, -3);
      }
      cleanedResult = cleanedResult.trim();
      
      const parsedResult = JSON.parse(cleanedResult);
      console.log('Parsed grading result:', parsedResult);
      
      // Extract grade from different possible field names
      const grade = parsedResult.grade || parsedResult.marks || parsedResult.final_marks || parsedResult.score || 0;
      const feedback = parsedResult.feedback || parsedResult.review || parsedResult.comments || 'No feedback provided';
      
      console.log('Extracted grade:', grade, 'feedback length:', feedback.length);
      
      return {
        success: true,
        grade: Number(grade),
        feedback: feedback,
        strengths: parsedResult.strengths || '',
        improvements: parsedResult.improvements || parsedResult.areas_for_improvement || '',
        final_marks: Number(grade),
        review: feedback,
        message: 'Submission graded successfully'
      };
    } catch (parseError) {
      console.log('JSON parse failed, using text format. Parse error:', parseError);
      return {
        success: true,
        grade: 0,
        feedback: gradingResult,
        final_marks: 0,
        review: gradingResult,
        message: 'Submission graded successfully (text format)'
      };
    }
  } catch (error: any) {
    console.error('gradeSubmission AI error:', error);
    throw new Error(`Failed to grade submission: ${error.message}`);
  }
};

// Generate answers for assignments using AI with fallback
export const generateAnswers = async (assignmentContent: string, maxMarks: number = 100) => {
  console.log('=== generateAnswers DEBUG START ===');
  console.log('Input parameters:', { assignmentContent: assignmentContent?.substring(0, 200), maxMarks });
  
  try {
    const prompt = `Based on the following assignment, generate comprehensive model answers:

Assignment Content:
${assignmentContent}

Maximum Marks: ${maxMarks}

Please provide:
1. Complete model answers for all questions/tasks
2. Key points that should be covered
3. Marking scheme breakdown
4. Alternative acceptable answers where applicable

Format the response clearly with proper headings and structure.`;
    
    console.log('Calling AI API with fallback for answers...');
    
    const generatedAnswers = await generateWithFallback(prompt);
    console.log('Generated answers length:', generatedAnswers?.length || 0);
    
    const returnObject = {
      success: true,
      generated_answers: generatedAnswers,
      max_marks: maxMarks,
      message: 'Model answers generated successfully'
    };
    
    console.log('=== generateAnswers DEBUG END ===');
    
    return returnObject;
  } catch (error: any) {
    console.error('=== generateAnswers ERROR ===');
    console.error('Error message:', error.message);
    console.error('=== generateAnswers ERROR END ===');
    throw new Error(`Failed to generate answers: ${error.message}`);
  }
};
// Mock API for classes, assignments, and grades
// In a real app, these would be actual API calls to your backend
export const getClasses = async () => {
  console.log('Calling getClasses API');
  try {
    // Mock data - replace with actual Supabase calls
    await new Promise(resolve => setTimeout(resolve, 300));
    const classes = [
      { id: '1', name: 'Mathematics 101', subject: 'Mathematics', description: 'Basic algebra and geometry', color_scheme: 'blue' },
      { id: '2', name: 'Physics 101', subject: 'Physics', description: 'Introduction to mechanics', color_scheme: 'green' },
      { id: '3', name: 'Chemistry 101', subject: 'Chemistry', description: 'Basic chemical principles', color_scheme: 'red' }
    ];
    console.log('getClasses response:', classes);
    return classes;
  } catch (error: any) {
    console.error('Error fetching classes:', error);
    throw error;
  }
};

export const createClass = async (classData: {
  name: string;
  subject: string;
  description: string;
  color_scheme: string;
}) => {
  console.log('Calling createClass with:', classData);
  try {
    // Mock create - replace with actual Supabase calls
    await new Promise(resolve => setTimeout(resolve, 500));
    const newClass = {
      id: Math.floor(Math.random() * 10000).toString(),
      ...classData
    };
    console.log('createClass response:', newClass);
    return newClass;
  } catch (error: any) {
    console.error('createClass error:', error);
    throw error;
  }
};
export const getAssignments = async (classId: string) => {
  console.log('Calling getAssignments for class:', classId);
  try {
    // Mock data - replace with actual Supabase calls
    await new Promise(resolve => setTimeout(resolve, 300));
    const assignments = [
      { 
        id: '1', 
        title: 'Algebra Basics', 
        content: 'Solve the following equations...', 
        max_marks: 100, 
        due_date: '2024-02-15',
        class_id: classId
      },
      { 
        id: '2', 
        title: 'Geometry Problems', 
        content: 'Calculate the area and perimeter...', 
        max_marks: 80, 
        due_date: '2024-02-20',
        class_id: classId
      }
    ];
    console.log('getAssignments response:', assignments);
    return assignments;
  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    throw error;
  }
};
export const getGrades = async (assignmentId: string) => {
  console.log('Calling getGrades for assignment:', assignmentId);
  try {
    // Mock data - replace with actual Supabase calls
    await new Promise(resolve => setTimeout(resolve, 300));
    const grades = [
      {
        id: '1',
        student_name: 'John Doe',
        score: 85,
        feedback: 'Good work on most problems',
        assignment_id: assignmentId,
        submitted_at: '2024-01-10T10:30:00.000Z'
      },
      {
        id: '2',
        student_name: 'Jane Smith',
        score: 92,
        feedback: 'Excellent understanding of concepts',
        assignment_id: assignmentId,
        submitted_at: '2024-01-11T14:20:00.000Z'
      }
    ];
    console.log('getGrades response:', grades);
    return grades;
  } catch (error: any) {
    console.error('Error fetching grades:', error);
    throw error;
  }
};
export const updateGrade = async (gradeId: string, marks: number) => {
  console.log('Calling updateGrade API with:', { gradeId, marks });
  try {
    // Import updateSubmission from supabase utils
    const { updateSubmission } = await import('./supabase');

    // Update the submission with the new grade
    const { data, error } = await updateSubmission(gradeId, {
      grade: marks,
      graded_at: new Date().toISOString(),
      graded_by: 'teacher'
    });

    if (error) {
      throw error;
    }

    const result = {
      success: true,
      gradeId,
      marks,
      data
    };
    console.log('updateGrade API response:', result);
    return result;
  } catch (error) {
    console.error('updateGrade API error:', error);
    throw error;
  }
};

export const createAssignment = async (assignmentData: {
  title: string;
  content: string;
  max_marks: number;
  due_date: string;
  class_id: string;
}) => {
  console.log('Calling createAssignment with:', assignmentData);
  try {
    // Mock create - replace with actual Supabase calls
    await new Promise(resolve => setTimeout(resolve, 500));
    const newAssignment = {
      id: Math.floor(Math.random() * 10000).toString(),
      ...assignmentData,
      created_at: new Date().toISOString()
    };
    console.log('createAssignment response:', newAssignment);
    return newAssignment;
  } catch (error: any) {
    console.error('createAssignment error:', error);
    throw error;
  }
};