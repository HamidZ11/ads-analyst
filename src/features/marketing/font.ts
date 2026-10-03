import { Host_Grotesk } from "next/font/google";

/** The marketing face: a clean neo-grotesk, separate from the product's Inter. */
export const marketingSans = Host_Grotesk({
  subsets: ["latin"],
  style: "normal",
  variable: "--font-landing",
  display: "swap",
});
