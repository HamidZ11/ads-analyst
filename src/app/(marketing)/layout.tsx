import type { ReactNode } from "react";
import { marketingSans } from "@/features/marketing/font";
import { MarketingFooter } from "@/features/marketing/marketing-footer";
import { MarketingNav } from "@/features/marketing/marketing-nav";
import { RevealOnScroll } from "@/features/marketing/reveal";
import s from "@/features/marketing/marketing.module.css";
import { cn } from "@/lib/cn";

/** The public marketing site: its own face, navigation and footer; no app shell. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn(s.site, marketingSans.variable)}>
      <a href="#content" className={s.skip}>
        Skip to content
      </a>
      <MarketingNav />
      <main id="content" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <MarketingFooter />
      <RevealOnScroll />
    </div>
  );
}
