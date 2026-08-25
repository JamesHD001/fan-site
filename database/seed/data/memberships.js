module.exports = [
  {
    name: "Supporter",
    slug: "supporter",
    description:
      "A great way to become a recognized member of the fan community.",
    // USD minor units: $1,000.00 = 100000.
    price: 100000,
    currency: "USD",
    duration: 1,
    durationUnit: "YEAR",
    benefits: [
      "Supporter membership badge",
      "Digital membership card",
      "Members-only posts",
      "Exclusive photo gallery",
      "Early event announcements",
      "Member notifications",
    ],
    badge: "Supporter",
    cardDesign: "supporter",
    minimumMeetingTier: "SUPPORTER",
    isActive: true,
    sortOrder: 1,
  },

  {
    name: "Insider",
    slug: "insider",
    description:
      "An enhanced membership for fans who want deeper access to the community experience.",
    // USD minor units: $3,500.00 = 350000.
    price: 350000,
    currency: "USD",
    duration: 1,
    durationUnit: "YEAR",
    benefits: [
      "Everything in Supporter",
      "Insider membership badge",
      "Premium digital membership card",
      "Exclusive videos",
      "Behind-the-scenes content",
      "Priority access to selected events",
      "One complimentary virtual gift",
    ],
    badge: "Insider",
    cardDesign: "insider",
    minimumMeetingTier: "INSIDER",
    isActive: true,
    sortOrder: 2,
  },

  {
    name: "VIP",
    slug: "vip",
    description:
      "The highest membership tier with premium community privileges and priority experiences.",
    // USD minor units: $10,000.00 = 1000000.
    price: 1000000,
    currency: "USD",
    duration: 1,
    durationUnit: "YEAR",
    benefits: [
      "Everything in Insider",
      "VIP membership badge",
      "Premium VIP membership card",
      "Priority meeting-booking access",
      "VIP-only events",
      "Premium fan experiences",
      "Two complimentary virtual gifts",
      "VIP community recognition",
      "Priority customer support",
    ],
    badge: "VIP",
    cardDesign: "vip",
    minimumMeetingTier: "VIP",
    isActive: true,
    sortOrder: 3,
  },
];
