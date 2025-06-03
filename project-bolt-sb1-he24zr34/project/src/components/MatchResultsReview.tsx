import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Check, X, Edit2, Search, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type Match = {
  id: string;
  home_team: { name: string };
  away_team: { name: string };
  scheduled_for: string;
  match_day: number;
  match_results: {
    id: string;
    team_id: string;
    teams: {
      name: string;
    };
    home_score: number;
    away_score: number;
    status: string;
    created_at: string;
    verification_status: string;
  }[];
  match_lineups: {
    id: string;
    team_id: string;
    formation: string;
    player_positions: Record<string, string>;
  }[];
  match_proofs: {
    id: string;
    team_id: string;
    player_list_url: string;
    result_url: string;
    stats_url: string;
    stream_url: string;
  }[];
  match_player_stats: {
    id: string;
    player_id: string;
    team_id: string;
    goals: number;
    assists: number;
    profiles: {
      username: string;
      game_id: string;
    };
  }[];
};

type MatchResultsReviewProps = {
  matches: Match[];
  onApproveResult: (matchId: string) => void;
};

type VerificationStep = 'lineups' | 'results' | 'stats' | 'stream' | 'confirm';

export function MatchResultsReview({ matches, onApproveResult }: MatchResultsReviewProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [currentStep, setCurrentStep] = useState<VerificationStep>('lineups');
  const [isVerifying, setIsVerifying] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [editedScores, setEditedScores] = useState<{
    homeScore: number;
    awayScore: number;
  } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const startVerification = (match: Match) => {
    setSelectedMatch(match);
    setIsVerifying(true);
    setCurrentStep('lineups');
    setAdminNotes('');
    setEditedScores(null);
    setSelectedImage(null);
  };

  const closeVerification = () => {
    setSelectedMatch(null);
    setIsVerifying(false);
    setCurrentStep('lineups');
    setAdminNotes('');
    setEditedScores(null);
  };

  const handleScoreEdit = (homeScore: number, awayScore: number) => {
    setEditedScores({ homeScore, awayScore });
  };

  const checkResultConsistency = (match: Match) => {
    if (!match.match_results || match.match_results.length !== 2) return false;
    const [result1, result2] = match.match_results;
    return result1.home_score === result2.home_score && result1.away_score === result2.away_score;
  };

  const handleApprove = async () => {
    if (!selectedMatch) return;

    try {
      if (editedScores) {
        const { error: updateError } = await supabase
          .from('match_results')
          .update({
            home_score: editedScores.homeScore,
            away_score: editedScores.awayScore,
            admin_modified: true
          })
          .eq('match_id', selectedMatch.id);

        if (updateError) throw updateError;
      }

      const { error: verifyError } = await supabase
        .rpc('verify_match_results', {
          match_id: selectedMatch.id,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          verification_result: 'approved',
          notes: adminNotes || null
        });

      if (verifyError) throw verifyError;

      toast.success('Risultato approvato con successo');
      onApproveResult(selectedMatch.id);
      closeVerification();
    } catch (error) {
      console.error('Error approving result:', error);
      toast.error('Errore nell\'approvazione del risultato');
    }
  };

  const ImageViewer = ({ url, alt }: { url: string; alt: string }) => (
    <div className="relative group">
      <img
        src={url}
        alt={alt}
        className="w-full rounded-lg cursor-pointer transition-transform transform hover:scale-105"
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

  const renderVerificationStep = () => {
    if (!selectedMatch) return null;

    const homeTeamData = selectedMatch.match_results?.find(r => 
      r.teams.name === selectedMatch.home_team.name
    );
    const awayTeamData = selectedMatch.match_results?.find(r => 
      r.teams.name === selectedMatch.away_team.name
    );

    const homeTeamProofs = selectedMatch.match_proofs?.find(p => 
      p.team_id === homeTeamData?.team_id
    );
    const awayTeamProofs = selectedMatch.match_proofs?.find(p => 
      p.team_id === awayTeamData?.team_id
    );

    switch (currentStep) {
      case 'lineups':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Verifica Formazioni</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Lineup */}
              <div className="space-y-4">
                <h4 className="font-medium">{selectedMatch.home_team.name}</h4>
                {selectedMatch.match_lineups
                  ?.filter(l => l.team_id === homeTeamData?.team_id)
                  .map(lineup => (
                    <div key={lineup.id} className="bg-gray-700 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-2">Formazione: {lineup.formation}</p>
                      {homeTeamProofs?.player_list_url && (
                        <ImageViewer
                          url={homeTeamProofs.player_list_url}
                          alt="Home team lineup"
                        />
                      )}
                    </div>
                  ))
                }
              </div>

              {/* Away Team Lineup */}
              <div className="space-y-4">
                <h4 className="font-medium">{selectedMatch.away_team.name}</h4>
                {selectedMatch.match_lineups
                  ?.filter(l => l.team_id === awayTeamData?.team_id)
                  .map(lineup => (
                    <div key={lineup.id} className="bg-gray-700 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-2">Formazione: {lineup.formation}</p>
                      {awayTeamProofs?.player_list_url && (
                        <ImageViewer
                          url={awayTeamProofs.player_list_url}
                          alt="Away team lineup"
                        />
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        );

      case 'results':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Verifica Risultato</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Result */}
              <div className="space-y-4">
                <h4 className="font-medium">{selectedMatch.home_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  {homeTeamProofs?.result_url && (
                    <ImageViewer
                      url={homeTeamProofs.result_url}
                      alt="Home team result"
                    />
                  )}
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
                <h4 className="font-medium">{selectedMatch.away_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  {awayTeamProofs?.result_url && (
                    <ImageViewer
                      url={awayTeamProofs.result_url}
                      alt="Away team result"
                    />
                  )}
                  <div className="text-center mt-4">
                    <p className="text-sm text-gray-400">Risultato Inviato</p>
                    <p className="text-xl font-semibold mt-1">
                      {awayTeamData?.home_score} - {awayTeamData?.away_score}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {!checkResultConsistency(selectedMatch) && (
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
        );

      case 'stats':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Verifica Statistiche</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Stats */}
              <div className="space-y-4">
                <h4 className="font-medium">{selectedMatch.home_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  {homeTeamProofs?.stats_url && (
                    <ImageViewer
                      url={homeTeamProofs.stats_url}
                      alt="Home team stats"
                    />
                  )}
                  <div className="space-y-2 mt-4">
                    {selectedMatch.match_player_stats
                      ?.filter(stat => stat.team_id === homeTeamData?.team_id)
                      .map(stat => (
                        <div key={stat.id} className="flex justify-between items-center">
                          <span>{stat.profiles.username}</span>
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
                <h4 className="font-medium">{selectedMatch.away_team.name}</h4>
                <div className="bg-gray-700 rounded-lg p-4">
                  {awayTeamProofs?.stats_url && (
                    <ImageViewer
                      url={awayTeamProofs.stats_url}
                      alt="Away team stats"
                    />
                  )}
                  <div className="space-y-2 mt-4">
                    {selectedMatch.match_player_stats
                      ?.filter(stat => stat.team_id === awayTeamData?.team_id)
                      .map(stat => (
                        <div key={stat.id} className="flex justify-between items-center">
                          <span>{stat.profiles.username}</span>
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
        );

      case 'stream':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Verifica Stream</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Stream */}
              <div className="space-y-4">
                <h4 className="font-medium">{selectedMatch.home_team.name}</h4>
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
                <h4 className="font-medium">{selectedMatch.away_team.name}</h4>
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
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Conferma Finale</h3>
            
            <div className="bg-gray-700 rounded-lg p-6">
              <div className="mb-6">
                <h4 className="font-medium mb-2">Risultato Finale</h4>
                <div className="flex items-center justify-center space-x-4 text-xl">
                  <span>{selectedMatch.home_team.name}</span>
                  <div className="flex items-center space-x-2">
                    <span>{editedScores?.homeScore ?? homeTeamData?.home_score}</span>
                    <span>-</span>
                    <span>{editedScores?.awayScore ?? homeTeamData?.away_score}</span>
                  </div>
                  <span>{selectedMatch.away_team.name}</span>
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
                  onClick={closeVerification}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center space-x-2"
                >
                  <X size={20} />
                  <span>Annulla</span>
                </button>
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center space-x-2"
                >
                  <Check size={20} />
                  <span>Approva</span>
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

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

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium mb-4">Risultati da Approvare</h4>
      
      {matches.length === 0 ? (
        <p className="text-center text-gray-400 py-4">
          Non ci sono risultati da approvare
        </p>
      ) : (
        matches.map(match => (
          <div key={match.id} className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h5 className="font-medium">
                  {match.home_team.name} vs {match.away_team.name}
                </h5>
                <p className="text-sm text-gray-400">
                  Giornata {match.match_day} - {format(new Date(match.scheduled_for), 'dd MMM yyyy HH:mm', { locale: it })}
                </p>
              </div>
              <button
                onClick={() => startVerification(match)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Check size={20} />
                <span>Verifica</span>
              </button>
            </div>

            <div className="space-y-2">
              {match.match_results?.map(result => (
                <div key={result.id} className="bg-gray-600 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      Risultato inviato da {result.teams.name}
                    </span>
                    <span className="text-sm text-gray-400">
                      {format(new Date(result.created_at), 'dd MMM yyyy HH:mm', { locale: it })}
                    </span>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="font-medium">{match.home_team.name}</span>
                    <span className="mx-3">
                      {result.home_score} - {result.away_score}
                    </span>
                    <span className="font-medium">{match.away_team.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Verification Modal */}
      {isVerifying && selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">
                  Verifica Risultato: {selectedMatch.home_team.name} vs {selectedMatch.away_team.name}
                </h3>
                <button
                  onClick={closeVerification}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <p className="text-gray-400 mt-1">
                Giornata {selectedMatch.match_day} - {format(new Date(selectedMatch.scheduled_for), 'dd MMM yyyy HH:mm', { locale: it })}
              </p>
            </div>

            {renderStepIndicator()}
            {renderVerificationStep()}

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
        </div>
      )}

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