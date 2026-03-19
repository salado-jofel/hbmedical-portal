import { BackgroundDot } from "./BackgroundDot";

const dots = [
  { top: "10%", left: "8%", size: 2 },
  { top: "20%", left: "85%", size: 1.5 },
  { top: "35%", left: "15%", size: 1 },
  { top: "15%", left: "60%", size: 2 },
  { top: "60%", left: "5%", size: 1.5 },
  { top: "75%", left: "90%", size: 2 },
  { top: "85%", left: "25%", size: 1 },
  { top: "50%", left: "78%", size: 1.5 },
  { top: "90%", left: "70%", size: 1 },
  { top: "5%", left: "45%", size: 1.5 },
  { top: "40%", left: "95%", size: 1 },
  { top: "68%", left: "50%", size: 2 },
];

export function BackgroundDots() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((dot, i) => (
        <BackgroundDot key={i} top={dot.top} left={dot.left} size={dot.size} />
      ))}
    </div>
  );
}
