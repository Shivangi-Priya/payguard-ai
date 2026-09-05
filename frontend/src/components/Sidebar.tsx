import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Activity, BarChart3, Store, ShieldCheck, FlaskConical, Bell, ShieldAlert,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Live Feed', icon: Activity },
  { to: '/analytics', label: 'Fraud Analytics', icon: BarChart3 },
  { to: '/merchants', label: 'Merchant Risk', icon: Store },
  { to: '/agents', label: 'Agent Security', icon: ShieldCheck },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/simulator', label: 'Attack Simulator', icon: FlaskConical },
]

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <ShieldAlert size={18} strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">PayGuard AI</div>
          <div className="text-[10px] uppercase tracking-wider text-text-dim">Agentic Trust Layer</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-soft text-brand'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text'
              }`
            }
          >
            <item.icon size={16} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3 text-[11px] text-text-dim">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-safe animate-pulse" />
          Simulated payment environment
        </div>
      </div>
    </aside>
  )
}
