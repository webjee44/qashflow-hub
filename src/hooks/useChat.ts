import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChatMessage {
  id: string;
  content: string;
  sender_type: 'visitor' | 'admin';
  created_at: string;
}

export interface ChatConversation {
  id: string;
  visitor_id: string;
  visitor_name?: string;
  visitor_email?: string;
  status: string;
}

export function useChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Generate or get visitor ID
  const getVisitorId = useCallback(() => {
    if (user?.id) return user.id;
    
    let visitorId = localStorage.getItem('chat_visitor_id');
    if (!visitorId) {
      visitorId = `visitor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chat_visitor_id', visitorId);
    }
    return visitorId;
  }, [user]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    const visitorId = getVisitorId();
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('chat-proxy', {
        method: 'GET',
        body: undefined,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Use fetch directly for GET with query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-proxy?visitor_id=${visitorId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      const result = await response.json();
      
      if (result.messages) {
        setMessages(result.messages);
      }
      if (result.conversation) {
        setConversation(result.conversation);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getVisitorId]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    const visitorId = getVisitorId();
    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('chat-proxy', {
        body: {
          visitor_id: visitorId,
          visitor_name: user?.email?.split('@')[0] || 'Visiteur',
          visitor_email: user?.email,
          message: content,
          conversation_id: conversation?.id,
          sender_type: 'visitor',
        },
      });
      
      if (error) throw error;
      
      if (data?.message) {
        setMessages(prev => [...prev, data.message]);
      }
      if (data?.conversation) {
        setConversation(data.conversation);
      }
      
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [getVisitorId, user, conversation]);

  // Load messages on mount
  useEffect(() => {
    fetchMessages();
  }, []);

  return {
    messages,
    conversation,
    isLoading,
    isSending,
    sendMessage,
    fetchMessages,
  };
}
