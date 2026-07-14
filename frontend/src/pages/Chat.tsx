import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import chatService from '../services/chatService'
import ReactMarkdown from 'react-markdown'
import './Chat.css'
import authService from '../services/authService'

interface Message {
  id: number | string
  conversation_id: number
  role: string
  content: string
  created_at: string
}

interface Conversation {
  id: number
  user_id: number
  title: string | null
  created_at: string
  updated_at: string
  messages?: Message[]
}

const API_URL = 'http://localhost:8000';

const Chat: React.FC = () => {
  const { user } = useAuth()

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

    // Create temp ID for assistant message
    const tempAssistantId = `temp-${Date.now()}`

    try {
      // Add conversation ID to URL if it exists
      const conversationIdParam = currentConversation?.id 
        ? `?conversation_id=${currentConversation.id}` 
        : '';

      // Make fetch request
      const response = await fetch(`${API_URL}/chat/stream${conversationIdParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken() || ''}`,
        },
        body: JSON.stringify({ content: messageContent }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''
      let conversationId = currentConversation?.id || null
      let assistantMessageId: number | null = null
      let firstChunkReceived = false

      // Read stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'metadata') {
                console.log('📦 Metadata received:', data)
                conversationId = data.conversation_id

                // Update user message with real ID, but DON'T add assistant message yet
                // Keep the typing indicator visible until first chunk arrives
                setMessages((prev) => {
                  // Remove temp user message and replace with real one
                  const withoutTempUser = prev.filter(
                    (msg) => msg.id !== tempUserMessage.id
                  )

                  return [
                    ...withoutTempUser,
                    {
                      id: data.user_message_id,
                      conversation_id: data.conversation_id,
                      role: 'user',
                      content: messageContent,
                      created_at: new Date().toISOString(),
                    },
                  ]
                })
                // DON'T set loading to false here - keep typing indicator visible
              } else if (data.type === 'chunk') {
                console.log('📨 Chunk received:', data.text)
                accumulatedText += data.text

                // On first chunk, add assistant message and hide typing indicator
                if (!firstChunkReceived) {
                  firstChunkReceived = true
                  setLoading(false)

                  setMessages((prev) => [
                    ...prev,
                    {
                      id: tempAssistantId,
                      conversation_id: conversationId || 0,
                      role: 'assistant',
                      content: accumulatedText,
                      created_at: new Date().toISOString(),
                    },
                  ])
                } else {
                  // Subsequent chunks - update existing assistant message
                  setMessages((prev) => {
                    const updated = [...prev]
                    const assistantMsgIndex = updated.findIndex(
                      (msg) => msg.id === tempAssistantId
                    )
                    if (assistantMsgIndex !== -1) {
                      updated[assistantMsgIndex] = {
                        ...updated[assistantMsgIndex],
                        content: accumulatedText,
                      }
                    }
                    return updated
                  })
                }
              } else if (data.type === 'complete') {
                console.log('✅ Stream complete, message ID:', data.assistant_message_id)
                assistantMessageId = data.assistant_message_id

                // Update assistant message with real ID
                setMessages((prev) => {
                  const updated = [...prev]
                  const assistantMsgIndex = updated.findIndex(
                    (msg) => msg.id === tempAssistantId
                  )
                  if (assistantMsgIndex !== -1) {
                    updated[assistantMsgIndex] = {
                      ...updated[assistantMsgIndex],
                      id: data.assistant_message_id,
                    }
                  }
                  return updated
                })

                // Update current conversation
                setCurrentConversation({
                  id: data.conversation_id,
                  user_id: user?.id || 0,
                  title: data.conversation_title || 'New Conversation',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })

                // Reload conversations list
                loadConversations()
              } else if (data.type === 'error') {
                throw new Error(data.message)
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)

      // Remove the temporary messages on error
      setMessages((prev) =>
        prev.filter(
          (msg) => msg.id !== tempUserMessage.id && msg.id !== tempAssistantId
        )
      )

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
                            {convo.title || 'New Conversation'}
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
                  <div className="chat-message-content">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>
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
                  onKeyDown={handleKeyPress}
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
