
import React, { useState, useEffect, useContext, createContext } from 'react';

// --- ROUTER SHIM ---
// Replaces react-router-dom which is causing build errors in the environment.

interface LocationState {
    pathname: string;
    search: string;
    state: any;
}

interface RouterContextType {
    location: LocationState;
    // Update: Support numeric navigation (back/forward)
    navigate: (to: string | number, options?: { state?: any }) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);
const ParamsContext = createContext<Record<string, string>>({});

export const HashRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Fix: Helper to extract both path and search string from the hash
    const getHashInfo = () => {
        const hash = window.location.hash.slice(1) || '/';
        const [pathname, searchRaw] = hash.split('?');
        return {
            pathname,
            search: searchRaw ? '?' + searchRaw : '',
            state: window.history.state
        };
    };
    
    const [location, setLocation] = useState<LocationState>(getHashInfo());

    useEffect(() => {
        const handleHashChange = () => {
            setLocation(getHashInfo());
        };
        window.addEventListener('hashchange', handleHashChange);
        window.addEventListener('popstate', handleHashChange);
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            window.removeEventListener('popstate', handleHashChange);
        };
    }, []);

    // Update: Implementation of navigate to handle numbers for history navigation
    const navigate = (to: string | number, options?: { state?: any }) => {
        if (typeof to === 'number') {
            window.history.go(to);
            return;
        }
        const url = '#' + to;
        // Update history and local state
        window.history.pushState(options?.state || null, '', url);
        
        // Fix: Parse manually to update state instantly with correct separation
        const [toPath, toSearch] = String(to).split('?');
        setLocation({ 
            pathname: toPath, 
            search: toSearch ? '?' + toSearch : '', 
            state: options?.state || null 
        });
    };

    return React.createElement(RouterContext.Provider, { value: { location, navigate } }, children);
};

export const useLocation = () => {
    const ctx = useContext(RouterContext);
    // Fix: Include empty search string in fallback
    if (!ctx) return { pathname: '/', search: '', state: null }; 
    return ctx.location;
};

// Update: support numeric navigation in fallback for useNavigate
export const useNavigate = () => {
    const ctx = useContext(RouterContext);
    if (!ctx) return (to: string | number) => { 
        if (typeof to === 'number') window.history.go(to);
        else window.location.hash = String(to); 
    };
    return ctx.navigate;
};

export const useParams = <T extends Record<string, string | undefined> = {}>(): T => {
    return useContext(ParamsContext) as T;
};

export const Routes: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { pathname } = useLocation();
    let match: React.ReactNode = null;
    let params: Record<string, string> = {};

    React.Children.forEach(children, (child) => {
        if (match) return;
        if (!React.isValidElement(child)) return;

        const props = child.props as { path: string; element: React.ReactNode };
        const path = props.path;
        
        // Exact Match
        if (path === pathname) {
            match = props.element;
            return;
        }

        // Param Match (e.g. /game/:id)
        if (path && path.includes(':')) {
            const routeSegs = path.split('/').filter(Boolean);
            const pathSegs = pathname.split('/').filter(Boolean);
            if (routeSegs.length === pathSegs.length) {
                const newParams: Record<string, string> = {};
                const isMatch = routeSegs.every((s, i) => {
                    if (s.startsWith(':')) {
                        newParams[s.slice(1)] = pathSegs[i];
                        return true;
                    }
                    return s === pathSegs[i];
                });
                if (isMatch) {
                    match = props.element;
                    params = newParams;
                }
            }
        }
    });

    return React.createElement(ParamsContext.Provider, { value: params }, match);
};

export const Route: React.FC<{ path: string; element: React.ReactNode }> = () => null;

/**
 * Fix: Link component with id prop support for onboarding tour selectors.
 */
export const Link: React.FC<{ to: string; className?: string; id?: string; state?: any; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }> = ({ to, className, id, state, children, onClick }) => {
    const navigate = useNavigate();
    return React.createElement('a', {
        href: `#${to}`,
        className: className,
        id: id,
        onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            if (onClick) onClick(e);
            navigate(to, { state });
        }
    }, children);
};
