import Link from "next/link";

type Variant = "light" | "dark";
type Size = "sm" | "md" | "lg";

interface HBLogoProps {
  variant?: Variant; // "light" = blue peaks (white bg)  |  "dark" = white peaks (blue bg)
  size?: Size; // "sm" | "md" | "lg"
  className?: string;
  asLink?: boolean; // wrap in <Link href="/"> — default true
}

const sizeMap: Record<Size, { icon: number; text: string; sub: string }> = {
  sm: { icon: 28, text: "text-sm", sub: "text-[8px]" },
  md: { icon: 34, text: "text-base", sub: "text-[9px]" },
  lg: { icon: 42, text: "text-lg", sub: "text-[10px]" },
};

export function HBLogo({
  variant = "light",
  size = "md",
  className = "",
  asLink = true,
}: HBLogoProps) {
  const { icon, text, sub } = sizeMap[size];

  const peakColor = variant === "dark" ? "white" : "#0f2d4a";
  const hbColor = variant === "dark" ? "text-white" : "text-[var(--navy)]";
  const medColor = variant === "dark" ? "text-white/60" : "text-[var(--navy)]/70";

  const content = (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {/* ── SVG icon ── */}
      <svg
        viewBox="0 0 56 56"
        width={icon}
        height={icon}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hbArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f5a87a" />
            <stop offset="100%" stopColor="#e85d0a" />
          </linearGradient>
        </defs>

        {/* Orange arc */}
        <path
          d="M 14 44 A 22 22 0 1 1 46 36"
          stroke="url(#hbArcGrad)"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left tall mountain peak */}
        <path
          d="M 10 44 L 24 13 L 38 44"
          stroke={peakColor}
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />

        {/* Right shorter mountain peak */}
        <path
          d="M 22 44 L 32 25 L 42 44"
          stroke={peakColor}
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* ── Text ── */}
      <span className="flex flex-row items-center gap-1.5 leading-none">
        <span className={`font-bold tracking-widest ${text} ${hbColor}`}>
          HB
        </span>
        <span
          className={`font-medium tracking-[0.35em] uppercase ${text} ${medColor}`}
        >
          Medical
        </span>
      </span>
    </span>
  );

  if (!asLink) return content;

  return (
    <Link href="/" className="shrink-0">
      {content}
    </Link>
  );
}
