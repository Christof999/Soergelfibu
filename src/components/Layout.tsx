import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
  Wallet,
  Menu,
  X,
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
  { to: '/fibu', label: 'Fibu', icon: Wallet },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
];

function BrandBlock({ compact }: { compact?: boolean }) {
  const { syncing } = useApp();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className={`bg-primary-600 rounded-lg flex items-center justify-center shrink-0 ${compact ? 'w-8 h-8' : 'w-9 h-9'}`}
      >
        <span className={`text-white font-bold ${compact ? 'text-xs' : 'text-sm'}`}>SØ</span>
      </div>
      <div className="min-w-0">
        <p className={`font-bold text-gray-100 leading-tight truncate ${compact ? 'text-xs' : 'text-sm'}`}>
          SØRGEL-design
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {syncing ? (
            <>
              <CloudOff size={10} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400 truncate">Synchronisiert…</p>
            </>
          ) : (
            <>
              <Cloud size={10} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400 truncate">Gespeichert</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="flex h-[100dvh] min-h-0 bg-dark-900 pt-[env(safe-area-inset-top)]">
      {/* Mobile Topbar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-3 py-2 border-b border-dark-700 bg-dark-900/95 backdrop-blur-sm pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="p-2 rounded-lg text-gray-300 hover:bg-dark-800 hover:text-gray-100 -ml-1"
          aria-label="Menü öffnen"
        >
          <Menu size={22} />
        </button>
        <BrandBlock compact />
      </header>

      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Menü schließen"
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity lg:hidden ${
          mobileNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileNavOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[min(18rem,100vw)] bg-dark-800 border-r border-dark-700 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 lg:w-60 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-dark-700 flex items-start justify-between gap-2 lg:block">
          <BrandBlock />
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:bg-dark-700 hover:text-gray-100 -mr-2 -mt-1"
            aria-label="Menü schließen"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileNavOpen(false)}
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
                  {isActive && <ChevronRight size={14} className="text-primary-500 shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User-Bereich */}
        <div className="p-3 border-t border-dark-700 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 px-2 py-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-300 shrink-0">
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
              className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-dark-900 min-w-0 pt-14 lg:pt-0 pb-[env(safe-area-inset-bottom)]">
        <Outlet />
      </main>
    </div>
  );
}
