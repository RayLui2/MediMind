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
  title: string | null;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

class ChatService {

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

  // Delete conversation - NOT USED YET
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