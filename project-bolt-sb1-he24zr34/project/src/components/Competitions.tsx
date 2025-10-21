import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Star, Shield, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import MatchResultForm from './MatchResultForm';
import { useAuth } from '../hooks/useAuth';

type Edition = {
  id: string;
  name: string;
  type: 'league' | 'champions' | 'cup';
  status: 'active' | 'completed' | 'upcoming';
};

type Team = {
  id: string;
  name: string;
  points: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
};

type Match = {
  id: string;
  home_team: { id: string; name: string };
  away_team: { id: string; name: string };
  home_score: number | null;
  away_score: number | null;
  scheduled_for: string;
  match_day: number;
  home_team_id: string;
  away_team_id: string;
};

type PlayerStats = {
  id: string;
  username: string | null;
  game_id: string | null;
  total_goals?: number;
  total_assists?: number;
};

export default function Competitions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'grid' | 'detail'>('grid');
  const [editions, setEditions] = useState<Edition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEditions();
  }, []);

  const fetchEditions = async () => {
    try {
      const { data, error } = await supabase
        .from('editions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEditions(data || []);
    } catch (error) {
      console.error('Error fetching editions:', error);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Competizioni</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Scopri tutte le competizioni, segui le classifiche e resta aggiornato sui risultati
        </p>
      </div>

      {editions.length === 0 ? (
        <div className="text-center text-gray-400">
          <p>Nessuna competizione disponibile al momento.</p>
        </div>
      ) : (
        <div>
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-300">In Corso</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
              {editions.map((edition) => (
                <div
                  key={edition.id}
                  onClick={() => navigate(`/competitions/${edition.id}`)}
                  className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="bg-gray-700 p-3 rounded-lg">
                      <Shield size={32} className="text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{edition.name}</h3>
                      <p className="text-sm text-gray-400">
                        {edition.type === 'league' ? 'Campionato' : 
                         edition.type === 'champions' ? 'Champions League' : 
                         'Coppa'}
                      </p>
                      <p className="text-sm text-gray-400">
                        {edition.status === 'active' ? 'In Corso' : 
                         edition.status === 'completed' ? 'Completata' : 
                         'In Arrivo'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}