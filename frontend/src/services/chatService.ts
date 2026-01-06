import axios from 'axios';
import authService from './authService';

const API_URL = 'http://localhost:8000';

interface Message {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  created_at: string;
}

interface Conversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

interface ChatResponse {
  user_message: Message;
  assistant_message: Message;
  conversation: Conversation;
}

interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onMetadata?: (metadata: { conversation_id: number; user_message_id: number; conversation_title: string }) => void;
}

class ChatService {
  // Send a message with streaming support
  async sendMessage(
    content: string,
    conversationId?: number,
    callbacks?: StreamCallbacks
  ): Promise<ChatResponse> {
    const token = authService.getToken();
    const url = `${API_URL}/chat/stream${conversationId ? `?conversation_id=${conversationId}` : ''}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let metadata: any = null;
    let fullText = '';
    let assistantMessageId: number | null = null;

    // Read stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'metadata') {
              metadata = data;
              console.log('📦 Metadata received:', data);
              if (callbacks?.onMetadata) {
                callbacks.onMetadata({
                  conversation_id: data.conversation_id,
                  user_message_id: data.user_message_id,
                  conversation_title: data.conversation_title
                });
              }
            } else if (data.type === 'chunk') {
              console.log('📨 Chunk received:', data.text);
              fullText += data.text;
              if (callbacks?.onChunk) {
                callbacks.onChunk(data.text);
              }
            } else if (data.type === 'complete') {
              console.log('✅ Stream complete, message ID:', data.assistant_message_id);
              assistantMessageId = data.assistant_message_id;
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }

    if (!metadata || assistantMessageId === null) {
      throw new Error('Invalid stream response');
    }

    // Build response in same format as before
    return {
      user_message: {
        id: metadata.user_message_id,
        conversation_id: metadata.conversation_id,
        role: 'user',
        content: content,
        created_at: new Date().toISOString()
      },
      assistant_message: {
        id: assistantMessageId,
        conversation_id: metadata.conversation_id,
        role: 'assistant',
        content: fullText,
        created_at: new Date().toISOString()
      },
      conversation: {
        id: metadata.conversation_id,
        user_id: 0, // Will be updated from backend if needed
        title: metadata.conversation_title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };
  }

  // Get all conversations
  async getConversations(): Promise<Conversation[]> {
    const token = authService.getToken();
    
    const response = await axios.get(`${API_URL}/chat/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data;
  }

  // Get specific conversation with messages
  async getConversation(conversationId: number): Promise<Conversation> {
    const token = authService.getToken();
    
    const response = await axios.get(`${API_URL}/chat/conversations/${conversationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data;
  }

  // Delete conversation
  async deleteConversation(conversationId: number): Promise<void> {
    const token = authService.getToken();
    
    await axios.delete(`${API_URL}/chat/conversations/${conversationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
}

export default new ChatService();