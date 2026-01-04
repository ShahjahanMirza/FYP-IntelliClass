import React, { useEffect, useState, Suspense } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PlusIcon, FileTextIcon, CalendarIcon, UsersIcon, UserPlusIcon, Copy, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getClassAssignments, getClassDetails, getClassGradesComprehensive, getStudentGrades, getClassMembersWithSubmissions, supabase, fixRLSForTeachers, createNotification, getActiveClassMeeting } from '../utils/supabase';
import { toast } from 'react-toastify';
import { toast as hotToast } from 'react-hot-toast';
import StudentGrades from '../components/grades/StudentGrades';
import ClassMaterials from '../components/ClassMaterials';
import BackButton from '../components/BackButton';
import ClassMeeting from '../components/meeting/ClassMeeting';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';
import ScrollToTopButton from '../components/ScrollToTopButton';

const GradesSpreadsheet = React.lazy(() => import('../components/grades/GradesSpreadsheet'));
interface ClassInfo {
  name: string;
  color: string;
  students: number;
  class_code: string;
  description?: string;
}
const ClassDetail = React.memo(() => {
  const {
    classId
  } = useParams();
  const {
    user,
    isTeacherForClass
  } = useAuth();

  const [activeTab, setActiveTab] = useState('assignments');
  const [assignments, setAssignments] = useState([]);
  const [grades, setGrades] = useState([]);
  const [studentGrades, setStudentGrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [classMembers, setClassMembers] = useState<any[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);

  const copyClassCode = async () => {
    if (classInfo?.class_code) {
      try {
        await navigator.clipboard.writeText(classInfo.class_code);
        hotToast.success('Class code copied to clipboard!');
      } catch (err) {
        hotToast.error('Failed to copy class code');
      }
    }
  };

  useEffect(() => {
    const fetchClassData = async () => {
      setIsLoading(true);

      // Check if user is teacher for this class
      let teacherStatus = false;
      if (user && classId) {
        teacherStatus = await isTeacherForClass(classId);
        setIsTeacher(teacherStatus);
        console.log('ClassDetail.tsx - Teacher status determined:', teacherStatus);
      }
      try {
        if (!classId) return;

        // Try to fix RLS policies first
        await fixRLSForTeachers();

        // Fetch class details
        const { data: classData, error: classError } = await getClassDetails(classId);
        if (classError) {
          throw classError;
        }

        if (classData) {
          setClassInfo({
            name: classData.name,
            color: classData.color_scheme || '#3B82F6',
            students: classData.class_members?.length || 0,
            class_code: classData.class_code,
            description: classData.description
          });

          // Get comprehensive class members including those from submissions
          const { data: comprehensiveMembers, error: membersError } = await getClassMembersWithSubmissions(classId);

          if (membersError) {
            console.error('Error fetching comprehensive members:', membersError);
          }

          let allMembers = comprehensiveMembers || [];

          console.log('Class data:', classData);
          console.log('Comprehensive members from DB:', allMembers);
          console.log('Teacher ID:', classData.teacher_id);
          console.log('Teacher info:', classData.users);

          // Check if teacher is already in the members list
          const teacherInMembers = allMembers.some(member =>
            member.users?.id === classData.teacher_id
          );

          console.log('Teacher in members:', teacherInMembers);

          // If teacher is not in members list, add them
          if (!teacherInMembers && classData.teacher_id) {

            // Try to get teacher data from the class data first
            let teacherData = classData.users;

            // If teacher data is not available from class data, try to fetch it separately
            if (!teacherData) {
              try {
                const { data: teacherUserData, error: teacherError } = await supabase
                  .from('users')
                  .select('id, name, email')
                  .eq('id', classData.teacher_id)
                  .single();

                if (teacherUserData && !teacherError) {
                  teacherData = teacherUserData;
                } else {
                  // Create placeholder teacher data
                  teacherData = {
                    id: classData.teacher_id,
                    name: `Teacher ${classData.teacher_id.slice(-8)}`,
                    email: 'Email not available'
                  };
                }
              } catch (error) {
                teacherData = {
                  id: classData.teacher_id,
                  name: `Teacher ${classData.teacher_id.slice(-8)}`,
                  email: 'Email not available'
                };
              }
            }

            const teacherMember = {
              id: `teacher-${classData.teacher_id}`,
              role: 'teacher',
              joined_at: classData.created_at,
              users: teacherData
            };

            allMembers = [teacherMember, ...allMembers];
          }

          console.log('Final members list:', allMembers);
          setClassMembers(allMembers);
        }

        // Fetch assignments for this class
        const { data: assignmentData, error: assignmentError } = await getClassAssignments(classId);
        if (assignmentError) {
          console.error('Error fetching assignments:', assignmentError);
        } else {
          setAssignments(assignmentData || []);
        }



        // Fetch grades based on user role (use teacherStatus directly, not state)
        console.log('ClassDetail.tsx - User:', user);
        console.log('ClassDetail.tsx - teacherStatus:', teacherStatus);
        console.log('ClassDetail.tsx - isTeacher state:', isTeacher);
        console.log('ClassDetail.tsx - Class teacher_id:', classData?.teacher_id);

        if (teacherStatus) {
          console.log('ClassDetail.tsx - Fetching teacher grades...');
          // Fetch comprehensive grades for teachers (all students, all assignments)
          const { data: gradesData, error: gradesError } = await getClassGradesComprehensive(classId);
          console.log('ClassDetail.tsx - Teacher grades data:', gradesData);
          console.log('ClassDetail.tsx - Teacher grades error:', gradesError);

          if (gradesError) {
            console.error('Error fetching grades:', gradesError);
          } else {
            setGrades(gradesData || []);
          }
        } else if (user) {
          console.log('ClassDetail.tsx - Fetching student grades...');
          // Fetch student-specific grades
          const { data: studentGradesData, error: studentGradesError } = await getStudentGrades(classId, user.id);
          console.log('ClassDetail.tsx - Student grades data:', studentGradesData);
          console.log('ClassDetail.tsx - Student grades error:', studentGradesError);

          if (studentGradesError) {
            console.error('Error fetching student grades:', studentGradesError);
          } else {
            setStudentGrades(studentGradesData || []);
          }
        }

      } catch (error) {
        console.error('Error fetching class data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (classId) {
      fetchClassData();
    }
  }, [classId, user, isTeacherForClass]);

  if (isLoading || !classInfo) {
    return <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <BackButton to="/dashboard/classes" />
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>;
  }

  return <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <BackButton to="/dashboard/classes" />
      </div>
      <div className="bg-blue-600 text-white p-8 rounded-lg mb-6" style={{ backgroundColor: classInfo.color }}>
        <h1 className="text-3xl font-bold mb-2">{classInfo.name}</h1>
        {classInfo.description && (
          <p className="text-white/90 mb-4">{classInfo.description}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <UsersIcon className="h-5 w-5 mr-2" />
            <span>{classInfo.students} students</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Class Code */}
            {isTeacher && (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center space-x-2">
                <div>
                  <div className="text-sm text-white/80">Class Code</div>
                  <div className="text-lg font-mono font-bold">{classInfo.class_code}</div>
                </div>
                <button
                  onClick={copyClassCode}
                  className="p-2 hover:bg-white/20 rounded-md transition-colors"
                  title="Copy class code"
                >
                  <Copy className="h-4 w-4 text-white/80" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg mb-6">
        <div className="flex border-b border-gray-200">
          <button className={`px-6 py-4 font-medium ${activeTab === 'assignments' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'}`} onClick={() => setActiveTab('assignments')}>
            Assignments
          </button>
          <button className={`px-6 py-4 font-medium ${activeTab === 'materials' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'}`} onClick={() => setActiveTab('materials')}>
            Materials
          </button>
          <button className={`px-6 py-4 font-medium flex items-center space-x-2 ${activeTab === 'meeting' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'}`} onClick={() => setActiveTab('meeting')}>
            <Video className="h-4 w-4" />
            <span>Meeting</span>
          </button>
          <button className={`px-6 py-4 font-medium ${activeTab === 'grades' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'}`} onClick={() => setActiveTab('grades')}>
            Grades
          </button>
          <button className={`px-6 py-4 font-medium ${activeTab === 'people' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-blue-600'}`} onClick={() => setActiveTab('people')}>
            People
          </button>
        </div>
        <div className="p-6">
          {activeTab === 'assignments' && <div>
              {isTeacher && <div className="mb-6">
                  <Link to={`/dashboard/classes/${classId}/create-assignment`} className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700 w-fit">
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Create Assignment
                  </Link>
                </div>}
              {assignments.length > 0 ? <div className="space-y-4">
                  {assignments.map((assignment: any) => <Link key={assignment.id} to={`/dashboard/classes/${classId}/assignments/${assignment.id}`} className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <FileTextIcon className="h-6 w-6 text-blue-600 mr-3 mt-1" />
                          <div>
                            <h3 className="font-medium">{assignment.title}</h3>
                            <p className="text-sm text-gray-500">
                              Max marks: {assignment.max_marks}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center text-gray-500">
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            <span className="text-sm">
                              Due{' '}
                              {new Date(assignment.due_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>)}
                </div> : <div className="text-center py-8 text-gray-500">
                  <FileTextIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <h3 className="text-lg font-medium mb-1">
                    No assignments yet
                  </h3>
                  <p>
                    {isTeacher ? 'Create your first assignment to get started' : "Your teacher hasn't created any assignments yet"}
                  </p>
                </div>}
            </div>}
          {activeTab === 'materials' && (
            <ClassMaterials classId={classId!} />
          )}
          {activeTab === 'meeting' && classInfo && (
            <ClassMeeting 
              classId={classId!} 
              className={classInfo.name}
              isTeacher={isTeacher}
            />
          )}
          {activeTab === 'grades' && (
            isTeacher ? (
              <ErrorBoundary>
                <Suspense fallback={<div className="flex items-center justify-center p-8"><LoadingSpinner size="medium" /></div>}>
                  <GradesSpreadsheet grades={grades} onUpdateGrade={(id, marks) => {
                    setGrades(grades.map((g: any) => g.id === id ? {
                      ...g,
                      marks
                    } : g));
                  }} />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <StudentGrades grades={studentGrades} studentName={user?.name} />
            )
          )}
          {activeTab === 'people' && <div>
              {isTeacher && (
                <div className="mb-6 flex items-center justify-between">

                  {classInfo && (
                    <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center space-x-2">
                      <div>
                        <span className="text-sm text-gray-600">Class Code: </span>
                        <span className="font-mono font-bold text-lg">{classInfo.class_code}</span>
                      </div>
                      <button
                        onClick={copyClassCode}
                        className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                        title="Copy class code"
                      >
                        <Copy className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
                {/* Teachers Section */}
                <div className="p-4 bg-gray-50">
                  <h3 className="font-medium">Teachers</h3>
                </div>
                <div className="p-4">
                  {classMembers.filter(member => member.role === 'teacher').length > 0 ? (
                    <div className="space-y-3">
                      {classMembers.filter(member => member.role === 'teacher').map((teacher) => (
                        <div key={teacher.id} className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-medium">
                              {teacher.users?.name?.charAt(0).toUpperCase() || 'T'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{teacher.users?.name || 'Unknown Teacher'}</p>
                            <p className="text-sm text-gray-500">{teacher.users?.email || 'No email'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No teachers found</p>
                  )}
                </div>

                {/* Students Section */}
                <div className="p-4 bg-gray-50">
                  <h3 className="font-medium">Students</h3>
                </div>
                <div className="p-4">
                  {classMembers.filter(member => member.role === 'student').length > 0 ? (
                    <div className="space-y-3">
                      {classMembers.filter(member => member.role === 'student').map((student) => (
                        <div key={student.id} className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                            <span className="text-gray-600 font-medium">
                              {student.users?.name?.charAt(0).toUpperCase() || 'S'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{student.users?.name || 'Unknown Student'}</p>
                            <p className="text-sm text-gray-500">{student.users?.email || 'No email'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No students have joined this class yet</p>
                  )}
                </div>
              </div>
            </div>}
        </div>
      </div>
      
      {/* Scroll to Top Button */}
      <ScrollToTopButton />
    </div>;
});
export default ClassDetail;