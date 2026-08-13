import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

export function HeroScene({
  dimmed,
  movementIntensity = 0,
  isMoving = false,
  reducedMotion = false,
}: {
  dimmed: boolean;
  movementIntensity?: number;
  isMoving?: boolean;
  reducedMotion?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });
  const [sceneryOffset, setSceneryOffset] = useState(0);

  const frame = useRef(0);
  const sceneryFrame = useRef(0);

  // Pointer movement / subtle sway
  useEffect(() => {
    if (reducedMotion) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        setPointerOffset({ x: -x * 10, y: -y * 6 });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame.current);
    };
  }, [reducedMotion]);

  // Continuous subtle horizontal scenery translation driven by train speed
  useEffect(() => {
    if (reducedMotion || !isMoving) {
      setSceneryOffset(0);
      return;
    }

    let active = true;
    let pos = 0;

    const loop = () => {
      if (!active) return;
      // Speed multiplier
      const step = 0.15 + movementIntensity * 0.45;
      pos = (pos + step) % 40; // subtle loop window
      setSceneryOffset(-Math.sin(pos * 0.1) * (4 + movementIntensity * 8));
      sceneryFrame.current = requestAnimationFrame(loop);
    };

    sceneryFrame.current = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(sceneryFrame.current);
    };
  }, [isMoving, movementIntensity, reducedMotion]);

  const totalX = pointerOffset.x + (reducedMotion ? 0 : sceneryOffset);
  const totalY = pointerOffset.y;

  return (
    <div className="grain fixed inset-0 overflow-hidden bg-ink">
      <motion.div
        className="absolute inset-0"
        animate={{ x: totalX, y: totalY }}
        transition={{ type: "spring", stiffness: 35, damping: 25, mass: 0.9 }}
      >
        <motion.img
          src="/images/train-interior.jpg"
          alt="Inside an Indian train coach, looking down the aisle"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover object-center ${
            reducedMotion ? "" : "breathe"
          }`}
          initial={{ opacity: 0, filter: "blur(14px)" }}
          animate={{
            opacity: loaded ? 1 : 0,
            filter: loaded ? "blur(0px)" : "blur(14px)",
          }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
          draggable={false}
        />
      </motion.div>

      {/* Moving atmospheric shadow & light overlay when train is in motion */}
      {isMoving && !reducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-950/10 to-transparent"
          animate={{ opacity: [0.2, 0.45, 0.2] }}
          transition={{
            repeat: Infinity,
            duration: Math.max(1.2, 3.5 - movementIntensity * 2),
            ease: "easeInOut",
          }}
        />
      )}

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
