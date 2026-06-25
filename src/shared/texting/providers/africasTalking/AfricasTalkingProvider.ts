import axios from "axios";
import { AddSubscriberOptions, ITextingProvider, ListsResult, ProviderCapabilities, SubscriberResult, TextingProviderConfig, TextingSendResult } from "../../interfaces.js";

const DEFAULT_BASE_URL = "https://api.sandbox.africastalking.com/version1";

export class AfricasTalkingProvider implements ITextingProvider {
  readonly name = "AfricasTalking";
  readonly capabilities: ProviderCapabilities = { addSubscriber: false, getLists: false };

  private getBaseUrl(config: TextingProviderConfig) {
    return config.baseUrl || DEFAULT_BASE_URL;
  }

  private getHeaders(config: TextingProviderConfig) {
    return {
      "apiKey": config.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    };
  }

  async sendMessage(config: TextingProviderConfig, to: string, message: string): Promise<TextingSendResult> {
    return this.sendToNumbers(config, [to], message).then(results => results[0]);
  }

  async sendBulk(config: TextingProviderConfig, recipients: string[], message: string): Promise<TextingSendResult[]> {
    return this.sendToNumbers(config, recipients, message);
  }

  private async sendToNumbers(config: TextingProviderConfig, recipients: string[], message: string): Promise<TextingSendResult[]> {
    try {
      const phoneNumbers = recipients.map(i => i.replaceAll(" ", ""));
      const params = new URLSearchParams();
      params.set("username", config.username || config.churchId);
      params.set("to", phoneNumbers.join(","));
      params.set("message", message);
      if (config.fromNumber) params.set("from", config.fromNumber);

      const response = await axios.post(
        `${this.getBaseUrl(config)}/messaging`,
        params.toString(),
        { headers: this.getHeaders(config) }
      );

      const recipientResults: any[] = response.data?.SMSMessageData?.Recipients || [];

      if (recipientResults.length === 0) {
        return phoneNumbers.map(() => ({ success: false, error: response.data?.SMSMessageData?.Message || "No recipients in response" }));
      }

      // Map results back to original recipient order
      const resultMap = new Map<string, any>();
      for (const r of recipientResults) resultMap.set(r.number, r);

      return phoneNumbers.map(num => {
        const r = resultMap.get(num);
        if (!r) return { success: false, error: "Recipient not found in response" };
        const success = r.statusCode === 101 || r.statusCode === 102;
        return {
          success,
          providerMessageId: r.messageId,
          error: success ? undefined : r.status
        };
      });
    } catch (error: any) {
      console.log("ERROR", error);
      const errMsg = error.response?.data?.SMSMessageData?.Message || error.response?.data?.message || error.message;
      return recipients.map(() => ({ success: false, error: errMsg }));
    }
  }

  async validateCredentials(config: TextingProviderConfig): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.getBaseUrl(config)}/user`,
        {
          params: { username: config.username || config.churchId },
          headers: { "apiKey": config.apiKey, "Accept": "application/json" }
        }
      );
      return response.status === 200 && !response.data?.UserData?.balance?.includes("error");
    } catch {
      return false;
    }
  }

  async addSubscriber(_config: TextingProviderConfig, _mobileNumber: string, _options?: AddSubscriberOptions): Promise<SubscriberResult> {
    return { success: false, error: "Not supported by AfricasTalking provider" };
  }

  async getLists(_config: TextingProviderConfig): Promise<ListsResult> {
    return { success: false, error: "Not supported by AfricasTalking provider" };
  }
}
