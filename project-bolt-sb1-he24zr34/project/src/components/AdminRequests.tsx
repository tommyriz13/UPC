import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Request {
  id: string;
  type: 'captain' | 'team';
  status: string;
  created_at: string;
  user: {
    id: string;
    username: string;
  };
  team_name?: string;
  team_description?: string;
  team_logo_url?: string;
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
    setupRealtimeSubscription();
  }, []);

  const fetchRequests = async () => {
    try {
      // Fetch captain requests
      const { data: captainRequests, error: captainError } = await supabase
        .from('captain_requests')
        .select(`
          id,
          status,
          created_at,
          user:profiles!captain_requests_user_id_fkey (
            id,
            username
          )
        `)
        .eq('status', 'pending');

      if (captainError) throw captainError;

      // Fetch team requests
      const { data: teamRequests, error: teamError } = await supabase
        .from('team_requests')
        .select(`
          id,
          name,
          description,
          logo_url,
          status,
          created_at,
          captain:profiles!team_requests_captain_id_fkey (
            id,
            username
          )
        `)
        .eq('status', 'pending');

      if (teamError) throw teamError;

      // Combine and format requests
      const formattedRequests: Request[] = [
        ...(captainRequests?.map(req => ({
          ...req,
          type: 'captain' as const,
          user: {
            id: req.user.id,
            username: req.user.username
          }
        })) || []),
        ...(teamRequests?.map(req => ({
          ...req,
          type: 'team' as const,
          user: {
            id: req.captain.id,
            username: req.captain.username
          },
          team_name: req.name,
          team_description: req.description,
          team_logo_url: req.logo_url
        })) || [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Error loading requests');
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'captain_requests'
        },
        () => fetchRequests()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_requests'
        },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleApprove = async (request: Request) => {
    try {
      setIsLoading(true);

      if (request.type === 'captain') {
        // Update user role to captain
        const { error: roleError } = await supabase
          .rpc('update_user_role', {
            user_id: request.user.id,
            new_role: 'captain'
          });

        if (roleError) throw roleError;

        // Update request status
        const { error: requestError } = await supabase
          .from('captain_requests')
          .update({ status: 'approved' })
          .eq('id', request.id);

        if (requestError) throw requestError;

        toast.success('Captain request approved');
      } else {
        // Create new team
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .insert({
            name: request.team_name,
            description: request.team_description,
            logo_url: request.team_logo_url,
            captain_id: request.user.id
          })
          .select()
          .single();

        if (teamError) throw teamError;

        // Update request status
        const { error: requestError } = await supabase
          .from('team_requests')
          .update({ status: 'approved' })
          .eq('id', request.id);

        if (requestError) throw requestError;

        toast.success('Team request approved');
      }

      fetchRequests();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error(error.message || 'Error approving request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (request: Request) => {
    try {
      setIsLoading(true);

      if (request.type === 'captain') {
        const { error } = await supabase
          .from('captain_requests')
          .update({ status: 'rejected' })
          .eq('id', request.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('team_requests')
          .update({ status: 'rejected' })
          .eq('id', request.id);

        if (error) throw error;
      }

      toast.success('Request rejected');
      fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Error rejecting request');
    } finally {
      setIsLoading(false);
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
      <h2 className="text-xl font-semibold mb-6">Pending Requests</h2>

      {requests.length === 0 ? (
        <p className="text-center text-gray-400 py-4">
          No pending requests
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">{request.user.username}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      request.type === 'captain' ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {request.type === 'captain' ? 'Captain Request' : 'Team Request'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {format(new Date(request.created_at), 'dd MMM yyyy HH:mm', { locale: it })}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleApprove(request)}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Check size={20} />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleReject(request)}
                    disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                  >
                    <X size={20} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              {request.type === 'team' && (
                <div className="mt-4 bg-gray-600 rounded-lg p-3">
                  <h4 className="font-medium mb-2">Team Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Name</p>
                      <p>{request.team_name}</p>
                    </div>
                    {request.team_description && (
                      <div>
                        <p className="text-sm text-gray-400">Description</p>
                        <p>{request.team_description}</p>
                      </div>
                    )}
                  </div>
                  {request.team_logo_url && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-400 mb-1">Logo</p>
                      <img
                        src={request.team_logo_url}
                        alt="Team logo"
                        className="w-16 h-16 rounded object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}