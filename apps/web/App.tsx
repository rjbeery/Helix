import React, { useState } from 'react';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { HelixIcon } from './components/HelixLogo';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({ name: 'User', budgetCents: 5000 });

  const handleGetStarted = () => {
    // Navigate to passcode entry or dashboard
    setIsAuthenticated(true);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {!isAuthenticated ? (
        <LandingPage onGetStarted={handleGetStarted} />
      ) : (
        <>
          <Header 
            showBudget={true}
            budgetCents={user.budgetCents}
            userName={user.name}
          />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <HelixIcon size={24} />
                <h2 className="text-2xl font-bold text-white">Dashboard</h2>
              </div>
              <p className="text-gray-300">
                Welcome to Helix AI - Your modular GenAI orchestration platform.
              </p>
            </div>
          </main>
        </>
      )}
    </div>
  );
}

export default App;