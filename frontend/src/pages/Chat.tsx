import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import chatService from '../services/chatService'
import './Chat.css'

interface Message {
  id: number
  conversation_id: number
  role: string
  content: string
  created_at: string
}

interface Conversation {
  id: number
  user_id: number
  title: string
  created_at: string
  updated_at: string
  messages?: Message[]
}

const Chat: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const loadConversations = async () => {
    try {
      const convos = await chatService.getConversations()
      setConversations(convos)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const loadConversation = async (conversationId: number) => {
    try {
      const convo = await chatService.getConversation(conversationId)
      setCurrentConversation(convo)
      setMessages(convo.messages || [])
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const messageContent = inputValue.trim()

    // Create temporary user message to show immediately
    const tempUserMessage: Message = {
      id: Date.now(), // Temporary ID
      conversation_id: currentConversation?.id || 0,
      role: 'user',
      content: messageContent,
      created_at: new Date().toISOString(),
    }

    // Show user message immediately (optimistic update)
    setMessages((prev) => [...prev, tempUserMessage])

    // Clear input immediately
    setInputValue('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Show typing indicator
    setLoading(true)

    try {
      const response = await chatService.sendMessage(
        messageContent,
        currentConversation?.id
      )

      // Replace temp message with real messages from server
      setMessages((prev) => {
        // Remove the temporary message
        const withoutTemp = prev.filter((msg) => msg.id !== tempUserMessage.id)
        // Add real messages from server
        return [
          ...withoutTemp,
          response.user_message,
          response.assistant_message,
        ]
      })

      // Update current conversation
      setCurrentConversation(response.conversation)

      // Reload conversations list
      loadConversations()
    } catch (error) {
      console.error('Failed to send message:', error)

      // Remove the temporary message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempUserMessage.id))

      alert('Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const startNewChat = () => {
    setCurrentConversation(null)
    setMessages([])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)

    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const groupConversationsByDate = () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const groups: { [key: string]: Conversation[] } = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Older: [],
    }

    conversations.forEach((convo) => {
      const convoDate = new Date(convo.updated_at)

      if (convoDate.toDateString() === today.toDateString()) {
        groups['Today'].push(convo)
      } else if (convoDate.toDateString() === yesterday.toDateString()) {
        groups['Yesterday'].push(convo)
      } else if (
        convoDate > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      ) {
        groups['This Week'].push(convo)
      } else {
        groups['Older'].push(convo)
      }
    })

    return groups
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const conversationGroups = groupConversationsByDate()

  return (
    <div className="chat-page">
      <div className="chat-main-container">
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <button className="chat-new-chat-btn" onClick={startNewChat}>
              + New Chat
            </button>
          </div>

          <div className="chat-conversations-list">
            {Object.entries(conversationGroups).map(
              ([groupName, groupConvos]) =>
                groupConvos.length > 0 && (
                  <div key={groupName} className="chat-conversation-group">
                    <div className="chat-conversation-group-title">
                      {groupName}
                    </div>
                    {groupConvos.map((convo) => (
                      <div
                        key={convo.id}
                        className={`chat-conversation-item ${
                          currentConversation?.id === convo.id ? 'active' : ''
                        }`}
                        onClick={() => loadConversation(convo.id)}
                      >
                        <div className="chat-conversation-icon">💬</div>
                        <div className="chat-conversation-content">
                          <div className="chat-conversation-title">
                            {convo.title}
                          </div>
                          <div className="chat-conversation-time">
                            {formatTime(convo.updated_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
            )}
          </div>
        </div>

        <main className="chat-main-area">
          <div className="chat-header">
            <div className="chat-title">
              {currentConversation?.title || 'New Conversation'}
            </div>
            <div className="chat-subtitle">
              AI-powered health assistant • Not a substitute for professional
              medical advice
            </div>
          </div>

          <div className="chat-messages-container">
            {messages.length === 0 && !loading && (
              <div className="chat-message assistant">
                <div className="chat-message-avatar">M</div>
                <div>
                  <div className="chat-message-content">
                    Hello! I'm MediMind, your AI healthcare assistant. I can
                    help you with questions about symptoms, medications, general
                    health information, and wellness tips. How can I assist you
                    today?
                  </div>
                  <div className="chat-message-time">
                    {new Date().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <div className="chat-message-avatar">
                  {message.role === 'assistant'
                    ? 'M'
                    : user?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="chat-message-content">{message.content}</div>
                  <div className="chat-message-time">
                    {formatTime(message.created_at)}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message assistant">
                <div className="chat-message-avatar">M</div>
                <div>
                  <div className="chat-message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder="Ask me anything about your health..."
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyPress={handleKeyPress}
                  rows={1}
                  disabled={loading}
                />
              </div>
              <button
                className="chat-send-btn"
                onClick={sendMessage}
                disabled={!inputValue.trim() || loading}
              >
                ➤
              </button>
            </div>
            <div className="chat-disclaimer">
              MediMind provides information only and is not a substitute for
              professional medical advice, diagnosis, or treatment.
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Chat
