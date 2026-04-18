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
  FolderKanban,
  Telescope,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/kunden', label: 'Kunden', icon: Users },
  { to: '/artikel', label: 'Artikel', icon: Package },
  { to: '/angebote', label: 'Angebote', icon: FileText },
  { to: '/rechnungen', label: 'Rechnungen', icon: Receipt },
  { to: '/projekte', label: 'Projekte', icon: FolderKanban },
  { to: '/akquise', label: 'Akquise', icon: Telescope },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { syncing } = useApp();

  return (
    <div className="flex h-screen bg-dark-900">
      {/* Sidebar */}
      <aside className="w-60 bg-dark-800 border-r border-dark-700 flex flex-col">
        <div className="p-5 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SØ</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-100 leading-tight">SØRGEL-design</p>
              <div className="flex items-center gap-1 mt-0.5">
                {syncing ? (
                  <>
                    <CloudOff size={10} className="text-amber-400" />
                    <p className="text-xs text-amber-400">Synchronisiert…</p>
                  </>
                ) : (
                  <>
                    <Cloud size={10} className="text-emerald-400" />
                    <p className="text-xs text-emerald-400">Gespeichert</p>
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
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-gray-400 hover:bg-dark-700 hover:text-gray-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? 'text-primary-400' : 'text-gray-500 group-hover:text-gray-300'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-primary-500" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User-Bereich */}
        <div className="p-3 border-t border-dark-700">
          <div className="flex items-center gap-2 px-2 py-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-300">
                {user?.displayName?.[0] ?? '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-200 truncate">{user?.displayName ?? 'Nutzer'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Abmelden"
              className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-dark-900">
        <Outlet />
      </main>
    </div>
  );
}
