import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Receipt,
  Settings,
  ChevronRight,
  LogOut,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/kunden', label: 'Kunden', icon: Users },
  { to: '/artikel', label: 'Artikel', icon: Package },
  { to: '/angebote', label: 'Angebote', icon: FileText },
  { to: '/rechnungen', label: 'Rechnungen', icon: Receipt },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { syncing } = useApp();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SF</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">SörgelFibu</p>
              <div className="flex items-center gap-1 mt-0.5">
                {syncing ? (
                  <>
                    <CloudOff size={10} className="text-amber-400" />
                    <p className="text-xs text-amber-500">Synchronisiert…</p>
                  </>
                ) : (
                  <>
                    <Cloud size={10} className="text-emerald-500" />
                    <p className="text-xs text-emerald-600">Gespeichert</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-primary-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User-Bereich */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-2 py-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                {user?.displayName?.[0] ?? '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{user?.displayName ?? 'Nutzer'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Abmelden"
              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
