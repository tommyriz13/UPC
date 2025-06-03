import React, { useState, useEffect } from 'react';
import { User, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Player {
  id: string;
  username: string | null;
  game_id: string | null;
  position: string | null;
}

export default function PlayersList() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, game_id, position')
        .not('game_id', 'is', null)
        .order('game_id');

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
      toast.error('Errore nel caricamento dei giocatori');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPlayers = players.filter(player =>
    player.game_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Giocatori</h1>

        <div className="relative mb-8">
          <input
            type="text"
            placeholder="Cerca per Game ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-4 py-3 pl-12 text-white"
          />
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
        </div>

        <div className="space-y-4">
          {filteredPlayers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              Nessun giocatore trovato
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => navigate(`/player/${player.id}`)}
                className="w-full bg-gray-800 rounded-lg p-4 flex items-center space-x-4 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="bg-gray-700 p-2 rounded-lg">
                  <User size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{player.game_id}</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    {player.username && <span>{player.username}</span>}
                    {player.position && (
                      <>
                        <span>•</span>
                        <span>{player.position}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}