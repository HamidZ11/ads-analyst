import { IBM_Plex_Mono, Newsreader } from "next/font/google";

/* Sign-in only (D-NEW-sign-in-1): a display serif for the one headline and a mono for
   the eyebrow above it. Self-hosted by next/font and loaded only where these
   are used; the app stays Inter. */

/** Newsreader, variable with its optical-size axis so the headline uses the display cut. */
export const signInDisplay = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-sign-in-display",
  display: "swap",
});

/** IBM Plex Mono 400, for the 11px uppercase eyebrow only. */
export const signInMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sign-in-mono",
  display: "swap",
});
