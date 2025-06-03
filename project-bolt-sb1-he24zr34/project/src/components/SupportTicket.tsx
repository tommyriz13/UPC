import React, { useState, useEffect, useRef } from 'react';
import { Send, Upload, X, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface SupportTicketProps {
  ticketId: string;
  onClose: () => void;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  file_url?: string;
  file_type?: string;
  profiles: {
    username: string;
    role: string;
  };
}

export default function SupportTicket({ ticketId, onClose }: SupportTicketProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages();
    setupRealtimeSubscription();

    return () => {
      supabase.removeChannel('ticket-messages');
    };
  }, [ticketId]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          file_url,
          file_type,
          profiles (
            username,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error loading messages');
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('ticket-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        async (payload) => {
          const { data: messageData, error } = await supabase
            .from('ticket_messages')
            .select(`
              id,
              content,
              created_at,
              user_id,
              file_url,
              file_type,
              profiles (
                username,
                role
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (error) {
            console.error('Error fetching new message:', error);
            return;
          }

          if (messageData) {
            setMessages(prev => [...prev, messageData]);
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !ticketId || (!newMessage.trim() && !fileInputRef.current?.files?.length)) return;

    try {
      let fileUrl = '';
      let fileType = '';

      if (fileInputRef.current?.files?.length) {
        const file = fileInputRef.current.files[0];
        setIsUploading(true);

        // Validate file type
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (!isImage && !isVideo) {
          throw new Error('Only images and videos are allowed');
        }

        // Upload file
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `${timestamp}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-uploads')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-uploads')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileType = isImage ? 'image' : 'video';
      }

      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          content: newMessage.trim(),
          file_url: fileUrl || null,
          file_type: fileType || null,
        });

      if (error) throw error;
      setNewMessage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Error sending message');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const renderFileContent = (message: Message) => {
    if (!message.file_url) return null;

    if (message.file_type === 'image') {
      return (
        <img
          src={message.file_url}
          alt="Support ticket image"
          className="max-w-[300px] max-h-[300px] rounded-lg object-contain mt-2"
          onClick={() => window.open(message.file_url, '_blank')}
        />
      );
    }

    if (message.file_type === 'video') {
      return (
        <video
          controls
          className="max-w-[300px] max-h-[300px] rounded-lg mt-2"
        >
          <source src={message.file_url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      );
    }

    return (
      <a
        href={message.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 mt-2 block"
      >
        View attachment
      </a>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Support Ticket</h3>
          <p className="text-sm text-gray-400">
            We're here to help!
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${
              message.user_id === user?.id ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.user_id === user?.id
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700'
              }`}
            >
              <p className="text-sm font-medium mb-1">
                {message.profiles.username}
                {message.profiles.role === 'admin' && (
                  <span className="ml-2 text-xs bg-gray-600 px-2 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
              </p>
              {message.content && <p>{message.content}</p>}
              {renderFileContent(message)}
              <p className="text-xs text-gray-300 mt-1">
                {format(new Date(message.created_at), 'HH:mm', { locale: it })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 rounded-lg px-4 py-2"
          />
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            className="hidden"
            onChange={() => {}}
          />
          <button
            type="button"
            onClick={handleFileSelect}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              <Upload size={20} />
            )}
          </button>
          <button
            type="submit"
            disabled={isUploading || (!newMessage.trim() && !fileInputRef.current?.files?.length)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}