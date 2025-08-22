import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function LoadingInline({ text = "Laddar…", className }) {
    return (
        <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
            <Spinner size="sm" className="text-primary" />
            <span className="text-sm">{text}</span>
        </div>
    );
}

export function LoadingBlock({ text = "Laddar…", className }) {
    return (
        <div className={cn("flex flex-col items-center justify-center p-8 text-muted-foreground", className)}>
            <Spinner size="lg" className="text-primary" />
            {text && <p className="mt-3 text-sm">{text}</p>}
        </div>
    );
}

/** Fullbredd/“sida” – centrerar i en hög sektion */
export function PageLoader({ text = "Hämtar data…" }) {
    return (
        <div className="min-h-[40vh] grid place-items-center">
            <LoadingBlock text={text} />
        </div>
    );
}
