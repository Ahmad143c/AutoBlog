import { Sun, Moon } from "lucide-react"
import { useTheme } from "../../lib/ThemeContext"

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="relative p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 shadow-sm transition-all duration-300 overflow-hidden group"
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {/* Sun Icon */}
        <Sun
          className={`w-5 h-5 absolute transition-all duration-500 ease-spring ${
            isDark 
              ? "rotate-90 scale-0 opacity-0" 
              : "rotate-0 scale-100 opacity-100 group-hover:rotate-45"
          }`}
        />
        {/* Moon Icon */}
        <Moon
          className={`w-5 h-5 absolute transition-all duration-500 ease-spring ${
            isDark 
              ? "rotate-0 scale-100 opacity-100 group-hover:-rotate-12" 
              : "-rotate-90 scale-0 opacity-0"
          }`}
        />
      </div>
    </button>
  )
}
