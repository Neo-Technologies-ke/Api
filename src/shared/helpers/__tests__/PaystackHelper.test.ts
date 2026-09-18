import Axios from "axios";
import { PaystackHelper } from "../PaystackHelper";

jest.mock("axios");
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

describe("PaystackHelper M-PESA", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ["0710000000", "+254710000000"],
    ["0110000000", "+254110000000"],
    ["254710000000", "+254710000000"],
    ["+254 710 000 000", "+254710000000"]
  ])("normalizes %s", (input, expected) => {
    expect(PaystackHelper.normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["123456", "07000000", "+255710000000", "254610000000"])("rejects %s", (input) => {
    expect(() => PaystackHelper.normalizeKenyanPhone(input)).toThrow("valid Kenyan mobile number");
  });

  it("creates a KES M-PESA charge in subunits", async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: true, data: { reference: "mpesa-test", status: "pay_offline" } } });
    const result = await PaystackHelper.initiateMpesaCharge("sk_test_value", {
      email: "member@example.com",
      amount: 123.45,
      currency: "kes",
      phone: "0710000000",
      reference: "mpesa-test",
      metadata: { churchId: "church" }
    });
    expect(result.data.reference).toBe("mpesa-test");
    expect(mockedAxios.post).toHaveBeenCalledWith("https://api.paystack.co/charge", expect.objectContaining({
      amount: 12345,
      currency: "KES",
      reference: "mpesa-test",
      mobile_money: { phone: "+254710000000", provider: "mpesa" }
    }), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer sk_test_value" }) }));
  });

  it("rejects missing secrets and invalid amounts before calling Paystack", async () => {
    await expect(PaystackHelper.initiateMpesaCharge("", { email: "member@example.com", amount: 10, phone: "0710000000", reference: "mpesa-test" })).rejects.toThrow("secret key");
    await expect(PaystackHelper.initiateMpesaCharge("secret", { email: "member@example.com", amount: 0, phone: "0710000000", reference: "mpesa-test" })).rejects.toThrow("valid amount");
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
