import type { Creative } from "@/domain/types";
import type { ClientSeedSpec } from "../spec";

/**
 * Arc Cloud — B2B SaaS. Conversions are free-trial signups; revenue is the
 * attributed first-payment value reported back by the pixel, so ROAS is
 * informative but not the primary target.
 */

const CLIENT_ID = "cli_arc";

const creatives: Creative[] = [
  {
    id: "cr_arc_01",
    clientId: CLIENT_ID,
    name: "Workflow Automation – Product Demo – Video 30s",
    type: "video",
    thumbnail: { kind: "placeholder", tone: "slate", aspect: "1:1", motif: "screen" },
    headline: "Automate the work between your tools",
    primaryText:
      "Connect 200+ apps and automate hand-offs in minutes. Free 14-day trial, no card required.",
    callToAction: "Start free trial",
  },
  {
    id: "cr_arc_02",
    clientId: CLIENT_ID,
    name: "Workflow Automation – Integrations Grid – Static",
    type: "image",
    thumbnail: { kind: "placeholder", tone: "mist", aspect: "1:1", motif: "catalogue" },
    headline: "Works with the tools you already use",
    primaryText:
      "Slack, HubSpot, Jira, Salesforce and 200 more. Set up your first workflow today.",
    callToAction: "Start free trial",
  },
  {
    id: "cr_arc_03",
    clientId: CLIENT_ID,
    name: "Book a Demo – ROI Calculator – Static",
    type: "image",
    thumbnail: { kind: "placeholder", tone: "stone", aspect: "1:1", motif: "clinical" },
    headline: "See what 12 hours a week is worth",
    primaryText:
      "Ops teams save an average of 12 hours per person per week. Book a 20-minute demo.",
    callToAction: "Book now",
  },
  {
    id: "cr_arc_04",
    clientId: CLIENT_ID,
    name: "Book a Demo – Customer Logos – Carousel",
    type: "carousel",
    thumbnail: { kind: "placeholder", tone: "dusk", aspect: "1:1", motif: "carousel" },
    headline: "Trusted by 1,400 operations teams",
    primaryText: "See how teams at Monzo, Hubble and Lumen run on Arc Cloud.",
    callToAction: "Book now",
  },
  {
    id: "cr_arc_05",
    clientId: CLIENT_ID,
    name: "Start Free Trial – 14 Days – Static",
    type: "image",
    thumbnail: { kind: "placeholder", tone: "slate", aspect: "1:1", motif: "offer" },
    headline: "Pick up where you left off",
    primaryText: "Your 14-day free trial is waiting. No card required.",
    callToAction: "Start free trial",
  },
  {
    id: "cr_arc_06",
    clientId: CLIENT_ID,
    name: "Start Free Trial – Feature Tour – Video 20s",
    type: "video",
    thumbnail: { kind: "placeholder", tone: "mist", aspect: "4:5", motif: "screen" },
    headline: "A 20-second tour of Arc Cloud",
    primaryText: "Triggers, conditions, approvals and audit logs. All in one place.",
    callToAction: "Start free trial",
  },
  {
    id: "cr_arc_07",
    clientId: CLIENT_ID,
    name: "G2 Leader – Fall 2026 Badge – Static",
    type: "image",
    thumbnail: { kind: "placeholder", tone: "sand", aspect: "1:1", motif: "testimonial" },
    headline: "G2 Leader, Workflow Automation, Fall 2026",
    primaryText: "Rated #1 for ease of setup by 2,100 reviewers.",
    callToAction: "Learn more",
  },
  {
    id: "cr_arc_08",
    clientId: CLIENT_ID,
    name: "G2 Leader – Reviews Montage – Video 15s",
    type: "video",
    thumbnail: { kind: "placeholder", tone: "clay", aspect: "1:1", motif: "ugc" },
    headline: "What ops leaders say about Arc Cloud",
    primaryText:
      '"We retired four internal scripts in the first week." – Head of RevOps, Series B fintech.',
    callToAction: "Start free trial",
  },
  {
    id: "cr_arc_09",
    clientId: CLIENT_ID,
    name: "Brand Film – Work That Flows – Video 60s",
    type: "video",
    thumbnail: { kind: "placeholder", tone: "dusk", aspect: "1:1", motif: "product" },
    headline: "Work that flows",
    primaryText: "A short film about the teams quietly running everything.",
    callToAction: "Learn more",
  },
];

export const arcCloudSeed: ClientSeedSpec = {
  client: {
    id: CLIENT_ID,
    agencyId: "agy_northstar",
    name: "Arc Cloud",
    type: "saas",
    currency: "USD",
    timezone: "America/New_York",
    targetCpa: 85,
    targetRoas: null,
  },
  adAccount: {
    id: "acc_arc_meta",
    clientId: CLIENT_ID,
    platform: "meta",
    name: "Arc Cloud – Meta",
    externalId: "act_117650098231",
    currency: "USD",
  },
  // Sun … Sat. B2B signups happen on working days.
  weeklyConversionPattern: [0.62, 1.12, 1.18, 1.16, 1.1, 0.95, 0.6],
  creatives,
  campaigns: [
    {
      id: "cmp_arc_01",
      name: "Trials | Lookalike Customers 1% | Workflow Automation",
      objective: "sales",
      status: "active",
      adSets: [
        {
          id: "ads_arc_01a",
          name: "LAL 1% Paying Customers · US",
          audience: "Lookalike 1% · Paying customers · US · 25–55",
          status: "active",
          ads: [
            {
              id: "ad_arc_01a1",
              name: "Workflow Automation – Product Demo – Video 30s",
              creativeId: "cr_arc_01",
              status: "active",
              spend: 150,
              cpm: 18,
              ctr: 0.0095,
              cvr: 0.026,
              aov: 52,
            },
            {
              id: "ad_arc_01a2",
              name: "Workflow Automation – Integrations Grid – Static",
              creativeId: "cr_arc_02",
              status: "active",
              spend: 110,
              cpm: 17,
              ctr: 0.0085,
              cvr: 0.022,
              aov: 52,
            },
          ],
        },
      ],
    },
    {
      id: "cmp_arc_02",
      name: "Demo Requests | Job Titles – Ops & IT | Enterprise",
      objective: "leads",
      status: "active",
      adSets: [
        {
          id: "ads_arc_02a",
          name: "Job titles: Ops, RevOps, IT · US · 200+ employees",
          audience: "Job titles: Operations, RevOps, IT · Company size 200+ · US",
          status: "active",
          ads: [
            {
              id: "ad_arc_02a1",
              name: "Book a Demo – ROI Calculator – Static",
              creativeId: "cr_arc_03",
              status: "active",
              spend: 95,
              cpm: 24,
              ctr: 0.0075,
              cvr: 0.02,
              aov: 0,
            },
            {
              id: "ad_arc_02a2",
              name: "Book a Demo – Customer Logos – Carousel",
              creativeId: "cr_arc_04",
              status: "active",
              spend: 70,
              cpm: 22,
              ctr: 0.008,
              cvr: 0.022,
              aov: 0,
            },
          ],
        },
      ],
    },
    {
      id: "cmp_arc_03",
      name: "Retargeting | Site Visitors 30D | Free Trial",
      objective: "sales",
      status: "active",
      adSets: [
        {
          id: "ads_arc_03a",
          name: "Site Visitors 30D · excl. Trials",
          audience: "Custom: Website visitors 30D, exclude StartTrial 30D",
          status: "active",
          ads: [
            {
              id: "ad_arc_03a1",
              name: "Start Free Trial – 14 Days – Static",
              creativeId: "cr_arc_05",
              status: "active",
              spend: 65,
              cpm: 20,
              ctr: 0.017,
              cvr: 0.048,
              aov: 52,
            },
            {
              id: "ad_arc_03a2",
              name: "Start Free Trial – Feature Tour – Video 20s",
              creativeId: "cr_arc_06",
              status: "active",
              spend: 48,
              cpm: 21,
              ctr: 0.014,
              cvr: 0.04,
              aov: 52,
            },
          ],
        },
      ],
    },
    {
      id: "cmp_arc_04",
      name: "Trials | Broad | G2 Leader",
      objective: "sales",
      status: "active",
      adSets: [
        {
          id: "ads_arc_04a",
          name: "Broad · US · 25–54",
          audience: "Broad · US · 25–54 · Feeds only",
          status: "active",
          ads: [
            {
              id: "ad_arc_04a1",
              name: "G2 Leader – Fall 2026 Badge – Static",
              creativeId: "cr_arc_07",
              status: "active",
              spend: 90,
              cpm: 16,
              ctr: [
                [0, 0.012],
                [59, 0.0065],
              ],
              cvr: 0.022,
              aov: 52,
            },
            {
              id: "ad_arc_04a2",
              name: "G2 Leader – Reviews Montage – Video 15s",
              creativeId: "cr_arc_08",
              status: "active",
              spend: 55,
              cpm: 16.5,
              ctr: 0.01,
              cvr: 0.02,
              aov: 52,
            },
          ],
        },
      ],
    },
    {
      id: "cmp_arc_05",
      name: "Awareness | Video Views | Brand Film",
      objective: "awareness",
      status: "active",
      adSets: [
        {
          id: "ads_arc_05a",
          name: "Broad · US · ThruPlay",
          audience: "Broad · US · 25–54 · ThruPlay optimisation",
          status: "active",
          ads: [
            {
              id: "ad_arc_05a1",
              name: "Brand Film – Work That Flows – Video 60s",
              creativeId: "cr_arc_09",
              status: "active",
              spend: 40,
              cpm: 6,
              ctr: 0.004,
              cvr: 0.002,
              aov: 52,
            },
          ],
        },
      ],
    },
  ],
};
