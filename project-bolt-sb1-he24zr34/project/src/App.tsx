import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Trophy, Users2, Globe2 } from 'lucide-react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import EmailVerificationSuccess from './components/EmailVerificationSuccess';
import UserProfile from './components/UserProfile';
import AdminDashboard from './components/AdminDashboard';
import TeamManagement from './components/TeamManagement';
import TeamView from './components/TeamView';
import TeamsList from './components/TeamsList';
import PlayersList from './components/PlayersList';
import PlayerProfile from './components/PlayerProfile';
import Competitions from './components/Competitions';
import CompetitionProfile from './components/CompetitionProfile';
import VerificationGame from './components/VerificationGame';
import LiveChats from './components/LiveChats';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import RequireProfile from './components/RequireProfile';
import SocialPosts from './components/SocialPosts';
import BannedPage from './components/BannedPage';

function App() {
  const navigate = useNavigate();
  const { isAuthModalOpen, setIsAuthModalOpen, user } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isBanned, setIsBanned] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const checkUserStatus = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('role, is_banned')
            .eq('id', user.id)
            .single();
          
          if (error) throw error;
          setIsAdmin(data?.role === 'admin');
          setIsBanned(data?.is_banned || false);

          // If user is banned, force redirect to banned page
          if (data?.is_banned) {
            navigate('/banned', { replace: true });
          }
        } catch (error) {
          console.error('Error checking user status:', error);
        }
      } else {
        setIsAdmin(false);
        setIsBanned(false);
      }
      setIsLoading(false);
    };

    checkUserStatus();

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user?.id}`,
        },
        (payload) => {
          const profile = payload.new;
          setIsAdmin(profile.role === 'admin');
          setIsBanned(profile.is_banned || false);
          
          // If user becomes banned, force redirect
          if (profile.is_banned) {
            navigate('/banned', { replace: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  // If user is banned, only allow access to the banned page
  if (user && isBanned) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        <Navbar />
        <Routes>
          <Route path="/banned" element={<BannedPage />} />
          <Route path="*" element={<Navigate to="/banned" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Navbar />
      
      <Routes>
        <Route path="/auth/callback/email-verified" element={<EmailVerificationSuccess />} />
        <Route path="/profile" element={
          user && !isAdmin ? <UserProfile /> : <Navigate to="/" replace />
        } />
        <Route path="/admin" element={
          isAdmin ? <AdminDashboard /> : <Navigate to="/" replace />
        } />
        <Route path="/verification-game/:matchId" element={
          isAdmin ? <VerificationGame /> : <Navigate to="/" replace />
        } />
        <Route path="/live-chats" element={
          user ? (
            <RequireProfile>
              <LiveChats />
            </RequireProfile>
          ) : <Navigate to="/" replace />
        } />
        <Route path="/team/manage" element={
          user ? (
            <RequireProfile>
              <TeamManagement />
            </RequireProfile>
          ) : <Navigate to="/" replace />
        } />
        <Route path="/team/:id" element={<TeamView />} />
        <Route path="/team/view" element={
          user ? (
            <RequireProfile>
              <TeamView />
            </RequireProfile>
          ) : <Navigate to="/" replace />
        } />
        <Route path="/teams" element={<TeamsList />} />
        <Route path="/players" element={<PlayersList />} />
        <Route path="/player/:id" element={<PlayerProfile />} />
        <Route path="/competitions" element={
          <RequireProfile>
            <Competitions />
          </RequireProfile>
        } />
        <Route path="/competitions/:id" element={<CompetitionProfile />} />
        <Route path="/banned" element={<BannedPage />} />
        <Route path="/" element={
          isAdmin ? <Navigate to="/admin" replace /> : (
            <RequireProfile>
              <main className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
                <div className="text-center">
                  <div className="mb-8">
                    <img 
                      src="https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?auto=format&fit=crop&w=200&h=200&q=80" 
                      alt="UPC Logo" 
                      className="mx-auto w-32 h-32 rounded-full shadow-lg"
                    />
                  </div>
                  
                  {!user && (
                    <button 
                      onClick={() => setIsAuthModalOpen(true)}
                      className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold mb-12 transition-colors"
                    >
                      Iscriviti ora
                    </button>
                  )}

                  <div className="space-y-4 w-full max-w-xs mx-auto mb-16">
                    <button 
                      onClick={() => navigate('/competitions')}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Trophy size={20} />
                      <span>Competizioni</span>
                    </button>
                    
                    <button 
                      onClick={() => navigate('/players')}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Users2 size={20} />
                      <span>Giocatori</span>
                    </button>
                    
                    <button 
                      onClick={() => navigate('/teams')}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Globe2 size={20} />
                      <span>Squadre</span>
                    </button>
                  </div>

                  <SocialPosts />
                </div>
              </main>
            </RequireProfile>
          )
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;