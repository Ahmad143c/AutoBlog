import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"

/**
 * NavigationLoader
 * ─────────────────
 * A slim NProgress-style progress bar + animated dot that fires on every
 * route change. It lives at the very top of the viewport (z-index 9998).
 */
export default function NavigationLoader() {
  const location = useLocation()
  const [active, setActive] = useState(false)
  const [width, setWidth] = useState(0)
  const [exit, setExit] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const prevPath = useRef(location.pathname)

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  useEffect(() => {
    // Don't trigger on initial mount
    if (location.pathname === prevPath.current && location.search === "") {
      prevPath.current = location.pathname
      return
    }
    prevPath.current = location.pathname

    clear()
    setExit(false)
    setWidth(0)
    setActive(true)

    // Animate from 0 → ~85% quickly, then hold
    const startTime = Date.now()
    const duration = 600

    const animate = () => {
      const elapsed = Date.now() - startTime
      const fraction = Math.min(elapsed / duration, 1)
      // Ease-out cubic — shoots to ~85%
      const eased = 1 - Math.pow(1 - fraction, 3)
      setWidth(eased * 85)
      if (fraction < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)

    // Complete after a short pause
    timerRef.current = setTimeout(() => {
      setWidth(100)
      setTimeout(() => {
        setExit(true)
        setTimeout(() => {
          setActive(false)
          setWidth(0)
          setExit(false)
        }, 300)
      }, 200)
    }, 700)

    return clear
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  if (!active) return null

  return (
    <div className="nav-loader-bar-wrap" aria-hidden="true">
      {/* Bar */}
      <div
        className={`nav-loader-bar ${exit ? "nav-loader-bar-exit" : ""}`}
        style={{ width: `${width}%` }}
      />
      {/* Glowing tip dot */}
      <div
        className="nav-loader-dot"
        style={{ left: `calc(${width}% - 6px)` }}
      />
    </div>
  )
}
