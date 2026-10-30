import type { Metadata } from "next";
// Self-hosted fonts: served from our own domain, no request to Google.
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "CrewDeck",
    template: "%s · CrewDeck",
  },
  description:
    "Shared Kanban boards and project documents for small teams, by Tidewater Studio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the `dark` class before React hydrates, hence the warning opt-out.
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteHeader />
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
