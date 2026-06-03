import { Link } from "wouter";
import { PixelTransition } from "../../pixel-transition/pixel-transition";
import type { SiteHeaderConfig } from "../shared";

function avatarLabelClassName(sizePx: number) {
  if (sizePx >= 100) {
    return "text-xl font-black text-white";
  }
  if (sizePx >= 48) {
    return "text-sm font-black text-white";
  }
  return "text-[10px] font-black leading-none text-white";
}

export function BrandLink({
  siteConfig,
  className = "",
  avatarClassName,
  avatarSizePx,
  compact = false,
  showAvatar = true,
  showDescription = true,
  titleClassName = "",
  descriptionClassName = "",
}: {
  siteConfig: SiteHeaderConfig;
  className?: string;
  avatarClassName?: string;
  avatarSizePx?: number;
  compact?: boolean;
  showAvatar?: boolean;
  showDescription?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  const resolvedAvatarSizePx = avatarSizePx ?? (compact ? 48 : 100);
  const avatarSrc = siteConfig.avatar?.trim() || "";
  const resolvedAvatarClassName = avatarClassName || (
    compact
      ? "rounded-full border-2 border-white/80 dark:border-white/20"
      : "rounded-2xl border-2 border-white/80 dark:border-white/20"
  );

  return (
    <Link aria-label="home" href="/" className={className}>
      {showAvatar ? (
        <PixelTransition
          sizePx={resolvedAvatarSizePx}
          gridSize={8}
          pixelColor="#ffffff"
          animationStepDuration={0.4}
          className={`bg-[#222] ${resolvedAvatarClassName}`}
          firstContent={avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-theme text-white">
              <span className={avatarLabelClassName(resolvedAvatarSizePx)}>
                {siteConfig.name.slice(0, 1) || "R"}
              </span>
            </div>
          )}
          secondContent={(
            <div className="grid h-full w-full place-items-center bg-theme p-1 text-center text-white">
              <p className={avatarLabelClassName(resolvedAvatarSizePx)}>
                {siteConfig.name}
              </p>
            </div>
          )}
          enableTouchToggle={false}
        />
      ) : null}
      <div className={`${showAvatar ? (compact ? "mx-2" : "mx-4") : ""} flex flex-col justify-center items-start`}>
        <p className={`${compact ? "text-sm font-bold t-primary" : "text-xl font-bold dark:text-white"} ${titleClassName}`}>{siteConfig.name}</p>
        {showDescription ? <p className={`text-xs text-neutral-500 ${descriptionClassName}`}>{siteConfig.description}</p> : null}
      </div>
    </Link>
  );
}
