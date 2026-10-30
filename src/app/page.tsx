import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-6 py-24">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">Tidewater Studio</p>
      <h1 className="text-4xl font-semibold sm:text-5xl">
        Every project, every task, one shared board.
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        CrewDeck gives small teams a shared Kanban board and a place for project
        documents. Invite your crew, drag tasks forward, and see changes as they happen.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">Start a workspace</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
