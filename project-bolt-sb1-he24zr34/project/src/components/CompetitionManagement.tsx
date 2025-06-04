import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Trash2, Settings, Calendar, Users2, ClipboardCheck, Edit2, Search, Shuffle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

type CompetitionType = 'league' | 'champions' | 'cup';

interface Competition {
  id: string;
  name: string;
  image_url: string | null;
  type: CompetitionType;
  status: string;
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
}

type ManagementTab = 'teams' | 'calendar' | 'results' | 'bracket';

const competitionTypes = [
  { value: 'league', label: 'Campionato' },
  { value: 'champions', label: 'Champions League' },
  { value: 'cup', label: 'Coppa' }
] as const;

const teamCountOptions = {
  champions: [8, 16, 20, 24, 28, 32, 36],
  cup: [8, 16, 32]
};

export default function CompetitionManagement() {
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'league' as CompetitionType,
    image: null as File | null,
    teamCount: 8,
  });
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [createStep, setCreateStep] = useState(1);
  const [activeManagementTab, setActiveManagementTab] = useState<ManagementTab>('teams');
  const [bracketTeams, setBracketTeams] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchCompetitions();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedCompetition?.type === 'cup') {
      setActiveManagementTab('bracket');
      fetchBracketTeams();
    }
  }, [selectedCompetition]);

  const fetchCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompetitions(data || []);
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast.error('Error loading competitions');
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

  const fetchBracketTeams = async () => {
    if (!selectedCompetition) return;

    try {
      // Get competition format settings
      const { data: formatData, error: formatError } = await supabase
        .from('competition_format')
        .select('settings')
        .eq('competition_id', selectedCompetition.id)
        .single();

      if (formatError) throw formatError;

      if (formatData?.settings?.slots) {
        setBracketTeams(formatData.settings.slots);
      }

      // Get selected teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('competition_teams')
        .select('team_id')
        .eq('competition_id', selectedCompetition.id);

      if (teamsError) throw teamsError;
      setSelectedTeams(teamsData?.map(t => t.team_id) || []);
    } catch (error) {
      console.error('Error fetching bracket teams:', error);
      toast.error('Error loading bracket teams');
    }
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      let imageUrl = null;

      if (formData.image) {
        const timestamp = Date.now();
        const fileExt = formData.image.name.split('.').pop();
        const fileName = `${timestamp}.${fileExt}`;
        const filePath = `competitions/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('team-assets')
          .upload(filePath, formData.image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('team-assets')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      // Create competition
      const { data: competition, error: competitionError } = await supabase
        .from('competitions')
        .insert({
          name: formData.name,
          type: formData.type,
          image_url: imageUrl,
          status: 'in_corso'
        })
        .select()
        .single();

      if (competitionError) throw competitionError;

      // Create format settings
      const { error: formatError } = await supabase
        .from('competition_format')
        .insert({
          competition_id: competition.id,
          settings: {
            type: formData.type,
            teamCount: formData.teamCount,
            slots: {},
            ...(formData.type === 'cup' && {
              knockoutLegs: 2,
              finalLegs: 1
            })
          }
        });

      if (formatError) throw formatError;

      // Add selected teams
      if (selectedTeams.length > 0) {
        const { error: teamsError } = await supabase
          .from('competition_teams')
          .insert(
            selectedTeams.map(teamId => ({
              competition_id: competition.id,
              team_id: teamId
            }))
          );

        if (teamsError) throw teamsError;
      }

      toast.success('Competition created successfully!');
      setIsCreateModalOpen(false);
      setFormData({ name: '', type: 'league', image: null, teamCount: 8 });
      setSelectedTeams([]);
      setCreateStep(1);
      fetchCompetitions();
    } catch (error: any) {
      console.error('Error creating competition:', error);
      toast.error(error.message || 'Error creating competition');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCompetition = async (id: string) => {
    try {
      const { error } = await supabase
        .from('competitions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Competition deleted successfully!');
      fetchCompetitions();
    } catch (error) {
      console.error('Error deleting competition:', error);
      toast.error('Error deleting competition');
    }
  };

  const handleManageCompetition = async (competition: Competition) => {
    setSelectedCompetition(competition);
    await Promise.all([
      fetchTeams(),
      fetchCompetitionTeams(competition.id),
      fetchMatches(competition.id),
    ]);
    setIsManageModalOpen(true);
  };

  const fetchCompetitionTeams = async (competitionId: string) => {
    try {
      const { data, error } = await supabase
        .from('competition_teams')
        .select('team_id')
        .eq('competition_id', competitionId);

      if (error) throw error;
      setSelectedTeams(data.map(item => item.team_id));
    } catch (error) {
      console.error('Error fetching competition teams:', error);
    }
  };

  const fetchMatches = async (competitionId: string) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          home_score,
          away_score,
          scheduled_for,
          match_day,
          home_team_id,
          away_team_id
        `)
        .eq('competition_id', competitionId)
        .order('match_day', { ascending: true });

      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const handleTeamToggle = async (teamId: string) => {
    if (formData.type !== 'league') {
      // For Cup and Champions League, handle team selection during creation
      if (selectedTeams.includes(teamId)) {
        setSelectedTeams(prev => prev.filter(id => id !== teamId));
      } else if (selectedTeams.length < formData.teamCount) {
        setSelectedTeams(prev => [...prev, teamId]);
      } else {
        toast.error(`Maximum ${formData.teamCount} teams allowed`);
      }
      return;
    }

    if (!selectedCompetition) return;
    
    try {
      if (selectedTeams.includes(teamId)) {
        // Remove team
        const { error } = await supabase
          .from('competition_teams')
          .delete()
          .eq('competition_id', selectedCompetition.id)
          .eq('team_id', teamId);

        if (error) throw error;
        setSelectedTeams(prev => prev.filter(id => id !== teamId));
      } else {
        // Add team
        const { error } = await supabase
          .from('competition_teams')
          .insert({
            competition_id: selectedCompetition.id,
            team_id: teamId,
          });

        if (error) throw error;
        setSelectedTeams(prev => [...prev, teamId]);
      }
    } catch (error) {
      console.error('Error toggling team:', error);
      toast.error('Error managing teams');
    }
  };

  const handleNext = () => {
    if (createStep === 1) {
      if (!formData.name.trim()) {
        toast.error('Please enter a competition name');
        return;
      }
      if (formData.type !== 'league') {
        setCreateStep(2);
      } else {
        handleCreateCompetition(new Event('submit') as any);
      }
    }
  };

  const handleRandomizeBracket = () => {
    const shuffledTeams = [...selectedTeams].sort(() => Math.random() - 0.5);
    const newBracket: {[key: string]: string} = {};
    
    shuffledTeams.forEach((teamId, index) => {
      newBracket[`slot_${index + 1}`] = teamId;
    });
    
    setBracketTeams(newBracket);
  };

  const handleAssignTeam = (slotId: string, teamId: string) => {
    setBracketTeams(prev => ({
      ...prev,
      [slotId]: teamId
    }));
  };

  const handleSaveBracket = async () => {
    if (!selectedCompetition) return;

    try {
      setIsLoading(true);

      // Update competition format with new slot assignments
      const { error: formatError } = await supabase
        .from('competition_format')
        .update({
          settings: {
            type: 'cup',
            teamCount: selectedTeams.length,
            slots: bracketTeams,
            knockoutLegs: 2,
            finalLegs: 1
          }
        })
        .eq('competition_id', selectedCompetition.id);

      if (formatError) throw formatError;

      toast.success('Bracket saved successfully');
    } catch (error) {
      console.error('Error saving bracket:', error);
      toast.error('Error saving bracket');
    } finally {
      setIsLoading(false);
    }
  };

  const renderBracket = () => {
    if (!selectedCompetition) return null;

    const rounds = Math.log2(selectedTeams.length);
    const totalSlots = selectedTeams.length;

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
                  {selectedTeams.map(teamId => {
                    const team = allTeams.find(t => t.id === teamId);
                    if (!team) return null;
                    return (
                      <option 
                        key={team.id} 
                        value={team.id}
                        disabled={Object.values(bracketTeams).includes(team.id) && bracketTeams[`slot_${i + 1}`] !== team.id}
                      >
                        {team.name}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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

          {(formData.type === 'champions' || formData.type === 'cup') && (
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
                {teamCountOptions[formData.type as 'champions' | 'cup'].map(count => (
                  <option key={count} value={count}>
                    {count} squadre
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Immagine
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
              className="w-full"
            />
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
        <h2 className="text-xl font-semibold">Gestione Competizioni</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Crea Competizione</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {competitions.map(competition => (
          <div key={competition.id} className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-4 mb-4">
              {competition.image_url ? (
                <img
                  src={competition.image_url}
                  alt={competition.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center">
                  <Trophy size={32} className="text-gray-400" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-lg">{competition.name}</h3>
                <span className="text-sm text-gray-400">
                  {competitionTypes.find(t => t.value === competition.type)?.label}
                </span>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => handleManageCompetition(competition)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Settings size={18} />
                <span>Gestisci</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCompetition(competition.id)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Competition Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {createStep === 1 ? 'Crea Competizione' : 'Seleziona Squadre'}
            </h3>
            
            <form onSubmit={handleCreateCompetition} className="space-y-4">
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

      {/* Manage Competition Modal */}
      {isManageModalOpen && selectedCompetition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Gestione {selectedCompetition.name}</h3>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mb-6">
              <div className="flex space-x-4">
                {selectedCompetition.type === 'league' && (
                  <button
                    onClick={() => setActiveManagementTab('teams')}
                    className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                      activeManagementTab === 'teams' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <Users2 size={20} />
                    <span>Squadre</span>
                  </button>
                )}

                {selectedCompetition.type === 'cup' ? (
                  <button
                    onClick={() => setActiveManagementTab('bracket')}
                    className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                      activeManagementTab === 'bracket' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <Trophy size={20} />
                    <span>Bracket</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveManagementTab('calendar')}
                    className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                      activeManagementTab === 'calendar' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <Calendar size={20} />
                    <span>Calendario</span>
                  </button>
                )}

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

            {activeManagementTab === 'teams' && selectedCompetition.type === 'league' && (
              <div>
                <h4 className="text-lg font-medium mb-4">Squadre</h4>
                
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Cerca squadra..."
                    value={teamSearchTerm}
                    onChange={(e) => setTeamSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 rounded-lg pl-10 pr-4 py-2 text-white"
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                </div>

                <div className="space-y-2">
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
              </div>
            )}

            {activeManagementTab === 'bracket' && selectedCompetition.type === 'cup' && (
              renderBracket()
            )}

            {activeManagementTab === 'calendar' && selectedCompetition.type !== 'cup' && (
              <div>
                <h4 className="text-lg font-medium mb-4">Calendario</h4>
                {/* Calendar content */}
              </div>
            )}

            {activeManagementTab === 'results' && (
              <div>
                <h4 className="text-lg font-medium mb-4">Risultati</h4>
                {/* Results content */}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}