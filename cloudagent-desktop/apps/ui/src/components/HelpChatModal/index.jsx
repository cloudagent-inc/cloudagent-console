import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronDown, Send, Menu, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icons } from '../icons';
import DiagramChatPreview from '../DiagramChatPreview';
import Markdown from 'markdown-to-jsx';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  listRecentChats,
  startChat as startChatThunk,
  appendChatMessages as appendChatMessagesThunk,
  getChatRecord,
  setCurrentChatId,
} from '@/features/chat/chatSlice';
import { sendChatMessage } from '@/api/chatApi';
import { agentRunsClient } from '@/api/clients/agentRunsClient';
import { toLogObject } from '@/helpers/logUtils';



// Returns a user-friendly label for a given tool and state
const getToolStatusLabel = (toolName, isActive) => {
  switch (toolName) {
    case 'permission_profile_list':
      return 'Fetching Permission Profiles';
    case 'cli_session_execute':
      return 'Running CLI Session Command';
    case 'azure_cli_readonly':
      return 'Running Azure CLI (Read-Only Mode)';
    case 'aws_cfn_operations':
      return 'Accessing AWS CloudFormation';
    case 'list_workloads':
      return 'Fetching Workloads';
    case 'update_workload':
      return 'Updating Workload';
    case 'architecture_templates':
        return 'Reviewing Reference Architectures';
    case 'get_deployment_preferences_summary':
        return 'Reviewing Deployment Preferences';
    case 'list_report_history':
      return 'Listing Reports';
    case 'prepare_report_file':
      return isActive ? 'Loading Report for Analysis' : 'Report Ready for Analysis';
    case 'diagram_spec':
      return isActive ? 'Building Diagram' : 'Diagram Ready';
    case 'run_blueprint_background':
    case 'run_skill_background':
      return isActive ? 'Starting Skill Run' : 'Skill Run Started';
    case 'list_blueprints':
    case 'list_skills':
      return isActive ? 'Listing Skills' : 'Skills Listed';
    default:
      return isActive ? `Using ${toolName}...` : `Used ${toolName}`;
  }
};

const HelpChatModal = ({ onClose, initialMessage = '', autoSendMessage = '' }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [message, setMessage] = useState(initialMessage);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: '',
      timestamp: new Date()
    }
  ]);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  const [lastResponseId, setLastResponseId] = useState(null);
  const [blueprintRunStatus, setBlueprintRunStatus] = useState({});
  const lastAutoSentRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const recentChatIds = useSelector(state => state.chat?.recentChatIds || []);
  const chatsById = useSelector(state => state.chat?.chatsById || {});
  const { isAuthenticated, loading } = useSelector(state => state.auth);

  const splitDiagramBlocks = (content) => {
    if (!content) return [{ type: 'text', content: '' }];
    const START_TOKEN = '<<CLOUD_DIAGRAM_SPEC>>';
    const END_TOKEN = '<<END_CLOUD_DIAGRAM_SPEC>>';
    const segments = [];
    let cursor = 0;

    while (cursor < content.length) {
      const startIndex = content.indexOf(START_TOKEN, cursor);
      if (startIndex === -1) {
        segments.push({ type: 'text', content: content.slice(cursor) });
        break;
      }

      if (startIndex > cursor) {
        segments.push({ type: 'text', content: content.slice(cursor, startIndex) });
      }

      const endIndex = content.indexOf(END_TOKEN, startIndex + START_TOKEN.length);
      if (endIndex === -1) {
        segments.push({ type: 'diagram_pending' });
        break;
      }

      const raw = content.slice(startIndex + START_TOKEN.length, endIndex).trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.spec) {
            segments.push({ type: 'diagram', payload: parsed });
          } else {
            segments.push({ type: 'diagram_error' });
          }
        } catch {
          segments.push({ type: 'diagram_error' });
        }
      } else {
        segments.push({ type: 'diagram_error' });
      }

      cursor = endIndex + END_TOKEN.length;
    }

    return segments;
  };

  const splitBlueprintBlocks = (content) => {
    if (!content) return [{ type: 'text', content: '' }];
    const START_TOKEN = '<<BLUEPRINT_RUN>>';
    const END_TOKEN = '<<END_BLUEPRINT_RUN>>';
    const segments = [];
    let cursor = 0;

    while (cursor < content.length) {
      const startIndex = content.indexOf(START_TOKEN, cursor);
      if (startIndex === -1) {
        segments.push({ type: 'text', content: content.slice(cursor) });
        break;
      }

      if (startIndex > cursor) {
        segments.push({ type: 'text', content: content.slice(cursor, startIndex) });
      }

      const endIndex = content.indexOf(END_TOKEN, startIndex + START_TOKEN.length);
      if (endIndex === -1) {
        segments.push({ type: 'blueprint_pending' });
        break;
      }

      const raw = content.slice(startIndex + START_TOKEN.length, endIndex).trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            segments.push({ type: 'blueprint_run', payload: parsed });
          } else {
            segments.push({ type: 'blueprint_error' });
          }
        } catch {
          segments.push({ type: 'blueprint_error' });
        }
      } else {
        segments.push({ type: 'blueprint_error' });
      }

      cursor = endIndex + END_TOKEN.length;
    }

    return segments;
  };

  const deriveBlueprintStatus = (record) => {
    const logData = toLogObject(record?.log);
    const logs = Array.isArray(logData.logs) ? logData.logs : [];
    const status = record?.status || logs[logs.length - 1]?.status || 'pending';
    const currentPhase = Number.isFinite(logData.currentPhase) ? logData.currentPhase : null;
    const currentTask = Number.isFinite(logData.currentTask) ? logData.currentTask : null;
    let entry = null;
    if (currentPhase != null && currentTask != null) {
      entry = logs.find((log) => log.phaseIndex === currentPhase && log.taskIndex === currentTask) || null;
    }
    if (!entry && logs.length) entry = logs[logs.length - 1];
    const message =
      status === 'waiting_on_user_input'
        ? (entry?.output || entry?.task_output || '')
        : '';
    return {
      status,
      message,
      lastUpdated: logData.lastUpdated || null,
      title: record?.title || null
    };
  };

  const fetchBlueprintRunStatus = useCallback(async (recordId) => {
    if (!recordId) return;
    setBlueprintRunStatus((prev) => ({
      ...prev,
      [recordId]: { ...(prev[recordId] || {}), loading: true }
    }));
    try {
      const record = await agentRunsClient.get(recordId);
      const derived = deriveBlueprintStatus(record);
      setBlueprintRunStatus((prev) => ({
        ...prev,
        [recordId]: { ...(prev[recordId] || {}), ...derived, loading: false }
      }));
    } catch (error) {
      setBlueprintRunStatus((prev) => ({
        ...prev,
        [recordId]: {
          ...(prev[recordId] || {}),
          loading: false,
          error: error?.message || String(error)
        }
      }));
    }
  }, []);

  const buildConversationTitle = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${month}-${day}-${year} ${hours}:${minutes}`;
  };

  const showQuickTips = messages.length === 1 && messages[0]?.type === 'assistant';

  const closeModal = () => {
    if (onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };

  // Generate a unique session ID
  const generateSessionId = () => {
    return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Initialize session on component mount
  useEffect(() => {
    if (!sessionId) {
      setSessionId(generateSessionId());
    }
  }, [sessionId]);

  // Load recent chats when modal opens (only if authenticated)
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      dispatch(listRecentChats({ limit: 10 }));
    }
  }, [isOpen, isAuthenticated, dispatch]);

  // Fetch chat list when history pane is opened (only if authenticated)
  useEffect(() => {
    if (isHistoryVisible && isAuthenticated) {
      dispatch(listRecentChats({ limit: 50 }));
    }
  }, [isHistoryVisible, isAuthenticated, dispatch]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Observe recent chat ids/state to verify list results
  useEffect(() => {
    const count = Array.isArray(recentChatIds) ? recentChatIds.length : 0;
  }, [recentChatIds]);

  // Auto-send initial message if provided
  const initialMessageSentRef = React.useRef(false);
  useEffect(() => {
    if (initialMessage && initialMessage.trim() && !initialMessageSentRef.current && isAuthenticated && !loading) {
      initialMessageSentRef.current = true;
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        handleSendMessage();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [initialMessage, isAuthenticated, loading]);

  // Auto-focus input when modal opens (authenticated users only)
  useEffect(() => {
    if (isOpen && isAuthenticated && !loading && !initialMessage) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isAuthenticated, loading, initialMessage]);

  // Start a new chat session
  const handleNewChat = () => {
    setMessages([
      {
        id: 1,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        tools: [],
        activeTools: []
      }
    ]);
    setMessage('');
    setCurrentRecordId(null);
    setLastResponseId(null);

    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    dispatch(startChatThunk({ sessionId: newSessionId, title: buildConversationTitle(), metadata: { source: 'HelpChatModal' } }))
      .unwrap()
      .then(chat => {
        setCurrentRecordId(chat.recordId);
        dispatch(setCurrentChatId(chat.recordId));
        // Focus input after new chat is created
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      })
      .catch(() => {});
  };

  const sendMessage = useCallback(async (rawMessage) => {
    const trimmed = (rawMessage || '').trim();
    if (!trimmed || isLoading) return;
    if (rawMessage === message) {
      setMessage('');
    }
    const userMessage = trimmed;
    setIsLoading(true);
    const nextSessionId = sessionId || generateSessionId();
    if (!sessionId) {
      setSessionId(nextSessionId);
    }
    // Add user message to chat
    const userMessageObj = {
      id: messages.length + 1,
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessageObj]);

    // Create a placeholder message for streaming updates
    const assistantMessageId = messages.length + 2;
    const initialAssistantMessage = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      tools: [],
      activeTools: []
    };
    
    setMessages(prev => [...prev, initialAssistantMessage]);

    try {
      // Ensure a backend chat record exists before sending
      let recordId = currentRecordId;
      if (!recordId) {
        const started = await dispatch(
          startChatThunk({
            sessionId: nextSessionId,
            title: buildConversationTitle(),
            metadata: { source: 'HelpChatModal' }
          })
        ).unwrap();
        recordId = started.recordId;
        setCurrentRecordId(recordId);
        dispatch(setCurrentChatId(recordId));
      }

      // Send message to backend with streaming callback
      const result = await sendChatMessage(
        {
          sessionId: nextSessionId,
          message: userMessage,
          previousResponseId: lastResponseId,
        },
        {
          onToken: (fullResponse) => {
            // Update the assistant message with streaming content
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { 
                      ...msg, 
                      content: fullResponse, 
                      isStreaming: true
                    }
                  : msg
              )
            );
          },
          onToolCall: (toolName) => {
            setMessages(prev => prev.map(msg => {
              if (msg.id !== assistantMessageId) return msg;
              const current = msg.activeTools || [];
              return current.includes(toolName) ? msg : { ...msg, activeTools: [...current, toolName] };
            }));
          },
          onToolResult: (toolName) => {
            setMessages(prev => prev.map(msg => {
              if (msg.id !== assistantMessageId) return msg;
              const active = (msg.activeTools || []).filter(t => t !== toolName);
              const done = (msg.tools || []).includes(toolName) ? (msg.tools || []) : [ ...(msg.tools || []), toolName ];
              return { ...msg, activeTools: active, tools: done };
            }));
          },
          onFinal: (fullResponse, responseId) => {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { 
                      ...msg, 
                      content: fullResponse, 
                      isStreaming: false
                    }
                  : msg
              )
            );
            if (responseId) {
              setLastResponseId(responseId);
            }
          },
          onDone: () => {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
          },
        }
      );

      // Mark streaming as complete
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

      // Persist messages to AppSync
      const assistantText = (result && result.message) || '';
      const responseIdFromServer = (result && result.responseId) || null;
      if (responseIdFromServer) {
        setLastResponseId(responseIdFromServer);
      }
      try {
        // Merge existing metadata with new responseId
        const existingMetadataRaw = (chatsById[recordId] && chatsById[recordId].metadata) || null;
        let existingMetadata = {};
        if (existingMetadataRaw) {
          try { existingMetadata = typeof existingMetadataRaw === 'string' ? JSON.parse(existingMetadataRaw) : (existingMetadataRaw || {}); } catch {}
        }
        const metadataToSave = {
          ...existingMetadata,
          responseId: responseIdFromServer || existingMetadata.responseId || null,
        };

        await dispatch(
          appendChatMessagesThunk({
            recordId: recordId,
            messages: [
              { role: 'user', content: userMessage },
              { role: 'assistant', content: assistantText },
            ],
            metadata: metadataToSave,
          })
        ).unwrap();
      } catch (err) {
        console.error('Failed to append chat messages:', err);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Replace the streaming message with error message
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                content: 'Sorry, I\'m having trouble connecting to the server right now. Please try again later.',
                isStreaming: false 
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      // Refocus input after sending message
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [
    chatsById,
    currentRecordId,
    dispatch,
    isLoading,
    lastResponseId,
    message,
    messages.length,
    sessionId,
  ]);

  const handleSendMessage = () => {
    sendMessage(message);
  };

  useEffect(() => {
    const trimmed = (autoSendMessage || '').trim();
    if (!trimmed || !isOpen) return;
    if (!isAuthenticated || loading) return;
    if (lastAutoSentRef.current === trimmed) return;
    if (isLoading) return;
    lastAutoSentRef.current = trimmed;
    sendMessage(trimmed);
  }, [autoSendMessage, isAuthenticated, isLoading, isOpen, loading, sendMessage]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeModal();
        }
      }}
    >
      <DialogContent className="w-screen h-screen max-w-none p-0 gap-0 bg-white flex flex-col rounded-none">
        {!isAuthenticated && !loading ? (
          // Full modal authentication prompt
          <>
            <div className="p-4 flex justify-between border-b border-gray-200">
              <div className="flex items-center gap-2 text-primary-600 font-medium">
                <Icons.chatStar className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                CloudAgent
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex items-center justify-center min-h-full p-8">
                <div className="space-y-6 max-w-2xl mx-auto w-full">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
                      <Icons.chatStar className="w-10 h-10 text-primary-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-3xl font-semibold text-gray-900">CloudAgent Chat</h3>
                      <p className="text-lg text-gray-600">
                        Use chat to explore AWS best practices, build new workloads, review infrastructure health, run reports — or any of the other functionality CloudAgent offers.
                      </p>
                    </div>
                  </div>

                  {/* Call to action */}
                  <div className="text-center space-y-4">
                    <div className="space-y-3">
                      <Button 
                        onClick={() => {
                          onClose?.();
                          navigate('/signup');
                        }}
                        className="w-full text-lg py-3"
                        size="lg"
                      >
                        Sign Up for Free
                      </Button>
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            onClose?.();
                            navigate('/login');
                          }}
                          className="flex-1"
                          size="lg"
                        >
                          Sign In
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => {
                            onClose?.();
                            navigate('/pricing');
                          }}
                          className="flex-1 text-primary-600 hover:text-primary-700"
                          size="lg"
                        >
                          View Pricing
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center justify-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>

                  {/* Example chat requests */}
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 text-center">
                      Try asking things like:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { icon: '🏗️', text: 'Generate architecture diagrams' },
                        { icon: '🔍', text: 'List workloads & highlight risks' },
                        { icon: '☁️', text: 'Build new cloud environments' },
                        { icon: '💻', text: 'List my compute resources' },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700"
                        >
                          <span className="text-base">{item.icon}</span>
                          <span className="text-sm">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : loading ? (
          // Full modal loading state
          <>
            <div className="p-4 flex justify-between border-b border-gray-200">
              <div className="flex items-center gap-2 text-primary-600 font-medium">
                <Icons.chatStar className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                CloudAgent
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          </>
        ) : (
          // Authenticated chat interface
          <>
            <div className="p-4 flex justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = !isHistoryVisible;
                    setIsHistoryVisible(next);
                  }}
                  className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2 text-primary-600 font-medium">
                  <Icons.chatStar className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                  CloudAgent
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isHistoryVisible && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNewChat}
                    className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
                    title="New Chat"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 h-8 w-8 p-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex h-full overflow-hidden ">
              {isHistoryVisible && (
                <div className="w-64 flex flex-col border-r border-gray-200">
                  <ScrollArea className="flex-1">
                    <div className="p-3">
                      <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
                        <span>History</span>
                      </div>

                      <div className="space-y-1">
                        {recentChatIds.map((id) => {
                          const chat = chatsById[id];
                          if (!chat) return null;
                          const title = chat.title || 'Untitled chat';
                          return (
                            <Button
                              key={id}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-primary-600 hover:bg-gray-100 h-8 font-normal"
                              onClick={async () => {
                                try {
                                  let fetched = chat;
                                  if (!fetched.messages || fetched.messages.length === 0) {
                                    fetched = await dispatch(getChatRecord({ recordId: id })).unwrap();
                                  }
                                  setCurrentRecordId(id);
                                  dispatch(setCurrentChatId(id));
                                  const mapped = (fetched?.messages || []).map((m, idx) => ({
                                    id: idx + 1,
                                    type: m.role === 'user' ? 'user' : 'assistant',
                                    content: m.content,
                                    timestamp: new Date(m.createdAt || Date.now()),
                                  }));
                                  if (mapped.length > 0) setMessages(mapped);
                                  // Initialize lastResponseId from chat metadata if present
                                  try {
                                    const mdRaw = fetched?.metadata;
                                    const md = typeof mdRaw === 'string' ? JSON.parse(mdRaw) : mdRaw;
                                    setLastResponseId(md?.responseId || null);
                                  } catch {}
                                } catch (e) {
                                  console.error('Failed to load chat:', e);
                                }
                              }}
                            >
                              {title}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="p-3">
                    <Button className="w-full" onClick={handleNewChat}>New chat</Button>
                  </div>
                </div>
              )}

              <div className="flex-1 flex h-full overflow-hidden">
                <div className="flex-1 flex border rounded-[20px] m-3 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-primary-600 text-sm">
                      {(currentRecordId && chatsById[currentRecordId]?.title) || 'New Chat'}
                    </span>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {showQuickTips && (
                      <div className="space-y-3">
                        <div className="text-center space-y-1">
                          <p className="text-sm text-gray-500">
                            Your AI assistant for cloud infrastructure
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { icon: '🏗️', label: 'Generate diagrams', prompt: 'Generate a diagram for a basic VPC setup' },
                            { icon: '🔍', label: 'List workloads & risks', prompt: 'List my workloads and highlight any risks' },
                            { icon: '☁️', label: 'Build new cloud environments', prompt: 'Help me build a new cloud environment' },
                            { icon: '💻', label: 'List compute resources', prompt: 'List my compute resources across my cloud environments' },
                          ].map((item, i) => (
                            <button
                              key={i}
                              onClick={() => setMessage(item.prompt)}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors text-left group"
                            >
                              <span className="text-base">{item.icon}</span>
                              <span className="text-sm text-gray-600 group-hover:text-gray-900">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((msg, index) => {
                      // Skip rendering the empty initial assistant placeholder message
                      if (index === 0 && msg.type === 'assistant' && !msg.content) {
                        return null;
                      }
                      return (
                    <div key={msg.id} className="space-y-2">
                      {/* Tool badges */}
                      {((msg.tools && msg.tools.length > 0) || (msg.activeTools && msg.activeTools.length > 0)) && (
                        <div className="flex flex-wrap gap-2 ml-2">
                          {/* Active tools (blue - currently running) */}
                          {msg.activeTools && msg.activeTools.map((toolName, index) => (
                            <div 
                              key={`active-${index}`}
                              className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium"
                            >
                              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                              {getToolStatusLabel(toolName, true)}
                            </div>
                          ))}
                          
                          {/* Completed tools (green - finished) */}
                          {msg.tools && msg.tools.map((toolName, index) => (
                            <div 
                              key={`completed-${index}`}
                              className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium"
                            >
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              {getToolStatusLabel(toolName, false)}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Message content */}
                      <Card 
                        className={`p-4 ${
                          msg.type === 'user' 
                            ? 'bg-primary-50 ml-8 border-blue-200' 
                            : 'bg-white border-primary-200'
                        }`}
                      >
                        {msg.type === 'user' ? (
                          // User messages - keep as plain text
                          <p className="text-gray-800 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        ) : (
                          // Assistant messages - markdown formatting + suggestion bubbles
                          <div className="text-gray-800 max-w-none">
                            {msg.content && (
                              <div className="space-y-3">
                                {splitBlueprintBlocks(msg.content).map((segment, idx) => {
                                  if (segment.type === 'blueprint_pending') {
                                    return (
                                      <div
                                        key={`blueprint-pending-${msg.id}-${idx}`}
                                        className="rounded-lg border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center gap-2"
                                      >
                                        <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                                        Skill run starting...
                                      </div>
                                    );
                                  }
                                  if (segment.type === 'blueprint_error') {
                                    return (
                                      <div
                                        key={`blueprint-error-${msg.id}-${idx}`}
                                        className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700"
                                      >
                                        Skill status unavailable.
                                      </div>
                                    );
                                  }
                                  if (segment.type === 'blueprint_run') {
                                    const payload = segment.payload || {};
                                    const recordId =
                                      payload.recordId || payload.agentRunId || payload.runId || '';
                                    const cached = recordId ? blueprintRunStatus[recordId] || {} : {};
                                    const status =
                                      cached.status || payload.status || 'running';
                                    const title =
                                      cached.title || payload.title || 'Skill run';
                                    const message =
                                      status === 'waiting_on_user_input'
                                        ? (cached.message || payload.message || '')
                                        : '';
                                    const loading = Boolean(cached.loading);
                                    const statusLower = String(status || '').toLowerCase();
                                    const statusBadgeClass =
                                      statusLower === 'waiting_on_user_input'
                                        ? 'bg-amber-100 text-amber-800'
                                        : statusLower === 'complete'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : statusLower === 'failed'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-blue-100 text-blue-700';
                                    const statusLabel = statusLower.replace(/_/g, ' ') || 'running';

                                    return (
                                      <div
                                        key={`blueprint-run-${msg.id}-${idx}`}
                                        className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-4 space-y-3"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold">
                                              Skill Run
                                            </div>
                                            <div className="text-sm font-semibold text-gray-900">
                                              {title}
                                            </div>
                                          </div>
                                          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadgeClass}`}>
                                            {statusLabel}
                                          </div>
                                        </div>

                                        {statusLower === 'waiting_on_user_input' && (
                                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                              Input Needed
                                            </div>
                                            <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                              {message || 'The skill run is waiting for input.'}
                                            </div>
                                          </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={loading || !recordId}
                                            onClick={() => fetchBlueprintRunStatus(recordId)}
                                          >
                                            {loading ? 'Refreshing…' : 'Refresh'}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-blue-700"
                                            onClick={() => recordId && navigate(`/dashboard/agent/${recordId}`)}
                                          >
                                            View progress
                                            <ExternalLink className="w-4 h-4 ml-2" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (segment.type === 'text') {
                                    if (!segment.content || !segment.content.trim()) {
                                      return null;
                                    }
                                    return splitDiagramBlocks(segment.content).map((sub, subIdx) => {
                                      if (sub.type === 'diagram') {
                                        return (
                                          <DiagramChatPreview
                                            key={`diagram-${msg.id}-${idx}-${subIdx}`}
                                            payload={sub.payload}
                                            onCloseChat={closeModal}
                                          />
                                        );
                                      }
                                      if (sub.type === 'diagram_pending') {
                                        return (
                                          <div
                                            key={`diagram-pending-${msg.id}-${idx}-${subIdx}`}
                                            className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500 flex items-center gap-2"
                                          >
                                            <span className="inline-block h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                                            Loading diagram...
                                          </div>
                                        );
                                      }
                                      if (sub.type === 'diagram_error') {
                                        return (
                                          <div
                                            key={`diagram-error-${msg.id}-${idx}-${subIdx}`}
                                            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
                                          >
                                            Diagram preview unavailable.
                                          </div>
                                        );
                                      }
                                      if (!sub.content || !sub.content.trim()) {
                                        return null;
                                      }
                                      return (
                                        <div key={`text-${msg.id}-${idx}-${subIdx}`} className="prose prose-sm">
                                          <Markdown
                                            options={{
                                              overrides: {
                                                h1: { props: { className: 'text-lg font-bold mb-2 mt-4' } },
                                                h2: { props: { className: 'text-base font-bold mb-2 mt-3' } },
                                                h3: { props: { className: 'text-sm font-bold mb-1 mt-2' } },
                                                p: { props: { className: 'mb-2 last:mb-0' } },
                                                ul: { props: { className: 'list-disc pl-5 mb-2 space-y-1' } },
                                                ol: { props: { className: 'list-decimal pl-5 mb-2 space-y-1' } },
                                                li: { props: { className: 'text-gray-800' } },
                                                code: { props: { className: 'bg-gray-100 px-1 py-0.5 rounded text-sm font-mono' } },
                                                pre: { props: { className: 'bg-gray-100 p-3 rounded overflow-x-auto mb-2' } },
                                                blockquote: { props: { className: 'border-l-4 border-gray-300 pl-4 italic mb-2' } }
                                              }
                                            }}
                                          >
                                            {sub.content}
                                          </Markdown>
                                        </div>
                                      );
                                    });
                                  }

                                  return null;
                                })}
                              </div>
                            )}
                            {msg.suggestions && msg.suggestions.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-sm text-gray-500">Here are some things I can help with in CloudAgent and your connected cloud environments:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {msg.suggestions.map((suggestion, i) => {
                                    const prompts = [
                                      'Generate a diagram for a basic VPC setup',
                                      'List my workloads and highlight any risks',
                                      'Help me build a new cloud environment',
                                      'List my compute resources across my cloud environments',
                                    ];
                                    return (
                                      <button
                                        key={i}
                                        onClick={() => setMessage(prompts[i] || suggestion)}
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors text-left group"
                                      >
                                        <span className="text-base">{['🏗️', '🔍', '☁️', '💻'][i] || '💡'}</span>
                                        <span className="text-sm text-gray-600 group-hover:text-gray-900 line-clamp-2">{suggestion}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {msg.isStreaming && (
                              <span className="inline-block w-2 h-5 bg-primary-600 ml-1 animate-pulse"></span>
                            )}
                          </div>
                        )}
                        {msg.content === '' && msg.isStreaming && (
                          <p className="text-gray-500 italic">
                            <span className="animate-pulse">Assistant is thinking...</span>
                          </p>
                        )}
                      </Card>
                    </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4">
                  <div className="flex gap-3 border rounded-[8px] p-2">
                    <Input
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about CloudAgent or your cloud environments"
                      className="border-none outline-none py-2 focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:outline-none"
                      wrapperClassName="flex-1"
                    />
                    <Button
                      size="md"
                      onClick={handleSendMessage}
                      disabled={!message.trim() || isLoading}
                      className=" disabled:bg-gray-300"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isLoading ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>
              </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HelpChatModal;
