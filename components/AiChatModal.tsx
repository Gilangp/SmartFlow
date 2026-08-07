'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Bot, User, Loader2, Trash2, ArrowDown } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

const QUICK_PROMPTS = [
  'Berapa jatah harian saya hari ini?',
  'Bagaimana kondisi alokasi kantong saya?',
  'Berapa total sisa saldo di Dompet Utama & Tabungan?',
  'Berikan saran penghematan minggu ini',
];

export default function AiChatModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, scrollToBottom]);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('sf-token');
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage.trim();
    if (!query || isLoading) return;

    const token = getToken();
    if (!token) return;

    const userMsgId = Date.now().toString();
    const newMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = updatedMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: query,
          conversationHistory: historyPayload,
        }),
      });

      const data = await res.json();

      if (data.success && data.data?.reply) {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.data.reply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          modelUsed: data.data.modelUsed,
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message || 'Maaf, terjadi masalah saat menghubungkan ke Finto AI.',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Terjadi kesalahan koneksi. Pastikan koneksi internet kamu lancar.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-5 z-40 lg:bottom-8 lg:right-8 p-3.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-300 flex items-center gap-2 group ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
        aria-label="Tanya Finto AI"
      >
        <div className="relative">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <span className="text-xs font-semibold pr-1 hidden sm:inline-block">Tanya Finto AI</span>
      </button>

      {/* Floating Chat Drawer / Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[380px] p-0 sm:p-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-full h-[80vh] sm:h-[500px] max-h-[620px] bg-white dark:bg-gray-950 rounded-t-3xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden">

            
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    Finto AI Assistant
                    <span className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full font-medium">Pro</span>
                  </h3>
                  <p className="text-[11px] text-indigo-100">Finto Financial Engine</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="p-2 rounded-lg hover:bg-white/10 text-indigo-100 transition-colors"
                    title="Hapus Percakapan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-gray-900/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-2 py-3 space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Hai! Ada yang ingin ditanyakan?</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs">
                      Saya bisa membantu menganalisis sisa jatah harian, alokasi Dompet Utama & Tabungan, serta rekomendasi hematmu.
                    </p>
                  </div>

                  {/* Quick Prompts */}
                  <div className="w-full space-y-1.5 pt-1">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-left">Contoh Pertanyaan</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {QUICK_PROMPTS.map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(prompt)}
                          className="text-left text-xs p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all group flex items-center justify-between"
                        >
                          <span>{prompt}</span>
                          <ArrowDown className="w-3.5 h-3.5 text-gray-400 -rotate-90 group-hover:text-indigo-500 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={`max-w-[80%] space-y-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-tl-none shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 px-1">{msg.timestamp}</p>
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-3.5 rounded-2xl rounded-tl-none bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span>Finto AI sedang berpikir...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder="Tanyakan analisis keuanganmu..."
                disabled={isLoading}
                className="flex-1 text-xs px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 focus:outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-all shadow-md shadow-indigo-600/20 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        </div>
      )}
    </>
  );
}
