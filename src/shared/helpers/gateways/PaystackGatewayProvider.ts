import express from "express";
import Axios from "axios";
import { PaystackHelper } from "../PaystackHelper.js";
import { Environment } from "../Environment.js";
import { IGatewayProvider, WebhookResult, ChargeResult, SubscriptionResult, GatewayConfig } from "./IGatewayProvider.js";

/**
 * Paystack integration (Option A: Paystack's own M-Pesa/mobile-money support, no
 * direct Safaricom Daraja integration). Card and M-Pesa donations both flow through
 * Paystack's client-side "Inline" popup, which returns a transaction reference once
 * the donor completes payment. The reference is then verified server-to-server here
 * before it is ever recorded as a donation — the client is never trusted for amount
 * or success/failure.
 *
 * Paystack has no per-merchant webhook-provisioning API; the webhook URL must be
 * pasted into the Paystack Dashboard (Settings > API Keys & Webhooks) once per
 * account. createWebhookEndpoint/deleteWebhooksByChurchId are therefore no-ops that
 * just surface a stable placeholder id so the rest of the gateway-save flow behaves
 * the same as it does for Stripe/PayPal.
 */
export class PaystackGatewayProvider implements IGatewayProvider {
  readonly name = "paystack";

  async createWebhookEndpoint(_config: GatewayConfig, _webhookUrl: string): Promise<{ id: string; secret?: string }> {
    return { id: "manual-dashboard-config" };
  }

  async deleteWebhooksByChurchId(_config: GatewayConfig, _churchId: string): Promise<void> {
    // No-op: Paystack webhooks are configured account-wide in their dashboard, not per church.
  }

  async verifyWebhookSignature(config: GatewayConfig, headers: express.Request["headers"], body: any): Promise<WebhookResult> {
    try {
      const signature = headers["x-paystack-signature"]?.toString();
      if (!signature) return { success: false, shouldProcess: false };

      const rawBody: Buffer | string = Buffer.isBuffer(body) ? body : (typeof body === "string" ? body : JSON.stringify(body));
      const validSignature = PaystackHelper.verifyWebhookSignature(config.privateKey, rawBody, signature);
      if (!validSignature) return { success: false, shouldProcess: false };

      const parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString("utf8"));
      const eventType: string = parsed?.event || "";
      const eventData = parsed?.data;
      const eventId: string = eventData?.reference || (eventData?.id != null ? String(eventData.id) : "");

      return {
        success: true,
        shouldProcess: eventType === "charge.success",
        eventType,
        eventData,
        eventId
      };
    } catch {
      return { success: false, shouldProcess: false };
    }
  }

  async processCharge(config: GatewayConfig, donationData: any): Promise<ChargeResult> {
    const reference: string = donationData?.id;
    if (!reference) {
      return { success: false, transactionId: "", data: null, error: "Missing payment reference" };
    }

    try {
      const verifyResponse = await PaystackHelper.verifyTransaction(config.privateKey, reference);
      const data = verifyResponse?.data;

      if (!data || data.status !== "success") {
        return {
          success: false,
          transactionId: reference,
          data,
          error: data?.gateway_response || "Payment could not be verified as successful"
        };
      }

      // Normalize to the status token the shared donor UI already understands
      // (MultiGatewayDonationForm treats "succeeded" as a completed payment).
      return { success: true, transactionId: reference, data: { ...data, status: "succeeded" } };
    } catch (err: any) {
      console.error("Paystack verify error:", err?.response?.data || err?.message || err);
      return {
        success: false,
        transactionId: reference,
        data: null,
        error: err?.response?.data?.message || err?.message || "Payment verification failed"
      };
    }
  }

  async createSubscription(): Promise<SubscriptionResult> {
    throw new Error("Paystack does not support recurring donations in this integration");
  }

  async updateSubscription(): Promise<SubscriptionResult> {
    throw new Error("Paystack does not support recurring donations in this integration");
  }

  async cancelSubscription(): Promise<void> {
    throw new Error("Paystack does not support recurring donations in this integration");
  }

  async calculateFees(amount: number, churchId: string, _currency: string = "KES", paymentType?: "card" | "bank"): Promise<number> {
    let customFixedFee: number | null = null;
    let customPercentFee: number | null = null;

    if (churchId) {
      try {
        const response = await Axios.get(Environment.membershipApi + "/settings/public/" + churchId);
        const data = response.data;
        if (paymentType === "bank") {
          // "bank" is reused here to mean the mobile-money (M-Pesa) channel, matching
          // how the ACH slot is reused for non-card channels elsewhere in this codebase.
          if (data?.flatRatePaystackMobile != null && data.flatRatePaystackMobile !== "") customFixedFee = +data.flatRatePaystackMobile;
          if (data?.transFeePaystackMobile != null && data.transFeePaystackMobile !== "") customPercentFee = +data.transFeePaystackMobile / 100;
        } else {
          if (data?.flatRatePaystack != null && data.flatRatePaystack !== "") customFixedFee = +data.flatRatePaystack;
          if (data?.transFeePaystack != null && data.transFeePaystack !== "") customPercentFee = +data.transFeePaystack / 100;
        }
      } catch {
        // Fall through to defaults if settings can't be loaded.
      }
    }

    // Sensible Kenya-market defaults: mobile money (M-Pesa) is cheaper than card.
    const fixedFee = customFixedFee ?? 0;
    const fixedPercent = customPercentFee ?? (paymentType === "bank" ? 0.015 : 0.029);
    return Math.round(((amount + fixedFee) / (1 - fixedPercent) - amount) * 100) / 100;
  }

  async logEvent(churchId: string, event: any, eventData: any, repos: any): Promise<void> {
    const eventType = event?.event || "charge.success";
    await PaystackHelper.logEvent(churchId, eventType, eventData, repos);
  }

  async logDonation(_config: GatewayConfig, churchId: string, eventData: any, repos: any, status: "pending" | "complete" = "complete"): Promise<any> {
    return await PaystackHelper.logDonation(churchId, eventData, repos, status);
  }

  async updateDonationStatus(churchId: string, transactionId: string, status: "pending" | "complete" | "failed", repos: any): Promise<void> {
    await PaystackHelper.updateDonationStatus(churchId, transactionId, status, repos);
  }
}
