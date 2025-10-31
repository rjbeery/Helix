import { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Persona {
  id: string;
  label: string;
  avatarUrl: string;
  systemPrompt: string;
  engine: { displayName: string };
}

interface ChatProps {
  token: string;
  apiBase: string;
}

export default function Chat({ token, apiBase }: ChatProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(apiBase + '/api/personas', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => {
        setPersonas(data.personas || []);
        if (data.personas?.length > 0) {
          setSelectedPersona(data.personas[0]);
        }
      })
      .catch(console.error);
  }, [token, apiBase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selectedPersona || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(apiBase + '/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          message: userMessage,
          conversationId
        })
      });

      if (!res.ok) throw new Error('Chat failed');
      
      const data = await res.json();
      setConversationId(data.conversationId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, something went wrong.' 
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      maxWidth: '960px',
      margin: '20px auto',
      padding: '24px',
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,.5)',
      minHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {selectedPersona && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px',
          border: '1px solid #444',
          borderRadius: '10px',
          backgroundColor: '#202020',
          marginBottom: '20px'
        }}>
          <img 
            src={selectedPersona.avatarUrl} 
            alt={selectedPersona.label}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #2a3350'
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '18px', color: '#fff' }}>
              {selectedPersona.label}
            </div>
            <div style={{ color: '#a0a0a0', fontSize: '12px' }}>
              {selectedPersona.engine.displayName}
            </div>
          </div>
        </div>
      )}

      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: '16px',
        padding: '16px',
        backgroundColor: '#0d0d0d',
        borderRadius: '8px',
        minHeight: '400px'
      }}>
        {messages.length === 0 && (
          <div style={{ 
            color: '#666', 
            textAlign: 'center', 
            padding: '40px',
            fontSize: '14px' 
          }}>
            Start a conversation with {selectedPersona?.label}...
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: msg.role === 'user' ? '#1e3a5f' : '#1a1a1a',
            border: '1px solid ' + (msg.role === 'user' ? '#2a5080' : '#333'),
            color: '#fff'
          }}>
            <div style={{ 
              fontSize: '11px', 
              color: '#a0a0a0', 
              marginBottom: '6px',
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              {msg.role === 'user' ? 'You' : selectedPersona?.label}
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
            {selectedPersona?.label} is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '12px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading || !selectedPersona}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: '#2a2a2a',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || !selectedPersona}
          style={{
            padding: '12px 24px',
            backgroundColor: loading ? '#555' : '#00d1ff',
            color: loading ? '#999' : '#1a1a1a',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
