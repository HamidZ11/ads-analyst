import { GalleryHorizontal, ImageIcon, Play } from "lucide-react";
import type { ReactNode } from "react";
import type {
  CreativeThumbnail as CreativeThumbnailRef,
  CreativeType,
  ThumbnailMotif,
  ThumbnailTone,
} from "@/domain/types";
import { cn } from "@/lib/cn";

const TONE_CLASSES: Record<ThumbnailTone, string> = {
  sand: "bg-tone-sand text-tone-sand-ink",
  stone: "bg-tone-stone text-tone-stone-ink",
  mist: "bg-tone-mist text-tone-mist-ink",
  moss: "bg-tone-moss text-tone-moss-ink",
  clay: "bg-tone-clay text-tone-clay-ink",
  slate: "bg-tone-slate text-tone-slate-ink",
  dusk: "bg-tone-dusk text-tone-dusk-ink",
};

const ASPECT_CLASSES: Record<CreativeThumbnailRef["aspect"], string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
};

const TYPE_ICON = { image: ImageIcon, video: Play, carousel: GalleryHorizontal } as const;

const INK = "currentColor";
const PAPER = "var(--color-surface)";

/**
 * Abstract compositions drawn in the tone's ink on the tone's fill. Each motif
 * suggests a kind of creative without depicting a brand, person or product.
 * All are authored on a 100×100 canvas and letterboxed into the frame.
 */
const MOTIFS: Record<ThumbnailMotif, ReactNode> = {
  ugc: (
    <>
      <rect x="35" y="10" width="30" height="80" rx="6" fill={PAPER} fillOpacity="0.6" />
      <rect
        x="35"
        y="10"
        width="30"
        height="80"
        rx="6"
        fill="none"
        stroke={INK}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <circle cx="50" cy="46" r="9" fill={INK} fillOpacity="0.22" />
      <path d="M47 41.5v9l7.5-4.5z" fill={INK} fillOpacity="0.85" />
      <rect x="40" y="78" width="20" height="2.5" rx="1.25" fill={INK} fillOpacity="0.25" />
      <rect x="40" y="78" width="9" height="2.5" rx="1.25" fill={INK} fillOpacity="0.8" />
      <circle cx="43" cy="18" r="2" fill={INK} fillOpacity="0.5" />
    </>
  ),
  "talking-head": (
    <>
      <rect x="12" y="22" width="76" height="56" rx="5" fill={PAPER} fillOpacity="0.6" />
      <circle cx="50" cy="45" r="8" fill={INK} fillOpacity="0.38" />
      <path d="M33 72c2-10 8-15 17-15s15 5 17 15z" fill={INK} fillOpacity="0.38" />
      <rect x="18" y="66" width="22" height="3" rx="1.5" fill={INK} fillOpacity="0.7" />
      <rect x="18" y="71" width="14" height="2.5" rx="1.25" fill={INK} fillOpacity="0.4" />
      <circle cx="80" cy="30" r="2.5" fill={INK} fillOpacity="0.6" />
    </>
  ),
  product: (
    <>
      <circle cx="50" cy="56" r="27" fill={PAPER} fillOpacity="0.5" />
      <rect x="42" y="24" width="16" height="8" rx="2" fill={INK} fillOpacity="0.55" />
      <rect x="38" y="32" width="24" height="42" rx="5" fill={INK} fillOpacity="0.35" />
      <rect x="43" y="43" width="14" height="14" rx="2" fill={PAPER} fillOpacity="0.75" />
      <ellipse cx="50" cy="81" rx="18" ry="3" fill={INK} fillOpacity="0.15" />
    </>
  ),
  "before-after": (
    <>
      <rect x="12" y="20" width="37" height="60" rx="4" fill={INK} fillOpacity="0.2" />
      <rect x="51" y="20" width="37" height="60" rx="4" fill={PAPER} fillOpacity="0.65" />
      <g fill={INK} fillOpacity="0.35">
        <circle cx="22" cy="32" r="1.6" />
        <circle cx="33" cy="40" r="1.6" />
        <circle cx="25" cy="52" r="1.6" />
        <circle cx="38" cy="58" r="1.6" />
        <circle cx="29" cy="66" r="1.6" />
        <circle cx="19" cy="44" r="1.6" />
      </g>
      <line x1="50" y1="14" x2="50" y2="86" stroke={PAPER} strokeWidth="2.5" />
      <circle
        cx="50"
        cy="50"
        r="5"
        fill={PAPER}
        stroke={INK}
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <rect x="17" y="72" width="14" height="3" rx="1.5" fill={INK} fillOpacity="0.6" />
      <rect x="69" y="72" width="14" height="3" rx="1.5" fill={INK} fillOpacity="0.6" />
    </>
  ),
  carousel: (
    <>
      <rect x="8" y="30" width="26" height="40" rx="4" fill={PAPER} fillOpacity="0.4" />
      <rect x="66" y="30" width="26" height="40" rx="4" fill={PAPER} fillOpacity="0.4" />
      <rect
        x="32"
        y="22"
        width="36"
        height="56"
        rx="5"
        fill={PAPER}
        fillOpacity="0.8"
        stroke={INK}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <rect x="38" y="30" width="24" height="24" rx="3" fill={INK} fillOpacity="0.25" />
      <rect x="38" y="60" width="18" height="3" rx="1.5" fill={INK} fillOpacity="0.55" />
      <rect x="38" y="66" width="12" height="3" rx="1.5" fill={INK} fillOpacity="0.3" />
      <circle cx="44" cy="86" r="2" fill={INK} fillOpacity="0.3" />
      <circle cx="50" cy="86" r="2" fill={INK} fillOpacity="0.8" />
      <circle cx="56" cy="86" r="2" fill={INK} fillOpacity="0.3" />
    </>
  ),
  clinical: (
    <>
      <rect x="22" y="16" width="30" height="4" rx="2" fill={INK} fillOpacity="0.5" />
      <rect x="22" y="23" width="18" height="3" rx="1.5" fill={INK} fillOpacity="0.25" />
      <rect x="22" y="62" width="14" height="20" rx="2" fill={INK} fillOpacity="0.28" />
      <rect x="43" y="46" width="14" height="36" rx="2" fill={INK} fillOpacity="0.5" />
      <rect x="64" y="30" width="14" height="52" rx="2" fill={INK} fillOpacity="0.8" />
      <line
        x1="18"
        y1="82.5"
        x2="82"
        y2="82.5"
        stroke={INK}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
    </>
  ),
  testimonial: (
    <>
      <text
        x="20"
        y="48"
        fontSize="44"
        fontWeight="700"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill={INK}
        fillOpacity="0.3"
      >
        “
      </text>
      <rect x="24" y="50" width="52" height="3" rx="1.5" fill={INK} fillOpacity="0.5" />
      <rect x="24" y="57" width="44" height="3" rx="1.5" fill={INK} fillOpacity="0.4" />
      <rect x="24" y="64" width="34" height="3" rx="1.5" fill={INK} fillOpacity="0.3" />
      <circle cx="29" cy="80" r="5" fill={INK} fillOpacity="0.4" />
      <rect x="38" y="78" width="20" height="3" rx="1.5" fill={INK} fillOpacity="0.35" />
      <g fill={INK} fillOpacity="0.55">
        <circle cx="62" cy="24" r="1.8" />
        <circle cx="67" cy="24" r="1.8" />
        <circle cx="72" cy="24" r="1.8" />
        <circle cx="77" cy="24" r="1.8" />
        <circle cx="82" cy="24" r="1.8" />
      </g>
    </>
  ),
  offer: (
    <>
      <path
        d="M22 24h26a4 4 0 0 1 2.8 1.2l24 24a4 4 0 0 1 0 5.6L52.6 77a4 4 0 0 1-5.6 0l-24-24A4 4 0 0 1 22 50.2V28a4 4 0 0 1 4-4z"
        fill={PAPER}
        fillOpacity="0.75"
        stroke={INK}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <circle cx="33" cy="35" r="3" fill={INK} fillOpacity="0.5" />
      <text
        x="47"
        y="58"
        textAnchor="middle"
        fontSize="15"
        fontWeight="600"
        fontFamily="inherit"
        fill={INK}
        fillOpacity="0.85"
        transform="rotate(45 47 53)"
      >
        %
      </text>
    </>
  ),
  catalogue: (
    <>
      {[
        [14, 14],
        [52, 14],
        [14, 52],
        [52, 52],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="34" height="34" rx="3" fill={PAPER} fillOpacity="0.65" />
          <rect
            x={x + 6}
            y={y + 6}
            width="22"
            height="15"
            rx="2"
            fill={INK}
            fillOpacity="0.25"
          />
          <rect
            x={x + 6}
            y={y + 25}
            width="14"
            height="3"
            rx="1.5"
            fill={INK}
            fillOpacity="0.5"
          />
        </g>
      ))}
    </>
  ),
  routine: (
    <>
      <line
        x1="22"
        y1="46"
        x2="78"
        y2="46"
        stroke={INK}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      {[22, 50, 78].map((cx, i) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy="46"
            r="9"
            fill={PAPER}
            fillOpacity="0.9"
            stroke={INK}
            strokeOpacity={i === 1 ? 0.8 : 0.4}
            strokeWidth="1.5"
          />
          <text
            x={cx}
            y="49.5"
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fontFamily="inherit"
            fill={INK}
            fillOpacity="0.8"
          >
            {i + 1}
          </text>
          <rect
            x={cx - 8}
            y="62"
            width="16"
            height="3"
            rx="1.5"
            fill={INK}
            fillOpacity={i === 1 ? 0.6 : 0.3}
          />
        </g>
      ))}
    </>
  ),
  screen: (
    <>
      <rect
        x="12"
        y="20"
        width="76"
        height="60"
        rx="5"
        fill={PAPER}
        fillOpacity="0.75"
        stroke={INK}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <path d="M12 25a5 5 0 0 1 5-5h66a5 5 0 0 1 5 5v5H12z" fill={INK} fillOpacity="0.14" />
      <circle cx="19" cy="25" r="1.5" fill={INK} fillOpacity="0.5" />
      <circle cx="24" cy="25" r="1.5" fill={INK} fillOpacity="0.5" />
      <circle cx="29" cy="25" r="1.5" fill={INK} fillOpacity="0.5" />
      <rect x="16" y="34" width="16" height="42" rx="2" fill={INK} fillOpacity="0.14" />
      <rect x="36" y="36" width="44" height="5" rx="2" fill={INK} fillOpacity="0.4" />
      <rect x="36" y="45" width="30" height="4" rx="2" fill={INK} fillOpacity="0.25" />
      <polyline
        points="36,72 46,62 56,66 66,56 80,52"
        fill="none"
        stroke={INK}
        strokeOpacity="0.65"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </>
  ),
};

const MOTIF_LABELS: Record<ThumbnailMotif, string> = {
  ugc: "user-generated video",
  "talking-head": "spoken video",
  product: "product shot",
  "before-after": "before and after comparison",
  carousel: "carousel",
  clinical: "results chart",
  testimonial: "testimonial",
  offer: "offer",
  catalogue: "product catalogue",
  routine: "step-by-step routine",
  screen: "product interface",
};

export interface CreativeThumbnailProps {
  thumbnail: CreativeThumbnailRef;
  type: CreativeType;
  /** Force a frame aspect regardless of the creative's native aspect. */
  frame?: "native" | "square";
  size?: "sm" | "lg";
  className?: string;
}

/** Placeholder artwork until imported creatives carry real imagery. */
export function CreativeThumbnail({
  thumbnail,
  type,
  frame = "native",
  size = "lg",
  className,
}: CreativeThumbnailProps) {
  const Icon = TYPE_ICON[type];
  return (
    <div
      role="img"
      aria-label={`${type} creative placeholder: ${MOTIF_LABELS[thumbnail.motif]}`}
      className={cn(
        "relative overflow-hidden rounded-md",
        TONE_CLASSES[thumbnail.tone],
        frame === "square" ? "aspect-square" : ASPECT_CLASSES[thumbnail.aspect],
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {MOTIFS[thumbnail.motif]}
      </svg>
      {size === "lg" ? (
        <>
          <span className="absolute bottom-2 left-2 flex size-5 items-center justify-center rounded-full bg-white/75">
            <Icon aria-hidden size={11} strokeWidth={2} />
          </span>
          <span className="absolute right-2 bottom-2 rounded-xs bg-white/75 px-1 py-px text-2xs font-medium">
            {thumbnail.aspect}
          </span>
        </>
      ) : null}
    </div>
  );
}
