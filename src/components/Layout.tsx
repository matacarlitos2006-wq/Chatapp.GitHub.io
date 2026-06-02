import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { usePresence } from '../hooks/usePresence';

export default function Layout() {
  usePresence();
  const location = useLocation();
  const isChatOpen = location.pathname.startsWith('/chat/');

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors overflow-hidden">
      {/* Sidebar: hide on mobile when a chat is open */}
      <div className={`${isChatOpen ? 'hidden md:flex' : 'flex'} w-full md:w-64 flex-shrink-0 flex-col`}>
        <Sidebar />
      </div>
      {/* Main: hide on mobile when sidebar is showing */}
      <main className={`${!isChatOpen ? 'hidden md:flex' : 'flex'} flex-1 overflow-hidden flex-col`}>
        <Outlet />
      </main>
    </div>
  );
}
