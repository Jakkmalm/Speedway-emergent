import { cn } from "@/lib/utils";

export function Spinner({ size = "md", className }) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  };

  return (
    <span
      role="status"
      aria-label="Laddar"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        sizes[size],
        className
      )}
    />
  );
}
