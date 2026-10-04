import type { Metadata } from "next";
import Link from "next/link";
import { ProductMark } from "@/components/shell/product-mark";
import { buttonClasses } from "@/components/ui/button";
import { loadSession } from "@/features/workspace/server";
import { APP_HOME } from "@/lib/routes";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Unknown URLs, answered with a 404 status (and noindex) rather than a
 * redirect. In an app session the page sits inside the app shell and leads
 * back to the Overview; otherwise it stands alone like sign-in and leads to
 * the public site.
 */
export default async function NotFound() {
  const session = await loadSession();
  const heading = (
    <h1 id="not-found-title" className="text-xl font-semibold tracking-[-0.02em] text-ink">
      Page not found
    </h1>
  );
  const line = (
    <p className="mt-2 text-sm leading-5 text-ink-muted">
      There&apos;s no page at this address.
    </p>
  );

  if (session.kind === "app")
    return (
      <section aria-labelledby="not-found-title" className="max-w-[520px] py-10">
        {heading}
        {line}
        <div className="mt-5 flex gap-2">
          <Link href={APP_HOME} className={buttonClasses("primary")}>
            Go to Overview
          </Link>
        </div>
      </section>
    );

  return (
    <main
      id="main"
      className="flex min-h-dvh items-start justify-center bg-surface px-4 pt-[18vh]"
    >
      <div className="w-full max-w-[360px]">
        <ProductMark />
        <section className="mt-8" aria-labelledby="not-found-title">
          {heading}
          {line}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/" className={buttonClasses("primary")}>
              Go to the home page
            </Link>
            <Link href="/pricing" className={buttonClasses("secondary")}>
              Pricing
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
