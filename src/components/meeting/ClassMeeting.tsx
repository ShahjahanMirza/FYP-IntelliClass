import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createClassMeeting, getActiveClassMeeting, endMeeting, notifyClassAboutMeeting } from '../../utils/supabase';
import { toast } from 'react-hot-toast';
import { Video, VideoOff, Users, X, ExternalLink, Loader2 } from 'lucide-react';

interface ClassMeetingProps {
  classId: string;
  className: string;
  isTeacher: boolean;
  onClose?: () => void;
}

// Get IntelliMeet URL from environment or use default
const INTELLIMEET_URL = import.meta.env.VITE_INTELLIMEET_URL || 'http://localhost:5174';

const ClassMeeting: React.FC<ClassMeetingProps> = ({ classId, className, isTeacher, onClose }) => {
  const { user } = useAuth();
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    checkActiveMeeting();
    
    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'MEETING_ENDED') {
        setShowMeeting(false);
        setActiveMeeting(null);
        toast.success('Meeting ended');
        onClose?.();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [classId]);

  const checkActiveMeeting = async () => {
    setIsLoading(true);
    const { data, error } = await getActiveClassMeeting(classId);
    if (!error && data) {
      setActiveMeeting(data);
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
      setShowMeeting(true);
      
      // Notify class members
      await notifyClassAboutMeeting(classId, data.code, data.title, user.name);
      toast.success('Meeting started! Students have been notified.');
    } catch (err) {
      toast.error('Failed to start meeting');
    } finally {
      setIsStarting(false);
    }
  };

  const handleJoinMeeting = () => {
    if (activeMeeting) {
      setShowMeeting(true);
    }
  };

  const handleEndMeeting = async () => {
    if (!activeMeeting) return;
    
    try {
      await endMeeting(activeMeeting.id);
      setShowMeeting(false);
      setActiveMeeting(null);
      toast.success('Meeting ended');
      onClose?.();
    } catch (err) {
      toast.error('Failed to end meeting');
    }
  };

  const handleOpenInNewTab = () => {
    if (activeMeeting) {
      const isHost = user?.id === activeMeeting.host_id;
      const url = `${INTELLIMEET_URL}/meeting/${activeMeeting.code}?host=${isHost}&name=${encodeURIComponent(user?.name || '')}`;
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Show embedded meeting
  if (showMeeting && activeMeeting) {
    const isHost = user?.id === activeMeeting.host_id;
    const embedUrl = `${INTELLIMEET_URL}/embed/${activeMeeting.code}?host=${isHost}&name=${encodeURIComponent(user?.name || '')}&classId=${classId}`;

    return (
      <div className="fixed inset-0 z-50 bg-gray-900">
        {/* Meeting Header */}
        <div className="absolute top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Video className="h-5 w-5 text-red-500" />
              <span className="text-white font-medium">{activeMeeting.title}</span>
            </div>
            <span className="text-gray-400 text-sm">Code: {activeMeeting.code}</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleOpenInNewTab}
              className="flex items-center space-x-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open in New Tab</span>
            </button>
            
            {isTeacher && (
              <button
                onClick={handleEndMeeting}
                className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
              >
                <VideoOff className="h-4 w-4" />
                <span>End Meeting</span>
              </button>
            )}
            
            <button
              onClick={() => setShowMeeting(false)}
              className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Embedded Meeting */}
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="w-full h-full pt-14"
          allow="camera; microphone; display-capture; autoplay; clipboard-write"
          allowFullScreen
        />
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
              <Users className="h-5 w-5" />
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
