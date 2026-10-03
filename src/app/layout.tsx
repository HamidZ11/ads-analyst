import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SurfaceSwitch } from "@/components/shell/surface-switch";
import { loadSession } from "@/features/workspace/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Ad Analyst", template: "%s · Ad Analyst" },
  description: "Meta Ads analytics for small marketing agencies.",
};

/**
 * The app shell appears only for a signed-in (or demo) session and only on app
 * routes; the marketing pages, sign-in and the labs render without it.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await loadSession();
  const shell =
    session.kind === "app"
      ? {
          agency: session.context.agency,
          clients: session.context.clients,
          client: session.context.client,
          coverage: session.context.coverage,
          sourceKind: session.context.dataSource?.kind ?? ("meta_csv" as const),
        }
      : null;
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans">
        <SurfaceSwitch shell={shell}>{children}</SurfaceSwitch>
      </body>
    </html>
  );
}
