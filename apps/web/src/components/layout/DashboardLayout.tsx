import { Outlet, NavLink } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'
import { 
  LayoutDashboard, 
  FileText, 
  Globe, 
  Workflow,
  PenTool
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/posts', icon: FileText, label: 'Posts' },
  { to: '/dashboard/sites', icon: Globe, label: 'Sites' },
  { to: '/dashboard/workflows', icon: Workflow, label: 'Workflows' },
]

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-4 md:px-6">
          <div className="flex items-center gap-2 mr-8">
            <PenTool className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">AutoBlog</span>
          </div>
          <div className="flex-1" />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-4rem)] border-r bg-card">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
