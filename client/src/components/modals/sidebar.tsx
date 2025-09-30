import {
  ListTodo,
  Users,
  Settings,
  Server,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  Twitter,
  Workflow,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

interface SidebarProps {
  activeTab: "tasks" | "profiles" | "settings" | "twitter-caring" | "automation";
  onTabChange: (tab: "tasks" | "profiles" | "settings" | "twitter-caring" | "automation") => void;
  taskCount: number;
  runningTaskCount: number;
  profileCount: number;
  runningProfileCount: number;
  twitterCaringCount?: number;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  taskCount,
  runningTaskCount,
  profileCount,
  runningProfileCount,
  twitterCaringCount = 0,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfilesExpanded, setIsProfilesExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className={`${isCollapsed ? "w-20" : "w-64"} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300`}
    >
      {/* Header */}
      <div className="h-24 p-6 border-b border-gray-200 dark:border-gray-700 relative flex items-center">
        <div className="flex items-center space-x-3">
          {isCollapsed ? (
            <div className="w-8 h-8 flex items-center justify-center">
              <span className="text-xl font-bold text-gray-900 dark:text-white">W</span>
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Worker
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Task & Profile Management
              </p>
            </div>
          )}
        </div>
        {/* Collapse button positioned absolutely */}

      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <div className="space-y-4">
          {/* Task Management Section */}
          <div>
            <ul>
              <li>
                <button
                  onClick={() => onTabChange("tasks")}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === "tasks"
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? "Tasks" : ""}
                >
                  <ListTodo
                    className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`}
                  />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span>Tasks</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          activeTab === 'tasks'
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {taskCount}
                        </span>
                        {runningTaskCount > 0 && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            activeTab === 'tasks'
                              ? 'bg-green-500/30 text-white'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          }`}>
                            {runningTaskCount}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              </li>
            </ul>
          </div>

          {/* Profile Management Section with Collapse/Expand */}
          <div>
            <ul>
              <li>
                <button
                  onClick={() => {
                    onTabChange("profiles");
                    if (!isCollapsed) setIsProfilesExpanded(true);
                  }}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === "profiles" || activeTab === "twitter-caring"
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? "Profiles" : ""}
                >
                  <Users className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`} />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span>Profiles</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          (activeTab === 'profiles' || activeTab === 'twitter-caring')
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {profileCount}
                        </span>
                        {runningProfileCount > 0 && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            (activeTab === 'profiles' || activeTab === 'twitter-caring')
                              ? 'bg-green-500/30 text-white'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          }`}>
                            {runningProfileCount}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsProfilesExpanded(!isProfilesExpanded);
                        }}
                        className="p-0.5 hover:bg-white/20 rounded"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isProfilesExpanded ? '' : '-rotate-90'}`}
                        />
                      </button>
                    </div>
                  )}
                </button>
              </li>
              {(!isCollapsed && isProfilesExpanded) && (
                <li>
                  <button
                    onClick={() => onTabChange("twitter-caring")}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      activeTab === "twitter-caring"
                        ? "bg-primary/80 text-white"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    } ml-6`}
                    title="Twitter Caring"
                  >
                    <Twitter className="w-5 h-5 mr-3" />
                    <div className="flex items-center gap-2">
                      <span>Twitter Caring</span>
                      {twitterCaringCount > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          activeTab === 'twitter-caring'
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {twitterCaringCount}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Settings Section - Moved above Automation */}
          <div>
            <ul>
              <li>
                <button
                  onClick={() => onTabChange("settings")}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === "settings"
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? "Settings" : ""}
                >
                  <Settings
                    className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`}
                  />
                  {!isCollapsed && "Settings"}
                </button>
              </li>
            </ul>
          </div>

          {/* Automation Section */}
          <div>
            <ul>
              <li>
                <button
                  onClick={() => onTabChange("automation")}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === "automation"
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  } ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? "Automation" : ""}
                >
                  <Workflow className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`} />
                  {!isCollapsed && "Automation"}
                </button>
              </li>
            </ul>
          </div>
          {/* Collapse Button */}
          <div>
            <ul>
              <li>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 ${isCollapsed ? "justify-center" : ""}`}
                  title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                  {isCollapsed ? (
                    <ChevronRight
                      className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`}
                    />
                  ) : (
                    <ChevronLeft
                      className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`}
                    />
                  )}
                  {!isCollapsed && "Collapse"}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Theme Toggle Section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <ul>
          <li>
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 ${isCollapsed ? "justify-center" : ""}`}
              title={isCollapsed ? (theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode") : ""}
            >
              {theme === 'light' ? (
                <Moon className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`} />
              ) : (
                <Sun className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`} />
              )}
              {!isCollapsed && (theme === 'light' ? "Dark Mode" : "Light Mode")}
            </button>
          </li>
        </ul>
      </div>

      {/* Logout Section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <ul>
          <li>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                window.location.href = '/login';
              }}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 ${isCollapsed ? "justify-center" : ""}`}
              title={isCollapsed ? "Logout" : ""}
            >
              <LogOut className={`w-6 h-6 ${isCollapsed ? "" : "mr-3"}`} />
              {!isCollapsed && "Logout"}
            </button>
          </li>
        </ul>
      </div>

      {/* Connection Status */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              <span className="text-secondary dark:text-gray-300">Task Center Connected</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">2min ago</span>
          </div>
        </div>
      )}
    </div>
  );
}
