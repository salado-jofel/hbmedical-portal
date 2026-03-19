interface HBMedicalBrandProps {
  layout?: "row" | "col";
  iconSize?: string;
  textSize?: string;
}

export function HBMedicalBrand({
  layout = "row",
  iconSize = "w-7 h-7",
  textSize = "text-sm",
}: HBMedicalBrandProps) {
  return (
    <div
      className={`flex items-center text-[#2db0b0] ${layout === "col" ? "flex-col gap-0" : "flex-row gap-2"
        }`}
    >
      <div className={iconSize}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </svg>
      </div>
      <span
        className={`font-black tracking-widest uppercase ${textSize} ${layout === "col" ? "mt-3" : ""
          }`}
      >
        HB Medical
      </span>
    </div>
  );
}
