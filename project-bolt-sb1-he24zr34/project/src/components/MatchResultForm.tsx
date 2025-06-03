import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ArrowRight, ArrowLeft, Upload } from 'lucide-react';

interface Props {
  matchId: string;
  teamId: string;
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '3-4-3' | '5-3-2' | '5-4-1';

interface FormationConfig {
  [key: string]: {
    positions: string[];
    layout: number[];
  };
}

const FORMATIONS: FormationConfig = {
  '4-4-2': {
    positions: ['POR', 'TD', 'DCD', 'DCS', 'TS', 'ED', 'CCD', 'CCS', 'ES', 'ATTD', 'ATTS'],
    layout: [1, 4, 4, 2]
  },
  '4-3-3': {
    positions: ['POR', 'TD', 'DCD', 'DCS', 'TS', 'CDC', 'CCD', 'CCS', 'AD', 'ATT', 'AS'],
    layout: [1, 4, 3, 3]
  },
  '4-2-3-1': {
    positions: ['POR', 'TD', 'DCD', 'DCS', 'TS', 'CDCD', 'CDCS', 'COD', 'COC', 'COS', 'ATT'],
    layout: [1, 4, 2, 3, 1]
  },
  '3-5-2': {
    positions: ['POR', 'DCD', 'DC', 'DCS', 'ED', 'CCD', 'CDC', 'CCS', 'ES', 'ATTD', 'ATTS'],
    layout: [1, 3, 5, 2]
  },
  '3-4-3': {
    positions: ['POR', 'DCD', 'DC', 'DCS', 'ED', 'CCD', 'CCS', 'ES', 'AD', 'ATT', 'AS'],
    layout: [1, 3, 4, 3]
  },
  '5-3-2': {
    positions: ['POR', 'ED', 'DCD', 'DC', 'DCS', 'ES', 'CCD', 'CDC', 'CCS', 'ATTD', 'ATTS'],
    layout: [1, 5, 3, 2]
  },
  '5-4-1': {
    positions: ['POR', 'ED', 'DCD', 'DC', 'DCS', 'ES', 'CCD', 'CCS', 'ED', 'ES', 'ATT'],
    layout: [1, 5, 4, 1]
  }
};

const getPositionLabel = (position: string): string => {
  const positionLabels: { [key: string]: string } = {
    'POR': 'POR',
    'TD': 'TD',
    'TS': 'TS',
    'DCD': 'DCD',
    'DCS': 'DCS',
    'DC': 'DC',
    'ED': 'ED',
    'ES': 'ES',
    'CDC': 'CDC',
    'CDCD': 'CDCD',
    'CDCS': 'CDCS',
    'CCD': 'CCD',
    'CCS': 'CCS',
    'COC': 'COC',
    'COD': 'COD',
    'COS': 'COS',
    'AD': 'AD',
    'AS': 'AS',
    'ATTD': 'ATTD',
    'ATTS': 'ATTS',
    'ATT': 'ATT'
  };
  return positionLabels[position] || position;
};

export default function MatchResultForm({ matchId, teamId, homeTeamName, awayTeamName, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState<Array<{
    playerId: string;
    goals: number;
    assists: number;
  }>>([]);
  const [isHomeTeam, setIsHomeTeam] = useState(false);
  const [formation, setFormation] = useState<Formation>('4-4-2');
  const [lineup, setLineup] = useState<{ [key: string]: string }>({});
  const [proofs, setProofs] = useState({
    playerList: '',
    result: '',
    stats: '',
    stream: ''
  });

  useEffect(() => {
    if (teamId) {
      fetchTeamPlayers();
      checkTeamSide();
    }
  }, [teamId]);

  const checkTeamSide = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('home_team_id')
        .eq('id', matchId)
        .single();

      if (error) throw error;
      setIsHomeTeam(data.home_team_id === teamId);
    } catch (error) {
      console.error('Error checking team side:', error);
    }
  };

  const fetchTeamPlayers = async () => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          captain:profiles!captain_id(id, username, game_id),
          team_members(
            profiles(id, username, game_id)
          )
        `)
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;

      if (teamData) {
        const captain = teamData.captain;
        const members = teamData.team_members.map((member: any) => member.profiles);
        
        const allPlayers = [captain, ...members].filter((player, index, self) => 
          player && index === self.findIndex(p => p?.id === player.id)
        );

        setPlayers(allPlayers);
      }
    } catch (error) {
      console.error('Error fetching team players:', error);
      toast.error('Errore nel caricamento dei giocatori');
    }
  };

  const handleFormationChange = (newFormation: Formation) => {
    setFormation(newFormation);
    setLineup({}); // Reset lineup completely when formation changes
  };

  const handlePlayerAssignment = (position: string, playerId: string) => {
    setLineup(prevLineup => {
      const newLineup = { ...prevLineup };

      // If clearing the position
      if (!playerId) {
        delete newLineup[position];
        return newLineup;
      }

      // Find if player is already assigned to another position
      const previousPosition = Object.entries(newLineup).find(([_, id]) => id === playerId)?.[0];
      
      // Remove player from previous position
      if (previousPosition) {
        delete newLineup[previousPosition];
      }

      // Assign player to new position
      newLineup[position] = playerId;
      return newLineup;
    });
  };

  const handleImageUpload = async (file: File, type: keyof typeof proofs) => {
    try {
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}.${fileExt}`;
      const filePath = `${matchId}/${teamId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('match-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('match-proofs')
        .getPublicUrl(filePath);

      setProofs(prev => ({
        ...prev,
        [type]: publicUrl
      }));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Errore nel caricamento dell\'immagine');
    }
  };

  const validateStep = (currentStep: number) => {
    switch (currentStep) {
      case 1:
        // Relaxed validation: require at least 1 player
        if (Object.keys(lineup).length === 0) {
          toast.error('Devi selezionare almeno un giocatore');
          return false;
        }
        return true;

      case 2:
        if (!proofs.playerList || !proofs.result || !proofs.stats) {
          toast.error('Devi caricare tutte le immagini richieste');
          return false;
        }
        return true;

      case 3:
        if (!proofs.stream) {
          toast.error('Devi inserire il link allo stream');
          return false;
        }
        return true;

      case 4:
        const teamScore = isHomeTeam ? homeScore : awayScore;
        const totalGoals = playerStats.reduce((sum, stat) => sum + stat.goals, 0);
        if (totalGoals > teamScore) {
          toast.error('Il totale dei gol dei giocatori non può superare il risultato della partita');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    
    setIsLoading(true);
    try {
      // Save lineup
      const { error: lineupError } = await supabase
        .from('match_lineups')
        .insert({
          match_id: matchId,
          team_id: teamId,
          formation,
          player_positions: lineup
        });

      if (lineupError) throw lineupError;

      // Save proofs
      const { error: proofsError } = await supabase
        .from('match_proofs')
        .insert({
          match_id: matchId,
          team_id: teamId,
          player_list_url: proofs.playerList,
          result_url: proofs.result,
          stats_url: proofs.stats,
          stream_url: proofs.stream
        });

      if (proofsError) throw proofsError;

      // Submit match result
      const { error: resultError } = await supabase
        .from('match_results')
        .insert({
          match_id: matchId,
          team_id: teamId,
          home_score: homeScore,
          away_score: awayScore,
        });

      if (resultError) throw resultError;

      // Submit player stats
      if (playerStats.length > 0) {
        const { error: statsError } = await supabase
          .from('match_player_stats')
          .insert(
            playerStats.map(stat => ({
              match_id: matchId,
              team_id: teamId,
              player_id: stat.playerId,
              goals: stat.goals,
              assists: stat.assists,
            }))
          );

        if (statsError) throw statsError;
      }

      toast.success('Risultato inviato con successo!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error submitting match result:', error);
      toast.error('Errore nell\'invio del risultato');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormation = () => {
    const config = FORMATIONS[formation];
    let currentIndex = 0;

    return (
      <div className="space-y-8">
        {config.layout.map((playersInRow, rowIndex) => (
          <div key={rowIndex} className="flex justify-center space-x-4">
            {Array.from({ length: playersInRow }).map((_, playerIndex) => {
              const position = config.positions[currentIndex];
              const playerId = lineup[position];
              currentIndex++;

              return (
                <div key={position} className="text-center">
                  <select
                    value={playerId || ''}
                    onChange={(e) => handlePlayerAssignment(position, e.target.value)}
                    className="w-40 px-2 py-1 bg-gray-700 rounded text-sm"
                  >
                    <option value="">Seleziona</option>
                    {players.map(player => (
                      <option
                        key={player.id}
                        value={player.id}
                        disabled={Object.values(lineup).includes(player.id) && lineup[position] !== player.id}
                      >
                        {player.username} ({player.game_id})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-gray-400">{getPositionLabel(position)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">
          {step === 1 && 'Formazione'}
          {step === 2 && 'Carica Prove'}
          {step === 3 && 'Link Stream'}
          {step === 4 && 'Statistiche Giocatori'}
        </h3>
        <div className="text-sm text-gray-400">
          Step {step} di 4
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Formazione
            </label>
            <select
              value={formation}
              onChange={(e) => handleFormationChange(e.target.value as Formation)}
              className="w-full px-3 py-2 bg-gray-700 rounded"
            >
              {Object.keys(FORMATIONS).map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-700 p-6 rounded-lg">
            {renderFormation()}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Screenshot Lista Giocatori
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'playerList')}
                className="hidden"
                id="playerList"
              />
              <label
                htmlFor="playerList"
                className="flex items-center justify-center px-4 py-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
              >
                <Upload size={20} className="mr-2" />
                Carica Immagine
              </label>
              {proofs.playerList && (
                <span className="text-green-500">✓ Caricato</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Screenshot Risultato Finale
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'result')}
                className="hidden"
                id="result"
              />
              <label
                htmlFor="result"
                className="flex items-center justify-center px-4 py-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
              >
                <Upload size={20} className="mr-2" />
                Carica Immagine
              </label>
              {proofs.result && (
                <span className="text-green-500">✓ Caricato</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Screenshot Statistiche
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'stats')}
                className="hidden"
                id="stats"
              />
              <label
                htmlFor="stats"
                className="flex items-center justify-center px-4 py-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
              >
                <Upload size={20} className="mr-2" />
                Carica Immagine
              </label>
              {proofs.stats && (
                <span className="text-green-500">✓ Caricato</span>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Link allo Stream
          </label>
          <input
            type="url"
            value={proofs.stream}
            onChange={(e) => setProofs(prev => ({ ...prev, stream: e.target.value }))}
            placeholder="https://"
            className="w-full px-3 py-2 bg-gray-700 rounded"
          />
          <p className="mt-2 text-sm text-gray-400">
            Inserisci il link al video della partita
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-right">{homeTeamName}</div>
            <div className="flex items-center justify-center space-x-2">
              <input
                type="number"
                min="0"
                value={homeScore}
                onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1 bg-gray-700 rounded text-center"
              />
              <span>-</span>
              <input
                type="number"
                min="0"
                value={awayScore}
                onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1 bg-gray-700 rounded text-center"
              />
            </div>
            <div>{awayTeamName}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Giocatore</label>
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded"
              >
                <option value="">Seleziona giocatore</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.username} ({player.game_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Goal</label>
                <input
                  type="number"
                  min="0"
                  value={goals}
                  onChange={(e) => setGoals(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Assist</label>
                <input
                  type="number"
                  min="0"
                  value={assists}
                  onChange={(e) => setAssists(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectedPlayer && (goals > 0 || assists > 0)) {
                setPlayerStats(prev => [...prev, { playerId: selectedPlayer, goals, assists }]);
                setSelectedPlayer('');
                setGoals(0);
                setAssists(0);
              }
            }}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded"
          >
            Aggiungi Statistiche
          </button>

          {playerStats.length > 0 && (
            <div className="space-y-2">
              {playerStats.map(stat => {
                const player = players.find(p => p.id === stat.playerId);
                return (
                  <div key={stat.playerId} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                    <div>
                      <span className="font-medium">{player?.username}</span>
                      <span className="text-sm text-gray-400 ml-2">({player?.game_id})</span>
                      <span className="text-sm text-gray-400 ml-2">
                        {stat.goals > 0 && `${stat.goals} goal`}
                        {stat.goals > 0 && stat.assists > 0 && ', '}
                        {stat.assists > 0 && `${stat.assists} assist`}
                      </span>
                    </div>
                    <button
                      onClick={() => setPlayerStats(prev => prev.filter(s => s.playerId !== stat.playerId))}
                      className="text-red-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between mt-6">
        {step > 1 ? (
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center"
          >
            <ArrowLeft size={20} className="mr-2" />
            Indietro
          </button>
        ) : (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Annulla
          </button>
        )}

        {step < 4 ? (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center"
          >
            Avanti
            <ArrowRight size={20} className="ml-2" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
          >
            {isLoading ? 'Invio in corso...' : 'Invia Risultato'}
          </button>
        )}
      </div>
    </div>
  );
}