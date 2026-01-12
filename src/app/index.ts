// Re-export everything from the real library
// This ensures App.tsx, AppProviders.tsx, and Sidebar all share the SAME context.
export { 
  HashRouter, 
  Routes, 
  Route, 
  Link, 
  useLocation, 
  useNavigate, 
  useParams, 
  Outlet 
} from 'react-router-dom';