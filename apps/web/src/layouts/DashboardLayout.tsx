import { Outlet, Link, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { 
  LayoutDashboard, 
  Globe, 
  FileText, 
  Zap, 
  Settings, 
  Bell,
  X,
  PenTool,
  LogOut,
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import NavigationLoader from "../components/ui/NavigationLoader"
import ThemeToggle from "../components/ui/ThemeToggle"


export default function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isSidebarOpen] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarTimer, setSidebarTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [user, setUser] = useState<any>(null)
  const [showGuidance, setShowGuidance] = useState(false)
  const [isHoveringOnSidebar, setIsHoveringOnSidebar] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user')
    const token = localStorage.getItem('auth_token')
    if (!userData || !token) {
      navigate('/login')
    } else {
      setUser(JSON.parse(userData))
      // Show guidance popup for new users
      const hasSeenGuidance = localStorage.getItem('hasSeenGuidance')
      if (!hasSeenGuidance) {
        setShowGuidance(true)
      }
    }
  }, [navigate])

  useEffect(() => {
    // Auto-collapse sidebar after 20 seconds if open, not collapsed, and not hovering
    if (isSidebarOpen && !isSidebarCollapsed && !isHoveringOnSidebar) {
      const timer = setTimeout(() => {
        setIsSidebarCollapsed(true)
      }, 20000)
      setSidebarTimer(timer)
    }

    return () => {
      if (sidebarTimer) {
        clearTimeout(sidebarTimer)
      }
    }
  }, [isSidebarOpen, isSidebarCollapsed, isHoveringOnSidebar])

  const handleLogout = () => {
    localStorage.removeItem('user')
    navigate('/login')
  }

  const closeGuidance = () => {
    setShowGuidance(false)
    localStorage.setItem('hasSeenGuidance', 'true')
  }

  const handleSidebarHoverEnter = () => {
    setIsHoveringOnSidebar(true)
    setIsSidebarCollapsed(false)
    // Clear any existing timer
    if (sidebarTimer) {
      clearTimeout(sidebarTimer)
      setSidebarTimer(null)
    }
  }

  const handleSidebarHoverLeave = () => {
    setIsHoveringOnSidebar(false)
    // Auto-collapse after 3 seconds of leaving hover
    const timer = setTimeout(() => {
      setIsSidebarCollapsed(true)
    }, 3000)
    setSidebarTimer(timer)
  }
  
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Sites", href: "/dashboard/sites", icon: Globe },
    { name: "Posts", href: "/dashboard/posts", icon: FileText },
    { name: "Workflows", href: "/dashboard/workflows", icon: Zap },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === href
    }
    return location.pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <NavigationLoader />
      {/* Sidebar */}
      <div 
        onMouseEnter={handleSidebarHoverEnter}
        onMouseLeave={handleSidebarHoverLeave}
        className={`${isSidebarOpen ? (isSidebarCollapsed ? 'w-20' : 'w-64') : 'w-0'} bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800/80 shadow-sm transition-all duration-300 overflow-visible relative`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-center">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <PenTool className="h-6 w-6 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <h1 className="ml-3 text-2xl font-bold text-gray-900 dark:text-white">AutoBlog</h1>
            )}
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navigation.slice(0, 2).map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive(item.href)
                          ? "bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                      title={isSidebarCollapsed ? item.name : ''}
                    >
                      <Icon className={`${isSidebarCollapsed ? '' : 'mr-3'} h-5 w-5`} />
                      {!isSidebarCollapsed && item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <ul className="space-y-2">
              {navigation.slice(2).map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive(item.href)
                          ? "bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                      title={isSidebarCollapsed ? item.name : ''}
                    >
                      <Icon className={`${isSidebarCollapsed ? '' : 'mr-3'} h-5 w-5`} />
                      {!isSidebarCollapsed && item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800/80">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!isSidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0 text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-gray-200"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Collapse Toggle - Right Border Center */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-850 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 shadow-lg transition-colors z-50 text-gray-600 dark:text-gray-400"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800/80 h-16 transition-colors duration-300">
          <div className="flex items-center justify-between h-full px-6">
            {/* Left: Toggle Button */}
            <div className="flex items-center space-x-4">
            </div>

            {/* Right: Notifications, Help, and User */}
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <button 
                onClick={() => setShowGuidance(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Help"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <Bell className="h-5 w-5" />
              </button>
              
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Guidance Popup */}
      {showGuidance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Welcome to AutoBlog! 🎉</h2>
                <button 
                  onClick={closeGuidance}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Connect Your Sites</h3>
                    <p className="text-gray-600 text-sm">Go to the Sites page and connect your WordPress or Next.js websites. This allows AutoBlog to publish content directly to your sites.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Create Posts</h3>
                    <p className="text-gray-600 text-sm">Use the New Post page to generate AI-powered blog content. Enter your topic, keywords, and tone, and let AI create your article.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Set Up Workflows</h3>
                    <p className="text-gray-600 text-sm">Create automated workflows in the Workflows page to generate and publish content on a schedule. Set it once and let AutoBlog handle the rest!</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-bold">4</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Monitor Progress</h3>
                    <p className="text-gray-600 text-sm">Check the Dashboard for an overview of your sites, posts, and workflow status. Track your content automation success!</p>
                  </div>
                </div>

                <div className="bg-primary-50 rounded-lg p-4">
                  <p className="text-sm text-primary-800">
                    <strong>💡 Tip:</strong> Use the collapse button at the bottom of the sidebar to switch between icon-only and full sidebar views.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={closeGuidance}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
