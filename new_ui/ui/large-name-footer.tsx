"use client";
import Link from "next/link";

function Footer() {
  return (
    <footer className="py-16 px-6 bg-white border-t border-neutral-100 text-neutral-700" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          <div className="mb-8 md:mb-0 max-w-md">
            <Link href="#" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
              <div>
                <img src="/wpx-logo.png" alt="WPxShield" style={{ height: "76px", width: "auto" }} />
              </div>
            </Link>

            <p className="text-sm text-neutral-500 mt-4 leading-relaxed">
              Decoupled Companion Security Plugin and Cloud Analytics Platform for WordPress installations. Engineered for absolute defense.
            </p>
            <p className="text-xs text-neutral-400 mt-6">
              © {new Date().getFullYear()} 3cits cybernra. All rights reserved.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-16">
            <div>
              <h3 className="font-bold text-sm text-neutral-900 mb-4 tracking-wider uppercase">Navigation</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="#features" className="text-neutral-500 hover:text-[#285A48] transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="text-neutral-500 hover:text-[#285A48] transition-colors">
                    Pricing Plans
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-neutral-500 hover:text-[#285A48] transition-colors">
                    Dashboard Login
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-sm text-neutral-900 mb-4 tracking-wider uppercase">Legal</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/privacy" className="text-neutral-500 hover:text-[#285A48] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-neutral-500 hover:text-[#285A48] transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div className="w-full flex mt-4 items-center justify-center select-none overflow-hidden" style={{ marginBottom: "-4rem" }}>
        <h1 className="text-center text-[15vw] font-black select-none tracking-tighter leading-none text-transparent bg-clip-text" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0, padding: 0, backgroundImage: "linear-gradient(to bottom, #091413, #285A48, #408A71, #B0E4CC)" }}>
          WPxShield
        </h1>
      </div>
    </footer>
  );
}

export { Footer };
