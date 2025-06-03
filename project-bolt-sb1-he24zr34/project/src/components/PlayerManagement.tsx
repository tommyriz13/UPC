import React, { useState, useEffect } from 'react';
import { Search, Ban, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface User {
  id: string;
  username: string;
  is_banned: boolean;
  updated_at: string;
}

export default function PlayerManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, is_banned, updated_at')
        .order('username');

      if (profilesError) throw profilesError;

      setUsers(profiles || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Errore nel caricamento degli utenti');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBanUser = async (user: User) => {
    try {
      setIsLoading(true);
      const newBanStatus = !user.is_banned;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_banned: newBanStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, is_banned: newBanStatus } : u
      ));

      toast.success(`Utente ${newBanStatus ? 'bannato' : 'sbloccato'} con successo`);
      setIsConfirmModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating user ban status:', error);
      toast.error('Errore durante l\'aggiornamento dello stato dell\'utente');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <h2 className="text-xl font-semibold mb-6">Gestione Giocatori</h2>

      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Cerca per username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-700 rounded-lg px-4 py-3 pl-12"
        />
        <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
      </div>

      <div className="bg-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800">
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Username</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Data Registrazione</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Stato</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-300">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-650">
                  <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(new Date(user.updated_at), 'dd MMM yyyy HH:mm', { locale: it })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_banned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {user.is_banned ? 'Bannato' : 'Attivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setIsConfirmModalOpen(true);
                      }}
                      className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${
                        user.is_banned
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {user.is_banned ? (
                        <>
                          <Check size={16} className="mr-1" />
                          <span>Sblocca</span>
                        </>
                      ) : (
                        <>
                          <Ban size={16} className="mr-1" />
                          <span>Banna</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">
              {selectedUser.is_banned ? 'Sblocca Utente' : 'Banna Utente'}
            </h3>
            <p className="text-gray-300 mb-6">
              Sei sicuro di voler {selectedUser.is_banned ? 'sbloccare' : 'bannare'} l'utente{' '}
              <span className="font-semibold">{selectedUser.username}</span>?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={() => handleBanUser(selectedUser)}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg ${
                  selectedUser.is_banned
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {isLoading ? 'In corso...' : (selectedUser.is_banned ? 'Sblocca' : 'Banna')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}