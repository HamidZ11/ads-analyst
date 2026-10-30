"use client";

import { ProductMark } from "@/components/shell/product-mark";
import { buttonClasses } from "@/components/ui/button";
import "./globals.css";

/**
 * A failure in the root layout itself (for example loading the session),
 * where `error.tsx` cannot help. It replaces the whole document, so it brings
 * its own html, body and styles. Never shows raw errors.
 */
export default function GlobalError({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full font-sans">
        <title>Something went wrong · Ad Analyst</title>
        <main
          id="main"
          className="flex min-h-dvh items-start justify-center bg-surface px-4 pt-[18vh]"
        >
          <section className="w-full max-w-[360px]" aria-labelledby="global-error-title">
            <ProductMark />
            <h1
              id="global-error-title"
              className="mt-8 text-xl font-semibold tracking-[-0.02em] text-ink"
            >
              Ad Analyst couldn&apos;t load
            </h1>
            <p className="mt-2 text-sm leading-5 text-ink-muted">
              Your data is safe. Something went wrong on our side; try again in a moment.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={retry} className={buttonClasses("primary")}>
                Try again
              </button>
              {/* A full page load: the root layout itself failed, so start it afresh. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className={buttonClasses("secondary")}>
                Go to the home page
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
