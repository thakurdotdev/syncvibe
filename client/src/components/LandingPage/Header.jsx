import React from "react";
import LazyImage from "../LazyImage";
import { Button } from "../ui/button";
import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md">
      <nav className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <Link to="/">
            <div className="flex items-center gap-3">
              <LazyImage
                src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
                height={40}
                width={40}
                alt="SyncVibe"
                className="w-10 h-10 rounded-full"
              />

              <span className="text-xl font-bold">SyncVibe</span>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <Link to="/login">
              <Button
                variant="ghost"
                className="rounded-full px-6 hover:bg-white/5 text-white/90"
              >
                Login
              </Button>
            </Link>
            <div>
              <Link to="/register">
                <Button className="rounded-full px-6">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
