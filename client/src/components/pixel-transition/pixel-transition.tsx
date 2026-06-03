import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { gsap } from "gsap";
import "./pixel-transition.css";

export type PixelTransitionProps = {
  firstContent: ReactNode;
  secondContent: ReactNode;
  sizePx: number;
  gridSize?: number;
  pixelColor?: string;
  animationStepDuration?: number;
  once?: boolean;
  className?: string;
  style?: CSSProperties;
  enableTouchToggle?: boolean;
};

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function useCanHover() {
  const [canHover, setCanHover] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return canHover;
}

export function PixelTransition({
  firstContent,
  secondContent,
  sizePx,
  gridSize = 7,
  pixelColor = "currentColor",
  animationStepDuration = 0.3,
  once = false,
  className = "",
  style,
  enableTouchToggle = true,
}: PixelTransitionProps) {
  const pixelGridRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const delayedCallRef = useRef<gsap.core.Tween | null>(null);
  const [isActive, setIsActive] = useState(false);
  const canHover = useCanHover();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const pixelGridEl = pixelGridRef.current;
    if (!pixelGridEl || prefersReducedMotion) {
      return;
    }

    pixelGridEl.innerHTML = "";

    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        const pixel = document.createElement("div");
        pixel.classList.add("pixelated-image-card__pixel");
        pixel.style.backgroundColor = pixelColor;

        const size = 100 / gridSize;
        pixel.style.width = `${size}%`;
        pixel.style.height = `${size}%`;
        pixel.style.left = `${col * size}%`;
        pixel.style.top = `${row * size}%`;
        pixelGridEl.appendChild(pixel);
      }
    }
  }, [gridSize, pixelColor, prefersReducedMotion]);

  useEffect(() => () => {
    if (delayedCallRef.current) {
      delayedCallRef.current.kill();
    }
  }, []);

  const animatePixels = (activate: boolean) => {
    if (prefersReducedMotion) {
      return;
    }

    setIsActive(activate);

    const pixelGridEl = pixelGridRef.current;
    const activeEl = activeRef.current;
    if (!pixelGridEl || !activeEl) {
      return;
    }

    const pixels = pixelGridEl.querySelectorAll<HTMLElement>(".pixelated-image-card__pixel");
    if (!pixels.length) {
      return;
    }

    gsap.killTweensOf(pixels);
    if (delayedCallRef.current) {
      delayedCallRef.current.kill();
    }

    gsap.set(pixels, { display: "none" });

    const totalPixels = pixels.length;
    const staggerDuration = animationStepDuration / totalPixels;

    gsap.to(pixels, {
      display: "block",
      duration: 0,
      stagger: {
        each: staggerDuration,
        from: "random",
      },
    });

    delayedCallRef.current = gsap.delayedCall(animationStepDuration, () => {
      activeEl.style.display = activate ? "block" : "none";
      activeEl.style.pointerEvents = activate ? "none" : "";
    });

    gsap.to(pixels, {
      display: "none",
      duration: 0,
      delay: animationStepDuration,
      stagger: {
        each: staggerDuration,
        from: "random",
      },
    });
  };

  const handleEnter = () => {
    if (!isActive) {
      animatePixels(true);
    }
  };

  const handleLeave = () => {
    if (isActive && !once) {
      animatePixels(false);
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!enableTouchToggle) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!isActive) {
      animatePixels(true);
    } else if (!once) {
      animatePixels(false);
    }
  };

  const boxStyle: CSSProperties = {
    width: sizePx,
    height: sizePx,
    minWidth: sizePx,
    minHeight: sizePx,
    ...style,
  };

  if (prefersReducedMotion) {
    return (
      <div className={`pixelated-image-card ${className}`} style={boxStyle}>
        <div className="pixelated-image-card__default">{firstContent}</div>
      </div>
    );
  }

  return (
    <div
      className={`pixelated-image-card ${className}`}
      style={boxStyle}
      onMouseEnter={canHover ? handleEnter : undefined}
      onMouseLeave={canHover ? handleLeave : undefined}
      onClick={!canHover && enableTouchToggle ? handleClick : undefined}
    >
      <div className="pixelated-image-card__default" aria-hidden={isActive}>
        {firstContent}
      </div>
      <div
        className="pixelated-image-card__active"
        ref={activeRef}
        aria-hidden={!isActive}
      >
        {secondContent}
      </div>
      <div className="pixelated-image-card__pixels" ref={pixelGridRef} />
    </div>
  );
}
