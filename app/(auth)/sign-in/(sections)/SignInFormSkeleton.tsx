"use client";
import { Card, CardBody, Skeleton } from "@heroui/react";

export default function SignInFormSkeleton() {
  return (
    <Card
      shadow="lg"
      radius="lg"
      className="w-full max-w-md select-none bg-content1/80 backdrop-blur-2xl border border-white/15"
    >
      <CardBody className="p-8 md:p-10 gap-0">
        {/* Logo placeholder */}
        <div className="flex items-center justify-center py-10 mb-8">
          <Skeleton className="w-40 h-10 rounded-lg" />
        </div>

        <div className="flex flex-col gap-6">
          {/* Fields */}
          <div className="flex flex-col gap-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-4 pt-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/10" />
              <Skeleton className="h-3 w-6 rounded" />
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>

        {/* Back link */}
        <div className="mt-10 flex justify-center">
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </CardBody>
    </Card>
  );
}
