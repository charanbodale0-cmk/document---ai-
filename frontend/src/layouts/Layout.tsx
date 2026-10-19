import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, MessageSquare, GitCompare,
  BarChart3, Settings, HelpCircle, ChevronLeft, ChevronRight,
  Search, Bell, Brain, Menu, X,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/documents', label: 'My Documents', icon: FileText },
  { path: '/chat', label: 'AI Chat', icon: MessageSquare },
  { path: '/compare', label: 'Document Comparison', icon: GitCompare },
  { path: '/insights', label: 'Insights & Analytics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const pageTitle = navItems.find(i => i.path === location.pathname)?.label || 'DocuMind AI';

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface)]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          flex flex-col bg-white border-r border-gray-100
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className={`flex items-center gap-3 px-5 py-5 border-b border-gray-50 ${collapsed ? 'justify-center px-3' : ''}`}>
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-base font-bold gradient-text leading-tight">DocuMind AI</h1>
              <p className="text-[10px] text-gray-400 font-medium tracking-wide">DOCUMENT INTELLIGENCE</p>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Help */}
        <div className="px-3 pb-3">
          <button
            className={`sidebar-link w-full ${collapsed ? 'justify-center px-2' : ''}`}
            title="Help & About"
          >
            <HelpCircle className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Help & About</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <div className="hidden lg:flex border-t border-gray-50 px-3 py-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-link w-full justify-center"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top nav */}
        <header className="h-[60px] bg-white/80 backdrop-blur-sm border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-lg font-semibold text-[var(--color-navy-800)]">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="hidden md:flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 w-64">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-400"
              />
            </div>

            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
              <Bell className="w-[18px] h-[18px] text-gray-500" />
            </button>

            {/* Profile */}
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center cursor-pointer">
              <span className="text-white text-xs font-bold">U</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
