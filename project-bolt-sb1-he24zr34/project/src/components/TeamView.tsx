import React, { useState, useEffect } from 'react';
import { Users2, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Team {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  captain_id: string;
}

interface TeamMember {
  id: string;
  username: string;
  game_id: string;
  position: string;
}

interface Competition {
  id: string;
  name: string;
  image_url: string | null;
  status: string;
}

export default function TeamView() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTeamById(id);
    } else if (user) {
      fetchUserTeam();
    } else {
      setIsLoading(false);
    }
  }, [id, user]);

  const fetchTeamById = async (teamId: string) => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      const { data: captainData, error: captainError } = await supabase
        .from('profiles')
        .select('id, username, game_id, position')
        .eq('id', teamData.captain_id)
        .single();

      if (captainError) throw captainError;

      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          profiles (
            id,
            username,
            game_id,
            position
          )
        `)
        .eq('team_id', teamId);

      if (membersError) throw membersError;

      const { data: competitionsData, error: competitionsError } = await supabase
        .from('competition_teams')
        .select(`
          competitions (
            id,
            name,
            image_url,
            status
          )
        `)
        .eq('team_id', teamId);

      if (competitionsError) throw competitionsError;

      const allMembers = [
        captainData,
        ...(membersData?.map(m => m.profiles) || [])
      ].filter(Boolean);

      const uniqueMembers = allMembers.filter((member, index, self) =>
        index === self.findIndex((m) => m.id === member.id)
      );

      setMembers(uniqueMembers);
      setCompetitions(competitionsData?.map(item => item.competitions) || []);
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Errore nel caricamento del team');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserTeam = async () => {
    if (!user) return;
    
    try {
      const { data: membershipData, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (membershipError) throw membershipError;

      if (membershipData) {
        await fetchTeamById(membershipData.team_id);
      }
    } catch (error) {
      console.error('Error fetching user team data:', error);
      toast.error('Errore nel caricamento del team');
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

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-400">Nessun team trovato</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center space-x-4 mb-8">
        <Users2 size={32} className="text-red-500" />
        <h1 className="text-3xl font-bold">Team Profile</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Column */}
        <div className="md:w-1/3 space-y-8">
          {/* Team Info Box */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex flex-col items-center text-center">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="w-32 h-32 rounded-lg object-cover mb-4"
                />
              ) : (
                <div className="w-32 h-32 bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
                  <Users2 size={48} className="text-gray-600" />
                </div>
              )}
              <h2 className="text-2xl font-bold mb-2">{team.name}</h2>
              {team.description && (
                <p className="text-gray-400">{team.description}</p>
              )}
            </div>
          </div>

          {/* Competitions Box */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Competizioni</h3>
            <div className="space-y-3">
              {competitions.length === 0 ? (
                <p className="text-gray-400 text-center">Nessuna competizione attiva</p>
              ) : (
                competitions.map((competition) => (
                  <button
                    key={competition.id}
                    onClick={() => navigate(`/competitions/${competition.id}`)}
                    className="w-full bg-gray-700 rounded-lg p-4 flex items-center space-x-3 hover:bg-gray-600 transition-colors"
                  >
                    <div className="bg-gray-600 p-2 rounded-lg">
                      <Trophy size={24} className="text-red-500" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium">{competition.name}</h4>
                      <span className="text-sm text-gray-400">
                        {competition.status === 'in_corso' ? 'In Corso' : 
                         competition.status === 'completata' ? 'Completata' : 
                         'In Arrivo'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Players List */}
        <div className="md:w-2/3">
          <div className="bg-gray-800 rounded-lg p-6 h-full">
            <h3 className="text-xl font-semibold mb-4">Membri del Team</h3>
            <div className="overflow-y-auto max-h-[calc(100vh-16rem)]">
              {members.length === 0 ? (
                <p className="text-gray-400 text-center">Nessun membro nel team</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => navigate(`/player/${member.id}`)}
                              className="font-medium hover:text-red-500 transition-colors"
                            >
                              {member.username || 'Username non impostato'}
                            </button>
                            {team.captain_id === member.id && (
                              <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                Capitano
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-400 mt-1">
                            <span>{member.position}</span>
                            <span>•</span>
                            <span>{member.game_id}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}