import React, { useState, useEffect } from 'react';
import { Users2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
}

export default function TeamsList() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Errore nel caricamento delle squadre');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h1 className="text-3xl font-bold text-center mb-8">Squadre</h1>

        <div className="relative mb-8">
          <input
            type="text"
            placeholder="Cerca squadra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-4 py-3 pl-12 text-white"
          />
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
        </div>

        <div className="space-y-4">
          {filteredTeams.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              Nessuna squadra trovata
            </div>
          ) : (
            filteredTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => navigate(`/team/${team.id}`)}
                className="w-full bg-gray-800 rounded-lg p-4 flex items-center space-x-4 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="bg-gray-700 p-2 rounded-lg">
                  <Users2 size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{team.name}</h3>
                  {team.description && (
                    <p className="text-gray-400 text-sm mt-1">{team.description}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}