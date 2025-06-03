import React, { useState, useRef, useEffect } from 'react';
import { UserCircle, LogOut, MessageSquare, LifeBuoy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SupportTicket from './SupportTicket';

const Navbar = () => {
  const { user, setIsAuthModalOpen, signOut } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    if (user) {
      checkUserRole();
      fetchUnreadCount();
      fetchUnreadTickets();
      channel = setupRealtimeSubscription();
    }
    
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_unread_message_count', {
          p_user_id: user.id
        });

      if (error) throw error;
      setUnreadCount(data || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchUnreadTickets = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_unread_ticket_count', {
          p_user_id: user.id
        });

      if (error) throw error;
      setUnreadTickets(data || 0);
    } catch (error) {
      console.error('Error fetching unread tickets:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`notifications-${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
        },
        () => {
          fetchUnreadTickets();
        }
      )
      .subscribe();

    return channel;
  };

  const handleAuthClick = () => {
    if (user) {
      setIsProfileOpen(!isProfileOpen);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleTicketClick = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      // Check for existing open ticket using maybeSingle() instead of single()
      const { data: existingTicket, error: ticketError } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (ticketError) {
        throw ticketError;
      }

      if (existingTicket) {
        setTicketId(existingTicket.id);
      } else {
        // Create new ticket
        const { data: newTicket, error: createError } = await supabase
          .from('support_tickets')
          .insert({
            user_id: user.id,
            status: 'open'
          })
          .select()
          .single();

        if (createError) throw createError;
        setTicketId(newTicket.id);
      }

      setIsTicketOpen(true);
    } catch (error) {
      console.error('Error handling ticket:', error);
    }
  };

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
            <img 
              src="https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?auto=format&fit=crop&w=40&h=40&q=80" 
              alt="UPC Logo" 
              className="w-8 h-8"
            />
            <span className="ml-2 text-xl font-bold text-red-500">UPC League Italia</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {user && !isAdmin && (
              <>
                <button
                  onClick={handleTicketClick}
                  className="text-gray-300 hover:text-white flex items-center space-x-2"
                >
                  <LifeBuoy size={20} />
                  <span>Support</span>
                  {unreadTickets > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {unreadTickets > 9 ? '9+' : unreadTickets}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => navigate('/live-chats')}
                  className="text-gray-300 hover:text-white flex items-center space-x-2"
                >
                  <MessageSquare size={20} />
                  <span>Live Chats</span>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {user ? (
              <button 
                onClick={handleAuthClick}
                className="text-gray-300 hover:text-white flex items-center space-x-2 cursor-pointer"
              >
                <UserCircle size={24} />
                <span className="text-sm">{user.email}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="text-gray-300 hover:text-white"
              >
                <UserCircle size={24} />
              </button>
            )}
          </div>

          {isProfileOpen && user && (
            <div 
              ref={dropdownRef}
              className="absolute right-4 top-16 w-48 bg-gray-800 rounded-lg shadow-lg py-1 z-50"
            >
              <div className="px-4 py-2 border-b border-gray-700">
                <p className="text-sm text-gray-300 truncate">{user.email}</p>
              </div>
              <button
                onClick={() => {
                  navigate('/profile');
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Profilo Utente
              </button>
              <button
                onClick={() => {
                  signOut();
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center space-x-2"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isTicketOpen && ticketId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl">
            <SupportTicket
              ticketId={ticketId}
              onClose={() => setIsTicketOpen(false)}
            />
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;