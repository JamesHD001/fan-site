const generateMembershipNumber = () => {
    const timestamp = Date.now().toString().slice(-8);
  
    const random = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();
  
    return `KRC-${timestamp}-${random}`;
  };
  
  const calculateExpiryDate = (startDate, plan) => {
    const expiryDate = new Date(startDate);
  
    switch (plan.durationUnit) {
      case "DAY":
        expiryDate.setDate(
          expiryDate.getDate() + plan.duration
        );
        break;
  
      case "MONTH":
        expiryDate.setMonth(
          expiryDate.getMonth() + plan.duration
        );
        break;
  
      case "YEAR":
        expiryDate.setFullYear(
          expiryDate.getFullYear() + plan.duration
        );
        break;
  
      default:
        throw new Error(
          `Unsupported duration unit: ${plan.durationUnit}`
        );
    }
  
    return expiryDate;
  };
  
  module.exports = {
    generateMembershipNumber,
    calculateExpiryDate,
  };