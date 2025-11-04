import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  personaId?: string; // present for assistant messages
  batonAction?: 'initial' | 'approved' | 'revised'; // for baton mode
}

interface Engine {
  id: string;
  displayName: string;
  provider: string;
  enabled: boolean;
}

interface Persona {
  id: string;
  label: string;
  specialization?: string;
  avatarUrl: string;
  systemPrompt: string;
  engineId: string;
  engine: Engine;
}

interface ChatProps {
  token: string;
  apiBase: string;
  maxBatonPasses?: number;
}

export default function Chat({ token, apiBase, maxBatonPasses = 5 }: ChatProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingCount, setLoadingCount] = useState(0);
  const loading = loadingCount > 0;
  const [conversationIds, setConversationIds] = useState<Record<string, string | null>>({});
  const [activePersonaIds, setActivePersonaIds] = useState<string[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editEngineId, setEditEngineId] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSpecialization, setNewSpecialization] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newEngineId, setNewEngineId] = useState('');
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [multiAgentMode, setMultiAgentMode] = useState<'panel' | 'baton'>('panel');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch personas
    fetch(apiBase + '/api/personas', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => {
        const list: Persona[] = data.personas || [];
        setPersonas(list);
        if (list.length > 0) {
          setSelectedPersona(list[0]);
          setActivePersonaIds([list[0].id]);
        }
      })
      .catch(console.error);

    // Fetch engines
    fetch(apiBase + '/api/personas/engines', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => setEngines(data.engines || []))
      .catch(console.error);
  }, [token, apiBase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function startEdit() {
    if (!selectedPersona) return;
    setEditLabel(selectedPersona.label);
    setEditSpecialization(selectedPersona.specialization || '');
    setEditPrompt(selectedPersona.systemPrompt);
    setEditEngineId(selectedPersona.engineId);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setAvatarFile(null);
  }

  function startCreate() {
    setNewLabel('');
    setNewSpecialization('');
    setNewPrompt('');
    setNewEngineId(engines[0]?.id || '');
    setNewAvatarFile(null);
    setCreating(true);
  }

  function cancelCreate() {
    setCreating(false);
    setNewAvatarFile(null);
  }

  async function saveCreate() {
    if (!newLabel || !newPrompt || !newEngineId) {
      alert('Please fill in all required fields (Name, Prompt, Engine)');
      return;
    }

    try {
      let createdPersonaId: string | null = null;
      let avatarUrl = '';

      // Upload avatar if selected
      if (newAvatarFile) {
        const formData = new FormData();
        formData.append('avatar', newAvatarFile);

        // Create a temporary persona first to get an ID
        const tempRes = await fetch(`${apiBase}/api/personas`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            label: newLabel,
            specialization: newSpecialization,
            systemPrompt: newPrompt,
            engineId: newEngineId
          })
        });

        if (!tempRes.ok) throw new Error('Failed to create persona');
        const tempData = await tempRes.json();
        const newPersonaId = tempData.persona.id;

        // Upload avatar
        const uploadRes = await fetch(`${apiBase}/api/personas/${newPersonaId}/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          body: formData
        });

        if (!uploadRes.ok) throw new Error('Avatar upload failed');
        const uploadData = await uploadRes.json();
        avatarUrl = uploadData.persona.avatarUrl;

        // Update persona with avatar URL
        const updateRes = await fetch(`${apiBase}/api/personas/${newPersonaId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ avatarUrl })
        });

        if (!updateRes.ok) throw new Error('Failed to update avatar');
        const finalData = await updateRes.json();
        
        // Add to personas list and select
        setPersonas(prev => [finalData.persona, ...prev]);
        setSelectedPersona(finalData.persona);
        createdPersonaId = finalData.persona.id;
      } else {
        // Create without avatar
        const res = await fetch(`${apiBase}/api/personas`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            label: newLabel,
            specialization: newSpecialization,
            systemPrompt: newPrompt,
            engineId: newEngineId
          })
        });

        if (!res.ok) throw new Error('Failed to create persona');
        const data = await res.json();
        
        // Add to personas list and select
        setPersonas(prev => [data.persona, ...prev]);
        setSelectedPersona(data.persona);
        createdPersonaId = data.persona.id;
      }

      setCreating(false);
      setNewAvatarFile(null);
      // Reset conversations and set selection to the new persona
      setMessages([]);
      setConversationIds({});
      if (createdPersonaId) {
        setActivePersonaIds([createdPersonaId]);
      }
    } catch (error) {
      console.error('Failed to create persona:', error);
      alert('Failed to create persona');
    }
  }

  async function saveEdit() {
    if (!selectedPersona) return;

    try {
      let updatedPersona = selectedPersona;

      // Upload avatar if selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);

        const uploadRes = await fetch(`${apiBase}/api/personas/${selectedPersona.id}/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          body: formData
        });

        if (!uploadRes.ok) throw new Error('Avatar upload failed');

        const uploadData = await uploadRes.json();
        updatedPersona = uploadData.persona;
      }

      // Update other fields
      const res = await fetch(`${apiBase}/api/personas/${selectedPersona.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          label: editLabel,
          specialization: editSpecialization,
          systemPrompt: editPrompt,
          engineId: editEngineId
        })
      });

      if (!res.ok) throw new Error('Update failed');

      const data = await res.json();
      updatedPersona = data.persona;

      // Update in personas list and selected
      setPersonas(prev => prev.map(p => p.id === updatedPersona.id ? updatedPersona : p));
      setSelectedPersona(updatedPersona);
      setEditing(false);
      setAvatarFile(null);
    } catch (error) {
      console.error('Failed to update persona:', error);
      alert('Failed to update persona');
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || activePersonaIds.length === 0 || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Panel mode: send to all personas simultaneously
    if (multiAgentMode === 'panel' || activePersonaIds.length === 1) {
      for (const pid of activePersonaIds) {
        const convId = conversationIds[pid] || null;
        setLoadingCount((c) => c + 1);
        fetch(apiBase + '/api/chat', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personaId: pid,
            message: userMessage,
            conversationId: convId
          })
        })
          .then(async (r) => {
            if (!r.ok) throw new Error('Chat failed');
            const data = await r.json();
            setConversationIds(prev => ({ ...prev, [pid]: data.conversationId }));
            setMessages(prev => [...prev, { role: 'assistant', content: data.message, personaId: pid }]);
          })
          .catch((err) => {
            console.error(err);
            const p = personas.find(pp => pp.id === pid);
            setMessages(prev => [...prev, { role: 'assistant', content: (p ? p.label + ': ' : '') + 'Sorry, something went wrong.', personaId: pid }]);
          })
          .finally(() => setLoadingCount((c) => Math.max(0, c - 1)));
      }
    } 
    // Baton mode: sequential refinement
    else if (multiAgentMode === 'baton') {
      setLoadingCount(1);
      fetch(apiBase + '/api/chat/baton', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personaIds: activePersonaIds,
          message: userMessage,
          conversationIds: activePersonaIds.map(pid => conversationIds[pid] || null)
        })
      })
        .then(async (r) => {
          if (!r.ok) throw new Error('Baton chat failed');
          const data = await r.json();
          
          // Update conversation IDs
          data.conversationIds.forEach((convId: string, idx: number) => {
            const pid = activePersonaIds[idx];
            setConversationIds(prev => ({ ...prev, [pid]: convId }));
          });
          
          // Add baton chain messages
          setMessages(prev => [
            ...prev,
            ...data.batonChain.map((step: any) => ({
              role: 'assistant' as const,
              content: step.content,
              personaId: step.personaId,
              batonAction: step.action
            }))
          ]);
        })
        .catch((err) => {
          console.error(err);
          setMessages(prev => [...prev, { role: 'assistant', content: 'Baton mode failed: ' + err.message }]);
        })
        .finally(() => setLoadingCount(0));
    }
  }

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '20px auto',
      padding: '24px',
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,.5)',
      minHeight: '600px',
      display: 'flex',
      gap: '16px'
    }}>
      {/* Left sidebar: personas column */}
      <div style={{ width: '260px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ color: '#fff', fontWeight: 700 }}>Personas ({personas.length})</div>
          <button
            onClick={startCreate}
            title="Create persona"
            style={{
              padding: '6px 10px',
              backgroundColor: '#00d1ff',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            + New
          </button>
        </div>
        <div style={{ overflowY: 'auto', border: '1px solid #333', borderRadius: 8 }}>
          {personas.map(p => {
            const checked = activePersonaIds.includes(p.id);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #2a2a2a' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setActivePersonaIds(prev => checked ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                  }}
                />
                <img src={p.avatarUrl} alt={p.label} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid #444' }} />
                <button
                  onClick={() => {
                    setSelectedPersona(p);
                    setActivePersonaIds([p.id]);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    color: '#fff',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: '#a0a0a0' }}>{p.engine.displayName}</div>
                </button>
              </div>
            );
          })}
          {personas.length === 0 && (
            <div style={{ color: '#888', fontSize: 12, padding: 12 }}>No personas yet.</div>
          )}
        </div>
      </div>

      {/* Right panel: chat and forms */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* No personas message */}
      {personas.length === 0 && !creating && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#a0a0a0'
        }}>
          <h2 style={{ color: '#fff', marginBottom: '12px' }}>Welcome to Helix</h2>
          <p style={{ marginBottom: '24px', fontSize: '14px' }}>
            You don't have any personas yet. Create your first AI persona to get started.
          </p>
          <button
            onClick={startCreate}
            style={{
              padding: '12px 24px',
              backgroundColor: '#00d1ff',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Create Your First Persona
          </button>
        </div>
      )}
      
  {selectedPersona && !editing && activePersonaIds.length === 1 && (
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
            {selectedPersona.specialization && (
              <div style={{ color: '#00d1ff', fontSize: '11px', marginTop: '4px', fontStyle: 'italic' }}>
                {selectedPersona.specialization}
              </div>
            )}
            {selectedPersona.systemPrompt && (
              <div style={{ 
                color: '#888', 
                fontSize: '11px', 
                marginTop: '6px', 
                lineHeight: '1.4',
                maxHeight: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical'
              }}>
                {selectedPersona.systemPrompt}
              </div>
            )}
          </div>
          <button
            onClick={startEdit}
            style={{
              padding: '8px 16px',
              backgroundColor: '#00d1ff',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
        </div>
      )}

      {selectedPersona && editing && (
        <div style={{
          padding: '20px',
          border: '1px solid #444',
          borderRadius: '10px',
          backgroundColor: '#202020',
          marginBottom: '20px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              Name
            </label>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              Specialization
            </label>
            <input
              type="text"
              value={editSpecialization}
              onChange={(e) => setEditSpecialization(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              Engine
            </label>
            <select
              value={editEngineId}
              onChange={(e) => setEditEngineId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {engines.map(eng => (
                <option key={eng.id} value={eng.id}>
                  {eng.displayName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              Avatar Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            {avatarFile && (
              <div style={{ marginTop: '8px', color: '#00d1ff', fontSize: '12px' }}>
                Selected: {avatarFile.name}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              System Prompt
            </label>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={saveEdit}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#00d1ff',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save
            </button>
            <button
              onClick={cancelEdit}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create new persona form */}
      {creating && (
        <div style={{
          padding: '20px',
          border: '1px solid #444',
          borderRadius: '10px',
          backgroundColor: '#202020',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '18px' }}>
            Create New Persona
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              Name *
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g., Chris H."
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              Specialization
            </label>
            <input
              type="text"
              value={newSpecialization}
              onChange={(e) => setNewSpecialization(e.target.value)}
              placeholder="e.g., Bank Senior Director"
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              Engine *
            </label>
            <select
              value={newEngineId}
              onChange={(e) => setNewEngineId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {engines.map(eng => (
                <option key={eng.id} value={eng.id}>
                  {eng.displayName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              Avatar Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewAvatarFile(e.target.files?.[0] || null)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            {newAvatarFile && (
              <div style={{ marginTop: '8px', color: '#00d1ff', fontSize: '12px' }}>
                Selected: {newAvatarFile.name}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#a0a0a0', fontSize: '12px', marginBottom: '4px' }}>
              System Prompt *
            </label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={6}
              placeholder="You are a helpful assistant..."
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={saveCreate}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#00d1ff',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Create
            </button>
            <button
              onClick={cancelCreate}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Multi-agent mode selector (only show when multiple personas active) */}
      {activePersonaIds.length > 1 && !editing && !creating && (
        <div style={{
          padding: '16px',
          border: '1px solid #444',
          borderRadius: '8px',
          backgroundColor: '#202020',
          marginBottom: '16px'
        }}>
          <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
            Multi-Agent Mode ({activePersonaIds.length} personas active)
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff' }}>
              <input
                type="radio"
                name="multiAgentMode"
                value="panel"
                checked={multiAgentMode === 'panel'}
                onChange={() => setMultiAgentMode('panel')}
                style={{ cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Panel Mode</div>
                <div style={{ fontSize: '11px', color: '#a0a0a0', marginTop: '2px' }}>
                  All personas respond simultaneously with independent answers
                </div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff' }}>
              <input
                type="radio"
                name="multiAgentMode"
                value="baton"
                checked={multiAgentMode === 'baton'}
                onChange={() => setMultiAgentMode('baton')}
                style={{ cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Baton Mode</div>
                <div style={{ fontSize: '11px', color: '#a0a0a0', marginTop: '2px' }}>
                  Sequential refinement - each agent reviews and improves the answer
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Warning when too many personas selected for baton mode */}
      {activePersonaIds.length > 1 && 
       multiAgentMode === 'baton' && 
       activePersonaIds.length > maxBatonPasses && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#3d2200',
          border: '1px solid #cc6600',
          borderRadius: '8px',
          marginTop: '12px',
          fontSize: '13px',
          color: '#ffcc99'
        }}>
          <strong>⚠️ Warning:</strong> You have {activePersonaIds.length} personas selected, but the baton 
          pass limit is {maxBatonPasses}. Only the first {maxBatonPasses} personas will participate.
        </div>
      )}

      {selectedPersona && !editing && !creating && (
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
            {activePersonaIds.length <= 1
              ? `Start a conversation with ${selectedPersona?.label}...`
              : multiAgentMode === 'panel'
              ? `Start a panel discussion with ${activePersonaIds.length} personas...`
              : `Start a baton relay with ${activePersonaIds.length} personas...`}
          </div>
        )}
        {messages.map((msg, i) => {
          const p = msg.personaId ? personas.find(pp => pp.id === msg.personaId) : selectedPersona;
          return (
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
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {msg.role === 'assistant' && p?.avatarUrl && (
                  <img src={p.avatarUrl} alt={p.label} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', border: '1px solid #444' }} />
                )}
                {msg.role === 'user' ? 'You' : (p?.label || 'Assistant')}
              </span>
              {msg.batonAction && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 
                    msg.batonAction === 'initial' ? '#444' :
                    msg.batonAction === 'approved' ? '#2a5030' :
                    msg.batonAction === 'revised' ? '#00d1ff33' : '#444',
                  color: 
                    msg.batonAction === 'approved' ? '#50ff70' :
                    msg.batonAction === 'revised' ? '#00d1ff' : '#aaa',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  {msg.batonAction === 'initial' ? '📝 Initial' :
                   msg.batonAction === 'approved' ? '👍 Approved' :
                   msg.batonAction === 'revised' ? '✏️ Revised' : ''}
                </span>
              )}
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          </div>
        );})}
        {loading && (
          <div style={{ color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
            {selectedPersona?.label} is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      )}

      {selectedPersona && !editing && !creating && (
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: '12px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading || activePersonaIds.length === 0}
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
          disabled={loading || !input.trim() || activePersonaIds.length === 0}
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
      )}
      </div>
    </div>
  );
}
