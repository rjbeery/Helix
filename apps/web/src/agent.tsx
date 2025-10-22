import React from 'react';
import { createRoot } from 'react-dom/client';
import HelixLogoTagline from './public/images/Helix_logo_with_tagline.svg';

function AgentPreview() {
  return (
    <div style={{
      maxWidth: 520,
      margin: '40px auto',
      padding: '24px',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      fontFamily: "'Inter', system-ui, sans-serif",
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
        <img src={HelixLogoTagline} alt="Helix AI Logo" style={{ width: 64, height: 64 }} />
      </div>
      <h1 style={{ textAlign: 'center', margin: 0 }}>Agent Preview</h1>
      <p style={{ textAlign: 'center', color: '#a0a0a0' }}>
        This is a lightweight preview page for Helix agents.
      </p>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  const root = createRoot(el);
  root.render(<AgentPreview />);
}
