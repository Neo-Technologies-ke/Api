import crypto from "crypto";
import Axios from "axios";
import { Donation, DonationBatch, EventLog, FundDonation } from "../../modules/giving/models/index.js";

const PAYSTACK_API_BASE = "https://api.paystack.co";

export class PaystackHelper {
  /**
   * Verify a transaction reference server-to-server. This is the ONLY source of truth
   * for whether money actually moved — client-reported amounts/status are never trusted.
   */
  static async verifyTransaction(secretKey: string, reference: string): Promise<any> {
    if (!secretKey) throw new Error("Paystack secret key is not configured. Please check your gateway settings.");
    if (!reference) throw new Error("Missing Paystack transaction reference.");

    const response = await Axios.get(`${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    return response.data;
  }

  /**
   * Paystack does not expose a per-merchant "create webhook" API — the webhook URL is
   * configured once in the Paystack Dashboard (Settings > API Keys & Webhooks) and is
   * verified using the account's secret key (HMAC-SHA512 over the raw request body).
   * This constant-time signature check is the only thing standing between us and a
   * forged "payment succeeded" request, so treat any mismatch as a hard failure.
   */
  static verifyWebhookSignature(secretKey: string, rawBody: Buffer | string, signature: string | undefined): boolean {
    if (!secretKey || !signature) return false;
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
    const expected = crypto.createHmac("sha512", secretKey).update(bodyBuffer).digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(signature, "utf8");
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  static async logEvent(churchId: string, eventType: string, eventData: any, givingRepos: any) {
    const eventLog: EventLog = {
      id: "", // Let the repository create() method generate the ID
      churchId,
      customerId: eventData?.customer?.email || "",
      provider: "Paystack",
      providerId: eventData?.reference || "",
      eventType,
      status: eventData?.status || eventType,
      message: eventData?.gateway_response || "",
      created: eventData?.paid_at ? new Date(eventData.paid_at) : new Date()
    };
    return givingRepos.eventLog.save(eventLog);
  }

  /**
   * Records a completed Paystack transaction as a donation. `eventData` is the Paystack
   * transaction object (the `data` node from either a webhook payload or a verify
   * response) — both share the same shape, so this single implementation covers both
   * the synchronous post-charge path and the asynchronous webhook reconciliation path.
   *
   * Amount is always taken from the verified Paystack `amount` field (never from the
   * client-supplied donation context) to prevent a tampered client from recording a
   * larger donation than was actually collected.
   */
  static async logDonation(churchId: string, eventData: any, givingRepos: any, status: "pending" | "complete" = "complete") {
    const rawAmount = Number(eventData?.amount) || 0;
    const amount = Math.round(rawAmount) / 100;
    const currency = (eventData?.currency || "KES").toLowerCase();
    const channel = eventData?.channel;
    const method = channel === "mobile_money" ? "M-Pesa" : channel === "bank" || channel === "bank_transfer" ? "Bank Transfer" : channel === "ussd" ? "USSD" : "Card";
    const methodDetails = eventData?.authorization?.last4 ? `****${eventData.authorization.last4}` : eventData?.reference || "";

    const metadata = eventData?.metadata && typeof eventData.metadata === "object" ? eventData.metadata : {};
    const personId = metadata.personId || null;
    const notes = metadata.notes || "";

    let funds: FundDonation[] = [];
    if (metadata.funds) {
      try {
        const parsed = JSON.parse(metadata.funds);
        if (Array.isArray(parsed)) funds = parsed;
      } catch {
        funds = [];
      }
    }

    // Defense against a tampered client claiming a fund split that doesn't match what
    // was actually verified as paid — fall back to the general fund for the full
    // verified amount instead of trusting an inconsistent breakdown.
    const fundsTotal = funds.reduce((sum, f: any) => sum + (Number(f?.amount) || 0), 0);
    if (funds.length === 0 || Math.abs(fundsTotal - amount) > 0.5) {
      const generalFund = await givingRepos.fund.getOrCreateGeneral(churchId);
      funds = [{ id: generalFund.id, amount } as FundDonation];
    }

    const batch: DonationBatch = await givingRepos.donationBatch.getOrCreateCurrent(churchId);
    const donationData: Donation = {
      batchId: batch.id,
      amount,
      currency,
      churchId,
      personId,
      method,
      methodDetails,
      donationDate: eventData?.paid_at ? new Date(eventData.paid_at) : new Date(),
      notes,
      status,
      transactionId: eventData?.reference
    };

    const donation: Donation = await givingRepos.donation.save(donationData);
    const promises: Promise<FundDonation>[] = [];
    funds.forEach((fund: any) => {
      const fundDonation: FundDonation = { churchId, amount: fund.amount, donationId: donation.id, fundId: fund.id };
      promises.push(givingRepos.fundDonation.save(fundDonation));
    });
    return Promise.all(promises);
  }

  static async updateDonationStatus(churchId: string, transactionId: string, status: "pending" | "complete" | "failed", givingRepos: any) {
    await givingRepos.donation.updateStatus(churchId, transactionId, status);
  }
}
