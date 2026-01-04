import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createClassMeeting, getActiveClassMeeting, endMeeting, notifyClassAboutMeeting } from '../../utils/supabase';
import { toast } from 'react-hot-toast';
import { Video, VideoOff, Users, ExternalLink, Loader2 } from 'lucide-react';

interface ClassMeetingProps {
  classId: string;
  className: string;
  isTeacher: boolean;
  onClose?: () => void;
}

// Get IntelliMeet URL from environment or use default
const INTELLIMEET_URL = import.meta.env.VITE_INTELLIMEET_URL || 'http://localhost:8080';

const ClassMeeting: React.FC<ClassMeetingProps> = ({ classId, className, isTeacher, onClose }) => {
  const { user } = useAuth();
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    checkActiveMeeting();
    
    // Poll for meeting status changes every 10 seconds
    const interval = setInterval(checkActiveMeeting, 10000);
    return () => clearInterval(interval);
  }, [classId]);

  const checkActiveMeeting = async () => {
    setIsLoading(true);
    const { data, error } = await getActiveClassMeeting(classId);
    if (!error && data) {
      setActiveMeeting(data);
    } else {
      setActiveMeeting(null);
    }
    setIsLoading(false);
  };

  const handleStartMeeting = async () => {
    if (!user) return;
    
    setIsStarting(true);
    try {
      const { data, error } = await createClassMeeting({
        title: `${className} - Live Class`,
        host_id: user.id,
        class_id: classId,
      });

      if (error) {
        toast.error('Failed to start meeting');
        return;
      }

      setActiveMeeting(data);
      
      // Notify class members
      await notifyClassAboutMeeting(classId, data.code, data.title, user.name);
      toast.success('Meeting started! Students have been notified.');
      
      // Open meeting in new tab
      openMeetingInNewTab(data, true);
    } catch (err) {
      toast.error('Failed to start meeting');
    } finally {
      setIsStarting(false);
    }
  };

  const openMeetingInNewTab = (meeting: any, isHost: boolean) => {
    const url = `${INTELLIMEET_URL}/meeting/${meeting.code}`;
    window.open(url, '_blank');
  };

  const handleJoinMeeting = () => {
    if (activeMeeting && user) {
      const isHost = user.id === activeMeeting.host_id;
      openMeetingInNewTab(activeMeeting, isHost);
    }
  };

  const handleEndMeeting = async () => {
    if (!activeMeeting) return;
    
    try {
      await endMeeting(activeMeeting.id);
      setActiveMeeting(null);
      toast.success('Meeting ended');
      onClose?.();
    } catch (err) {
      toast.error('Failed to end meeting');
    }
  };

  if (isLoading && !activeMeeting) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Show meeting controls
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Video className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Class Meeting</h3>
            <p className="text-sm text-gray-500">
              {activeMeeting ? 'A meeting is in progress' : 'No active meeting'}
            </p>
          </div>
        </div>
      </div>

      {activeMeeting ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-700 font-medium">Meeting in Progress</span>
            </div>
            <p className="text-sm text-green-600">{activeMeeting.title}</p>
            <p className="text-xs text-green-500 mt-1">Code: {activeMeeting.code}</p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleJoinMeeting}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <ExternalLink className="h-5 w-5" />
              <span>Join Meeting</span>
            </button>
            
            {isTeacher && (
              <button
                onClick={handleEndMeeting}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <VideoOff className="h-5 w-5" />
                <span>End</span>
              </button>
            )}
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Meeting opens in a new tab on IntelliMeet
          </p>
        </div>
      ) : isTeacher ? (
        <button
          onClick={handleStartMeeting}
          disabled={isStarting}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
        >
          {isStarting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Starting Meeting...</span>
            </>
          ) : (
            <>
              <Video className="h-5 w-5" />
              <span>Start Class Meeting</span>
            </>
          )}
        </button>
      ) : (
        <div className="text-center py-4 text-gray-500">
          <p>No active meeting. Wait for your teacher to start one.</p>
        </div>
      )}
    </div>
  );
};

export default ClassMeeting;
