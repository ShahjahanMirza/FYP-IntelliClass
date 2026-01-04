import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zwagbggjuwyldhjhnzyr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3YWdiZ2dqdXd5bGRoamhuenlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NjI5MTMsImV4cCI6MjA2NzAzODkxM30.BrPuwhpggfIVENeAsBHjUY65qZCs9CRnmN6VXuUGmTg';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  description: string;
  class_code: string;
  color_scheme: string;
  teacher_id: string;
  created_at: string;
  updated_at: string;
}

export interface ClassMember {
  id: string;
  class_id: string;
  user_id: string;
  role: 'teacher' | 'student';
  joined_at: string;
}

export interface Assignment {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string;
  content: string;
  max_marks: number;
  due_date: string;
  is_ai_generated: boolean;
  ai_prompt?: string;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string;
  file_name: string;
  ocr_text: string;
  grade?: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: string;
  submitted_at: string;
}

export interface Ticket {
  id: string;
  submission_id: string;
  student_id: string;
  title: string;
  reason: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  teacher_response?: string;
  responded_by?: string;
  responded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'grade' | 'assignment' | 'class' | 'ticket' | 'general' | 'material' | 'video_room';
  is_read: boolean;
  related_id?: string;
  created_at: string;
}

export interface VideoRoom {
  id: string;
  room_id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  is_active: boolean;
  max_participants: number;
  created_at: string;
  ended_at?: string;
  updated_at: string;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string;
  is_active: boolean;
  role: 'host' | 'participant';
}

export interface ClassMaterial {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  cloudinary_public_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Helper functions for authentication
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const signUp = async (email: string, password: string, name: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name
        }
      }
    });

    if (error) {
      throw error;
    }

    // If signup successful, create user profile manually
    if (data.user) {
      try {
        // Wait a moment for the auth user to be fully created
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create user profile manually
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: email,
            name: name
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Don't throw here, let the signup succeed
        } else {
          console.log('User profile created successfully');
        }
      } catch (profileError) {
        console.error('Could not create profile manually:', profileError);
        // Don't throw here, let the signup succeed
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('Signup error:', error);
    return { data: null, error };
  }
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// Helper function to clear cached data and force a clean state
export const clearCachedData = () => {
  try {
    console.log('Clearing Supabase session data...');
    // Find all keys in localStorage that are related to Supabase
    const supabaseKeys = Object.keys(localStorage).filter(key => key.startsWith('sb-'));
    // Remove each of those keys
    supabaseKeys.forEach(key => localStorage.removeItem(key));
    console.log('Supabase session data cleared successfully.');
  } catch (error) {
    console.error('Error clearing cached data:', error);
  }
};

// Function to force a complete application reset
export const forceAppReset = () => {
  console.log('Forcing complete application reset...');
  clearCachedData();
};

// Helper function to get user profile
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
};

// Helper function to update user profile
export const updateUserProfile = async (userId: string, updates: Partial<User>) => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
};

// Helper function to upload avatar using Supabase Storage
export const uploadAvatar = async (userId: string, file: File) => {
  try {
    // Import Supabase Storage upload function
    const { uploadAvatar: uploadAvatarToStorage } = await import('./storage');

    // Upload to Supabase Storage
    const result = await uploadAvatarToStorage(file);

    return {
      data: { publicUrl: result.url },
      error: null
    };
  } catch (error) {
    console.error('Avatar upload error:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Failed to upload avatar')
    };
  }
};

// Class management functions
export const createClass = async (classData: {
  name: string;
  subject: string;
  description: string;
  color_scheme: string;
  teacher_id: string;
}) => {
  try {
    // Generate unique class code
    let classCode: string;
    let isUnique = false;
    let attempts = 0;

    do {
      // Generate a 6-character alphanumeric code
      classCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Check if code is unique
      const { data: existingClass } = await supabase
        .from('classes')
        .select('id')
        .eq('class_code', classCode)
        .single();

      isUnique = !existingClass;
      attempts++;
    } while (!isUnique && attempts < 10);

    const { data, error } = await supabase
      .from('classes')
      .insert({
        ...classData,
        class_code: classCode
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating class:', error);
      return { data: null, error };
    }

    // Add teacher as class member (with conflict handling)
    const { error: memberError } = await supabase
      .from('class_members')
      .insert({
        class_id: data.id,
        user_id: classData.teacher_id,
        role: 'teacher'
      });

    if (memberError) {
      // Check if it's a duplicate key error (teacher already added by trigger)
      if (memberError.code === '23505') {
        console.log('Teacher already added as member (likely by trigger), continuing...');
        // This is expected if the trigger already added the teacher, so continue
      } else {
        console.error('Error adding teacher as member:', memberError);
        // If adding member fails for other reasons, delete the class
        await supabase.from('classes').delete().eq('id', data.id);
        return { data: null, error: memberError };
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error in createClass:', error);
    return { data: null, error };
  }
};

export const joinClass = async (userId: string, classCode: string) => {
  // First, find the class by code
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id')
    .eq('class_code', classCode)
    .single();

  if (classError || !classData) {
    return { data: null, error: classError || new Error('Class not found') };
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id', classData.id)
    .eq('user_id', userId)
    .single();

  if (existingMember) {
    return { data: null, error: new Error('You are already a member of this class') };
  }

  // Add user as student
  const { data, error } = await supabase
    .from('class_members')
    .insert({
      class_id: classData.id,
      user_id: userId,
      role: 'student'
    })
    .select()
    .single();

  return { data, error };
};

export const getUserClasses = async (userId: string) => {
  const { data, error } = await supabase
    .from('class_members')
    .select(`
      id,
      role,
      joined_at,
      classes (
        id,
        name,
        subject,
        description,
        class_code,
        color_scheme,
        teacher_id,
        created_at,
        users!classes_teacher_id_fkey (
          id,
          name,
          email
        )
      )
    `)
    .eq('user_id', userId);

  return { data, error };
};

export const getClassDetails = async (classId: string) => {
  console.log('🔍 getClassDetails called for classId:', classId);

  const { data, error } = await supabase
    .from('classes')
    .select(`
      *,
      users!classes_teacher_id_fkey (
        id,
        name,
        email
      ),
      class_members (
        id,
        role,
        joined_at,
        user_id,
        users (
          id,
          name,
          email,
          avatar_url
        )
      )
    `)
    .eq('id', classId)
    .single();

  console.log('🔍 getClassDetails raw result:', { data, error });

  // If teacher data is missing from the join, fetch it separately
  if (data && data.teacher_id && !data.users) {
    console.log('🔍 Teacher data missing, fetching separately for teacher_id:', data.teacher_id);
    try {
      const { data: teacherData, error: teacherError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', data.teacher_id)
        .single();

      if (teacherData && !teacherError) {
        console.log('🔍 Successfully fetched teacher data:', teacherData);
        data.users = teacherData;
      } else {
        console.log('🔍 Failed to fetch teacher data:', teacherError);
      }
    } catch (fetchError) {
      console.error('🔍 Error fetching teacher data:', fetchError);
    }
  }

  // Fix any class members with missing user data
  if (data && data.class_members) {
    const fixedMembers = [];
    for (const member of data.class_members) {
      if (!member.users && member.user_id) {
        console.log('Fixing class member with missing user data:', member);
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name, email, avatar_url')
            .eq('id', member.user_id)
            .single();

          if (userData && !userError) {
            fixedMembers.push({
              ...member,
              users: userData
            });
          } else {
            console.error('Could not fetch user data for member:', member.user_id, userError);
            fixedMembers.push({
              ...member,
              users: {
                id: member.user_id,
                name: 'Unknown User',
                email: 'unknown@example.com',
                avatar_url: null
              }
            });
          }
        } catch (fetchError) {
          console.error('Error fetching user data for member:', fetchError);
          fixedMembers.push({
            ...member,
            users: {
              id: member.user_id,
              name: 'Unknown User',
              email: 'unknown@example.com',
              avatar_url: null
            }
          });
        }
      } else {
        fixedMembers.push(member);
      }
    }

    return {
      data: {
        ...data,
        class_members: fixedMembers
      },
      error
    };
  }

  return { data, error };
};

export const leaveClass = async (userId: string, classId: string) => {
  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('user_id', userId)
    .eq('class_id', classId);

  return { error };
};

export const updateClass = async (classId: string, updates: Partial<Class>) => {
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', classId)
    .select()
    .single();

  return { data, error };
};

export const deleteClass = async (classId: string) => {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId);

  return { error };
};

// Assignment management functions
export const createAssignment = async (assignmentData: {
  class_id: string;
  teacher_id: string;
  title: string;
  content: string;
  max_marks: number;
  due_date: string;
  is_ai_generated: boolean;
  ai_prompt?: string;
}) => {
  const { data, error } = await supabase
    .from('assignments')
    .insert(assignmentData)
    .select()
    .single();

  return { data, error };
};

export const getClassAssignments = async (classId: string) => {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      users!assignments_teacher_id_fkey (
        id,
        name,
        email
      )
    `)
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  return { data, error };
};

export const getAssignmentDetails = async (assignmentId: string) => {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      users!assignments_teacher_id_fkey (
        id,
        name,
        email
      ),
      classes (
        id,
        name,
        subject
      )
    `)
    .eq('id', assignmentId)
    .single();

  return { data, error };
};

export const updateAssignment = async (assignmentId: string, updates: Partial<Assignment>) => {
  const { data, error } = await supabase
    .from('assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select()
    .single();

  return { data, error };
};

export const updateAssignmentAnswerKey = async (assignmentId: string, answerKey: string) => {
  const { data, error } = await supabase
    .from('assignments')
    .update({ answer_key: answerKey })
    .eq('id', assignmentId)
    .select()
    .single();

  return { data, error };
};

export const deleteAssignment = async (assignmentId: string) => {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId);

  return { error };
};

export const getUserAssignments = async (userId: string) => {
  // First get the user's class IDs
  const { data: classMembers, error: memberError } = await supabase
    .from('class_members')
    .select('class_id')
    .eq('user_id', userId);

  if (memberError || !classMembers) {
    return { data: null, error: memberError };
  }

  const classIds = classMembers.map(member => member.class_id);

  if (classIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      classes (
        id,
        name,
        subject,
        color_scheme
      ),
      users!assignments_teacher_id_fkey (
        id,
        name,
        email
      ),
      submissions!left (
        id,
        grade,
        submitted_at,
        graded_at
      )
    `)
    .in('class_id', classIds)
    .order('due_date', { ascending: true });

  return { data, error };
};

// Submission management functions
export const createSubmission = async (submissionData: {
  assignment_id: string;
  student_id: string;
  file_url: string;
  file_name: string;
  ocr_text?: string;
}) => {
  // First, get the class_id from the assignment
  const { data: assignment } = await supabase
    .from('assignments')
    .select('class_id')
    .eq('id', submissionData.assignment_id)
    .single();

  // Ensure student is a member of the class
  if (assignment?.class_id) {
    await ensureStudentInClass(submissionData.student_id, assignment.class_id);
  }

  // Create the submission
  const { data, error } = await supabase
    .from('submissions')
    .insert(submissionData)
    .select()
    .single();

  return { data, error };
};

export const updateSubmission = async (submissionId: string, updates: {
  ocr_text?: string;
  grade?: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: string;
}) => {
  const { data, error } = await supabase
    .from('submissions')
    .update(updates)
    .eq('id', submissionId)
    .select()
    .single();

  return { data, error };
};

export const getSubmission = async (assignmentId: string, studentId: string) => {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      assignments (
        id,
        title,
        content,
        max_marks,
        due_date
      ),
      users!submissions_student_id_fkey (
        id,
        name,
        email
      )
    `)
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .single();

  return { data, error };
};

export const getAssignmentSubmissions = async (assignmentId: string) => {
  console.log('getAssignmentSubmissions called with assignmentId:', assignmentId);

  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      users!submissions_student_id_fkey (
        id,
        name,
        email
      )
    `)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });

  console.log('getAssignmentSubmissions result:', { data, error });

  // Always try to fix missing user data
  if (data && data.length > 0) {
    const submissionsWithUsers = await Promise.all(
      data.map(async (submission) => {
        if (!submission.users || !submission.users.name || !submission.users.id) {
          console.log('Missing or incomplete user data for submission:', submission.id, 'student_id:', submission.student_id);

          // Manually fetch user data
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', submission.student_id)
            .single();

          if (userData && !userError) {
            console.log('Manually fetched user data:', userData);
            return {
              ...submission,
              users: userData
            };
          } else {
            console.error('Failed to fetch user data for student_id:', submission.student_id, userError);
            // Return submission with placeholder user data
            return {
              ...submission,
              users: {
                id: submission.student_id,
                name: 'Unknown Student',
                email: 'unknown@example.com'
              }
            };
          }
        }
        return submission;
      })
    );

    return { data: submissionsWithUsers, error };
  }

  return { data, error };
};

export const getUserSubmissions = async (userId: string) => {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      assignments (
        id,
        title,
        max_marks,
        due_date,
        classes (
          id,
          name,
          subject
        )
      )
    `)
    .eq('student_id', userId)
    .order('submitted_at', { ascending: false });

  return { data, error };
};

export const getSubmissionById = async (submissionId: string) => {
  console.log('getSubmissionById called with submissionId:', submissionId);

  // First get submission data without user join to avoid RLS issues
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      assignments (
        id,
        title,
        content,
        max_marks,
        due_date,
        classes (
          id,
          name,
          subject
        )
      )
    `)
    .eq('id', submissionId)
    .single();

  console.log('getSubmissionById result:', { data, error });

  if (error || !data) {
    return { data, error };
  }

  // Try to fetch user data, but use fallback if it fails
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', data.student_id)
      .single();

    if (userData && !userError) {
      return {
        data: {
          ...data,
          users: userData
        },
        error
      };
    }
  } catch (fetchError) {
    console.log('Could not fetch user data, using fallback');
  }

  // Fallback: create placeholder user data
  return {
    data: {
      ...data,
      users: {
        id: data.student_id,
        name: `Student ${data.student_id.slice(-8)}`,
        email: 'Email not available'
      }
    },
    error
  };

  return { data, error };
};

// Ticket management functions
export const createTicket = async (ticketData: {
  submission_id: string;
  student_id: string;
  title: string;
  reason: string;
  class_name: string;
}) => {
  const { data, error } = await supabase
    .from('tickets')
    .insert(ticketData)
    .select()
    .single();

  return { data, error };
};

export const updateTicket = async (ticketId: string, updates: {
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  teacher_response?: string;
  responded_by?: string;
  responded_at?: string;
}) => {
  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select()
    .single();

  return { data, error };
};

export const getTicketsBySubmission = async (submissionId: string) => {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      student:users!student_id (
        id,
        name,
        email
      ),
      responder:users!responded_by (
        id,
        name,
        email
      ),
      submissions (
        id,
        assignments (
          id,
          title,
          classes (
            id,
            name
          )
        )
      )
    `)
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false });

  return { data, error };
};

export const getUserTickets = async (userId: string) => {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      submissions (
        id,
        assignments (
          id,
          title,
          max_marks,
          classes (
            id,
            name,
            subject
          )
        )
      ),
      responder:users!responded_by (
        id,
        name,
        email
      )
    `)
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  return { data, error };
};

export const getClassTickets = async (classId: string) => {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      student:users!tickets_student_id_fkey (
        id,
        name,
        email
      ),
      responder:users!tickets_responded_by_fkey (
        id,
        name,
        email
      ),
      submissions (
        id,
        grade,
        assignments!inner (
          id,
          title,
          max_marks,
          class_id
        )
      )
    `)
    .eq('submissions.assignments.class_id', classId)
    .order('created_at', { ascending: false });

  return { data, error };
};

// Get all grades for a class
export const getClassGrades = async (classId: string) => {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      id,
      grade,
      submitted_at,
      graded_at,
      assignments!inner (
        id,
        title,
        max_marks,
        class_id
      ),
      users!submissions_student_id_fkey (
        id,
        name,
        email
      )
    `)
    .eq('assignments.class_id', classId)
    .order('submitted_at', { ascending: false });

  return { data, error };
};

// Get comprehensive grades for all students in a class
export const getClassGradesComprehensive = async (classId: string) => {
  const { data, error } = await supabase
    .rpc('get_class_grades_comprehensive', {
      class_id_param: classId
    });

  if (error) {
    console.error('Error fetching comprehensive grades:', error);
    return { data: null, error };
  }

  // Transform data to match GradesSpreadsheet expected format
  const transformedData = data?.map((row: any) => ({
    id: row.submission_id || `${row.student_id}-${row.assignment_id}`,
    studentName: row.student_name,
    studentId: row.student_id,
    assignment: row.assignment_title,
    assignmentId: row.assignment_id,
    marks: row.grade,
    maxMarks: row.assignment_max_marks,
    submitted: !!row.submission_id,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    feedback: row.feedback
  })) || [];

  return { data: transformedData, error: null };
};

// Get student-specific grades for a class
export const getStudentGrades = async (classId: string, studentId: string) => {
  try {
    // Get all assignments for the class
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('*')
      .eq('class_id', classId)
      .order('due_date', { ascending: true });

    if (assignmentsError) {
      return { data: null, error: assignmentsError };
    }

    // Get student's submissions for these assignments
    const assignmentIds = assignments?.map(a => a.id) || [];
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('id, assignment_id, grade, submitted_at, graded_at, feedback')
      .eq('student_id', studentId)
      .in('assignment_id', assignmentIds);

    if (submissionsError) {
      return { data: null, error: submissionsError };
    }

    // Create student grade data
    const studentGrades = assignments?.map(assignment => {
      const submission = submissions?.find(s => s.assignment_id === assignment.id);

      return {
        id: submission?.id || `${studentId}-${assignment.id}`,
        assignmentTitle: assignment.title,
        assignmentId: assignment.id,
        maxMarks: assignment.max_marks,
        marks: submission?.grade !== undefined && submission?.grade !== null ? Number(submission.grade) : null,
        submitted: !!submission,
        submittedAt: submission?.submitted_at,
        gradedAt: submission?.graded_at,
        dueDate: assignment.due_date,
        feedback: submission?.feedback
      };
    }) || [];

    return { data: studentGrades, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// New function to get all tickets for a teacher across all their classes
export const getTeacherTickets = async (teacherId: string) => {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      student:users!student_id (
        id,
        name,
        email
      ),
      responder:users!responded_by (
        id,
        name,
        email
      ),
      submissions (
        id,
        grade,
        assignments!inner (
          id,
          title,
          max_marks,
          class_id,
          classes!inner (
            id,
            name,
            teacher_id
          )
        )
      )
    `)
    .eq('submissions.assignments.classes.teacher_id', teacherId)
    .order('created_at', { ascending: false });

  return { data, error };
};

// Notification management functions
export const createNotification = async (notificationData: {
  user_id: string;
  title: string;
  message: string;
  type: 'grade' | 'assignment' | 'class' | 'ticket' | 'general' | 'material' | 'video_room';
  related_id?: string;
}) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notificationData)
    .select()
    .single();

  return { data, error };
};

export const getUserNotifications = async (userId: string, limit: number = 50) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
};

export const markNotificationAsRead = async (notificationId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .select()
    .single();

  return { data, error };
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return { data, error };
};

export const getUnreadNotificationCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return { count, error };
};

export const deleteNotification = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  return { error };
};

export const getClassMembers = async (classId: string) => {
  console.log('🔍 getClassMembers called with classId:', classId);

  // Simple approach: Get class members with join and handle missing data
  const { data: membersData, error: membersError } = await supabase
    .from('class_members')
    .select(`
      id,
      role,
      joined_at,
      user_id,
      users (
        id,
        name,
        email
      )
    `)
    .eq('class_id', classId)
    .order('role', { ascending: false }); // Teachers first

  console.log('🔍 Raw members data:', membersData);
  console.log('🔍 Members error:', membersError);

  if (membersError) {
    console.error('Error fetching class members:', membersError);
    return { data: null, error: membersError };
  }

  if (!membersData || membersData.length === 0) {
    console.log('No class members found');
    return { data: [], error: null };
  }

  // Process the data and handle missing user information
  const processedMembers = membersData.map((member, index) => {
    console.log(`🔍 Processing member ${index}:`, {
      id: member.id,
      role: member.role,
      user_id: member.user_id,
      users: member.users
    });

    // If users data is missing, we need to handle it
    if (!member.users) {
      console.log(`⚠️ Missing user data for member ${member.user_id}`);
      return {
        ...member,
        users: {
          id: member.user_id,
          name: `Student ${member.user_id.slice(-8)}`,
          email: 'Email not available'
        }
      };
    }

    return member;
  });

  console.log('🔍 Final processed members:', processedMembers);
  return { data: processedMembers, error: null };
};

// Get all students including those from submissions who might not be class members
export const getClassMembersWithSubmissions = async (classId: string) => {
  console.log('getClassMembersWithSubmissions called with classId:', classId);

  // Get regular class members (already improved with user data fixing)
  const { data: classMembers, error: membersError } = await getClassMembers(classId);

  console.log('getClassMembersWithSubmissions - classMembers:', classMembers);
  console.log('getClassMembersWithSubmissions - membersError:', membersError);

  if (membersError) {
    return { data: null, error: membersError };
  }

  // Get students from submissions who might not be class members
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id')
    .eq('class_id', classId);

  if (!assignments || assignments.length === 0) {
    return { data: classMembers, error: null };
  }

  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      student_id,
      users!submissions_student_id_fkey (
        id,
        name,
        email
      )
    `)
    .in('assignment_id', assignments.map(a => a.id));

  if (!submissions || submissions.length === 0) {
    return { data: classMembers, error: null };
  }

  // Merge class members with students from submissions
  const allMembers = [...(classMembers || [])];

  // Add students from submissions who are not already in class_members
  const classMemberIds = new Set((classMembers || []).map((m: any) => m.users?.id).filter(Boolean));
  const uniqueSubmissionStudents = [];

  if (submissions && submissions.length > 0) {
    const processedStudentIds = new Set();

    for (const submission of submissions) {
      if (processedStudentIds.has(submission.student_id) || classMemberIds.has(submission.users?.id)) {
        continue; // Skip if already processed or already a class member
      }

      let userData = submission.users;

      // If user data is missing, try to fetch it
      if (!userData || !userData.name) {
        console.log('Fetching missing user data for submission student:', submission.student_id);
        try {
          const { data: fetchedUserData, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', submission.student_id)
            .single();

          if (fetchedUserData && !userError) {
            userData = fetchedUserData;
          } else {
            console.error('Could not fetch user data for submission student:', submission.student_id, userError);
            continue; // Skip this student if we can't get their data
          }
        } catch (error) {
          console.error('Error fetching user data for submission student:', error);
          continue; // Skip this student if we can't get their data
        }
      }

      uniqueSubmissionStudents.push({
        id: `submission-${submission.student_id}`,
        role: 'student',
        joined_at: null, // They haven't officially joined
        users: userData
      });

      processedStudentIds.add(submission.student_id);
    }
  }

  allMembers.push(...uniqueSubmissionStudents);
  console.log('getClassMembersWithSubmissions - final allMembers:', allMembers);

  return { data: allMembers, error: null };
};

// Automatically add student to class when they submit an assignment (if not already a member)
export const ensureStudentInClass = async (studentId: string, classId: string) => {
  try {
    // Check if student is already a member
    const { data: existingMember } = await supabase
      .from('class_members')
      .select('id')
      .eq('class_id', classId)
      .eq('user_id', studentId)
      .single();

    if (existingMember) {
      // Student is already a member, no action needed
      return { success: true, added: false };
    }

    // Add student to class
    const { error } = await supabase
      .from('class_members')
      .insert({
        class_id: classId,
        user_id: studentId,
        role: 'student'
      });

    if (error) {
      console.error('Error adding student to class:', error);
      return { success: false, error };
    }

    console.log(`Automatically added student ${studentId} to class ${classId}`);
    return { success: true, added: true };
  } catch (error) {
    console.error('Error in ensureStudentInClass:', error);
    return { success: false, error };
  }
};

export const getClassMemberCount = async (classId: string) => {
  try {
    // Count students in class_members table
    const { count: studentCount, error: studentError } = await supabase
      .from('class_members')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId);

    if (studentError) {
      return { count: 0, error: studentError };
    }

    // Check if class exists (which means there's a teacher)
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .single();

    if (classError) {
      return { count: studentCount || 0, error: null }; // Return student count even if class check fails
    }

    // Total count = students + teacher (1)
    const totalCount = (studentCount || 0) + (classData ? 1 : 0);

    return { count: totalCount, error: null };
  } catch (error) {
    return { count: 0, error };
  }
};

// Get total student count for a user (counts students in classes where user is teacher or member)
export const getTotalStudentCount = async (userId: string) => {
  try {
    // Get classes where user is teacher
    const { data: teacherClasses, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', userId);

    // Get classes where user is a member
    const { data: memberClasses, error: memberError } = await supabase
      .from('class_members')
      .select('class_id')
      .eq('user_id', userId);

    if (classError && memberError) {
      return { count: 0, error: classError || memberError };
    }

    // Combine all class IDs
    const teacherClassIds = teacherClasses?.map(cls => cls.id) || [];
    const memberClassIds = memberClasses?.map(member => member.class_id) || [];
    const allClassIds = [...new Set([...teacherClassIds, ...memberClassIds])];

    if (allClassIds.length === 0) {
      return { count: 0, error: null };
    }

    // Count unique students across all their classes (excluding the user themselves)
    const { data, error } = await supabase
      .from('class_members')
      .select('user_id')
      .in('class_id', allClassIds)
      .neq('user_id', userId);

    if (error) {
      return { count: 0, error };
    }

    // Count unique students
    const uniqueStudents = new Set(data?.map(member => member.user_id) || []);
    return { count: uniqueStudents.size, error: null };
  } catch (error) {
    return { count: 0, error };
  }
};

// Class-based permission checking functions
export const isUserTeacherOfClass = async (userId: string, classId: string) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('teacher_id')
      .eq('id', classId)
      .eq('teacher_id', userId)
      .single();

    return { isTeacher: !error && !!data, error };
  } catch (error) {
    return { isTeacher: false, error };
  }
};

export const isUserStudentInClass = async (userId: string, classId: string) => {
  try {
    const { data, error } = await supabase
      .from('class_members')
      .select('id')
      .eq('class_id', classId)
      .eq('user_id', userId)
      .single();

    return { isStudent: !error && !!data, error };
  } catch (error) {
    return { isStudent: false, error };
  }
};

export const getUserClassRole = async (userId: string, classId: string) => {
  try {
    // Check if user is teacher of the class
    const { isTeacher } = await isUserTeacherOfClass(userId, classId);
    if (isTeacher) {
      return { role: 'teacher', error: null };
    }

    // Check if user is student in the class
    const { isStudent } = await isUserStudentInClass(userId, classId);
    if (isStudent) {
      return { role: 'student', error: null };
    }

    return { role: null, error: null };
  } catch (error) {
    return { role: null, error };
  }
};

export const getUserCreatedClasses = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', userId)
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getUserJoinedClasses = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('class_members')
      .select(`
        class_id,
        joined_at,
        classes (
          id,
          name,
          subject,
          description,
          class_code,
          color_scheme,
          teacher_id,
          created_at,
          users!classes_teacher_id_fkey (
            id,
            name,
            email
          )
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

// Temporary function to fix RLS policies
export const fixRLSForTeachers = async () => {
  console.log('🔧 Attempting to fix RLS policies for teacher access...');

  try {
    // Try to execute SQL to fix RLS policies
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop existing restrictive policy
        DROP POLICY IF EXISTS "class_members_can_see_each_other" ON public.users;

        -- Create more permissive policy
        CREATE POLICY "users_class_visibility" ON public.users
        FOR SELECT USING (
          -- Users can see their own data
          auth.uid() = id
          OR
          -- Users can see other users in the same classes
          EXISTS (
            SELECT 1 FROM public.class_members cm1
            INNER JOIN public.class_members cm2 ON cm1.class_id = cm2.class_id
            WHERE cm1.user_id = auth.uid()
            AND cm2.user_id = users.id
          )
          OR
          -- Teachers can see all students in their classes
          EXISTS (
            SELECT 1 FROM public.classes c
            INNER JOIN public.class_members cm ON c.id = cm.class_id
            WHERE c.teacher_id = auth.uid()
            AND cm.user_id = users.id
          )
          OR
          -- Anyone can see teachers of classes they're in
          EXISTS (
            SELECT 1 FROM public.classes c
            INNER JOIN public.class_members cm ON c.id = cm.class_id
            WHERE cm.user_id = auth.uid()
            AND c.teacher_id = users.id
          )
        );
      `
    });

    if (error) {
      console.error('❌ RLS fix failed:', error);
      return { success: false, error };
    }

    console.log('✅ RLS policies updated successfully');
    return { success: true, data };

  } catch (error) {
    console.error('❌ Error executing RLS fix:', error);
    return { success: false, error };
  }
};

// =====================================================
// CLASS MATERIALS MANAGEMENT FUNCTIONS
// =====================================================

// Create a new class material
export const createClassMaterial = async (materialData: {
  class_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path?: string;
}) => {
  try {
    const { data, error } = await supabase
      .from('class_materials')
      .insert(materialData)
      .select()
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error creating class material:', error);
    return { data: null, error };
  }
};

// Create multiple class materials at once (for bulk upload)
export const createClassMaterials = async (materialsData: Array<{
  class_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path?: string;
}>) => {
  try {
    const { data, error } = await supabase
      .from('class_materials')
      .insert(materialsData)
      .select();

    return { data, error };
  } catch (error: any) {
    console.error('Error creating class materials:', error);
    return { data: null, error };
  }
};

// Get all materials for a class
export const getClassMaterials = async (classId: string) => {
  try {
    const { data, error } = await supabase
      .from('class_materials')
      .select(`
        *,
        users!class_materials_teacher_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error: any) {
    console.error('Error fetching class materials:', error);
    return { data: null, error };
  }
};

// Get a specific material by ID
export const getClassMaterial = async (materialId: string) => {
  try {
    const { data, error } = await supabase
      .from('class_materials')
      .select(`
        *,
        users!class_materials_teacher_id_fkey (
          id,
          name,
          email
        ),
        classes (
          id,
          name,
          subject
        )
      `)
      .eq('id', materialId)
      .eq('is_active', true)
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error fetching class material:', error);
    return { data: null, error };
  }
};

// Update a class material
export const updateClassMaterial = async (materialId: string, updates: {
  title?: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  cloudinary_public_id?: string;
}) => {
  try {
    const { data, error } = await supabase
      .from('class_materials')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', materialId)
      .select()
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error updating class material:', error);
    return { data: null, error };
  }
};

// Delete a class material (soft delete)
export const deleteClassMaterial = async (materialId: string) => {
  try {
    const { data, error } = await supabase
      .from('class_materials')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', materialId)
      .select()
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error deleting class material:', error);
    return { data: null, error };
  }
};

// Hard delete a class material (permanently remove)
export const permanentlyDeleteClassMaterial = async (materialId: string) => {
  try {
    const { data, error } = await supabase
      .from('class_materials')
      .delete()
      .eq('id', materialId)
      .select()
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error permanently deleting class material:', error);
    return { data: null, error };
  }
};

// Get materials count for a class
export const getClassMaterialsCount = async (classId: string) => {
  try {
    const { count, error } = await supabase
      .from('class_materials')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('is_active', true);

    return { count, error };
  } catch (error: any) {
    console.error('Error fetching class materials count:', error);
    return { count: 0, error };
  }
};

// Video Room Management Functions

// Create a new video room
export const createVideoRoom = async (roomData: {
  class_id: string;
  teacher_id: string;
  title?: string;
  max_participants?: number;
}) => {
  try {
    // Generate unique room ID
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const { data, error } = await supabase
      .from('video_rooms')
      .insert({
        room_id: roomId,
        class_id: roomData.class_id,
        teacher_id: roomData.teacher_id,
        title: roomData.title || 'Class Session',
        max_participants: roomData.max_participants || 50,
        is_active: true
      })
      .select()
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error creating video room:', error);
    return { data: null, error };
  }
};

// Get active video room for a class
export const getActiveVideoRoom = async (classId: string) => {
  try {
    const { data, error } = await supabase
      .from('video_rooms')
      .select(`
        *,
        users!video_rooms_teacher_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error fetching active video room:', error);
    return { data: null, error };
  }
};

// End a video room
export const endVideoRoom = async (roomId: string) => {
  try {
    const { data, error } = await supabase
      .from('video_rooms')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .select()
      .single();

    // Also mark all participants as inactive
    await supabase
      .from('room_participants')
      .update({
        is_active: false,
        left_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('is_active', true);

    return { data, error };
  } catch (error: any) {
    console.error('Error ending video room:', error);
    return { data: null, error };
  }
};

// Join a video room
export const joinVideoRoom = async (roomId: string, userId: string, role: 'host' | 'participant' = 'participant') => {
  try {
    const { data, error } = await supabase
      .from('room_participants')
      .upsert({
        room_id: roomId,
        user_id: userId,
        role: role,
        is_active: true,
        joined_at: new Date().toISOString()
      }, {
        onConflict: 'room_id,user_id'
      })
      .select()
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error joining video room:', error);
    return { data: null, error };
  }
};

// Leave a video room
export const leaveVideoRoom = async (roomId: string, userId: string) => {
  try {
    const { data, error } = await supabase
      .from('room_participants')
      .update({
        is_active: false,
        left_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .select()
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error leaving video room:', error);
    return { data: null, error };
  }
};

// Get room participants
export const getRoomParticipants = async (roomId: string) => {
  try {
    const { data, error } = await supabase
      .from('room_participants')
      .select(`
        *,
        users (
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    return { data, error };
  } catch (error: any) {
    console.error('Error fetching room participants:', error);
    return { data: null, error };
  }
};

// Get video room by room_id
export const getVideoRoom = async (roomId: string) => {
  try {
    const { data, error } = await supabase
      .from('video_rooms')
      .select(`
        *,
        users!video_rooms_teacher_id_fkey (
          id,
          name,
          email
        ),
        classes (
          id,
          name,
          subject
        )
      `)
      .eq('room_id', roomId)
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error fetching video room:', error);
    return { data: null, error };
  }
};

// =====================================================
// INTELLIMEET INTEGRATION FUNCTIONS
// =====================================================

export interface Meeting {
  id: string;
  code: string;
  title: string;
  host_id: string;
  class_id?: string;
  source: 'standalone' | 'class';
  status: 'scheduled' | 'active' | 'ended';
  scheduled_time?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

// Create a meeting for a class
export const createClassMeeting = async (meetingData: {
  title: string;
  host_id: string;
  class_id: string;
}) => {
  try {
    // Generate unique meeting code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let meetingCode = '';
    for (let i = 0; i < 8; i++) {
      meetingCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const { data, error } = await supabase
      .from('meetings')
      .insert({
        code: meetingCode,
        title: meetingData.title,
        host_id: meetingData.host_id,
        class_id: meetingData.class_id,
        source: 'class',
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating meeting:', error);
      return { data: null, error };
    }

    // Add host as participant
    await supabase.from('meeting_participants').insert({
      meeting_id: data.id,
      user_id: meetingData.host_id,
      is_host: true,
    });

    return { data, error: null };
  } catch (error: any) {
    console.error('Error creating class meeting:', error);
    return { data: null, error };
  }
};

// Get active meeting for a class
export const getActiveClassMeeting = async (classId: string) => {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .select(`
        *,
        users!meetings_host_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data, error };
  } catch (error: any) {
    console.error('Error fetching active class meeting:', error);
    return { data: null, error };
  }
};

// End a meeting
export const endMeeting = async (meetingId: string) => {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', meetingId)
      .select()
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error ending meeting:', error);
    return { data: null, error };
  }
};

// Join a meeting as participant
export const joinMeeting = async (meetingCode: string, userId: string) => {
  try {
    // Find the meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('code', meetingCode)
      .eq('status', 'active')
      .single();

    if (meetingError || !meeting) {
      return { data: null, error: meetingError || new Error('Meeting not found') };
    }

    // Check if already a participant
    const { data: existingParticipant } = await supabase
      .from('meeting_participants')
      .select('id')
      .eq('meeting_id', meeting.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingParticipant) {
      // Add as participant
      await supabase.from('meeting_participants').insert({
        meeting_id: meeting.id,
        user_id: userId,
        is_host: false,
      });
    }

    return { data: meeting, error: null };
  } catch (error: any) {
    console.error('Error joining meeting:', error);
    return { data: null, error };
  }
};

// Get meeting by code
export const getMeetingByCode = async (code: string) => {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .select(`
        *,
        users!meetings_host_id_fkey (
          id,
          name,
          email
        ),
        classes (
          id,
          name,
          subject
        )
      `)
      .eq('code', code)
      .single();

    return { data, error };
  } catch (error: any) {
    console.error('Error fetching meeting:', error);
    return { data: null, error };
  }
};

// Notify class members about a meeting
export const notifyClassAboutMeeting = async (classId: string, meetingCode: string, meetingTitle: string, hostName: string) => {
  try {
    // Get all class members except the host
    const { data: members, error: membersError } = await supabase
      .from('class_members')
      .select('user_id')
      .eq('class_id', classId);

    if (membersError || !members) {
      return { error: membersError };
    }

    // Create notifications for all members
    const notifications = members.map(member => ({
      user_id: member.user_id,
      title: '📹 Live Class Meeting',
      message: `${hostName} has started a meeting: "${meetingTitle}". Join now!`,
      type: 'meeting' as const,
      related_id: meetingCode,
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    return { error };
  } catch (error: any) {
    console.error('Error notifying class about meeting:', error);
    return { error };
  }
};
