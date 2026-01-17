import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHAT_API_URL = 'https://vqejzddudqixhuqcqeqy.supabase.co/functions/v1/chat';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const chatApiKey = Deno.env.get('CHAT_API_KEY');
    if (!chatApiKey) {
      throw new Error('CHAT_API_KEY not configured');
    }

    const url = new URL(req.url);
    
    if (req.method === 'GET') {
      // Forward GET requests (get messages)
      const conversationId = url.searchParams.get('conversation_id');
      const visitorId = url.searchParams.get('visitor_id');
      
      let apiUrl = CHAT_API_URL;
      if (conversationId) {
        apiUrl += `?conversation_id=${conversationId}`;
      } else if (visitorId) {
        apiUrl += `?visitor_id=${visitorId}`;
      }
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${chatApiKey}`,
        },
      });
      
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (req.method === 'POST') {
      // Forward POST requests (send message)
      const body = await req.json();
      
      console.log('Sending chat message:', body);
      
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${chatApiKey}`,
        },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      console.log('Chat API response:', data);
      
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Chat proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
