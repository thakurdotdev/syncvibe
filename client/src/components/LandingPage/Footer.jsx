import { Link } from "react-router-dom";

const Footer = () => {
  const navigation = {
    legal: [
      { name: "Privacy Policy", href: "/privacy-policy" },
      { name: "Terms of Service", href: "/terms-of-services" },
    ],
    social: [
      { name: "X (Twitter)", href: "https://x.com/thakurdotdev" },
      { name: "LinkedIn", href: "https://linkedin.com/in/thakurdotdev" },
      { name: "GitHub", href: "https://github.com/thakurdotdev" },
    ],
  };

  return (
    <footer>
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <img
                src="https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/r_max/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
                alt="SyncVibe"
                className="w-10 h-10 rounded-lg shadow-lg"
              />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400">
                SyncVibe
              </span>
            </div>
            <p className="text-gray-400 text-sm">info@syncvibe.xyz</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">
              Legal
            </h3>
            <ul className="space-y-2">
              {navigation.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className="text-gray-400 hover:text-gray-300 transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">
              Connect
            </h3>
            <ul className="space-y-2">
              {navigation.social.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-gray-400 hover:text-gray-300 transition-colors text-sm"
                    target="_blank"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 pb-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} SyncVibe. All rights reserved.
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              Made with<span className="mx-1">❤️</span>
              by
              <a
                href="https://thakur.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 transition-colors"
              >
                Pankaj Thakur
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
