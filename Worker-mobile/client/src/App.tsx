import { useState } from 'react';
import AutomationBuilderMobile from './components/automationTab/AutomationBuilderMobile';
import { useMobileLDPlayer } from './hooks/use-mobile-ldplayer';
import './styles/mobile.css';

export default function App() {
  const { isMobile, isLDPlayer, screenSize } = useMobileLDPlayer();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Worker Mobile - Automation Builder
          </h1>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {isLDPlayer ? '📱 LDPlayer' : isMobile ? '📱 Mobile' : '💻 Desktop'} • {screenSize.width}x{screenSize.height}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="h-[calc(100vh-60px)]">
        <AutomationBuilderMobile />
      </main>
    </div>
  );
}