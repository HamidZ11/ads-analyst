import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductMark } from "@/components/shell/product-mark";
import { SignInForm } from "@/features/auth/sign-in-form";
import { loadSession } from "@/features/workspace/server";
import { APP_HOME } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await loadSession();
  if (session.kind === "app") redirect(APP_HOME);
  const linkError = (await searchParams).error === "link";
  return (
    <main
      id="main"
      className="flex min-h-dvh items-start justify-center bg-surface px-4 pt-[18vh]"
    >
      <div className="w-full max-w-[360px]">
        <ProductMark />
        {session.kind === "unconfigured" ? (
          <section className="mt-8" aria-labelledby="setup-title">
            <h1 id="setup-title" className="text-xl font-semibold tracking-[-0.02em] text-ink">
              Not connected yet
            </h1>
            <p className="mt-2 text-sm leading-5 text-ink-muted">
              This deployment has no database. Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or AD_ANALYST_DEMO_MODE=true for read-only
              demo data.
            </p>
          </section>
        ) : (
          <section className="mt-8" aria-labelledby="sign-in-title">
            <h1
              id="sign-in-title"
              className="text-xl font-semibold tracking-[-0.02em] text-ink"
            >
              Sign in
            </h1>
            <p className="mt-1 text-sm leading-5 text-ink-muted">
              We&apos;ll email you a one-time link. No password needed.
            </p>
            {session.kind === "unavailable" ? (
              <p role="alert" className="mt-4 text-sm text-negative">
                Your workspace couldn&apos;t be loaded. Try signing in again.
              </p>
            ) : null}
            <SignInForm linkError={linkError} />
          </section>
        )}
      </div>
    </main>
  );
}
