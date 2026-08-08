'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Bot, User, Loader2, Trash2, ArrowDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

function formatMarkdownContent(text: string): string {
  if (!text) return '';
  // Otomatis sisipkan ganti baris (\n) jika baris tabel digabung oleh AI tanpa \n (contoh: "| Item | Nominal | |---|---| | Dompet |")
  return text.replace(/\|\s*\|/g, '|\n|');
}

const QUICK_PROMPTS = [
  'Sisa jatah harian saya berapa?',
  'Analisis pengeluaran terbanyak bulan ini',
  'Berapa dana yang bisa saya tabung bulan ini?',
  'Saran penghematan terbaik untuk saya',
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

      const assistantMsgId = (Date.now() + 1).toString();
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

      if (!res.body) {
        setIsLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const jsonStr = trimmed.replace(/^data:\s*/, '');
              const data = JSON.parse(jsonStr);

              if (data.content) {
                const aiMsg: ChatMessage = {
                  id: assistantMsgId,
                  role: 'assistant',
                  content: data.content,
                  timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                  modelUsed: data.modelUsed,
                };
                setMessages(prev => {
                  const filtered = prev.filter(m => m.id !== assistantMsgId);
                  return [...filtered, aiMsg];
                });
                setIsLoading(false);
              }
            } catch (e) {}
          }
        }
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
        className={`fixed bottom-28 right-4 z-40 md:bottom-8 md:right-8 p-3.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-300 flex items-center gap-2 group ${
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

      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[55] md:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Chat Drawer / Panel */}
      {isOpen && (
        <div className="fixed bottom-0 inset-x-0 md:inset-auto md:bottom-6 md:right-6 z-[60] w-full md:w-[380px] p-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-full h-[85vh] md:h-[500px] max-h-[640px] bg-white dark:bg-gray-950 rounded-t-3xl md:rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    Finto AI Assistant
                  </h3>
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

                    <div className={`max-w-[80%] space-y-1 ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed text-left ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-tl-none shadow-sm'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap text-left">{msg.content}</p>
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                              strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>,
                              ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-2">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              table: ({ children }) => (
                                <div className="my-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-950">
                                  <table className="w-full text-left text-xs border-collapse">{children}</table>
                                </div>
                              ),
                              thead: ({ children }) => (
                                <thead className="bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 border-b border-gray-200 dark:border-gray-800 font-semibold">
                                  {children}
                                </thead>
                              ),
                              th: ({ children }) => (
                                <th className="px-3.5 py-2.5 font-bold text-[11px] uppercase tracking-wider border-r border-gray-200/60 dark:border-gray-800/60 last:border-0">
                                  {children}
                                </th>
                              ),
                              tbody: ({ children }) => <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">{children}</tbody>,
                              tr: ({ children }) => <tr className="hover:bg-gray-50/60 dark:hover:bg-gray-900/60 transition-colors">{children}</tr>,
                              td: ({ children }) => (
                                <td className="px-3.5 py-2 text-gray-700 dark:text-gray-300 border-r border-gray-100/60 dark:border-gray-800/40 last:border-0">
                                  {children}
                                </td>
                              ),
                              hr: () => <hr className="my-3 border-gray-200 dark:border-gray-800" />,
                            }}
                          >
                            {formatMarkdownContent(msg.content)}
                          </ReactMarkdown>
                        )}
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

            {/* Input Form with Safe Area Padding */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,20px))] md:pb-3 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-shrink-0"
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
