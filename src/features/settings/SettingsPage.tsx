
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from '../../app/index';
import { Settings, Sliders, Cpu, Palette, Bell, Database, Cloud, Bug } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { GeneralTab } from './tabs/GeneralTab';
import { IntegrationsTab } from './tabs/IntegrationsTab';
import { PersonalizationTab } from './tabs/PersonalizationTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { DataTab } from './tabs/DataTab';
import { CloudTab } from './tabs/CloudTab';
import { DebugTab } from './tabs/DebugTab';

type TabId = 'general' | 'integrations' | 'cloud' | 'personalization' | 'notifications' | 'maintenance' | 'debug';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getTabFromUrl = (): TabId => {
    const pathParts = location.pathname.split('/');
    const tabName = pathParts[pathParts.length - 1];
    
    const validTabs: TabId[] = [
      'general', 
      'integrations', 
      'cloud', 
      'personalization', 
      'notifications', 
      'maintenance', 
      // 'debug' // Hidden for release
    ];
    
    return validTabs.includes(tabName as TabId) ? (tabName as TabId) : 'general';
  };

  const [activeTab, setActiveTab] = useState<TabId>(getTabFromUrl());

  // Listener: Update state when URL changes (Crucial for Tour navigation)
  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location.pathname]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    navigate(`/settings/${tab}`);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'integrations', label: 'Integrations', icon: Cpu },
    { id: 'cloud', label: 'Cloud & Sync', icon: Cloud },
    { id: 'personalization', label: 'Personalization', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'maintenance', label: 'Data & Maintenance', icon: Database },
    // { id: 'debug', label: 'Debug', icon: Bug }, // Hidden for release
  ];

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-10 h-full flex flex-col overflow-hidden animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0 mb-8 border-b border-border/50 pb-6">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-sm">
            <Settings size={32} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Settings</h1>
            <p className="text-muted-foreground font-medium">Manage your vault preferences and system connections.</p>
          </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <nav className="w-full lg:w-72 flex flex-col gap-2 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`settings-tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id as TabId)}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-xl text-sm font-bold transition-all text-left group border relative overflow-hidden",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 border-primary" 
                    : "bg-card hover:bg-accent text-muted-foreground hover:text-foreground border-border hover:border-border/80"
                )}
              >
                {isActive && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />}
                <Icon size={20} className={cn(isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary transition-colors")} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <div className="flex-1 min-w-0 overflow-y-auto pr-2 custom-scrollbar">
           <div className="bg-card/30 border border-border/50 rounded-3xl p-1 lg:p-8 backdrop-blur-sm min-h-full">
              {activeTab === 'general' && <GeneralTab />}
              {activeTab === 'integrations' && <div id="integrations-content"><IntegrationsTab /></div>}
              {activeTab === 'cloud' && <CloudTab />}
              {activeTab === 'personalization' && <PersonalizationTab />}
              {activeTab === 'notifications' && <NotificationsTab />}
              {activeTab === 'maintenance' && <DataTab />}
              {/* {activeTab === 'debug' && <DebugTab />} */}
           </div>
        </div>
      </div>
    </div>
  );
};
