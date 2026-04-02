import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { text: "text-lg", icon: "h-4 w-4" },
  md: { text: "text-xl", icon: "h-5 w-5" },
  lg: { text: "text-2xl", icon: "h-6 w-6" },
};

export function Logo({ size = "md", className }: LogoProps) {
  const s = sizes[size];

  return (
    <span className={cn("inline-flex items-end font-semibold text-foreground", s.text, className)}>
      Link2plan
      <svg
        className={cn(s.icon, "ml-[-1px] mb-[1px]")}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          stroke="#3b82f6"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="12" cy="9" r="2.5" stroke="#3b82f6" strokeWidth="2" fill="none" />
      </svg>
    </span>
  );
}
