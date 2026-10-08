"use client";

import React, { useRef, useState, useEffect } from "react";

interface Spark {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  color: string;
  size: number;
  opacity: number;
}

interface ClickSparkProps {
  children: React.ReactNode;
  className?: string;
  sparkColors?: string[];
  particleCount?: number;
}

/**
 * CODE-e-MANIPAL 2.0 — High-Efficiency Click Spark
 *
 * Implements Level 5 selective interactive detail:
 * - Cancels RAF immediately when particles finish (0 idle CPU usage)
 * - Modest 6-8 particle count in Jaipur Pink and Antique Brass
 * - Zero execution under prefers-reduced-motion
 * - Wrapped around primary public hero interactions only
 */
export function ClickSpark({
  children,
  className,
  sparkColors = ["#B95745", "#B08A45", "#C97878", "#D2AC68"],
  particleCount = 8,
}: ClickSparkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, []);

  const stopAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !containerRef.current || !canvasRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const canvas = canvasRef.current;
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Generate modest sparks
    const newSparks: Spark[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      newSparks.push({
        id: Math.random(),
        x: clickX,
        y: clickY,
        angle,
        speed: 1.8 + Math.random() * 2.2,
        color: sparkColors[i % sparkColors.length],
        size: 2 + Math.random() * 2,
        opacity: 1,
      });
    }

    sparksRef.current = newSparks;

    // Only start loop if not currently running
    if (!animFrameRef.current) {
      animate();
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      stopAnimation();
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      stopAnimation();
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sparks = sparksRef.current;
    let activeCount = 0;

    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      if (s.opacity <= 0.05) continue;

      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;
      s.opacity *= 0.91; // smooth fade
      s.speed *= 0.94; // slight deceleration

      ctx.save();
      ctx.globalAlpha = Math.max(0, s.opacity);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      activeCount++;
    }

    if (activeCount > 0) {
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      // All particles faded — shut down RAF immediately!
      stopAnimation();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`relative inline-block ${className || ""}`}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-50"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
export default ClickSpark;
