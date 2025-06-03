import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Target, Users2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface PlayerStats {
  total_goals: number;
  total_assists: number;
  matches_played: number;
  team_name: string | null;
}

interface PlayerInfo {
  username: string;
  game_id: string;
  position: string;
}

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPlayerData();
    }
  }, [id]);

  const fetchPlayerData = async () => {
    try {
      // Fetch basic player info
      const { data: playerData, error: playerError } = await supabase
        .from('profiles')
        .select('username, game_id, position')
        .eq('id', id)
        .single();

      if (playerError) throw playerError;
      setPlayerInfo(playerData);

      // Fetch player stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_player_stats', { player_id: id });

      if (statsError) throw statsError;
      setPlayerStats(statsData[0] || {
        total_goals: 0,
        total_assists: 0,
        matches_played: 0,
        team_name: null
      });
    } catch (error) {
      console.error('Error fetching player data:', error);
      toast.error('Errore nel caricamento dei dati del giocatore');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!playerInfo) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">Giocatore non trovato</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{playerInfo.game_id}</h1>
          <p className="text-gray-400">{playerInfo.username}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="flex items-center justify-center mb-4">
              <Trophy size={32} className="text-red-500" />
            </div>
            <div className="text-3xl font-bold mb-2">{playerStats?.total_goals || 0}</div>
            <div className="text-gray-400">Goal Segnati</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="flex items-center justify-center mb-4">
              <Target size={32} className="text-red-500" />
            </div>
            <div className="text-3xl font-bold mb-2">{playerStats?.total_assists || 0}</div>
            <div className="text-gray-400">Assist</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="flex items-center justify-center mb-4">
              <Users2 size={32} className="text-red-500" />
            </div>
            <div className="text-3xl font-bold mb-2">{playerStats?.matches_played || 0}</div>
            <div className="text-gray-400">Partite Giocate</div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Ruolo</h2>
            <div className="text-gray-300">{playerInfo.position || 'Non specificato'}</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Team</h2>
            <div className="text-gray-300">{playerStats?.team_name || 'Nessun team'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}