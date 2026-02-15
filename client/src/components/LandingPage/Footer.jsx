import { memo } from "react"
import { Link } from "react-router-dom"
import { Github, Twitter } from "lucide-react"

const Footer = memo(() => {
  return (
    <footer className="bg-[#050505] border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img
              src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
              alt="SyncVibe"
              className="w-8 h-8 rounded-xl"
            />
            <span className="text-lg font-bold text-white">SyncVibe</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-8 text-sm">
            <a href="#features" className="text-white/40 hover:text-white transition-colors">
              Features
            </a>
            <Link to="/plans" className="text-white/40 hover:text-white transition-colors">
              Pricing
            </Link>
            <a href="#download" className="text-white/40 hover:text-white transition-colors">
              Download
            </a>
            <Link to="/privacy-policy" className="text-white/40 hover:text-white transition-colors">
              Privacy
            </Link>
            <Link
              to="/terms-of-services"
              className="text-white/40 hover:text-white transition-colors"
            >
              Terms
            </Link>
            <Link to="/refund-policy" className="text-white/40 hover:text-white transition-colors">
              Refund Policy
            </Link>
          </div>

          {/* Social */}
          <div className="flex items-center gap-4">
            <a
              href="https://x.com/thakurdotdev"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <Twitter className="w-4 h-4 text-white/60" />
            </a>
            <a
              href="https://github.com/thakurdotdev"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <Github className="w-4 h-4 text-white/60" />
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} SyncVibe. All rights reserved.
          </p>
          <p className="text-sm text-white/30">
            Made with ♥ by{" "}
            <a
              href="https://thakur.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-400 hover:text-rose-300 transition-colors"
            >
              Pankaj Thakur
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
})

export default Footer
