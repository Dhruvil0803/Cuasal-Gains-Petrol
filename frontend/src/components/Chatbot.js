import React, { useState, useRef, useEffect } from 'react';
import { sendChat } from '../services/api';

const THREAD_ID = 'pipeline-session-1';

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your Pipeline Assistant. Ask me about sensor readings, anomalies, network impact, or simulate disaster events.",
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const data = await sendChat(text, THREAD_ID);
      setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error contacting the server. Make sure the backend is running.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 14,
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      height: 460,
      marginTop: 16,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #F47920, #D4621A)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Pipeline Assistant</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Ask about sensors, anomalies, events & more</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2px #bbf7d0' }} />
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Online</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? '#F47920' : '#f1f5f9',
              color: msg.role === 'user' ? '#ffffff' : '#0f172a',
              fontSize: 13,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
              background: '#f1f5f9', fontSize: 13, color: '#94a3b8',
            }}>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 18px',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-end',
      }}>
        <textarea
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about sensors, nodes, disasters…"
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '9px 13px',
            fontSize: 13,
            color: '#0f172a',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            background: '#f8fafc',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            background: input.trim() && !loading ? '#F47920' : '#e2e8f0',
            color: input.trim() && !loading ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: 10,
            padding: '9px 16px',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            fontWeight: 600,
            fontSize: 13,
            transition: 'all 0.15s',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
