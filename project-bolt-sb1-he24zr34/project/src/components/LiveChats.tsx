import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import MatchChat from './MatchChat';

interface Chat {
  id: string;
  match: {
    id: string;
    home_team: { name: string };
    away_team: { name: string };
    scheduled_for: string;
  };
}

export default function LiveChats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActiveChats();
      setupRealtimeSubscription();
    }

    // Handle direct navigation to specific chat
    if (location.state?.selectedMatch) {
      setSelectedChat({
        id: '', // Will be set after fetching
        match: location.state.selectedMatch
      });
    }

    return () => {
      supabase.removeChannel('live-chats');
    };
  }, [user, location]);

  useEffect(() => {
    // When chats are loaded and we have a selected match from navigation,
    // find and select the corresponding chat
    if (activeChats.length > 0 && location.state?.selectedMatch) {
      const chat = activeChats.find(c => c.match.id === location.state.selectedMatch.id);
      if (chat) {
        setSelectedChat(chat);
        // Clear the location state to avoid reselecting on subsequent renders
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [activeChats, location.state]);

  const fetchActiveChats = async () => {
    try {
      let query = supabase
        .from('match_chats')
        .select(`
          id,
          match:matches (
            id,
            home_team:teams!home_team_id (id, name),
            away_team:teams!away_team_id (id, name),
            scheduled_for
          )
        `)
        .eq('active', true)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setActiveChats(data || []);
    } catch (error) {
      console.error('Error fetching active chats:', error);
      toast.error('Error loading chats');
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('live-chats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_chats',
        },
        () => {
          fetchActiveChats();
        }
      )
      .subscribe();

    return channel;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Live Match Chats</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chat List */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Active Chats</h2>
            {activeChats.length === 0 ? (
              <p className="text-gray-400 text-center py-4">
                No active chats available
              </p>
            ) : (
              <div className="space-y-4">
                {activeChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full text-left p-4 rounded-lg transition-colors ${
                      selectedChat?.id === chat.id
                        ? 'bg-red-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <h3 className="font-medium">
                      {chat.match.home_team.name} vs {chat.match.away_team.name}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {format(new Date(chat.match.scheduled_for), 'dd MMM yyyy HH:mm', {
                        locale: it,
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2">
          {selectedChat ? (
            <MatchChat
              matchId={selectedChat.match.id}
              homeTeamName={selectedChat.match.home_team.name}
              awayTeamName={selectedChat.match.away_team.name}
              onClose={() => setSelectedChat(null)}
            />
          ) : (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">Select a chat to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}