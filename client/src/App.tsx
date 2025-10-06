import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './libs/queryClient';
import { Toaster } from './components/ui/toaster';
import { TaskCenterTab } from './components/tasks/TaskCenterTab';
import { InstancesTab } from './components/instances/InstancesTab';
import { SettingsTab } from './components/settings/SettingsTab';
import AutomationBuilderMobile from './components/automation/AutomationBuilderMobile';
import {
  LayoutDashboard,
  Smartphone,
  Settings,
  Download,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Workflow
} from 'lucide-react';
import './styles/mobile.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('tasks');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

  const tabs = [
    { id: 'tasks', name: 'Task Center', icon: Download },
    { id: 'instances', name: 'Instances', icon: Smartphone },
    { id: 'automation', name: 'Automation', icon: Workflow },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 relative">
      {/* Sidebar */}
      {!sidebarMinimized && (
        <div
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700 transition-all duration-300 relative`}
        >
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
            {sidebarOpen ? (
              <>
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-6 h-6 text-cyan-400" />
                  <h1 className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Worker Mobile
                  </h1>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-slate-700 rounded text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1 hover:bg-slate-700 rounded mx-auto text-gray-400 hover:text-white transition"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="p-2 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                      : 'text-gray-400 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="font-medium text-sm">{tab.name}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Minimize Button */}
          <button
            onClick={() => setSidebarMinimized(true)}
            className="absolute bottom-20 right-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-gray-400 hover:text-white transition shadow-lg"
            title="Thu gọn sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Footer Info */}
          {sidebarOpen && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
                <p className="text-xs text-cyan-400 font-medium">
                  LDPlayer Control Center
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  v1.0.0 • localhost:5050
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Minimized Floating Button */}
      {sidebarMinimized && (
        <button
          onClick={() => setSidebarMinimized(false)}
          className="fixed bottom-4 left-4 z-50 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white p-4 rounded-full shadow-2xl shadow-cyan-500/50 transition-all hover:scale-110 group"
          title="Mở sidebar"
        >
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6" />
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'tasks' && <TaskCenterTab />}
        {activeTab === 'instances' && <InstancesTab />}
        {activeTab === 'automation' && <AutomationBuilderMobile />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
    </QueryClientProvider>
  );
}