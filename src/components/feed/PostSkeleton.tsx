import { Skeleton } from "@/components/ui/skeleton";

const PostSkeleton = () => (
  <div className="rounded-xl p-4 space-y-3" style={{ background: "#0B0F12" }}>
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-64 w-full rounded-lg" />
    <div className="flex gap-4">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-5 w-16" />
    </div>
  </div>
);

export default PostSkeleton;
