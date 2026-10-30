import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-12">
      <Suspense fallback={<Skeleton className="h-24 w-full max-w-md" />}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  // Second line of defence after the proxy: the page itself checks the user.
  const user = await requireUser("/dashboard");
  const profile = await getProfile();
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Welcome, {profile?.full_name || user.email}</h1>
      <Button asChild>
        <Link href="/workspaces">Open your workspaces</Link>
      </Button>
    </section>
  );
}
