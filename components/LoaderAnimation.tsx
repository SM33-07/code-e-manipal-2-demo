"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface LoaderAnimationProps {
  onComplete: () => void;
}

export default function LoaderAnimation({ onComplete }: LoaderAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  // Reduced motion: bypass animation immediately for accessibility
  useEffect(() => {
    if (typeof window !== "undefined") {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced) {
        onComplete();
      }
    }
  }, [onComplete]);

  // Failsafe: ensure loader never traps the user under any circumstance
  useEffect(() => {
    const failsafe = setTimeout(() => {
      onComplete();
    }, 4000);
    return () => clearTimeout(failsafe);
  }, [onComplete]);

  // Memoize particle positions so they don't re-randomize on every render
  const particles = useMemo(
    () =>
      Array.from({ length: 25 }).map((_, i) => ({
        left: (i * 37 + 11) % 100,
        top: (i * 61 + 7) % 100,
        size: ((i * 17) % 25) / 10 + 0.5,
        duration: ((i * 13) % 60) / 10 + 4,
        delay: ((i * 7) % 50) / 10,
        yTravel: (i * 19) % 80 + 30,
      })),
    []
  );

  // Memoize bird data
  const birds = useMemo(
    () => [
      { left: "28%", top: "32%", delay: 2, scale: 0.7 },
      { left: "32%", top: "30%", delay: 2.3, scale: 0.5 },
      { left: "68%", top: "31%", delay: 3, scale: 0.6 },
      { left: "72%", top: "33%", delay: 3.4, scale: 0.45 },
      { left: "25%", top: "28%", delay: 4, scale: 0.4 },
    ],
    []
  );

  const handleSkip = useCallback(() => {
    setProgress(100);
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 300);
  }, [onComplete]);

  // Escape key listener for keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSkip]);

  // Increment progress counter smoothly
  useEffect(() => {
    if (progress >= 100) {
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, 200);

      const completeTimer = setTimeout(() => {
        onComplete();
      }, 800);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(completeTimer);
      };
    }

    const timer = setTimeout(() => {
      setProgress((prev) => {
        const increment = Math.random() * 1.8 + 0.8;
        return Math.min(100, prev + increment);
      });
    }, Math.random() * 15 + 15);

    return () => clearTimeout(timer);
  }, [progress, onComplete]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden flex flex-col items-center justify-between"
          style={{ background: "linear-gradient(180deg, #050505 0%, #070a12 50%, #050505 100%)" }}
        >
          {/* ===== BACKGROUND LAYERS ===== */}

          {/* Subtle Grid Texture */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(246,196,83,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(246,196,83,0.3) 1px, transparent 1px)
              `,
              backgroundSize: "50px 50px",
            }}
          />

          {/* Cinematic Vignette */}
          <div
            className="absolute inset-0 z-[2] pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 30%, rgba(5,5,5,0.7) 70%, rgba(5,5,5,0.95) 100%)",
            }}
          />

          {/* MUJ Building Golden Wireframe Background */}
          <motion.div
            className="absolute z-[1] pointer-events-none w-[180vw] sm:w-[97vw] left-[-40vw] sm:left-[1%] -top-[10%] sm:-top-[25%]"
            style={{
              transform: "translateX(-50%)",
              maxWidth: "1650px",
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2.5, ease: "easeOut", delay: 0.3 }}
          >
            <Image
              src="/MUJ-BUILD.webp"
              alt="MUJ Campus Building"
              width={1600}
              height={1600}
              sizes="(max-width: 639px) 180vw, 97vw"
              loading="eager"
              fetchPriority="high"
              className="w-full h-auto object-contain opacity-[0.35] mix-blend-screen"
              style={{
                filter: "drop-shadow(0 0 12px rgba(246,196,83,0.15))",
              }}
            />
          </motion.div>

          {/* Floating Particles */}
          <div className="absolute inset-0 z-[3] overflow-hidden pointer-events-none">
            {particles.map((p, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-[#F6C453]"
                style={{
                  width: p.size + "px",
                  height: p.size + "px",
                  left: p.left + "%",
                  top: p.top + "%",
                  filter: "blur(0.5px)",
                }}
                animate={{
                  y: [0, -p.yTravel],
                  opacity: [0, 0.7, 0],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: p.delay,
                }}
              />
            ))}
          </div>

          {/* Bird Silhouettes */}
          {birds.map((bird, i) => (
            <motion.div
              key={`bird-${i}`}
              className="absolute z-[3] pointer-events-none"
              style={{ left: bird.left, top: bird.top, transform: `scale(${bird.scale})` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.25, 0.15, 0] }}
              transition={{ duration: 6, delay: bird.delay, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
                <path d="M 0 8 Q 6 0 12 5 Q 18 0 24 8" stroke="#F6C453" strokeWidth="1" fill="none" opacity="0.6" />
              </svg>
            </motion.div>
          ))}

          {/* ===== HUD FRAME CORNERS ===== */}

          {/* Top-Left Corner */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-[10] pointer-events-none w-10 h-10 sm:w-20 sm:h-20">
            <svg className="w-full h-full sm:w-auto sm:h-auto" width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M 0 30 L 0 8 Q 0 0 8 0 L 30 0" stroke="#F6C453" strokeWidth="1.5" opacity="0.5" />
              <path d="M 8 8 L 25 8" stroke="#F6C453" strokeWidth="1" opacity="0.4" />
              <path d="M 8 8 L 8 25" stroke="#F6C453" strokeWidth="1" opacity="0.4" />
              <rect x="0" y="0" width="3" height="3" fill="#F6C453" opacity="0.8" />
            </svg>
          </div>

          {/* Top-Right Corner */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[10] pointer-events-none w-10 h-10 sm:w-20 sm:h-20">
            <svg className="w-full h-full sm:w-auto sm:h-auto" width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M 80 30 L 80 8 Q 80 0 72 0 L 50 0" stroke="#F6C453" strokeWidth="1.5" opacity="0.5" />
              <path d="M 72 8 L 55 8" stroke="#F6C453" strokeWidth="1" opacity="0.4" />
              <path d="M 72 8 L 72 25" stroke="#F6C453" strokeWidth="1" opacity="0.4" />
              <rect x="77" y="0" width="3" height="3" fill="#F6C453" opacity="0.8" />
            </svg>
          </div>

          {/* Bottom-Left Corner */}
          <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-[10] pointer-events-none w-10 h-10 sm:w-20 sm:h-20">
            <svg className="w-full h-full sm:w-auto sm:h-auto" width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M 0 50 L 0 72 Q 0 80 8 80 L 30 80" stroke="#F6C453" strokeWidth="1.5" opacity="0.5" />
              <rect x="0" y="77" width="3" height="3" fill="#F6C453" opacity="0.8" />
            </svg>
          </div>

          {/* Bottom-Right Corner */}
          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-[10] pointer-events-none w-10 h-10 sm:w-20 sm:h-20">
            <svg className="w-full h-full sm:w-auto sm:h-auto" width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M 80 50 L 80 72 Q 80 80 72 80 L 50 80" stroke="#F6C453" strokeWidth="1.5" opacity="0.5" />
              <rect x="77" y="77" width="3" height="3" fill="#F6C453" opacity="0.8" />
            </svg>
          </div>

          {/* Dotted Border - Top */}
          <motion.div
            className="absolute top-3 left-14 right-14 sm:left-20 sm:right-20 h-[1px] z-[10] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, #F6C453 1px, transparent 1px)",
              backgroundSize: "10px 1px",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            transition={{ delay: 1, duration: 1 }}
          />

          {/* Dotted Border - Right */}
          <motion.div
            className="absolute top-14 bottom-14 sm:top-20 sm:bottom-20 right-3 w-[1px] z-[10] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, #F6C453 1px, transparent 1px)",
              backgroundSize: "1px 10px",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            transition={{ delay: 1.2, duration: 1 }}
          />

          {/* ===== SKIP BUTTON ===== */}
          <button
            type="button"
            onClick={handleSkip}
            className="pointer-events-auto absolute top-4 right-6 sm:top-6 sm:right-10 z-[20] rounded-full border border-[#F6C453]/30 bg-black/85 px-5 py-2 font-mono text-[10px] sm:text-xs text-[#F6C453] tracking-wider transition-all duration-300 hover:bg-[#F6C453] hover:text-black hover:shadow-[0_0_15px_rgba(246,196,83,0.4)] focus:outline-none cursor-pointer"
          >
            SKIP INTRO
          </button>

          {/* ===== MAIN CONTENT ===== */}
          <div className="flex-1 flex flex-col items-center justify-center z-[15] w-full px-4 max-w-4xl mx-auto">
            {/* ── LOGO SECTION ── */}
            <motion.div
              className="relative mb-4 sm:mb-6 flex justify-center items-center"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              {/* Pulsating Glow Aura */}
              <motion.div
                className="absolute w-28 h-28 md:w-36 md:h-36 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(246,196,83,0.15) 0%, transparent 70%)",
                }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Animated Circuit Lines extending from Logo */}
              <div className="absolute inset-0 flex items-center justify-center">
                {[
                  { angle: -30, len: 100 },
                  { angle: 30, len: 90 },
                  { angle: -60, len: 70 },
                  { angle: 60, len: 75 },
                  { angle: 150, len: 55 },
                  { angle: 210, len: 55 },
                ].map((line, i) => (
                  <motion.div
                    key={`circuit-${i}`}
                    className="absolute h-[1px] origin-left"
                    style={{
                      transform: `rotate(${line.angle}deg)`,
                      background: "linear-gradient(90deg, rgba(246,196,83,0.6), rgba(246,196,83,0))",
                    }}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{
                      width: [0, line.len, line.len],
                      opacity: [0, 0.7, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      delay: i * 0.4 + 0.5,
                      ease: "easeInOut",
                    }}
                  />
                ))}
                {/* Node dots at circuit endpoints */}
                {[
                  { angle: -30, dist: 100 },
                  { angle: 30, dist: 90 },
                ].map((node, i) => {
                  const rad = (node.angle * Math.PI) / 180;
                  return (
                    <motion.div
                      key={`node-${i}`}
                      className="absolute w-1.5 h-1.5 rounded-full bg-[#F6C453] shadow-[0_0_6px_#F6C453]"
                      style={{
                        left: `calc(50% + ${Math.cos(rad) * node.dist}px - 3px)`,
                        top: `calc(50% + ${Math.sin(rad) * node.dist}px - 3px)`,
                      }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 + 1.5 }}
                    />
                  );
                })}
              </div>

              {/* Logo Container - Circular with glow border */}
              <div className="relative z-10 w-20 h-20 md:w-28 md:h-28 rounded-full border border-[#F6C453]/30 shadow-[0_0_25px_rgba(246,196,83,0.12)] bg-[#050505] flex items-center justify-center p-2">
                {/* Rotating dashed inner ring */}
                <motion.div
                  className="absolute inset-1 rounded-full border border-dashed border-[#F6C453]/25"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                {/* Outer decorative dots ring */}
                <div className="absolute inset-0">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const angle = (i * 360) / 24;
                    const rad = (angle * Math.PI) / 180;
                    const r = 50;
                    return (
                      <div
                        key={`dot-${i}`}
                        className="absolute w-[2px] h-[2px] rounded-full bg-[#F6C453]/40"
                        style={{
                          left: `${(50 + Math.cos(rad) * r).toFixed(2)}%`,
                          top: `${(50 + Math.sin(rad) * r).toFixed(2)}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    );
                  })}
                </div>
                {/* Logo Image */}
                <Image
                  src="/logo.png"
                  alt="Learn IT Logo"
                  width={90}
                  height={90}
                  className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(246,196,83,0.7)]"
                  priority
                />
              </div>
            </motion.div>

            {/* ── TITLE SECTION ── */}
            <motion.div
              className="text-center mb-2 sm:mb-3 relative"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            >
              <h1
                className="text-3xl min-[400px]:text-4xl sm:text-5xl md:text-7xl font-serif tracking-widest text-transparent bg-clip-text"
                style={{
                  backgroundImage: "linear-gradient(180deg, #FFF8E1 0%, #F6C453 60%, #C9A227 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 20px rgba(246,196,83,0.3))",
                }}
              >
                LearnIT
              </h1>
            </motion.div>

            <motion.div
              className="text-center mb-1"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
            >
              <h2
                className="text-[9px] min-[400px]:text-xs md:text-sm tracking-[0.2em] min-[400px]:tracking-[0.35em] font-light uppercase"
                style={{ color: "#F6C453", opacity: 0.8 }}
              >
                Manipal University Jaipur
              </h2>
            </motion.div>

            {/* Three diamond decorations */}
            <motion.div
              className="flex items-center gap-2 mb-6 sm:mb-10 mt-2"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <div className="w-1.5 h-1.5 rotate-45 bg-[#F6C453]/50" />
              <div className="w-2 h-2 rotate-45 bg-[#F6C453]" />
              <div className="w-1.5 h-1.5 rotate-45 bg-[#F6C453]/50" />
            </motion.div>

            {/* ── LOADING CARD ── */}
            <motion.div
              className="w-full max-w-lg relative z-[15]"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
            >
              {/* Outer decorative border (double border effect) */}
              <div
                className="relative p-[2px] rounded-lg"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(246,196,83,0.4), rgba(246,196,83,0.1), rgba(246,196,83,0.4))",
                }}
              >
                <div className="p-[3px] rounded-lg bg-[#0A0A0A]/90">
                  <div
                    className="relative p-[1px] rounded-md"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(246,196,83,0.5), rgba(246,196,83,0.15), rgba(246,196,83,0.5))",
                    }}
                  >
                    {/* Glassmorphism Inner Panel */}
                    <div className="relative overflow-hidden rounded-md bg-[#0A0A0A] px-6 py-5 md:px-8 md:py-6">
                      {/* Top glowing edge */}
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#F6C453]/60 to-transparent" />

                      {/* Card content */}
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <h3 className="text-lg md:text-xl font-semibold tracking-wide" style={{ color: "#FFF5E1" }}>
                            CODE-ए-MANIPAL
                          </h3>
                          <p
                            className="text-xs md:text-sm mt-1 font-light tracking-wider"
                            style={{ color: "rgba(246,196,83,0.55)" }}
                          >
                            Great things are loading. Please wait.
                          </p>
                        </div>
                        <div
                          className="text-2xl md:text-3xl font-light tabular-nums tracking-tighter"
                          style={{ color: "#F6C453" }}
                        >
                          {Math.min(Math.round(progress), 100)}
                          <span className="text-sm ml-0.5" style={{ color: "rgba(246,196,83,0.5)" }}>
                            %
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div
                        className="h-2 w-full rounded-full overflow-hidden relative"
                        style={{ background: "#111111", border: "1px solid rgba(246,196,83,0.12)" }}
                      >
                        <motion.div
                          className="h-full relative"
                          style={{
                            width: `${Math.min(progress, 100)}%`,
                            background: "linear-gradient(90deg, #C9A227, #F6C453, #FFE066)",
                          }}
                          layout
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          {/* Inner bright core */}
                          <div
                            className="absolute inset-0"
                            style={{
                              background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 60%)",
                            }}
                          />
                          {/* Leading glow orb */}
                          <div
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/80 shadow-[0_0_10px_rgba(246,196,83,1),0_0_20px_rgba(246,196,83,0.6)]"
                            style={{ filter: "blur(1px)" }}
                          />
                        </motion.div>
                      </div>

                      {/* Micro HUD Elements */}
                      <div className="flex justify-between items-center mt-3">
                        <div className="flex gap-1">
                          <motion.div
                            className="w-1 h-1 bg-[#F6C453]"
                            animate={{ opacity: [0.2, 1, 0.2] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                          />
                          <motion.div
                            className="w-1 h-1 bg-[#F6C453]"
                            animate={{ opacity: [0.2, 1, 0.2] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                          />
                          <motion.div
                            className="w-1 h-1 bg-[#F6C453]"
                            animate={{ opacity: [0.2, 1, 0.2] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                          />
                        </div>
                        <span
                          className="font-mono text-[9px] tracking-widest uppercase"
                          style={{ color: "rgba(246,196,83,0.35)" }}
                        >
                          SYS.INIT.2026
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Corner accents on the loading card - like the reference image's futuristic beveled corners */}
              {/* Top-left */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#F6C453]/60 rounded-tl-sm" />
              {/* Top-right */}
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#F6C453]/60 rounded-tr-sm" />
              {/* Bottom-left */}
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#F6C453]/60 rounded-bl-sm" />
              {/* Bottom-right */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#F6C453]/60 rounded-br-sm" />

              {/* Circuit lines extending from card sides */}
              <motion.div
                className="hidden sm:block absolute -left-10 top-1/2 h-[1px] w-8"
                style={{ background: "linear-gradient(90deg, rgba(246,196,83,0), rgba(246,196,83,0.5))" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
              />
              <motion.div
                className="hidden sm:block absolute -right-10 top-1/2 h-[1px] w-8"
                style={{ background: "linear-gradient(270deg, rgba(246,196,83,0), rgba(246,196,83,0.5))" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
              />
            </motion.div>
          </div>

          {/* ===== FOOTER SECTION ===== */}
          <motion.div
            className="z-[15] pb-4 sm:pb-6 pt-2 sm:pt-4 flex flex-col items-center justify-center gap-3 sm:gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 1.5 }}
          >
            {/* Small footer logo */}
            <motion.div
              className="relative w-10 h-10 rounded-full border border-[#F6C453]/20 bg-[#050505] flex items-center justify-center shadow-[0_0_12px_rgba(246,196,83,0.08)]"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {/* Rotating ring */}
              <motion.div
                className="absolute inset-0 rounded-full border border-dashed border-[#F6C453]/20"
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />
              <Image
                src="/logo.png"
                alt="Learn IT"
                width={28}
                height={12}
                className="h-3 w-7 object-contain drop-shadow-[0_0_8px_rgba(246,196,83,0.5)]"
              />

              {/* Footer circuit lines */}
              <motion.div
                className="absolute -right-8 top-1/2 h-[1px] w-6"
                style={{ background: "linear-gradient(90deg, rgba(246,196,83,0.4), transparent)" }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute -left-8 top-1/2 h-[1px] w-6"
                style={{ background: "linear-gradient(270deg, rgba(246,196,83,0.4), transparent)" }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
              />
            </motion.div>

            {/* Footer tagline */}
            <div className="flex items-center gap-3">
              <div className="hidden min-[400px]:block h-[1px] w-8 bg-gradient-to-r from-transparent to-[#F6C453]/40" />
              <p
                className="text-[8px] min-[400px]:text-[10px] md:text-xs uppercase tracking-[0.15em] min-[400px]:tracking-[0.2em] font-light italic text-center px-2"
                style={{ color: "rgba(246,196,83,0.65)" }}
              >
                Empowering Minds. Building the Future.
              </p>
              <div className="hidden min-[400px]:block h-[1px] w-8 bg-gradient-to-l from-transparent to-[#F6C453]/40" />
            </div>
          </motion.div>

          {/* Background shimmer sweep */}
          <motion.div
            className="absolute w-full h-[1px] z-[4] pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(246,196,83,0.15), transparent)",
              top: "50%",
            }}
            animate={{ y: [-200, 200], opacity: [0, 0.6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
