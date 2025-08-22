// src/components/skeletons/MatchRowSkeleton.jsx
import { Skeleton } from "@/components/ui/skeleton";

export function MatchRowSkeleton({ withSecondButton = true }) {
    return (
        <div className="p-3 sm:p-4 border rounded-xl transition hover:bg-muted/60">
            {/* Top: badge + title + meta */}
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 sm:justify-between">
                <div className=" min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Badge shape */}
                        <Skeleton className="h-5 w-16 sm:w-20 rounded-full" />
                        {/* "Hemmalag vs Bortalag" */}
                        <Skeleton className="h-5 w-40 sm:w-56 md:w-72" />
                    </div>

                    {/* Date • venue */}
                    <div className="mt-2">
                        <Skeleton className="h-4 w-32 sm:w-40 md:w-52" />
                    </div>
                </div>

                {/* Actions (inline on sm+) */}
                <div className="hidden sm:flex items-center gap-2 w-auto">
                    {/* Play/Resume */}
                    <Skeleton className="h-9 w-10 sm:w-28" />
                    {/* Delete/Confirm */}
                    {withSecondButton && <Skeleton className="h-9 w-10 sm:w-24" />}
                </div>
            </div>

            {/* Mobile actions (row, right-aligned, small buttons) */}
            <div className="mt-3 flex sm:hidden items-center justify-end gap-2">
                <Skeleton className="h-9 w-10" />
                {withSecondButton && <Skeleton className="h-9 w-10" />}
            </div>
        </div>
    );
}
