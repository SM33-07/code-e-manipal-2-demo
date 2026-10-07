"use client";

import Image from "next/image";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 flex items-center justify-center bg-transparent">
              <Image
                src="/logo.png"
                alt="Code-e-Manipal Logo"
                width={80}
                height={34}
                className="object-contain bg-transparent"
              />
            </div>

            <div>
              <h1 className="text-xl font-bold text-white">
                LearnIT Admin Dashboard
              </h1>
              <p className="text-sm text-white/60">
                Hackathon Control Center
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
