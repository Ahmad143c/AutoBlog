import { useState } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import LandingPage from "./pages/LandingPage"
import Signup from "./pages/Signup"
import Login from "./pages/Login"
import DashboardLayout from "./layouts/DashboardLayout"
import DashboardHome from "./pages/dashboard/DashboardHome.tsx"
import Sites from "./pages/dashboard/Sites.tsx"
import EditSite from "./pages/dashboard/EditSite.tsx"
import SiteSocial from "./pages/dashboard/SiteSocial.tsx"
import Posts from "./pages/dashboard/Posts.tsx"
import NewPost from "./pages/dashboard/NewPost.tsx"
import EditPost from "./pages/dashboard/EditPost.tsx"
import Workflows from "./pages/dashboard/Workflows.tsx"
import Settings from "./pages/dashboard/Settings.tsx"
import Preloader from "./components/ui/Preloader"

export default function App() {
  const [appReady, setAppReady] = useState(false)

  return (
    <>
      <Preloader onComplete={() => setAppReady(true)} />
      <div
        style={{
          opacity: appReady ? 1 : 0,
          transition: "opacity 0.4s ease",
          pointerEvents: appReady ? "auto" : "none",
        }}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="sites" element={<Sites />} />
            <Route path="sites/:id/edit" element={<EditSite />} />
            <Route path="sites/:id/social" element={<SiteSocial />} />
            <Route path="posts" element={<Posts />} />
            <Route path="posts/new" element={<NewPost />} />
            <Route path="posts/:id/edit" element={<EditPost />} />
            <Route path="workflows" element={<Workflows />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  )
}

