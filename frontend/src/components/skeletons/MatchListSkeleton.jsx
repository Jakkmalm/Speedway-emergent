// // src/components/skeletons/MatchListSkeleton.jsx
// import React from "react";
// import { Card, CardHeader, CardContent } from "@/components/ui/card";
// import { Skeleton } from "@/components/ui/skeleton";

// export function MatchListSkeleton({ rows = 3 }) {
//   return (
//     <Card>
//       <CardHeader>
//         <Skeleton className="h-5 w-1/3" />
//       </CardHeader>
//       <CardContent className="space-y-3">
//         {Array.from({ length: rows }).map((_, i) => (
//           <div key={i} className="flex items-center justify-between border rounded-lg p-3">
//             <div className="space-y-1">
//               <Skeleton className="h-4 w-44" />
//               <Skeleton className="h-4 w-28" />
//             </div>
//             <div className="flex gap-2">
//               <Skeleton className="h-9 w-28" />
//               <Skeleton className="h-9 w-24" />
//             </div>
//           </div>
//         ))}
//       </CardContent>
//     </Card>
//   );
// }

// src/components/MatchListSkeleton.jsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MatchListSkeleton({ rows = 3 }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-40" />
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/60 transition"
                    >
                        {/* Vänster sida: badge + lag + datum/arena */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                {/* Badge-shape */}
                                <Skeleton className="h-5 w-20 rounded-full" />
                                {/* Lag vs Lag */}
                                <Skeleton className="h-5 w-64" />
                            </div>

                            {/* Datum • arena */}
                            <div className="mt-2">
                                <Skeleton className="h-4 w-44" />
                            </div>
                        </div>

                        {/* Höger sida: knappar */}
                        <div className="flex items-center gap-2 w-auto">
                            {/* Play/Resume: ikon-only på xs, text dyker upp på sm+ via olika bredder */}
                            <Skeleton className="h-9 w-10 sm:w-28" />
                            {/* Delete/Confirm */}
                            <Skeleton className="h-9 w-10 sm:w-24" />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

