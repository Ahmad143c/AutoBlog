import { useEffect, useState } from "react"
import { PenTool, Zap } from "lucide-react"

interface LoginLoaderProps {
  onComplete: () => void
}

/**
 * LoginLoader
 * ────────────
 * A branded full-screen transition that plays after a successful login,
 * before the dashboard appears. ~1.4 s total.
 */
export default function LoginLoader({ onComplete }: LoginLoaderProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter")

  useEffect(() => {
    const holdTimer  = setTimeout(() => setPhase("hold"), 300)
    const exitTimer  = setTimeout(() => setPhase("exit"), 900)
    const doneTimer  = setTimeout(() => onComplete(), 1400)
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [onComplete])

  return (
    <div className={`login-loader-root login-loader-${phase}`} aria-label="Signing you in…" role="status">
      {/* Background blobs */}
      <div className="login-loader-blob login-loader-blob-1" />
      <div className="login-loader-blob login-loader-blob-2" />

      <div className="login-loader-body">
        {/* Logo */}
        <div className="login-loader-logo">
          <div className="login-loader-ring" />
          <div className="login-loader-icon">
            <PenTool size={26} strokeWidth={2} />
          </div>
        </div>

        {/* Brand */}
        <div className="login-loader-brand">
          <span className="login-loader-brand-auto">Auto</span>
          <span className="login-loader-brand-blog">Blog</span>
        </div>

        {/* Status text */}
        <div className="login-loader-status">
          <Zap size={14} className="login-loader-status-icon" />
          <span>Setting up your dashboard…</span>
        </div>

        {/* Animated dots */}
        <div className="login-loader-dots">
          <span className="login-loader-dot-1" />
          <span className="login-loader-dot-2" />
          <span className="login-loader-dot-3" />
        </div>
      </div>
    </div>
  )
}
