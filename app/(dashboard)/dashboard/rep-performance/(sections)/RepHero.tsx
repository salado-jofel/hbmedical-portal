"use client";

export default function RepHero() {
  return (
    <div
      className="mb-5 flex items-center justify-between rounded-[12px] px-6 py-5"
      style={{ background: "var(--navy)", color: "#fff" }}
    >
      {/* Left: avatar + info */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold"
          style={{ background: "rgba(255,255,255,0.2)" }}
        >
          RK
        </div>
        <div>
          <p className="text-[18px] font-semibold leading-tight">Rachel Kim</p>
          <p className="mt-0.5 text-[12px]" style={{ color: "#7fb3cc" }}>
            Northeast Territory · Senior Tier · 5% Commission
          </p>
        </div>
      </div>

      {/* Right: goal ring */}
      <div className="text-right">
        <p className="text-[32px] font-bold leading-none">102%</p>
        <p className="mt-1 text-[12px]" style={{ color: "#7fb3cc" }}>
          of April Goal
        </p>
      </div>
    </div>
  );
}
