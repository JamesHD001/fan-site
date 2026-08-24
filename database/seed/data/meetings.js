module.exports = [
    {
      name: "Virtual Meet & Greet",
      slug: "virtual-meet-and-greet",
      description:
        "A 15-minute virtual fan experience.",
      duration: 15,
      price: 2500,
      currency: "USD",
      minimumMembershipTier: "SUPPORTER",
      maxParticipants: 1,
      isActive: true,
      sortOrder: 1,
    },
  
    {
      name: "Premium Fan Session",
      slug: "premium-fan-session",
      description:
        "A private 30-minute virtual fan session.",
      duration: 30,
      price: 5000,
      currency: "USD",
      minimumMembershipTier: "INSIDER",
      maxParticipants: 1,
      isActive: true,
      sortOrder: 2,
    },
  
    {
      name: "VIP Experience",
      slug: "vip-experience",
      description:
        "A premium 60-minute virtual fan experience.",
      duration: 60,
      price: 10000,
      currency: "USD",
      minimumMembershipTier: "VIP",
      maxParticipants: 1,
      isActive: true,
      sortOrder: 3,
    },
  
    {
      name: "Group Fan Event",
      slug: "group-fan-event",
      description:
        "A group virtual fan event with a limited number of participants.",
      duration: 60,
      price: 1000,
      currency: "USD",
      minimumMembershipTier: "FAN",
      maxParticipants: 50,
      isActive: true,
      sortOrder: 4,
    },
  ];