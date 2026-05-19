type LogoProps = {
  size?: number;
  mode?: "light" | "dark";
  className?: string;
};

export function Logo({ size = 120, mode = "light", className }: LogoProps) {
  const uid = `cis-${size}-${mode}`;
  const c1 = mode === "light" ? "#B890D0" : "#C4A8D8";
  const c2 = mode === "light" ? "#88AACE" : "#A8C4D8";
  const glow = mode === "light" ? "#E0D0F8" : "#EDE0F5";
  const op1 = mode === "light" ? 0.88 : 0.72;
  const op2 = mode === "light" ? 0.6 : 0.48;
  const op3 = mode === "light" ? 0.5 : 0.36;
  const sw = mode === "light" ? 1.8 : 1.5;
  const sop = mode === "light" ? 0.55 : 0.38;

  const pathL =
    "M 96 32 C 68 40, 52 64, 54 96 C 55 122, 68 146, 88 156 C 96 160, 100 153, 99 143 C 97 133, 88 120, 85 104 C 81 86, 84 66, 96 52 C 102 45, 104 38, 96 32 Z";
  const pathR =
    "M 104 32 C 132 40, 148 64, 146 96 C 145 122, 132 146, 112 156 C 104 160, 100 153, 101 143 C 103 133, 112 120, 115 104 C 119 86, 116 66, 104 52 C 98 45, 96 38, 104 32 Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      overflow="visible"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id={`h-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={mode === "light" ? 10 : 13} />
        </filter>
        <filter id={`m-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={`c-${uid}`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id={`p-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {mode === "light" && (
          <filter id={`sd-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="8"
              floodColor={c1}
              floodOpacity="0.22"
            />
          </filter>
        )}
        <linearGradient id={`g1-${uid}`} x1="0%" y1="20%" x2="100%" y2="80%">
          <stop offset="0%" stopColor={c1} stopOpacity={op1} />
          <stop offset="100%" stopColor={c1} stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`g2-${uid}`} x1="100%" y1="20%" x2="0%" y2="80%">
          <stop offset="0%" stopColor={c2} stopOpacity={op1} />
          <stop offset="100%" stopColor={c2} stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id={`gc-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.98" />
          <stop
            offset="40%"
            stopColor={glow}
            stopOpacity={mode === "light" ? 0.85 : 0.65}
          />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`b1-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c1} stopOpacity="0" />
          <stop offset="22%" stopColor={c1} stopOpacity={sop} />
          <stop offset="78%" stopColor={c1} stopOpacity={sop} />
          <stop offset="100%" stopColor={c1} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`b2-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c2} stopOpacity="0" />
          <stop offset="22%" stopColor={c2} stopOpacity={sop} />
          <stop offset="78%" stopColor={c2} stopOpacity={sop} />
          <stop offset="100%" stopColor={c2} stopOpacity="0" />
        </linearGradient>
      </defs>

      <g filter={mode === "light" ? `url(#sd-${uid})` : undefined}>
        <path
          d={pathL}
          fill={`url(#g1-${uid})`}
          filter={`url(#h-${uid})`}
          opacity={op1}
        />
        <path
          d={pathL}
          fill={`url(#g1-${uid})`}
          filter={`url(#m-${uid})`}
          opacity={op2}
        />
        <path d={pathL} fill={`url(#g1-${uid})`} opacity={op3} />
        <path
          d={pathL}
          fill="none"
          stroke={`url(#b1-${uid})`}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </g>

      <g
        transform="translate(4 -28) rotate(-5 134 88)"
        filter={mode === "light" ? `url(#sd-${uid})` : undefined}
      >
        <path
          d={pathR}
          fill={`url(#g2-${uid})`}
          filter={`url(#h-${uid})`}
          opacity={op1}
        />
        <path
          d={pathR}
          fill={`url(#g2-${uid})`}
          filter={`url(#m-${uid})`}
          opacity={op2}
        />
        <path d={pathR} fill={`url(#g2-${uid})`} opacity={op3} />
        <path
          d={pathR}
          fill="none"
          stroke={`url(#b2-${uid})`}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </g>

      <ellipse
        cx="100"
        cy="88"
        rx={mode === "light" ? 24 : 20}
        ry={mode === "light" ? 30 : 25}
        fill={`url(#gc-${uid})`}
        filter={`url(#c-${uid})`}
      />
      <ellipse
        cx="100"
        cy="87"
        rx="8"
        ry="10"
        fill="white"
        opacity={mode === "light" ? 0.95 : 0.82}
        filter={`url(#p-${uid})`}
      />
      <ellipse cx="100" cy="86" rx="2.5" ry="3" fill="white" opacity="0.98" />
    </svg>
  );
}

type WordmarkProps = LogoProps & {
  layout?: "horizontal" | "stacked";
};

export function LogoWordmark({
  size = 48,
  mode = "light",
  layout = "horizontal",
  className,
}: WordmarkProps) {
  const isDark = mode === "dark";
  const wordColor = isDark ? "text-slate-200" : "text-slate-700";
  const subColor = isDark ? "text-slate-400" : "text-slate-500";

  if (layout === "stacked") {
    return (
      <div className={`flex flex-col items-center ${className ?? ""}`}>
        <Logo size={size} mode={mode} />
        <div
          className={`font-display text-base ${wordColor}`}
          style={{ letterSpacing: "0.04em" }}
        >
          CIS
        </div>
        <div
          className={`text-[9px] font-bold ${subColor}`}
          style={{ letterSpacing: "0.28em" }}
        >
          CLÍNICA
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Logo size={size} mode={mode} />
      <div>
        <div
          className={`font-display text-lg leading-none ${wordColor}`}
          style={{ letterSpacing: "0.04em" }}
        >
          CIS
        </div>
        <div
          className={`text-[9px] font-bold mt-0.5 ${subColor}`}
          style={{ letterSpacing: "0.28em" }}
        >
          CLÍNICA
        </div>
      </div>
    </div>
  );
}
