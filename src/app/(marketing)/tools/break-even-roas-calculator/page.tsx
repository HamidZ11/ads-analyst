import type { Metadata } from "next";
import { marketingMetadata } from "@/features/marketing/seo";
import { ToolPage, ToolSection } from "@/features/tools/tool-page";

export const metadata: Metadata = marketingMetadata("/tools/break-even-roas-calculator");

export default function BreakEvenRoasCalculatorPage() {
  return (
    <ToolPage id="break-even-roas">
      <ToolSection title="What break-even ROAS means">
        <p>
          Break-even ROAS is the return on ad spend at which the margin on the sales your ads
          bring in exactly pays for the ads. Below it, each £1 of spend returns less than £1 of
          margin; above it, more.
        </p>
        <p>
          Write the margin as a fraction and divide 1 by it. At a 40% margin, 1 ÷ 0.40 = 2.50x:
          £2.50 of revenue leaves £1 of margin, which covers £1 of spend.
        </p>
      </ToolSection>
      <ToolSection title="Which margin to use">
        <p>
          Use the share of revenue left after the cost of the goods and any per-order costs you
          want covered, such as shipping and payment fees, before ad spend. The more costs you
          include, the lower the margin and the higher the break-even line.
        </p>
        <p>
          With an average order value, the calculator also gives the break-even CPA: the margin
          on one order, the most a conversion can cost before it loses money.
        </p>
        <p>
          It is a single-order view: it leaves out fixed costs such as salaries and software,
          and any repeat purchases a new customer makes later.
        </p>
      </ToolSection>
    </ToolPage>
  );
}
