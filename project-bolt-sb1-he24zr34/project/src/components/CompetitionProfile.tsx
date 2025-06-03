import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Star, Users2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import toast from 'react-hot-toast';
import MatchResultForm from './MatchResultForm';
import { useAuth } from '../hooks/useAuth';
import ChatButton from './ChatButton';
import CompetitionBracket from './CompetitionBracket';

interface Competition {
  id: string;
  name: string;
  image_url: string | null;
  status: string;
  type: 'league' | 'champions' | 'cup';
}

interface Standing {
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

interface Match {
  id: string;
  home_team: { id: string; name: string; logo_url: string | null };
  away_team: { id: string; name: string; logo_url: string | null };
  home_score: number | null;
  away_score: number | null;
  scheduled_for: string;
  match_day: number;
  approved: boolean;
  round?: number;
  leg?: number;
  bracket_position?: {
    match_number: number;
    round: number;
  };
}

interface Player {
  id: string;
  username: string | null;
  game_id: string | null;
  total_goals?: number;
  total_assists?: number;
}

type TabType = 'bracket' | 'calendar' | 'stats';

export default function CompetitionProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('bracket');
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [topScorers, setTopScorers] = useState<Player[]>([]);
  const [topAssists, setTopAssists] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [isResultFormOpen, setIsResultFormOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCompetitionData();
    }
  }, [id]);

  useEffect(() => {
    if (user) {
      fetchUserTeam();
    }
  }, [user]);

  const fetchUserTeam = async () => {
    if (!user) return;

    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('captain_id', user.id)
        .single();

      if (teamError && teamError.code !== 'PGRST116') {
        throw teamError;
      }

      if (teamData) {
        setUserTeamId(teamData.id);
      }
    } catch (error) {
      console.error('Error fetching user team:', error);
    }
  };

  const fetchCompetitionData = async () => {
    try {
      // Fetch competition details
      const { data: competitionData, error: competitionError } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', id)
        .single();

      if (competitionError) throw competitionError;
      setCompetition(competitionData);

      // Fetch matches with additional fields for cup competitions
      const matchesQuery = supabase
        .from('matches')
        .select(`
          id,
          home_team:teams!home_team_id(id, name, logo_url),
          away_team:teams!away_team_id(id, name, logo_url),
          home_score,
          away_score,
          scheduled_for,
          match_day,
          approved,
          competition_matches(
            round,
            leg,
            bracket_position
          )
        `)
        .eq('competition_id', id)
        .order('match_day', { ascending: true });

      const { data: matchesData, error: matchesError } = await matchesQuery;

      if (matchesError) throw matchesError;

      // Transform matches data to include bracket information
      const transformedMatches = matchesData?.map(match => ({
        ...match,
        round: match.competition_matches[0]?.round,
        leg: match.competition_matches[0]?.leg,
        bracket_position: match.competition_matches[0]?.bracket_position
      })) || [];

      setMatches(transformedMatches);

      // Fetch top scorers
      const { data: scorersData, error: scorersError } = await supabase
        .rpc('get_top_scorers', { limit_count: 10 });

      if (scorersError) throw scorersError;
      setTopScorers(scorersData || []);

      // Fetch top assists
      const { data: assistsData, error: assistsError } = await supabase
        .rpc('get_top_assistmen', { limit_count: 10 });

      if (assistsError) throw assistsError;
      setTopAssists(assistsData || []);

    } catch (error) {
      console.error('Error fetching competition data:', error);
      toast.error('Errore nel caricamento della competizione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitResult = async () => {
    await fetchCompetitionData();
    setIsResultFormOpen(false);
    setSelectedMatch(null);
  };

  const canSubmitResult = (match: Match) => {
    if (!user || !userTeamId) return false;
    if (match.approved) return false;
    
    const isPastMatch = new Date(match.scheduled_for) <= new Date();
    const isTeamInvolved = match.home_team.id === userTeamId || match.away_team.id === userTeamId;
    
    return isPastMatch && isTeamInvolved;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-400">Competizione non trovata</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          {competition.image_url ? (
            <img
              src={competition.image_url}
              alt={competition.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
          ) : (
            <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center">
              <Trophy size={32} className="text-red-500" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{competition.name}</h1>
            <span className="text-gray-400">
              {competition.status === 'in_corso' ? 'In Corso' : 
               competition.status === 'completata' ? 'Completata' : 
               'In Arrivo'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-4 mb-8">
        {competition.type === 'cup' && (
          <button
            onClick={() => setActiveTab('bracket')}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
              activeTab === 'bracket' ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <Trophy size={20} />
            <span>Tabellone</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
            activeTab === 'calendar' ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          <Calendar size={20} />
          <span>Calendario</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
            activeTab === 'stats' ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          <Star size={20} />
          <span>Statistiche</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-gray-800 rounded-lg p-6">
        {activeTab === 'bracket' && competition.type === 'cup' && (
          <CompetitionBracket
            matches={matches}
            userTeamId={userTeamId}
            onSubmitResult={(match) => {
              setSelectedMatch(match);
              setIsResultFormOpen(true);
            }}
          />
        )}

        {activeTab === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from(new Set(matches.map(m => m.match_day))).map(matchDay => (
              <div key={matchDay} className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-400 mb-3">Giornata {matchDay}</h3>
                <div className="space-y-3">
                  {matches
                    .filter(m => m.match_day === matchDay)
                    .map(match => (
                      <div key={match.id} className="bg-gray-800 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <button
                            onClick={() => navigate(`/team/${match.home_team.id}`)}
                            className="flex items-center space-x-2 hover:text-red-500 transition-colors"
                          >
                            {match.home_team.logo_url ? (
                              <img
                                src={match.home_team.logo_url}
                                alt={match.home_team.name}
                                className="w-6 h-6 rounded object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center">
                                <Users2 size={16} className="text-gray-500" />
                              </div>
                            )}
                            <span>{match.home_team.name}</span>
                          </button>
                          <div className="mx-4 flex items-center space-x-2">
                            <span className="bg-gray-700 px-2 py-1 rounded min-w-[24px] text-center">
                              {match.home_score !== null ? match.home_score : '-'}
                            </span>
                            <span>-</span>
                            <span className="bg-gray-700 px-2 py-1 rounded min-w-[24px] text-center">
                              {match.away_score !== null ? match.away_score : '-'}
                            </span>
                          </div>
                          <button
                            onClick={() => navigate(`/team/${match.away_team.id}`)}
                            className="flex items-center space-x-2 hover:text-red-500 transition-colors"
                          >
                            <span>{match.away_team.name}</span>
                            {match.away_team.logo_url ? (
                              <img
                                src={match.away_team.logo_url}
                                alt={match.away_team.name}
                                className="w-6 h-6 rounded object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center">
                                <Users2 size={16} className="text-gray-500" />
                              </div>
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">
                            {format(new Date(match.scheduled_for), 'dd MMM yyyy HH:mm', { locale: it })}
                          </span>
                          <div className="flex items-center space-x-2">
                            <ChatButton
                              matchId={match.id}
                              homeTeamId={match.home_team.id}
                              awayTeamId={match.away_team.id}
                              homeTeamName={match.home_team.name}
                              awayTeamName={match.away_team.name}
                              scheduledFor={match.scheduled_for}
                              approved={match.approved}
                            />
                            {canSubmitResult(match) && (
                              <button
                                onClick={() => {
                                  setSelectedMatch(match);
                                  setIsResultFormOpen(true);
                                }}
                                className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                              >
                                Invia Risultato
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">Marcatori</h3>
              <div className="space-y-2">
                {topScorers.map((player, index) => (
                  <div key={player.id} className="bg-gray-700 rounded-lg p-3 flex justify-between items-center">
                    <button
                      onClick={() => navigate(`/player/${player.id}`)}
                      className="hover:text-red-500 transition-colors text-left"
                    >
                      <span className="font-medium">{player.username || player.game_id}</span>
                      {player.game_id && player.username && (
                        <span className="text-sm text-gray-400 ml-2">({player.game_id})</span>
                      )}
                    </button>
                    <div className="bg-gray-600 px-3 py-1 rounded-full text-sm">
                      {player.total_goals} gol
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Assistman</h3>
              <div className="space-y-2">
                {topAssists.map((player, index) => (
                  <div key={player.id} className="bg-gray-700 rounded-lg p-3 flex justify-between items-center">
                    <button
                      onClick={() => navigate(`/player/${player.id}`)}
                      className="hover:text-red-500 transition-colors text-left"
                    >
                      <span className="font-medium">{player.username || player.game_id}</span>
                      {player.game_id && player.username && (
                        <span className="text-sm text-gray-400 ml-2">({player.game_id})</span>
                      )}
                    </button>
                    <div className="bg-gray-600 px-3 py-1 rounded-full text-sm">
                      {player.total_assists} assist
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Match Result Form Modal */}
      {isResultFormOpen && selectedMatch && userTeamId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <MatchResultForm
              matchId={selectedMatch.id}
              teamId={userTeamId}
              homeTeamName={selectedMatch.home_team.name}
              awayTeamName={selectedMatch.away_team.name}
              onClose={() => {
                setIsResultFormOpen(false);
                setSelectedMatch(null);
              }}
              onSuccess={handleSubmitResult}
            />
          </div>
        </div>
      )}
    </div>
  );
}