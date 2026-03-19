interface BackgroundDotProps {
  top: string;
  left: string;
  size: number;
}

export function BackgroundDot({ top, left, size }: BackgroundDotProps) {
  return (
    <div
      className="absolute rounded-full bg-white opacity-30"
      style={{ top, left, width: size, height: size }}
    />
  );
}
