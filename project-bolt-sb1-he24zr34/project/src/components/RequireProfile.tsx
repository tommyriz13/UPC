import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface RequireProfileProps {
  children: React.ReactNode;
}

export default function RequireProfile({ children }: RequireProfileProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('game_id, position, role')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        // If user is admin, consider profile as complete
        if (data?.role === 'admin') {
          setIsProfileComplete(true);
          setIsLoading(false);
          return;
        }

        const isComplete = Boolean(data?.game_id && data?.position);
        setIsProfileComplete(isComplete);

        if (!isComplete) {
          toast.error('Completa i campi rimanenti nel profilo');
          navigate('/profile');
        }
      } catch (error) {
        console.error('Error checking profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkProfile();
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!user || isProfileComplete) {
    return <>{children}</>;
  }

  return null;
}