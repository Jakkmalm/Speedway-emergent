// src/components/skeletons/UserMatchCardSkeleton.jsx
import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function UserMatchCardSkeleton() {
  return (
    <Card className="border">
      <CardHeader className="flex gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </CardHeader>

      {/* <CardContent className="pt-0">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="mt-2 h-4 w-32" />
            </Card>
          ))}
        </div>
      </CardContent> */}
    </Card>
  );
}
