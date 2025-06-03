import React, { useState, useEffect } from 'react';
import { MessageSquare, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SupportTicket from './SupportTicket';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface Ticket {
  id: string;
  user: {
    username: string;
  };
  created_at: string;
  last_message?: {
    content: string;
    created_at: string;
  };
}

export default function AdminTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
    const channel = setupRealtimeSubscription();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          id,
          created_at,
          user:profiles!support_tickets_user_id_fkey(username),
          last_message:ticket_messages(
            content,
            created_at
          )
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process the data to get the latest message
      const processedTickets = data?.map(ticket => ({
        ...ticket,
        last_message: ticket.last_message?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      }));

      setTickets(processedTickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Error loading tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
        },
        () => {
          fetchTickets();
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
          fetchTickets();
        }
      )
      .subscribe();

    return channel;
  };

  const handleResolveTicket = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', ticketId);

      if (error) throw error;

      toast.success('Ticket resolved successfully');
      setSelectedTicket(null);
      fetchTickets();
    } catch (error) {
      console.error('Error resolving ticket:', error);
      toast.error('Error resolving ticket');
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
    <div>
      <h2 className="text-xl font-semibold mb-6">Support Tickets</h2>

      {tickets.length === 0 ? (
        <p className="text-gray-400 text-center py-4">
          No open tickets at the moment
        </p>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium">{ticket.user.username}</h3>
                  <p className="text-sm text-gray-400">
                    Opened {format(new Date(ticket.created_at), 'dd MMM yyyy HH:mm', {
                      locale: it,
                    })}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedTicket(ticket.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <MessageSquare size={20} />
                    <span>View Ticket</span>
                  </button>
                  <button
                    onClick={() => handleResolveTicket(ticket.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Check size={20} />
                    <span>Resolve</span>
                  </button>
                </div>
              </div>
              {ticket.last_message && (
                <div className="bg-gray-600 rounded p-3 mt-2">
                  <p className="text-sm text-gray-300">{ticket.last_message.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(ticket.last_message.created_at), 'HH:mm', {
                      locale: it,
                    })}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl">
            <SupportTicket
              ticketId={selectedTicket}
              onClose={() => setSelectedTicket(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}