import type { Metadata } from "next";
import Link from "next/link";
import { marketingMetadata } from "@/features/marketing/seo";
import { ToolPage, ToolSection } from "@/features/tools/tool-page";

export const metadata: Metadata = marketingMetadata("/tools/roas-calculator");

export default function RoasCalculatorPage() {
  return (
    <ToolPage id="roas">
      <ToolSection title="What ROAS measures">
        <p>
          Return on ad spend is the revenue attributed to your ads divided by what the ads cost.
          A ROAS of 4.00x means £4 of revenue for every £1 of spend; the same figure is
          sometimes written as 400%.
        </p>
        <p>
          The revenue is whatever your ad platform attributes to the ads, such as the purchase
          conversion value in Meta Ads Manager, so it depends on the attribution setting the
          report uses. Use the same setting when you compare periods or clients.
        </p>
      </ToolSection>
      <ToolSection title="What it doesn’t tell you">
        <p>
          ROAS counts revenue, not profit. Whether a given ROAS makes money depends on the
          margin on what was sold: a business with a 25% margin needs a higher ROAS to cover its
          ads than one with a 60% margin. The{" "}
          <Link href="/tools/break-even-roas-calculator">break-even ROAS calculator</Link> works
          out that line from your margin.
        </p>
        <p>
          With no spend there is no return to measure, so the calculator shows ROAS as not
          available rather than zero.
        </p>
      </ToolSection>
    </ToolPage>
  );
}
