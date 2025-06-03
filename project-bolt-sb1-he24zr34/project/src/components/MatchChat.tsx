import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Upload, Image, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface MatchChatProps {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  onClose?: () => void;
  isAdmin?: boolean;
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  file_url?: string;
  file_type?: string;
  profiles: {
    username: string;
  };
}

export default function MatchChat({ matchId, homeTeamName, awayTeamName, onClose, isAdmin }: MatchChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchChatData();
    return () => {
      if (chatId) {
        supabase.removeChannel('chat-channel');
      }
    };
  }, [matchId]);

  useEffect(() => {
    if (chatId) {
      setupRealtimeSubscription();
      updateReadStatus();
    }
  }, [chatId]);

  const fetchChatData = async () => {
    try {
      const { data: chatData, error: chatError } = await supabase
        .from('match_chats')
        .select('id')
        .eq('match_id', matchId)
        .single();

      if (chatError) throw chatError;
      if (!chatData) throw new Error('Chat not found');

      setChatId(chatData.id);

      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          file_url,
          file_type,
          profiles (
            username
          )
        `)
        .eq('chat_id', chatData.id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);
      scrollToBottom();
    } catch (error: any) {
      console.error('Error fetching chat data:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('chat-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const { data: messageData, error } = await supabase
            .from('chat_messages')
            .select(`
              id,
              content,
              created_at,
              user_id,
              file_url,
              file_type,
              profiles (
                username
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (error) {
            console.error('Error fetching new message data:', error);
            return;
          }

          if (messageData) {
            setMessages(prev => [...prev, messageData]);
            scrollToBottom();
            if (messageData.user_id !== user?.id) {
              updateReadStatus();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const updateReadStatus = async () => {
    if (!user || !chatId) return;

    try {
      const { error } = await supabase
        .from('chat_read_status')
        .upsert({
          user_id: user.id,
          chat_id: chatId,
          last_read_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating read status:', error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chatId || (!newMessage.trim() && !fileInputRef.current?.files?.length)) return;

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

        const { error: uploadError, data } = await supabase.storage
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
        .from('chat_messages')
        .insert({
          chat_id: chatId,
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

  const renderFileContent = (message: ChatMessage) => {
    if (!message.file_url) return null;

    if (message.file_type === 'image') {
      return (
        <img
          src={message.file_url}
          alt="Chat image"
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

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Match Chat</h3>
          <p className="text-sm text-gray-400">
            {homeTeamName} vs {awayTeamName}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
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