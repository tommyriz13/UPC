import React, { useState, useEffect } from 'react';
import { Search, Save, Plus, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import CreateTeamModal from './CreateTeamModal';
import { useNavigate } from 'react-router-dom';

const positions = [
  'POR', 'TD/TS', 'DC', 'CDC', 'CC', 'COC', 'ES/ED', 'AS/AD', 'AT', 'ATT'
];

export default function UserProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isPositionDropdownOpen, setIsPositionDropdownOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    username: '',
    position: '',
    gameId: '',
    role: null as 'admin' | 'captain' | 'player' | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [teamData, setTeamData] = useState<{ id: string; name: string } | null>(null);
  const [captainRequest, setCaptainRequest] = useState(null);
  const [invitationCode, setInvitationCode] = useState('');
  const [currentTeam, setCurrentTeam] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfileData();
      fetchTeamData();
      fetchCaptainRequest();
      fetchCurrentTeam();
    }
  }, [user]);

  const fetchProfileData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, position, game_id, role')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfileData({
          username: data.username || '',
          position: data.position || '',
          gameId: data.game_id || '',
          role: data.role,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Errore nel caricamento del profilo');
    }
  };

  const fetchTeamData = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('captain_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setTeamData(data);
    } catch (error) {
      console.error('Error fetching team data:', error);
    }
  };

  const fetchCurrentTeam = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          team:teams (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setCurrentTeam(data?.team || null);
    } catch (error) {
      console.error('Error fetching current team:', error);
    }
  };

  const fetchCaptainRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('captain_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setCaptainRequest(data);
    } catch (error) {
      console.error('Error fetching captain request:', error);
    }
  };

  const filteredPositions = positions.filter(pos =>
    pos.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          position: profileData.position,
          game_id: profileData.gameId,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profilo aggiornato con successo!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Errore nell\'aggiornamento del profilo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBecomeCaptain = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('captain_requests')
        .insert({
          user_id: user.id,
          status: 'pending'
        });

      if (error) throw error;
      
      toast.success('Richiesta di diventare capitano inviata!');
      fetchCaptainRequest();
    } catch (error) {
      console.error('Error submitting captain request:', error);
      toast.error('Errore durante l\'invio della richiesta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!user || !invitationCode.trim()) return;

    setIsLoading(true);
    try {
      // First verify if the team exists
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', invitationCode)
        .single();

      if (teamError) throw new Error('Team non trovato');

      // Check if user is already in a team
      const { data: existingMembership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (existingMembership) {
        throw new Error('Sei già membro di un team');
      }

      // Join the team
      const { error: joinError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user.id
        });

      if (joinError) throw joinError;

      toast.success(`Ti sei unito al team ${team.name}!`);
      setInvitationCode('');
      fetchCurrentTeam();
    } catch (error: any) {
      console.error('Error joining team:', error);
      toast.error(error.message || 'Errore durante l\'unione al team');
    } finally {
      setIsLoading(false);
    }
  };

  const getCaptainStatusMessage = () => {
    if (profileData.role === 'captain') {
      return 'Sei un capitano';
    }
    if (captainRequest) {
      switch (captainRequest.status) {
        case 'pending':
          return 'Richiesta in attesa di approvazione';
        case 'rejected':
          return 'Richiesta rifiutata';
        default:
          return '';
      }
    }
    return '';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Profilo Utente</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Username Box */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Username</h2>
          <input
            type="text"
            value={profileData.username}
            disabled
            className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white opacity-75 cursor-not-allowed"
          />
          <p className="text-sm text-gray-400 mt-2">
            L'username non può essere modificato
          </p>
        </div>

        {/* Position Box */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Posizione</h2>
          <div className="relative">
            <div
              onClick={() => setIsPositionDropdownOpen(!isPositionDropdownOpen)}
              className="w-full bg-gray-700 rounded-lg px-4 py-2 cursor-pointer flex justify-between items-center"
            >
              <span>{profileData.position || 'Seleziona posizione'}</span>
              <Search size={20} className="text-gray-400" />
            </div>
            
            {isPositionDropdownOpen && (
              <div className="absolute w-full mt-2 bg-gray-700 rounded-lg shadow-lg z-10">
                <input
                  type="text"
                  placeholder="Cerca posizione..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-600 rounded-t-lg border-b border-gray-600"
                />
                <div className="max-h-48 overflow-y-auto">
                  {filteredPositions.map((pos) => (
                    <div
                      key={pos}
                      className="px-4 py-2 hover:bg-gray-600 cursor-pointer"
                      onClick={() => {
                        setProfileData({ ...profileData, position: pos });
                        setIsPositionDropdownOpen(false);
                        setSearchTerm('');
                      }}
                    >
                      {pos}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Game ID Box */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Game ID</h2>
          <input
            type="text"
            value={profileData.gameId}
            onChange={(e) => setProfileData({ ...profileData, gameId: e.target.value.slice(0, 25) })}
            maxLength={25}
            placeholder="Inserisci il tuo Game ID"
            className="w-full bg-gray-700 rounded-lg px-4 py-2"
          />
          <p className="text-sm text-gray-400 mt-2">
            {25 - (profileData.gameId?.length || 0)} caratteri rimanenti
          </p>
        </div>

        {/* Team Box */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Team</h2>
          {profileData.role === 'captain' ? (
            <div>
              {teamData ? (
                <div className="space-y-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-lg">{teamData.name}</h3>
                  </div>
                  <button
                    onClick={() => navigate('/team/manage')}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <span>Gestisci Squadra</span>
                    <ArrowRight size={20} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreateTeamModalOpen(true)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <Plus size={20} />
                  <span>Crea Team</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              {currentTeam ? (
                <div className="space-y-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-lg">{currentTeam.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">Membro del team</p>
                  </div>
                  <button
                    onClick={() => navigate('/team/view')}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <span>Visualizza Squadra</span>
                    <ArrowRight size={20} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Codice Invito
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={invitationCode}
                        onChange={(e) => setInvitationCode(e.target.value)}
                        placeholder="Inserisci il codice di invito"
                        className="flex-1 px-3 py-2 bg-gray-700 rounded-lg text-white"
                      />
                      <button
                        onClick={handleJoinTeam}
                        disabled={isLoading || !invitationCode.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        Unisciti
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <p className="text-gray-400 mb-4">
                      Diventa capitano per creare il tuo team
                    </p>
                    {captainRequest?.status === 'pending' ? (
                      <div className="bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-300">
                          Richiesta di diventare capitano in attesa di approvazione
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={handleBecomeCaptain}
                        disabled={isLoading || captainRequest?.status === 'pending'}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 w-full disabled:opacity-50"
                      >
                        <span>Diventa Capitano</span>
                      </button>
                    )}
                    {getCaptainStatusMessage() && (
                      <p className="text-sm text-gray-400 mt-2">
                        {getCaptainStatusMessage()}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
        >
          <Save size={20} />
          <span>{isLoading ? 'Salvataggio...' : 'Salva Modifiche'}</span>
        </button>
      </div>

      <CreateTeamModal
        isOpen={isCreateTeamModalOpen}
        onClose={() => setIsCreateTeamModalOpen(false)}
        onSuccess={() => {
          setIsCreateTeamModalOpen(false);
          fetchTeamData();
        }}
      />
    </div>
  );
}