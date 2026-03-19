interface FormHeaderProps {
  subtitle?: string;
  className?: string;
}

export function FormHeader({ subtitle, className = "mb-8" }: FormHeaderProps) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div
        className="w-14 h-14 mb-4 flex items-center justify-center rounded-full"
        style={{
          background: "rgba(0,212,200,0.1)",
          border: "1px solid rgba(0,212,200,0.25)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-7 h-7"
          style={{ color: "#00d4c8" }}
        >
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </svg>
      </div>
      <h1
        className="text-2xl font-black tracking-tight uppercase"
        style={{ color: "#ffffff" }}
      >
        HB <span style={{ color: "#00d4c8" }}>Medical</span>
      </h1>
      {subtitle && (
        <p
          className="text-sm mt-1 font-medium"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
