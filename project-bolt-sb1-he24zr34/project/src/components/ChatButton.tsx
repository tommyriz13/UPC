import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface ChatButtonProps {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledFor: string;
  approved: boolean;
}

export default function ChatButton({
  matchId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  scheduledFor,
  approved,
}: ChatButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      checkVisibility();
    }
  }, [user, matchId]);

  const checkVisibility = async () => {
    if (!user) return;

    try {
      // Check if user is a captain of either team or an admin
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const isAdmin = profileData.role === 'admin';

      if (!isAdmin) {
        // Check if user is a captain of either team
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('id')
          .eq('captain_id', user.id)
          .in('id', [homeTeamId, awayTeamId])
          .maybeSingle();

        if (teamError) throw teamError;

        // Calculate if chat should be visible based on date
        const matchDate = new Date(scheduledFor);
        const sevenDaysBefore = new Date(matchDate);
        sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);

        const isWithinTimeframe = new Date() >= sevenDaysBefore && !approved;
        const isCaptain = Boolean(teamData);

        setIsVisible(isWithinTimeframe && isCaptain);
      } else {
        // Admins can always see the chat button
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Error checking chat visibility:', error);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent event bubbling
    e.stopPropagation();
    navigate('/live-chats', { 
      state: { 
        selectedMatch: {
          id: matchId,
          home_team: { name: homeTeamName },
          away_team: { name: awayTeamName },
          scheduled_for: scheduledFor
        }
      }
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={handleClick}
      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg flex items-center space-x-1"
    >
      <MessageSquare size={16} />
      <span>Live Chat</span>
    </button>
  );
}