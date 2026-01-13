import React from 'react';
// Fix: Import Link and useLocation from local shim index file to avoid casing conflict with App.tsx
import { Link, useLocation } from '../../app/index';
import { Library, PlusCircle, BarChart2, Settings, User, Play, BookOpen, Square, Milestone, Users } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { useSessionManager } from '../../features/session-tracker/useSessionManager';
import { formatDuration } from '../../lib/utils/format';
import { getCoverUrl } from '../../lib/api/igdb';
// import { HardwareWidget } from '../widgets/HardwareWidget'; -- Disabled due to performance lag (v1.0)
import { useMarkObserver } from '../../features/gamification/hooks/useMarkObserver';
import logo from '../../../public/images/logo.png';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { activeSession, elapsed, stopTimer } = useSessionManager();
  const { reportSignal } = useMarkObserver();

  const version = import.meta.env.PACKAGE_VERSION || '1.0.0';

  const navItems = [
    { to: '/', icon: Library, label: 'My Library', id: 'nav-library' },
    { to: '/play', icon: Play, label: 'Play', id: 'sidebar-quick-play' },
    { to: '/journal', icon: BookOpen, label: 'Journal', id: 'nav-journal' },
    { to: '/add', icon: PlusCircle, label: 'Add Games', id: 'nav-add' },
    { to: '/profile', icon: User, label: 'Profile', id: 'nav-profile' },
    { to: '/milestones', icon: Milestone, label: 'Milestones', id: 'nav-milestones' },
    { to: '/community', icon: Users, label: 'Community', id: 'nav-community' },
    { to: '/analytics', icon: BarChart2, label: 'Analytics', id: 'nav-analytics' },
  ];

  const checkActive = (path: string) => {
    return path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  };

  return (
    <div className="w-64 valis-glass text-card-foreground flex flex-col h-full border-r border-border/50 transition-all duration-300">
      <div className="p-4 border-b border-border/10 select-none">
        <div className="flex items-center gap-3 px-2 mb-6 w-full">
           {/* 1. Logo */}
           <img 
             src={logo}
             alt="Valis Logo" 
             className="w-10 h-10 object-contain cursor-pointer active:scale-95 transition-transform" 
             onClick={() => reportSignal('LOGO_CLICK')}
           />
           
           {/* 2. Text Stack */}
           <div 
             className="flex flex-col justify-center cursor-pointer active:scale-95 transition-transform"
             onClick={() => reportSignal('LOGO_CLICK')}
           >
              <span className="font-display font-black text-xl tracking-tight leading-none">
                VALIS
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Game Journal
              </span>
           </div>

           {/* 3. Version (Pushed to Right) */}
           <div className="ml-auto flex items-start self-start">
              <span 
                className="text-[9px] font-mono font-bold text-muted-foreground/50 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 cursor-pointer hover:text-primary transition-colors"
                onClick={() => reportSignal('VERSION_CLICK')}
              >
                v{version}
              </span>
           </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            id={item.id}
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                checkActive(item.to)
                  ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                  : "text-foreground/70 hover:text-foreground hover:bg-white/5"
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>

      {activeSession && (
        <div className="mx-4 mb-4 p-3 bg-primary/10 border border-primary/20 rounded-xl animate-in slide-in-from-left-4 duration-500 valis-glass">
            <div className="flex gap-3 items-center mb-3">
                <img 
                    src={getCoverUrl(activeSession.coverUrl, 'big')} 
                    className="w-10 h-10 rounded shadow-sm object-cover border border-white/10" 
                    alt="Cover"
                />
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">Live</p>
                    <h4 className="text-xs font-bold truncate text-foreground leading-tight">
                        {activeSession.gameTitle}
                    </h4>
                    <p className="text-[10px] font-mono text-muted-foreground">
                        {formatDuration(elapsed)}
                    </p>
                </div>
            </div>
            <button 
                onClick={() => stopTimer()}
                className="w-full py-1.5 bg-destructive/20 hover:bg-destructive text-destructive hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-destructive/30"
            >
                <Square size={10} fill="currentColor" /> Stop
            </button>
        </div>
      )}

      {/* <HardwareWidget variant="sidebar" /> -- Disabled due to performance lag (v1.0) */}

      <div className="p-4 border-t border-border/10">
        <Link 
          to="/settings"
          id="nav-settings"
          className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-200",
              checkActive('/settings')
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                : "text-foreground/70 hover:text-foreground hover:bg-white/5"
            )
          }
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </div>
  );
};