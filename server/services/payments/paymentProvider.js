/**
 * Provider contract for external payment integrations.
 * Implementations must never mark a payment successful based solely on
 * client input; confirmation must come from the provider's API/webhook.
 */
class PaymentProvider {
  constructor(name) {
    this.name = name;
  }

  async initialize() {
    throw new Error(`${this.name} payment initialization is not implemented.`);
  }

  async verify() {
    throw new Error(`${this.name} payment verification is not implemented.`);
  }
}

module.exports = PaymentProvider;
