import { useEffect } from "react";
import Dashboard from "./components/Dashboard";
import Lenis from "lenis";

export default function App() {
  useEffect(() => {
    let rafId: number | null = null;
    let lenis: Lenis | null = null;

    try {
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      });

      function raf(time: number) {
        if (lenis) {
          lenis.raf(time);
          rafId = requestAnimationFrame(raf);
        }
      }

      rafId = requestAnimationFrame(raf);
    } catch (e) {
      console.warn("Smooth scroll initialization skipped:", e);
    }
    
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (lenis) {
        try {
          lenis.destroy();
        } catch (_) {}
        lenis = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#121212] via-[#0a0a0a] to-[#050505] text-neutral-100 font-sans selection:bg-white/20 selection:text-white pb-12">
      <Dashboard />
    </div>
  );
}
