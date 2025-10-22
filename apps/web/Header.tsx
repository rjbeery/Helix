import React from 'react';
import { HelixLogo } from './HelixLogo';

interface HeaderProps {
  showBudget?: boolean;
  budgetCents?: number;
  userName?: string;
}

export const Header: React.FC<HeaderProps> = ({ 
  showBudget = false, 
  budgetCents = 0,
  userName = ''
}) => {
  const formatBudget = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <div className="flex items-center">
            <HelixLogo size="default" className="hover:opacity-90 transition-opacity" />
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="/dashboard" className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">
              Dashboard
            </a>
            <a href="/personas" className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">
              Personas
            </a>
            <a href="/agents" className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">
              Agents
            </a>
            <a href="/tools" className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">
              Tools
            </a>
          </nav>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {showBudget && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-400">Available Budget</span>
                <span className={`text-sm font-semibold ${
                  budgetCents > 0 ? 'text-cyan-400' : 'text-red-400'
                }`}>
                  {formatBudget(budgetCents)}
                </span>
              </div>
            )}
            
            {userName && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};