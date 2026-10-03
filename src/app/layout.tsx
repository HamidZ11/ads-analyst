import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import { getWorkspace } from "@/features/workspace/server";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { agency, clients, client, coverage, dataSource } = await getWorkspace();
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans">
        <AppShell
          agency={agency}
          clients={clients}
          client={client}
          coverage={coverage}
          sourceKind={dataSource.kind}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
