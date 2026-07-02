import React from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import authImage from "@/assets/auth.png"

const AuthLayout = () => {
  const location = useLocation()
  const isRegister = location.pathname === "/register"
  const headerLinkPath = isRegister ? "/login" : "/register"
  const headerLinkLabel = isRegister ? "Log in" : "Sign up"

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background text-foreground">
      {/* Left Column - Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 md:p-12 lg:p-16 bg-zinc-50/40 dark:bg-[#050505] transition-colors duration-300">
        <div className="max-w-[420px] w-full mx-auto flex-1 flex flex-col justify-between gap-8">
          {/* Top Header Row */}
          <header className="flex items-center justify-between w-full">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/r_max/f_auto/v1780744511/profiles/profiles_130_1780744510_4a18b0ed9043cc21.jpg"
                alt="SyncVibe"
                className="w-8 h-8 rounded-xl object-cover shadow-sm transition-transform group-hover:scale-105"
              />
              <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">SyncVibe</span>
            </Link>
            <Link
              to={headerLinkPath}
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              {headerLinkLabel}
            </Link>
          </header>

          {/* Center Auth Form */}
          <main className="w-full my-auto py-4 flex flex-col justify-center">
            <Outlet />
          </main>

          {/* Footer Row */}
          <footer className="flex items-center justify-between w-full text-xs text-zinc-400 dark:text-zinc-500">
            <span>© 2026 SyncVibe</span>
            <div className="flex gap-4">
              <Link to="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-350 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-350 transition-colors">Terms</Link>
            </div>
          </footer>
        </div>
      </div>

      {/* Right Column - Image */}
      <div className="hidden md:block md:w-[50%] lg:w-[55%] relative p-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full h-full relative overflow-hidden rounded-[2rem] border border-zinc-150/50 dark:border-zinc-800/50 shadow-md">
          <img
            src={authImage}
            alt="SyncVibe Scene"
            className="w-full h-full object-cover select-none"
            loading="eager"
          />
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
