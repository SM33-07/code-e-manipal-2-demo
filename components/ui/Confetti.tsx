"use client";

import { useEffect, useRef } from "react";

export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Jaipur Pink, Antique Brass, and Terracotta palette
    const colors = ["#B95745", "#D2AC68", "#A64B3E", "#E69C90", "#E8C88B", "#C97878"];
    const particleCount = 120;
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      gravity: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }> = [];

    // Initialize particles shooting from bottom corners upward
    for (let i = 0; i < particleCount; i++) {
      const isLeft = i < particleCount / 2;
      particles.push({
        x: isLeft ? 0 : width,
        y: height - 10,
        size: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: isLeft ? Math.random() * 12 + 6 : -(Math.random() * 12 + 6),
        speedY: -(Math.random() * 15 + 12),
        gravity: 0.45,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 8 - 4,
        opacity: 1,
      });
    }

    const resize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      let active = false;
      for (const p of particles) {
        // Physics update
        p.speedY += p.gravity;
        p.x += p.speedX;
        p.y += p.speedY;

        // Slow down horizontal velocity
        p.speedX *= 0.985;
        p.speedY *= 0.985;

        // Rotate
        p.rotation += p.rotationSpeed;

        // Fade out when falling past middle of screen
        if (p.speedY > 0) {
          p.opacity -= 0.008;
        }

        if (p.opacity > 0 && p.y < height + 50 && p.x >= -50 && p.x <= width + 50) {
          active = true;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;

          // Draw random shapes (squares, rectangles, circles)
          if (p.size % 2 === 0) {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          } else {
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size / 2, p.size / 3, 0, 0, 2 * Math.PI);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (active) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[190] w-full h-full"
    />
  );
}
