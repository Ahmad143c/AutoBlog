import { useEffect, useState } from "react"
import { PenTool } from "lucide-react"

interface PreloaderProps {
  onComplete?: () => void
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<"loading" | "done">("loading")
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Simulate loading progress with realistic timing
    const steps = [
      { target: 30, delay: 0, duration: 400 },
      { target: 60, delay: 420, duration: 500 },
      { target: 85, delay: 940, duration: 600 },
      { target: 100, delay: 1560, duration: 400 },
    ]

    const timers: ReturnType<typeof setTimeout>[] = []

    steps.forEach(({ target, delay, duration }) => {
      const t = setTimeout(() => {
        const start = Date.now()
        const startVal = progress
        const step = () => {
          const elapsed = Date.now() - start
          const fraction = Math.min(elapsed / duration, 1)
          // ease-out cubic
          const eased = 1 - Math.pow(1 - fraction, 3)
          setProgress(Math.round(startVal + (target - startVal) * eased))
          if (fraction < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }, delay)
      timers.push(t)
    })

    // Trigger exit after loading completes
    const exitTimer = setTimeout(() => {
      setPhase("done")
    }, 2200)

    const hideTimer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 2800)

    timers.push(exitTimer, hideTimer)
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  return (
    <div
      className={`preloader-root ${phase === "done" ? "preloader-exit" : ""}`}
      aria-label="Loading AutoBlog…"
      role="status"
    >
      {/* Animated background orbs */}
      <div className="preloader-orb preloader-orb-1" />
      <div className="preloader-orb preloader-orb-2" />
      <div className="preloader-orb preloader-orb-3" />

      {/* Grid overlay */}
      <div className="preloader-grid" />

      {/* Center content */}
      <div className="preloader-content">
        {/* Logo mark */}
        <div className="preloader-logo">
          <div className="preloader-logo-ring" />
          <div className="preloader-logo-ring preloader-logo-ring-2" />
          <div className="preloader-logo-icon">
            <PenTool size={28} strokeWidth={2} />
          </div>
          {/* Orbiting dot */}
          <div className="preloader-orbit">
            <div className="preloader-orbit-dot" />
          </div>
        </div>

        {/* Brand name */}
        <div className="preloader-brand">
          <span className="preloader-brand-auto">Auto</span>
          <span className="preloader-brand-blog">Blog</span>
        </div>

        {/* Tagline */}
        <p className="preloader-tagline">AI-Powered Blog Automation</p>

        {/* Progress bar */}
        <div className="preloader-progress-track">
          <div
            className="preloader-progress-fill"
            style={{ width: `${progress}%` }}
          />
          <div
            className="preloader-progress-glow"
            style={{ left: `calc(${progress}% - 40px)` }}
          />
        </div>

        {/* Progress counter */}
        <div className="preloader-counter">{progress}%</div>

        {/* Animated pills */}
        <div className="preloader-pills">
          {["AI Writing", "SEO Ready", "Auto Publish"].map((label, i) => (
            <div
              key={label}
              className="preloader-pill"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <span className="preloader-pill-dot" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
