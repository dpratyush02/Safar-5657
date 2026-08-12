import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

/**
 * The train interior painting is the hero of the whole site: full viewport, untouched artwork,
 * with a very slow breathing scale, pointer parallax, film grain and readability scrims on top.
 */
export function HeroScene({ dimmed }: { dimmed: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frame = useRef(0);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        setOffset({ x: -x * 12, y: -y * 8 });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div className="grain fixed inset-0 overflow-hidden bg-ink">
      <motion.div
        className="absolute inset-0"
        animate={{ x: offset.x, y: offset.y }}
        transition={{ type: "spring", stiffness: 40, damping: 20, mass: 0.8 }}
      >
        <motion.img
          src="/images/train-interior.jpg"
          alt="Inside an Indian train coach, looking down the aisle"
          onLoad={() => setLoaded(true)}
          className="breathe absolute inset-0 h-full w-full object-cover object-center"
          initial={{ opacity: 0, filter: "blur(14px)" }}
          animate={{
            opacity: loaded ? 1 : 0,
            filter: loaded ? "blur(0px)" : "blur(14px)",
          }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
          draggable={false}
        />
      </motion.div>

      {/* Readability scrims — top and bottom only, so the aisle stays clean */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-ink/85 via-ink/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh] bg-gradient-to-t from-ink/92 via-ink/45 to-transparent" />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 45%, transparent 30%, rgba(22,17,14,0.45) 78%, rgba(22,17,14,0.8) 100%)",
        }}
      />

      {/* Extra dim while an overlay is open */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-ink"
        animate={{ opacity: dimmed ? 0.62 : 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
