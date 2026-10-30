import type { Metadata } from "next";
import { SharedNotice } from "@/features/report/shared-notice";

export const metadata: Metadata = { title: "Link not found" };

/** An unknown share link: a 404, in the share page's plain frame. */
export default function SharedReportNotFound() {
  return (
    <SharedNotice title="Link not found">
      There&apos;s no report at this address. Check the link you were sent, or ask the agency
      that sent it for a new one.
    </SharedNotice>
  );
}
