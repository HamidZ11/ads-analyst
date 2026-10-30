import type { Metadata } from "next";
import Link from "next/link";
import { marketingMetadata } from "@/features/marketing/seo";
import { ToolPage, ToolSection } from "@/features/tools/tool-page";

export const metadata: Metadata = marketingMetadata("/tools/cpa-calculator");

export default function CpaCalculatorPage() {
  return (
    <ToolPage id="cpa">
      <ToolSection title="What CPA measures">
        <p>
          Cost per acquisition, also called cost per conversion or cost per result, is ad spend
          divided by the number of conversions it produced. £3,000 of spend and 120 purchases is
          a CPA of £25.
        </p>
        <p>
          A conversion is whatever you count as the result of the ads: a purchase, a lead, a
          trial sign-up. Count the same thing in every period you compare, and lower is better.
        </p>
      </ToolSection>
      <ToolSection title="How to read it">
        <p>
          A CPA means most next to what a conversion is worth. If an average order leaves £20 of
          margin, a £25 CPA loses money on every sale it brings in. The{" "}
          <Link href="/tools/break-even-roas-calculator">break-even calculator</Link> works out
          the highest CPA your margin allows.
        </p>
        <p>
          Spend with no conversions has no CPA: the calculator says so rather than showing zero
          or infinity, because that spend produced no recorded result at all.
        </p>
      </ToolSection>
    </ToolPage>
  );
}
