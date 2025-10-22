import React from 'react';

interface HelixLogoProps {
  showTagline?: boolean;
  size?: 'small' | 'default' | 'large';
  className?: string;
}

export const HelixLogo: React.FC<HelixLogoProps> = ({ 
  showTagline = false, 
  size = 'default', 
  className = '' 
}) => {
  // Size presets for responsive design
  const sizes = {
    small: { width: 96, height: showTagline ? 30 : 24 },
    default: { width: 128, height: showTagline ? 40 : 32 },
    large: { width: 160, height: showTagline ? 50 : 40 }
  };

  const { width, height } = sizes[size];
  const viewBox = showTagline ? "0 0 128 40" : "0 0 128 32";

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={viewBox} 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Helix AI Logo"
    >
      <defs>
        <linearGradient id="helix-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#00d1ff" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      
      <text 
        x="0" 
        y="22" 
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" 
        fontSize="20" 
        fontWeight="600"
        fill="url(#helix-gradient)"
      >
        Helix AI
      </text>
      
      <circle cx="112" cy="16" r="12" fill="none" stroke="url(#helix-gradient)" strokeWidth="2" />
      <path d="M104 16c6 0 6-8 12-8" fill="none" stroke="url(#helix-gradient)" strokeWidth="2" />
      <path d="M104 16c6 0 6 8 12 8" fill="none" stroke="url(#helix-gradient)" strokeWidth="2" />
      
      {showTagline && (
        <text 
          x="0" 
          y="34" 
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" 
          fontSize="7" 
          fill="#9ca3af" 
          fontStyle="italic"
        >
          This is just the beginning...
        </text>
      )}
    </svg>
  );
};

export const HelixIcon: React.FC<{ size?: number; className?: string }> = ({ 
  size = 32, 
  className = '' 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Helix AI Icon"
    >
      <defs>
        <linearGradient id="helix-icon-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#00d1ff" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="12" fill="none" stroke="url(#helix-icon-gradient)" strokeWidth="2" />
      <path d="M8 16c6 0 6-8 12-8" fill="none" stroke="url(#helix-icon-gradient)" strokeWidth="2" />
      <path d="M8 16c6 0 6 8 12 8" fill="none" stroke="url(#helix-icon-gradient)" strokeWidth="2" />
    </svg>
  );
};