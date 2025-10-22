import React from 'react';
import { HelixLogo, HelixIcon } from './HelixLogo';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            {/* Large Logo with Tagline */}
            <div className="flex justify-center mb-8">
              <HelixLogo showTagline={true} size="large" />
            </div>
            
            {/* Hero Text */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
              Modular GenAI Orchestration
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              A powerful platform for multi-model, multi-persona intelligence. 
              Build, deploy, and scale your AI agents with enterprise-grade infrastructure.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onGetStarted}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all transform hover:scale-105"
              >
                Get Started
              </button>
              <a
                href="https://github.com/rjbeery/Helix"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-all border border-gray-700"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<HelixIcon size={40} />}
              title="Multi-Model Support"
              description="Seamlessly integrate OpenAI, Claude, Bedrock, and custom models through unified engine adapters."
            />
            <FeatureCard
              icon={<HelixIcon size={40} />}
              title="Personality System"
              description="Create and manage engine-agnostic personas with custom prompts, tools, and configurations."
            />
            <FeatureCard
              icon={<HelixIcon size={40} />}
              title="Enterprise Ready"
              description="JWT authentication, budget management, and comprehensive telemetry for production deployments."
            />
          </div>
        </div>

        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
        </div>
      </div>
    </div>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:bg-gray-800/70 transition-all">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
};