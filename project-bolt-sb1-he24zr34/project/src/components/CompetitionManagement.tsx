import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Plus,
  Trash2,
  Settings,
  Calendar,
  Users2,
  ClipboardCheck,
  Edit2,
  Search,
  Shuffle,
  Save,
  Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const UNSCHEDULED_DATE = new Date('2025-01-01T00:00:00Z').toISOString();

const MATCH_TABLES: Record<CompetitionType, string> = {
  league: 'matches_league',
  champions: 'matches_champions',
  cup: 'matches_cup',
};

const STATS_TABLES: Record<CompetitionType, string> = {
  league: 'stats_league',
  champions: 'stats_champions',
  cup: 'stats_cup',
};

const STANDINGS_TABLES: Record<CompetitionType, string> = {
  league: 'standings_league',
  champions: 'standings_champions_groups',
  cup: '', // Cup doesn't have standings
};

type CompetitionType = 'league' | 'champions' | 'cup';

interface Edition {
  id: string;
  name: string;
  type: CompetitionType;
  status: string;
  bracket_slots?: any;
}

interface Team {
  id: string;
  name: string;
}

interface Match {
  id: string;
  home_team: { name: string };
  away_team: { name: string };
  home_score: number | null;
  away_score: number | null;
  scheduled_for: string;
  match_day: number;
  home_team_id: string;
  away_team_id: string;
  approved?: boolean;
  round?: number;
  leg?: number;
  stage?: string;
  group_name?: string;
  bracket_position?: {
    match_number: number;
    round: number;
  };
  match_results?: { id: string }[];
}

type ManagementTab = 'teams' | 'calendar' | 'results' | 'bracket';

const competitionTypes = [
  { value: 'league', label: 'Campionato' },
  { value: 'champions', label: 'Champions League' },
  { value: 'cup', label: 'Coppa' }
] as const;

const teamCountOptions: Record<CompetitionType, number[]> = {
  league: [4, 6, 8, 10, 12, 14, 16, 18, 20],
  champions: [8, 16, 20, 24, 28, 32, 36],
  cup: [8, 16, 32]
};

export default function CompetitionManagement() {
  const navigate = useNavigate();
  const [editions, setEditions] = useState<Edition[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<Edition | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'league' as CompetitionType,
    teamCount: 8,
  });
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [pendingResults, setPendingResults] = useState<Match[]>([]);
  const [newMatch, setNewMatch] = useState({
    date: '',
    homeTeamId: '',
    awayTeamId: '',
    matchDay: 1,
  });
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [createStep, setCreateStep] = useState(1);
  const [activeManagementTab, setActiveManagementTab] = useState<ManagementTab>('teams');
  const [bracketTeams, setBracketTeams] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchEditions();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedEdition?.type === 'cup') {
      setActiveManagementTab('bracket');
      fetchBracketTeams();
    }
  }, [selectedEdition]);

  useEffect(() => {
    if (activeManagementTab === 'results' && selectedEdition) {
      fetchPendingResults(selectedEdition.id, selectedEdition.type);
    }
  }, [activeManagementTab, selectedEdition]);

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
      toast.error('Error loading editions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAllTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchPendingResults = async (editionId: string, type: CompetitionType) => {
    try {
      // First get matches with their results
      const { data: matchData, error: matchError } = await supabase
        .from(MATCH_TABLES[type])
        .select(`
          id,
          home_team_id,
          away_team_id,
          scheduled_for,
          match_day,
          approved
        `)
        .eq('edition_id', editionId)
        .eq('approved', false);

      if (matchError) throw matchError;

      if (!matchData || matchData.length === 0) {
        setPendingResults([]);
        return;
      }

      // Get team names
      const teamIds = [...new Set([
        ...matchData.map(m => m.home_team_id),
        ...matchData.map(m => m.away_team_id)
      ])];

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      if (teamError) throw teamError;

      const teamMap = new Map(teamData?.map(t => [t.id, t.name]) || []);

      // Get match results for these matches
      const { data: resultData, error: resultError } = await supabase
        .from('match_results')
        .select('id, match_id, team_id')
        .in('match_id', matchData.map(m => m.id));

      if (resultError) throw resultError;

      const resultMap = new Map<string, any[]>();
      resultData?.forEach(result => {
        if (!resultMap.has(result.match_id)) {
          resultMap.set(result.match_id, []);
        }
        resultMap.get(result.match_id)?.push({
          id: result.id,
          team_id: result.team_id,
          teams: { name: teamMap.get(result.team_id) || 'Unknown' }
        });
      });

      // Transform matches with results
      const pending = matchData
        .filter(match => resultMap.has(match.id) && resultMap.get(match.id)!.length > 0)
        .map(match => ({
          id: match.id,
          home_team: { name: teamMap.get(match.home_team_id) || 'Unknown' },
          away_team: { name: teamMap.get(match.away_team_id) || 'Unknown' },
          home_score: null,
          away_score: null,
          scheduled_for: match.scheduled_for,
          match_day: match.match_day,
          home_team_id: match.home_team_id,
          away_team_id: match.away_team_id,
          approved: match.approved,
          match_results: resultMap.get(match.id) || []
        }));

      setPendingResults(pending);
    } catch (err) {
      console.error('Error fetching pending results:', err);
      setPendingResults([]);
    }
  };

  const fetchBracketTeams = async () => {
    if (!selectedEdition) return;

    try {
      // Get edition format settings
      const { data: editionData, error: editionError } = await supabase
        .from('editions')
        .select('bracket_slots')
        .eq('id', selectedEdition.id)
        .single();

      if (editionError) throw editionError;

      if (editionData?.bracket_slots) {
        setBracketTeams(editionData.bracket_slots);
      }

      setSelectedTeams([]);
    } catch (error) {
      console.error('Error fetching bracket teams:', error);
      toast.error('Error loading bracket teams');
    }
  };

  const handleCreateEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);

      // Create edition
      const { data: edition, error: editionError } = await supabase
        .from('editions')
        .insert({
          name: formData.name,
          type: formData.type,
          status: 'active'
        })
        .select()
        .single();

      if (editionError) throw editionError;

      toast.success('Edition created successfully!');
      setIsCreateModalOpen(false);
      setFormData({ name: '', type: 'league', teamCount: 8 });
      setSelectedTeams([]);
      setCreateStep(1);
      fetchEditions();
    } catch (error: any) {
      console.error('Error creating edition:', error);
      toast.error(error.message || 'Error creating edition');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEdition = async (id: string) => {
    try {
      const { error } = await supabase
        .from('editions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Edition deleted successfully!');
      fetchEditions();
    } catch (error) {
      console.error('Error deleting edition:', error);
      toast.error('Error deleting edition');
    }
  };

  const handleManageEdition = async (
    edition: Edition,
    e?: React.MouseEvent<HTMLButtonElement>
  ) => {
    e?.preventDefault();
    e?.stopPropagation();

    setSelectedEdition(edition);
    setIsManageModalOpen(true);

    await Promise.all([
      fetchTeams(),
      fetchMatches(edition.id, edition.type),
      fetchPendingResults(edition.id, edition.type),
    ]);
  };

  const fetchMatches = async (editionId: string, type: CompetitionType) => {
    try {
      const { data, error } = await supabase
        .rpc('get_edition_matches', {
          p_edition_id: editionId,
          p_edition_type: type
        });

      if (error) throw error;

      const transformed = (data || []).map((match: any) => ({
        id: match.id,
        home_team: { name: match.home_team_name },
        away_team: { name: match.away_team_name },
        home_score: match.home_score,
        away_score: match.away_score,
        scheduled_for: match.scheduled_for,
        match_day: match.match_day,
        approved: match.approved,
        home_team_id: match.home_team_id,
        away_team_id: match.away_team_id,
        round: match.round,
        leg: match.leg,
        stage: match.stage,
        group_name: match.group_name,
        bracket_position: match.bracket_position
      }));

      setMatches(transformed);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const handleTeamToggle = async (teamId: string) => {
    if (!selectedEdition) {
      // Selecting teams during creation
      if (selectedTeams.includes(teamId)) {
        setSelectedTeams(prev => prev.filter(id => id !== teamId));
      } else if (selectedTeams.length < formData.teamCount) {
        setSelectedTeams(prev => [...prev, teamId]);
      } else {
        toast.error(`Maximum ${formData.teamCount} teams allowed`);
      }
      return;
    }
    
    if (selectedTeams.includes(teamId)) {
      setSelectedTeams(prev => prev.filter(id => id !== teamId));
    } else if (selectedTeams.length < formData.teamCount) {
      setSelectedTeams(prev => [...prev, teamId]);
    } else {
      toast.error(`Maximum ${formData.teamCount} teams allowed`);
    }
  };

  const handleNext = () => {
    if (createStep === 1) {
      if (!formData.name.trim()) {
        toast.error('Please enter an edition name');
        return;
      }
      if (formData.type === 'league') {
        // For league, create directly without team selection
        handleCreateEdition(new Event('submit') as any);
        return;
      }
      setCreateStep(2);
    }
  };

  const handleRandomizeBracket = () => {
    const shuffledTeams = [...allTeams.map(t => t.id)].sort(() => Math.random() - 0.5);
    const newBracket: {[key: string]: string} = {};
    
    shuffledTeams.slice(0, formData.teamCount).forEach((teamId, index) => {
      newBracket[`slot_${index + 1}`] = teamId;
    });
    
    setBracketTeams(newBracket);
    setSelectedTeams(shuffledTeams.slice(0, formData.teamCount));
  };

  const handleAssignTeam = (slotId: string, teamId: string) => {
    setBracketTeams(prev => ({
      ...prev,
      [slotId]: teamId
    }));
  };

  const handleSaveBracket = async () => {
    if (!selectedEdition) return;

    try {
      setIsLoading(true);

      // Save bracket slots in the edition row
      const { error: formatError } = await supabase
        .from('editions')
        .update({ bracket_slots: bracketTeams })
        .eq('id', selectedEdition.id);

      if (formatError) throw formatError;

      const createdMatches: Match[] = [];
      const slotEntries = Object.entries(bracketTeams);

      for (let i = 0; i < slotEntries.length; i += 2) {
        const homeTeamId = slotEntries[i][1];
        const awayTeamId = slotEntries[i + 1]?.[1];
        const matchNumber = i / 2 + 1;
        if (!homeTeamId || !awayTeamId) continue;

        const existing = matches.find(
          m => m.round === 1 && m.bracket_position?.match_number === matchNumber
        );
        if (existing) continue;

        // first leg
        const { data: firstLeg, error: firstError } = await supabase
          .from(MATCH_TABLES[selectedEdition.type])
          .insert({
            edition_id: selectedEdition.id,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            match_day: 1,
            scheduled_for: UNSCHEDULED_DATE,
            status: 'scheduled',
            round: 1,
            leg: 1,
            bracket_position: { match_number: matchNumber, round: 1 }
          })
          .select()
          .single();

        if (firstError) throw firstError;

        // Get team names for display
        const { data: homeTeam } = await supabase.from('teams').select('name').eq('id', homeTeamId).single();
        const { data: awayTeam } = await supabase.from('teams').select('name').eq('id', awayTeamId).single();

        createdMatches.push({
          id: firstLeg.id,
          home_team: { name: homeTeam?.name || 'Unknown' },
          away_team: { name: awayTeam?.name || 'Unknown' },
          home_score: firstLeg.home_score,
          away_score: firstLeg.away_score,
          scheduled_for: firstLeg.scheduled_for,
          match_day: firstLeg.match_day,
          approved: firstLeg.approved,
          home_team_id: firstLeg.home_team_id,
          away_team_id: firstLeg.away_team_id,
          round: firstLeg.round,
          leg: firstLeg.leg,
          bracket_position: firstLeg.bracket_position
        });

        // second leg
        const { data: secondLeg, error: secondError } = await supabase
          .from(MATCH_TABLES[selectedEdition.type])
          .insert({
            edition_id: selectedEdition.id,
            home_team_id: awayTeamId,
            away_team_id: homeTeamId,
            match_day: 2,
            scheduled_for: UNSCHEDULED_DATE,
            status: 'scheduled',
            round: 1,
            leg: 2,
            bracket_position: { match_number: matchNumber, round: 1 }
          })
          .select()
          .single();

        if (secondError) throw secondError;

        createdMatches.push({
          id: secondLeg.id,
          home_team: { name: awayTeam?.name || 'Unknown' },
          away_team: { name: homeTeam?.name || 'Unknown' },
          home_score: secondLeg.home_score,
          away_score: secondLeg.away_score,
          scheduled_for: secondLeg.scheduled_for,
          match_day: secondLeg.match_day,
          approved: secondLeg.approved,
          home_team_id: secondLeg.home_team_id,
          away_team_id: secondLeg.away_team_id,
          round: secondLeg.round,
          leg: secondLeg.leg,
          bracket_position: secondLeg.bracket_position
        });
      }

      if (createdMatches.length > 0) {
        setMatches(prev => [...prev, ...createdMatches]);
      }

      toast.success('Bracket saved successfully');
    } catch (error) {
      console.error('Error saving bracket:', error);
      toast.error('Error saving bracket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setNewMatch({
      date: format(new Date(match.scheduled_for), "yyyy-MM-dd'T'HH:mm"),
      homeTeamId: match.home_team_id,
      awayTeamId: match.away_team_id,
      matchDay: match.match_day,
    });
    setActiveManagementTab('calendar');
  };

  const resetMatchForm = () => {
    setNewMatch({ date: '', homeTeamId: '', awayTeamId: '', matchDay: 1 });
    setEditingMatch(null);
  };

  const handleDeleteMatch = async (matchId: string) => {
    try {
      const { error } = await supabase
        .from(MATCH_TABLES[selectedEdition!.type])
        .delete()
        .eq('id', matchId);

      if (error) throw error;

      setMatches(prev => prev.filter(m => m.id !== matchId));
      if (editingMatch?.id === matchId) {
        resetMatchForm();
      }

      toast.success('Partita eliminata');
    } catch (err) {
      console.error('Error deleting match:', err);
      toast.error('Errore eliminazione');
    }
  };

  const handleSaveMatch = async () => {
    if (!selectedEdition) return;

    if (!newMatch.date || !newMatch.homeTeamId || !newMatch.awayTeamId) {
      toast.error('Compila tutti i campi');
      return;
    }

    try {
      setIsLoading(true);

      const iso = new Date(newMatch.date).toISOString();

      if (editingMatch) {
        const { data, error } = await supabase
          .from(MATCH_TABLES[selectedEdition.type])
          .update({
            scheduled_for: iso,
            home_team_id: newMatch.homeTeamId,
            away_team_id: newMatch.awayTeamId,
            match_day: newMatch.matchDay,
          })
          .eq('id', editingMatch.id)
          .select()
          .single();

        if (error) throw error;

        // Get team names for display
        const { data: homeTeam } = await supabase.from('teams').select('name').eq('id', data.home_team_id).single();
        const { data: awayTeam } = await supabase.from('teams').select('name').eq('id', data.away_team_id).single();

        const updatedMatch = {
          ...data,
          home_team: { name: homeTeam?.name || 'Unknown' },
          away_team: { name: awayTeam?.name || 'Unknown' }
        };

        setMatches(prev =>
          prev.map(m => (m.id === editingMatch.id ? updatedMatch : m))
        );
        toast.success('Partita aggiornata');
      } else {
        const { data, error } = await supabase
          .from(MATCH_TABLES[selectedEdition.type])
          .insert({
            edition_id: selectedEdition.id,
            home_team_id: newMatch.homeTeamId,
            away_team_id: newMatch.awayTeamId,
            match_day: newMatch.matchDay,
            scheduled_for: iso,
            status: 'scheduled',
          })
          .select()
          .single();

        if (error) throw error;

        // Get team names for display
        const { data: homeTeam } = await supabase.from('teams').select('name').eq('id', data.home_team_id).single();
        const { data: awayTeam } = await supabase.from('teams').select('name').eq('id', data.away_team_id).single();

        const newMatchData = {
          ...data,
          home_team: { name: homeTeam?.name || 'Unknown' },
          away_team: { name: awayTeam?.name || 'Unknown' }
        };

        setMatches(prev => [...prev, newMatchData]);
        toast.success('Partita aggiunta');
      }

      resetMatchForm();
    } catch (err) {
      console.error('Error saving match:', err);
      toast.error('Errore salvataggio');
    } finally {
      setIsLoading(false);
    }
  };

  const renderBracket = () => {
    if (!selectedEdition) return null;

    const totalSlots = formData.teamCount;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">Bracket Setup</h3>
          <div className="space-x-4">
            <button
              onClick={handleRandomizeBracket}
              className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Shuffle size={20} />
              <span>Randomize Teams</span>
            </button>
            <button
              onClick={handleSaveBracket}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
            >
              <Save size={20} />
              <span>{isLoading ? 'Saving...' : 'Save Bracket'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: totalSlots }, (_, i) => (
            <div key={`slot_${i + 1}`} className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Slot {i + 1}</span>
                <select
                  value={bracketTeams[`slot_${i + 1}`] || ''}
                  onChange={(e) => handleAssignTeam(`slot_${i + 1}`, e.target.value)}
                  className="bg-gray-600 rounded px-3 py-1"
                >
                  <option value="">Select Team</option>
                  {allTeams.map(team => (
                    <option 
                      key={team.id} 
                      value={team.id}
                      disabled={Object.values(bracketTeams).includes(team.id) && bracketTeams[`slot_${i + 1}`] !== team.id}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleUpdateMatchDate = async (matchId: string, date: string) => {
    try {
      const iso = new Date(date).toISOString();
      const { error } = await supabase
        .from(MATCH_TABLES[selectedEdition!.type])
        .update({ scheduled_for: iso })
        .eq('id', matchId);

      if (error) throw error;

      setMatches(prev =>
        prev.map(m => (m.id === matchId ? { ...m, scheduled_for: iso } : m))
      );
      toast.success('Data aggiornata');
    } catch (err) {
      console.error('Error updating match date:', err);
      toast.error('Errore aggiornamento');
    }
  };

  const renderCalendar = () => {
    const matchDays = Array.from(new Set(matches.map(m => m.match_day)));
    const label = selectedEdition?.type === 'league' ? 'Giornata' : 'Turno';

    return matchDays.map(day => (
      <div key={day} className="mb-6">
        <h5 className="font-medium mb-2">{label} {day}</h5>
        <div className="space-y-2">
          {matches
            .filter(m => m.match_day === day)
            .map(match => (
              <div
                key={match.id}
                className={`p-3 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0 ${match.approved ? 'bg-green-700' : 'bg-gray-700'}`}
              >
                <span>
                  {match.home_team.name} vs {match.away_team.name}
                  {match.scheduled_for === UNSCHEDULED_DATE && (
                    <span className="ml-2 text-yellow-400">⚠️</span>
                  )}
                  {match.approved && <span className="ml-2 text-green-300">✔️</span>}
                </span>
                <div className="flex items-center space-x-2">
                  <input
                    type="datetime-local"
                    value={format(new Date(match.scheduled_for), "yyyy-MM-dd'T'HH:mm")}
                    onChange={e => handleUpdateMatchDate(match.id, e.target.value)}
                    className="bg-gray-800 rounded px-2 py-1 text-white"
                    disabled={match.approved}
                  />
                  {!match.approved && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEditMatch(match)}
                        className="text-gray-300 hover:text-white"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMatch(match.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    ));
  };

  const renderCreateStep = () => {
    if (createStep === 1) {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tipo
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CompetitionType })}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg"
              required
            >
              {competitionTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Numero di Squadre
            </label>
            <select
              value={formData.teamCount}
              onChange={(e) => setFormData({ ...formData, teamCount: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg"
              required
            >
              {teamCountOptions[formData.type].map(count => (
                <option key={count} value={count}>
                  {count} squadre
                </option>
              ))}
            </select>
          </div>
        </>
      );
    }

    if (createStep === 2) {
      return (
        <>
          <h4 className="text-lg font-medium mb-4">Seleziona Squadre ({selectedTeams.length}/{formData.teamCount})</h4>
          
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Cerca squadra..."
              value={teamSearchTerm}
              onChange={(e) => setTeamSearchTerm(e.target.value)}
              className="w-full bg-gray-700 rounded-lg pl-10 pr-4 py-2"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allTeams
              .filter(team => 
                team.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
              )
              .map(team => (
                <div
                  key={team.id}
                  className="flex items-center justify-between bg-gray-700 rounded-lg p-3"
                >
                  <span>{team.name}</span>
                  <button
                    type="button"
                    onClick={() => handleTeamToggle(team.id)}
                    className={`px-3 py-1 rounded ${
                      selectedTeams.includes(team.id)
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    {selectedTeams.includes(team.id) ? 'Remove' : 'Add'}
                  </button>
                </div>
              ))
            }
          </div>
        </>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Gestione Edizioni</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Crea Edizione</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {editions.map(edition => (
          <div key={edition.id} className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center">
                <Trophy size={32} className="text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{edition.name}</h3>
                <span className="text-sm text-gray-400">
                  {competitionTypes.find(t => t.value === edition.type)?.label}
                </span>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={(e) => handleManageEdition(edition, e)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Settings size={18} />
                <span>Gestisci</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEdition(edition.id)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Edition Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {createStep === 1 ? 'Crea Edizione' : 'Seleziona Squadre'}
            </h3>
            
            <form onSubmit={handleCreateEdition} className="space-y-4">
              {renderCreateStep()}

              <div className="flex space-x-2">
                {createStep === 2 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setCreateStep(1)}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg"
                    >
                      Indietro
                    </button>
                    <button
                      type="submit"
                      disabled={selectedTeams.length !== formData.teamCount}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
                    >
                      Crea
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg"
                    >
                      {formData.type === 'league' ? 'Crea' : 'Avanti'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Edition Modal */}
      {isManageModalOpen && selectedEdition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Gestione {selectedEdition.name}</h3>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mb-6">
              <div className="flex space-x-4">
                {selectedEdition.type === 'cup' && (
                  <button
                    onClick={() => setActiveManagementTab('bracket')}
                    className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                      activeManagementTab === 'bracket' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <Settings size={20} />
                    <span>Bracket</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveManagementTab('calendar')}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                    activeManagementTab === 'calendar' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <Calendar size={20} />
                  <span>Calendario</span>
                </button>

                <button
                  onClick={() => setActiveManagementTab('results')}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                    activeManagementTab === 'results' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <ClipboardCheck size={20} />
                  <span>Risultati</span>
                </button>
              </div>
            </div>

            {activeManagementTab === 'bracket' && selectedEdition.type === 'cup' && (
              renderBracket()
            )}

            {activeManagementTab === 'calendar' && (
              <div>
                <h4 className="text-lg font-medium mb-4">Calendario</h4>
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                      type="datetime-local"
                      value={newMatch.date}
                      onChange={e => setNewMatch({ ...newMatch, date: e.target.value })}
                      className="bg-gray-700 rounded px-2 py-1 text-white"
                    />
                    <select
                      value={newMatch.homeTeamId}
                      onChange={e => setNewMatch({ ...newMatch, homeTeamId: e.target.value })}
                      className="bg-gray-700 rounded px-2 py-1"
                    >
                      <option value="">Squadra Casa</option>
                      {allTeams.map(team => (
                        <option key={team.id} value={team.id} disabled={team.id === newMatch.awayTeamId}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newMatch.awayTeamId}
                      onChange={e => setNewMatch({ ...newMatch, awayTeamId: e.target.value })}
                      className="bg-gray-700 rounded px-2 py-1"
                    >
                      <option value="">Squadra Trasferta</option>
                      {allTeams.map(team => (
                        <option key={team.id} value={team.id} disabled={team.id === newMatch.homeTeamId}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={newMatch.matchDay}
                      onChange={e => setNewMatch({ ...newMatch, matchDay: parseInt(e.target.value) })}
                      className="bg-gray-700 rounded px-2 py-1 text-white"
                    />
                  </div>
                  <div className="flex space-x-2">
                    {editingMatch && (
                      <button
                        type="button"
                        onClick={resetMatchForm}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
                      >
                        Annulla
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveMatch}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                    >
                      {editingMatch ? 'Salva' : 'Aggiungi'}
                    </button>
                  </div>
                </div>
                {renderCalendar()}
              </div>
            )}

            {activeManagementTab === 'results'&& (
              <div>
                <h4 className="text-lg font-medium mb-4">Risultati</h4>
                {pendingResults.length === 0 ? (
                  <p className="text-gray-400">Nessun risultato da verificare</p>
                ) : (
                  pendingResults.map(match => {
                    const submittedTeams = match.match_results.map((r: any) => r.teams.name);
                    const missing = [match.home_team.name, match.away_team.name].filter(n => !submittedTeams.includes(n));
                    const showVerify = match.match_results.length >= 2;
                    return (
                      <div
                        key={match.id}
                        className="bg-gray-700 rounded-lg p-4 mb-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">
                            {match.home_team.name} vs {match.away_team.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            Giornata {match.match_day} -{' '}
                            {format(new Date(match.scheduled_for), 'dd MMM yyyy HH:mm', { locale: it })}
                          </p>
                          {!showVerify && (
                            <p className="text-sm text-yellow-400 mt-1">
                              Risultato inviato da {submittedTeams.join(', ')}. In attesa di {missing.join(', ')}
                            </p>
                          )}
                        </div>
                        {showVerify && (
                          <button
                            onClick={() => navigate(`/verification-game/${match.id}`)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                          >
                            <Check size={20} />
                            <span>Verifica</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}