import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MatchChat from './MatchChat';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ActiveChat {
  id: string;
  match: {
    id: string;
    home_team: { name: string };
    away_team: { name: string };
    scheduled_for: string;
  };
}

export default function AdminChatList() {
  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<ActiveChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    fetchActiveChats();
    channelRef.current = setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  const fetchActiveChats = async () => {
    try {
      const { data, error } = await supabase
        .from('match_chats')
        .select(`
          id,
          match:matches (
            id,
            home_team:teams!home_team_id (name),
            away_team:teams!away_team_id (name),
            scheduled_for
          )
        `)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActiveChats(data || []);
    } catch (error) {
      console.error('Error fetching active chats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    return supabase
      .channel('admin-chats')
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
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Active Match Chats</h2>

      {activeChats.length === 0 ? (
        <p className="text-gray-400 text-center py-4">
          No active chats at the moment
        </p>
      ) : (
        <div className="space-y-4">
          {activeChats.map((chat) => (
            <div
              key={chat.id}
              className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="font-medium">
                  {chat.match.home_team.name} vs {chat.match.away_team.name}
                </h3>
                <p className="text-sm text-gray-400">
                  {format(new Date(chat.match.scheduled_for), 'dd MMM yyyy HH:mm', {
                    locale: it,
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedChat(chat)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <MessageSquare size={20} />
                <span>Join Chat</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl">
            <MatchChat
              matchId={selectedChat.match.id}
              homeTeamName={selectedChat.match.home_team.name}
              awayTeamName={selectedChat.match.away_team.name}
              onClose={() => setSelectedChat(null)}
              isAdmin={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}