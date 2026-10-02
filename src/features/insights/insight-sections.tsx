import { Eye, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ConversionVocabulary } from "@/domain/labels";

interface SectionSpec {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}

export function insightSections(vocabulary: ConversionVocabulary): SectionSpec[] {
  const cost = vocabulary.costLabel.toLowerCase();
  return [
    {
      id: "high-impact",
      title: "High impact",
      icon: Zap,
      description: `Confident, material shifts: ${cost} or ROAS moving against target on meaningful spend, and budget going to entities with no ${vocabulary.plural.toLowerCase()}.`,
      emptyTitle: "No high-impact findings generated",
      emptyDescription:
        "Findings here will be computed from the selected period against the previous one, ranked by the spend involved. The insight engine arrives in a later release.",
    },
    {
      id: "opportunities",
      title: "Opportunities",
      icon: TrendingUp,
      description: `Where more budget would likely pay off: efficient ads with a small share of spend, campaigns improving period over period, and headroom under the ${cost} target.`,
      emptyTitle: "No opportunities generated",
      emptyDescription:
        "Scaling candidates will be identified from stable efficiency, rising conversion volume and share-of-spend relative to the rest of the account.",
    },
    {
      id: "watch",
      title: "Watch",
      icon: Eye,
      description:
        "Early signals worth monitoring before they become expensive: steadily declining CTR on stable CPM, rising spend with falling conversions, and slowing conversion rates.",
      emptyTitle: "Nothing on the watch list",
      emptyDescription:
        "Watch items will surface trends that are directionally clear but not yet material enough to act on.",
    },
  ];
}

export function InsightSections({ vocabulary }: { vocabulary: ConversionVocabulary }) {
  return (
    <div className="flex flex-col gap-4">
      {insightSections(vocabulary).map((section) => {
        return (
          <Card key={section.id} id={section.id}>
            <CardHeader
              icon={section.icon}
              title={section.title}
              description={section.description}
            />
            <CardBody>
              <EmptyState title={section.emptyTitle} description={section.emptyDescription} />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
