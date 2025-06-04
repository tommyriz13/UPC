import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { X, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type VerificationStep = 'lineups' | 'results' | 'stats' | 'stream' | 'confirm';

const UNSCHEDULED_DATE = new Date(0).toISOString();

const positionLabels: { [key: string]: string } = {
  'POR': 'Portiere',
  'TD': 'Terzino Destro',
  'TS': 'Terzino Sinistro',
  'DCD': 'Difensore Centrale Destro',
  'DCS': 'Difensore Centrale Sinistro',
  'DC': 'Difensore Centrale',
  'CDC': 'Centrocampista Difensivo Centrale',
  'CCD': 'Centrocampista Centrale Destro',
  'CCS': 'Centrocampista Centrale Sinistro',
  'COD': 'Centrocampista Offensivo Destro',
  'COC': 'Centrocampista Offensivo Centrale',
  'COS': 'Centrocampista Offensivo Sinistro',
  'ED': 'Esterno Destro',
  'ES': 'Esterno Sinistro',
  'AD': 'Ala Destra',
  'AS': 'Ala Sinistra',
  'ATTD': 'Attaccante Destro',
  'ATTS': 'Attaccante Sinistro',
  'ATT': 'Attaccante Centrale'
};

export default function VerificationGame() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<any | null>(null);
  const [currentStep, setCurrentStep] = useState<VerificationStep>('lineups');
  const [adminNotes, setAdminNotes] = useState('');
  const [editedScores, setEditedScores] = useState<{
    homeScore: number;
    awayScore: number;
  } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playerNames, setPlayerNames] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (matchId) {
      fetchMatchData(matchId);
    }
  }, [matchId]);

  const fetchMatchData = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          competition_id,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          scheduled_for,
          match_day,
          approved,
          match_results!inner (
            id,
            team_id,
            teams (
              name
            ),
            home_score,
            away_score,
            status,
            created_at
          ),
          match_lineups (
            id,
            team_id,
            formation,
            player_positions
          ),
          match_proofs (
            id,
            team_id,
            player_list_url,
            result_url,
            stats_url,
            stream_url
          ),
          match_player_stats (
            id,
            player_id,
            team_id,
            goals,
            assists,
            player:profiles!match_player_stats_player_profiles_fkey (
              username,
              game_id
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch player names for lineup positions
      if (data?.match_lineups) {
        const playerIds = new Set<string>();
        data.match_lineups.forEach((lineup: any) => {
          Object.values(lineup.player_positions || {}).forEach((playerId: any) => {
            if (playerId) playerIds.add(playerId);
          });
        });

        if (playerIds.size > 0) {
          const { data: players, error: playersError } = await supabase
            .from('profiles')
            .select('id, username, game_id')
            .in('id', Array.from(playerIds));

          if (!playersError && players) {
            const namesMap: { [key: string]: string } = {};
            players.forEach(player => {
              namesMap[player.id] = player.username || player.game_id;
            });
            setPlayerNames(namesMap);
          }
        }
      }

      setMatch(data);
    } catch (error) {
      console.error('Error fetching match data:', error);
      toast.error('Error loading match data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!match) return;

    try {
      setIsLoading(true);

      // First update match results with edited scores if any
      if (editedScores) {
        const { error: updateError } = await supabase
          .from('match_results')
          .update({
            home_score: editedScores.homeScore,
            away_score: editedScores.awayScore,
            admin_modified: true,
            status: 'approved',
            admin_notes: adminNotes || null
          })
          .eq('match_id', match.id);

        if (updateError) throw updateError;
      } else {
        // If no edited scores, just approve the results
        const { error: approveError } = await supabase
          .from('match_results')
          .update({
            status: 'approved',
            admin_notes: adminNotes || null
          })
          .eq('match_id', match.id);

        if (approveError) throw approveError;
      }

      // Update match status directly
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          status: 'completed',
          approved: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', match.id);

      if (matchError) throw matchError;

      await advanceKnockoutRounds(match.competition_id);
      toast.success('Match result approved successfully');
      navigate('/admin');
    } catch (error) {
      console.error('Error approving result:', error);
      toast.error('Error approving result');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScoreEdit = (homeScore: number, awayScore: number) => {
    setEditedScores({ homeScore, awayScore });
  };

  const advanceKnockoutRounds = async (competitionId: string) => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('competition_teams')
        .select('team_id')
        .eq('competition_id', competitionId);

      if (teamError) throw teamError;

      const teamIds = teamData?.map(t => t.team_id) || [];
      const totalRounds = Math.log2(teamIds.length);

      const { data, error } = await supabase
        .from('matches')
        .select(
          `id, home_team_id, away_team_id, home_score, away_score, approved, competition_matches(round, leg, bracket_position)`
        )
        .eq('competition_id', competitionId);

      if (error) throw error;

      const current: any[] = (data || []).map(m => ({
        ...m,
        round: m.competition_matches[0]?.round,
        leg: m.competition_matches[0]?.leg,
        bracket_position: m.competition_matches[0]?.bracket_position,
      }));

      for (let round = 1; round < totalRounds; round++) {
        const roundMatches = current
          .filter(m => m.round === round && m.leg === 1)
          .sort((a, b) => (a.bracket_position?.match_number || 0) - (b.bracket_position?.match_number || 0));
        if (roundMatches.length === 0) continue;
        if (!roundMatches.every(m => m.approved)) continue;

        for (let i = 0; i < roundMatches.length; i += 2) {
          const m1 = roundMatches[i];
          const m2 = roundMatches[i + 1];
          if (!m1 || !m2) continue;

          const matchNumber = Math.floor(i / 2) + 1;
          const exists = current.find(
            mm => mm.round === round + 1 &&
              mm.bracket_position?.match_number === matchNumber &&
              mm.leg === 1
          );
          if (exists) continue;

          const winner1 = m1.home_score > m1.away_score ? m1.home_team_id : m1.away_team_id;
          const winner2 = m2.home_score > m2.away_score ? m2.home_team_id : m2.away_team_id;

          const { data: newMatch, error: matchError } = await supabase
            .from('matches')
            .insert({
              competition_id: competitionId,
              home_team_id: winner1,
              away_team_id: winner2,
              match_day: round + 1,
              scheduled_for: UNSCHEDULED_DATE,
              status: 'scheduled',
            })
            .select('id')
            .single();

          if (matchError || !newMatch) continue;

          await supabase.from('competition_matches').insert({
            competition_id: competitionId,
            match_id: newMatch.id,
            round: round + 1,
            leg: 1,
            bracket_position: { match_number: matchNumber, round: round + 1 },
          });

          current.push({
            id: newMatch.id,
            home_team_id: winner1,
            away_team_id: winner2,
            home_score: null,
            away_score: null,
            approved: false,
            round: round + 1,
            leg: 1,
            bracket_position: { match_number: matchNumber, round: round + 1 },
          });
        }
      }
    } catch (err) {
      console.error('Error advancing knockout rounds', err);
    }
  };

  const checkResultConsistency = (match: any) => {
    if (!match.match_results || match.match_results.length !== 2) return false;
    const [result1, result2] = match.match_results;
    return result1.home_score === result2.home_score && result1.away_score === result2.away_score;
  };

  const ImageViewer = ({ url, alt }: { url: string; alt: string }) => (
    <div className="relative group">
      <img
        src={url}
        alt={alt}
        className="w-full max-w-[400px] max-h-[400px] object-contain rounded-lg cursor-pointer transition-transform transform hover:scale-105"
        onClick={() => setSelectedImage(url)}
      />
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(url, '_blank');
          }}
          className="bg-gray-800 bg-opacity-75 p-2 rounded-full hover:bg-opacity-100"
          title="Open in new tab"
        >
          <ExternalLink size={16} className="text-white" />
        </button>
      </div>
    </div>
  );

  const renderStepIndicator = () => {
    const steps: { key: VerificationStep; label: string }[] = [
      { key: 'lineups', label: 'Formazioni' },
      { key: 'results', label: 'Risultati' },
      { key: 'stats', label: 'Statistiche' },
      { key: 'stream', label: 'Stream' },
      { key: 'confirm', label: 'Conferma' },
    ];

    return (
      <div className="flex justify-between mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <button
              onClick={() => setCurrentStep(step.key)}
              className={`flex items-center ${
                currentStep === step.key
                  ? 'text-red-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === step.key
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-700'
              }`}>
                {index + 1}
              </div>
              <span className="ml-2">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <div className="flex-1 border-t-2 border-gray-700 self-center mx-4" />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-400">Match not found</p>
        </div>
      </div>
    );
  }

  const homeTeamData = match.match_results?.find((r: any) => 
    r.teams.name === match.home_team.name
  );
  const awayTeamData = match.match_results?.find((r: any) => 
    r.teams.name === match.away_team.name
  );

  const homeTeamProofs = match.match_proofs?.find((p: any) => 
    p.team_id === homeTeamData?.team_id
  );
  const awayTeamProofs = match.match_proofs?.find((p: any) => 
    p.team_id === awayTeamData?.team_id
  );

  const homeTeamLineup = match.match_lineups?.find((l: any) =>
    l.team_id === homeTeamData?.team_id
  );
  const awayTeamLineup = match.match_lineups?.find((l: any) =>
    l.team_id === awayTeamData?.team_id
  );

  const renderLineupPositions = (lineup: any) => {
    if (!lineup?.player_positions) return null;
    
    return (
      <div className="mt-4 space-y-1">
        {Object.entries(lineup.player_positions).map(([position, playerId]) => (
          <div key={position} className="flex justify-between text-sm">
            <span className="text-gray-400">{positionLabels[position] || position}</span>
            <span>{playerId ? playerNames[playerId as string] || 'N/A' : '-'}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">
            Verifica Risultato: {match.home_team.name} vs {match.away_team.name}
          </h3>
          <button
            onClick={() => navigate('/admin')}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        <p className="text-gray-400 mt-1">
          Giornata {match.match_day} - {format(new Date(match.scheduled_for), 'dd MMM yyyy HH:mm', { locale: it })}
        </p>
      </div>

      {renderStepIndicator()}

      <div className="bg-gray-800 rounded-lg p-6">
        {currentStep === 'lineups' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Verifica Formazioni</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Lineup */}
              <div className="space-y-4">
                <h4 className="font-medium">{match.home_team.name}</h4>
                {homeTeamLineup && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-400">Formazione</p>
                      <p className="text-xl font-semibold">{homeTeamLineup.formation}</p>
                    </div>
                    {renderLineupPositions(homeTeamLineup)}
                    {homeTeamProofs?.player_list_url && (
                      <div className="flex justify-center mt-6">
                        <ImageViewer
                          url={homeTeamProofs.player_list_url}
                          alt="Home team lineup"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Away Team Lineup */}
              <div className="space-y-4">
                <h4 className="font-medium">{match.away_team.name}</h4>
                {awayTeamLineup && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-400">Formazione</p>
                      <p className="text-xl font-semibold">{awayTeamLineup.formation}</p>
                    </div>
                    {renderLineupPositions(awayTeamLineup)}
                    {awayTeamProofs?.player_list_url && (
                      <div className="flex justify-center mt-6">
                        <ImageViewer
                          url={awayTeamProofs.player_list_url}
                          alt="Away team lineup"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'results' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Verifica Risultato</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Result */}
              <div className="space-y-4">
                <h4 className="font-medium">{match.home_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-center">
                    {homeTeamProofs?.result_url && (
                      <ImageViewer
                        url={homeTeamProofs.result_url}
                        alt="Home team result"
                      />
                    )}
                  </div>
                  <div className="text-center mt-4">
                    <p className="text-sm text-gray-400">Risultato Inviato</p>
                    <p className="text-xl font-semibold mt-1">
                      {homeTeamData?.home_score} - {homeTeamData?.away_score}
                    </p>
                  </div>
                </div>
              </div>

              {/* Away Team Result */}
              <div className="space-y-4">
                <h4 className="font-medium">{match.away_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-center">
                    {awayTeamProofs?.result_url && (
                      <ImageViewer
                        url={awayTeamProofs.result_url}
                        alt="Away team result"
                      />
                    )}
                  </div>
                  <div className="text-center mt-4">
                    <p className="text-sm text-gray-400">Risultato Inviato</p>
                    <p className="text-xl font-semibold mt-1">
                      {awayTeamData?.home_score} - {awayTeamData?.away_score}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {!checkResultConsistency(match) && (
              <div className="mt-6">
                <h4 className="font-medium text-red-500 mb-4">Discrepanza nei Risultati</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-4">
                    I risultati inviati non corrispondono. Inserisci il risultato corretto:
                  </p>
                  <div className="flex items-center justify-center space-x-4">
                    <input
                      type="number"
                      min="0"
                      value={editedScores?.homeScore ?? homeTeamData?.home_score ?? 0}
                      onChange={(e) => handleScoreEdit(
                        parseInt(e.target.value) || 0,
                        editedScores?.awayScore ?? homeTeamData?.away_score ?? 0
                      )}
                      className="w-16 px-2 py-1 bg-gray-600 rounded text-center"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      min="0"
                      value={editedScores?.awayScore ?? homeTeamData?.away_score ?? 0}
                      onChange={(e) => handleScoreEdit(
                        editedScores?.homeScore ?? homeTeamData?.home_score ?? 0,
                        parseInt(e.target.value) || 0
                      )}
                      className="w-16 px-2 py-1 bg-gray-600 rounded text-center"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Verifica Statistiche</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Stats */}
              <div className="space-y-4">
                <h4 className="font-medium">{match.home_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-center">
                    {homeTeamProofs?.stats_url && (
                      <ImageViewer
                        url={homeTeamProofs.stats_url}
                        alt="Home team stats"
                      />
                    )}
                  </div>
                  <div className="space-y-2 mt-4">
                    {match.match_player_stats
                      ?.filter((stat: any) => stat.team_id === homeTeamData?.team_id)
                      .map((stat: any) => (
                        <div key={stat.id} className="flex justify-between items-center">
                          <span>{stat.player.username}</span>
                          <div className="text-sm text-gray-400">
                            {stat.goals > 0 && <span>{stat.goals} gol</span>}
                            {stat.goals > 0 && stat.assists > 0 && <span>, </span>}
                            {stat.assists > 0 && <span>{stat.assists} assist</span>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>

              {/* Away Team Stats */}
              <div className="space-y-4">
                <h4 className="font-medium">{match.away_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-center">
                    {awayTeamProofs?.stats_url && (
                      <ImageViewer
                        url={awayTeamProofs.stats_url}
                        alt="Away team stats"
                      />
                    )}
                  </div>
                  <div className="space-y-2 mt-4">
                    {match.match_player_stats
                      ?.filter((stat: any) => stat.team_id === awayTeamData?.team_id)
                      .map((stat: any) => (
                        <div key={stat.id} className="flex justify-between items-center">
                          <span>{stat.player.username}</span>
                          <div className="text-sm text-gray-400">
                            {stat.goals > 0 && <span>{stat.goals} gol</span>}
                            {stat.goals > 0 && stat.assists > 0 && <span>, </span>}
                            {stat.assists > 0 && <span>{stat.assists} assist</span>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'stream' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Verifica Stream</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Stream */}
              <div className="space-y-4">
                <h4 className="font-medium">{match.home_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Link allo Stream:</p>
                  {homeTeamProofs?.stream_url ? (
                    <a
                      href={homeTeamProofs.stream_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all flex items-center"
                    >
                      <span className="flex-1">{homeTeamProofs.stream_url}</span>
                      <ExternalLink size={16} className="ml-2 flex-shrink-0" />
                    </a>
                  ) : (
                    <p className="text-gray-400">Nessun link fornito</p>
                  )}
                </div>
              </div>

              {/* Away Team Stream */}
              <div className="space-y-4">
                <h4 className="font-medium">{match.away_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Link allo Stream:</p>
                  {awayTeamProofs?.stream_url ? (
                    <a
                      href={awayTeamProofs.stream_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all flex items-center"
                    >
                      <span className="flex-1">{awayTeamProofs.stream_url}</span>
                      <ExternalLink size={16} className="ml-2 flex-shrink-0" />
                    </a>
                  ) : (
                    <p className="text-gray-400">Nessun link fornito</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'confirm' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Conferma Finale</h3>
            
            <div className="bg-gray-700 rounded-lg p-6">
              <div className="mb-6">
                <h4 className="font-medium mb-2">Risultato Finale</h4>
                <div className="flex items-center justify-center space-x-4 text-xl">
                  <span>{match.home_team.name}</span>
                  <div className="flex items-center space-x-2">
                    <span>{editedScores?.homeScore ?? homeTeamData?.home_score}</span>
                    <span>-</span>
                    <span>{editedScores?.awayScore ?? homeTeamData?.away_score}</span>
                  </div>
                  <span>{match.away_team.name}</span>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-medium mb-2">Note Amministrative</h4>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Inserisci eventuali note..."
                  className="w-full px-3 py-2 bg-gray-600 rounded-lg resize-none h-24"
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center space-x-2"
                >
                  <X size={20} />
                  <span>Annulla</span>
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                >
                  <span>{isLoading ? 'Approvazione...' : 'Approva'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep !== 'confirm' && (
          <div className="mt-6 flex justify-end space-x-4">
            {currentStep !== 'lineups' && (
              <button
                onClick={() => {
                  const steps: VerificationStep[] = ['lineups', 'results', 'stats', 'stream', 'confirm'];
                  const currentIndex = steps.indexOf(currentStep);
                  setCurrentStep(steps[currentIndex - 1]);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center space-x-2"
              >
                <span>Indietro</span>
              </button>
            )}
            <button
              onClick={() => {
                const steps: VerificationStep[] = ['lineups', 'results', 'stats', 'stream', 'confirm'];
                const currentIndex = steps.indexOf(currentStep);
                setCurrentStep(steps[currentIndex + 1]);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center space-x-2"
            >
              <span>Avanti</span>
            </button>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-gray-800 bg-opacity-75 p-2 rounded-full hover:bg-opacity-100"
            >
              <X size={24} className="text-white" />
            </button>
            <a
              href={selectedImage}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 left-4 bg-gray-800 bg-opacity-75 p-2 rounded-full hover:bg-opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={24} className="text-white" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}