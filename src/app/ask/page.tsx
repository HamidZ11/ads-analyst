import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { conversionVocabulary } from "@/domain/labels";
import { AskAnalyst } from "@/features/ask/ask-analyst";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Ask Analyst" };

export default async function AskAnalystPage() {
  const { client, periods, comparison } = await getWorkspace();
  const vocab = conversionVocabulary(client.type);
  const suggestions = [
    `Why did ${vocab.costLabel.toLowerCase()} increase this week?`,
    "Where am I wasting the most money?",
    "Which creative is performing best?",
    "Which campaign should get more budget?",
    `Which ads are losing ${vocab.plural.toLowerCase()} while spend rises?`,
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={client.name}
        title="Ask Analyst"
        description={`Plain-English questions about ${client.name}'s Meta Ads data, answered with the numbers behind them.`}
      />
      <AskAnalyst
        clientName={client.name}
        rangeLabel={formatDateRange(periods.current)}
        comparison={comparison}
        suggestions={suggestions}
      />
    </div>
  );
}
