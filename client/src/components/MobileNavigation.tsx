import { ListTodo, Users, Settings, Heart, Workflow } from "lucide-react";

interface MobileNavigationProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
}

export function MobileNavigation({ activeTab, onTabChange }: MobileNavigationProps) {
  const navItems = [
    { id: "tasks", label: "Tasks", icon: ListTodo },
    { id: "profiles", label: "Profiles", icon: Users },
    { id: "twitter-caring", label: "Twitter", icon: Heart },
    { id: "automation", label: "Auto", icon: Workflow },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default MobileNavigation;