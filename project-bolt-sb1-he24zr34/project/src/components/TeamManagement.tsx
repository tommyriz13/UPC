import React, { useState, useEffect } from 'react';
import { Search, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface Team {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  captain_id: string | null;
}

export default function TeamManagement() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    description: '',
    logo: null as File | null,
  });
  const [members, setMembers] = useState<Array<{
    id: string;
    username: string | null;
    game_id: string | null;
  }>>([]);

  useEffect(() => {
    if (user) {
      checkUserRole();
    }
  }, [user]);

  const checkUserRole = async () => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      const userIsAdmin = profile?.role === 'admin';
      setIsAdmin(userIsAdmin);

      if (userIsAdmin) {
        fetchAllTeams();
      } else {
        fetchCaptainTeam();
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      toast.error('Error checking user role');
    }
  };

  const fetchAllTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Error loading teams');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCaptainTeam = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('captain_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setTeams([data]);
        await fetchTeamMembers(data.id);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
      toast.error('Error loading team data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          profiles (
            id,
            username,
            game_id
          )
        `)
        .eq('team_id', teamId);

      if (error) throw error;
      setMembers(data?.map(m => m.profiles) || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Error loading team members');
    }
  };

  const handleStartEdit = (team: Team) => {
    setSelectedTeam(team);
    setEditData({
      description: team.description || '',
      logo: null,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedTeam) return;
    setIsLoading(true);

    try {
      let logoUrl = selectedTeam.logo_url;

      if (editData.logo) {
        const timestamp = Date.now();
        const fileExt = editData.logo.name.split('.').pop();
        const fileName = `${timestamp}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('team-assets')
          .upload(filePath, editData.logo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('team-assets')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      }

      const { error: updateError } = await supabase
        .from('teams')
        .update({
          description: editData.description,
          logo_url: logoUrl,
        })
        .eq('id', selectedTeam.id);

      if (updateError) throw updateError;

      toast.success('Team updated successfully');
      setIsEditing(false);
      setSelectedTeam(null);
      
      // Refresh data
      if (isAdmin) {
        fetchAllTeams();
      } else {
        fetchCaptainTeam();
      }
    } catch (error) {
      console.error('Error updating team:', error);
      toast.error('Error updating team');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', selectedTeam.id)
        .eq('user_id', memberId);

      if (error) throw error;

      toast.success('Member removed successfully');
      await fetchTeamMembers(selectedTeam.id);
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Error removing team member');
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">
          {isAdmin ? 'Team Management' : 'Manage Your Team'}
        </h2>
        {isAdmin && (
          <div className="relative">
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 px-4 py-2 bg-gray-700 rounded-lg pl-10"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">
            {isAdmin ? 'No teams found' : 'You don\'t have a team to manage'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTeams.map((team) => (
            <div key={team.id} className="bg-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center space-x-4">
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center">
                      <Upload size={24} className="text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{team.name}</h3>
                    <p className="text-gray-400">{team.description || 'No description'}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleStartEdit(team)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                >
                  Edit Team
                </button>
              </div>

              {!isAdmin && (
                <div>
                  <h4 className="font-medium mb-4">Team Members</h4>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="bg-gray-600 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{member.username}</p>
                          {member.game_id && (
                            <p className="text-sm text-gray-400">{member.game_id}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isAdmin && (
                <div className="mt-6 p-4 bg-gray-600 rounded-lg">
                  <h4 className="font-medium mb-2">Team Invite Code</h4>
                  <div className="bg-gray-700 p-3 rounded break-all font-mono text-sm">
                    {team.id}
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Share this code with players to let them join your team
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Edit Team</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={selectedTeam.name}
                  disabled
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg opacity-50 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg h-32 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Team Logo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditData({ ...editData, logo: e.target.files?.[0] || null })}
                  className="w-full"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedTeam(null);
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}