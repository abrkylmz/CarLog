import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Reads a fuel receipt photo with Claude and returns the fill-up fields. Needs ANTHROPIC_API_KEY
// in the environment; without it receiptScanConfigured() is false and the app hides the button.

const ReceiptSchema = z.object({
  is_fuel_receipt: z.boolean(),
  /** Purchase date as YYYY-MM-DD, null if not printed or unreadable. */
  date: z.string().nullable(),
  total_tl: z.number().nullable(),
  liters: z.number().nullable(),
  price_per_liter: z.number().nullable(),
  fuel: z.enum(["benzin", "motorin", "lpg", "diger"]).nullable(),
  station: z.string().nullable(),
});

export type ReceiptReading = z.infer<typeof ReceiptSchema>;

const PROMPT = `Bu fotoğraf Türkiye'de bir akaryakıt istasyonundan alınmış bir fiş (veya pompa ekranı) olabilir.
Fişte yazanları oku ve alanları doldur:
- is_fuel_receipt: bu bir akaryakıt/LPG alım fişi veya pompa ekranı mı?
- date: alım tarihi, YYYY-MM-DD biçiminde (fişte gün.ay.yıl yazar).
- total_tl: ödenen toplam tutar (TL). Türkçe yazımda nokta binlik, virgül ondalık ayırıcıdır: "1.250,50" = 1250.50.
- liters: alınan litre miktarı.
- price_per_liter: litre fiyatı (TL).
- fuel: benzin, motorin (dizel), lpg ya da diger.
- station: istasyon markası (Shell, Opet, BP, Petrol Ofisi, Total, Aytemiz, Lukoil vb.).
Okuyamadığın ya da fişte olmayan bir değeri tahmin etme; null bırak.`;

let client: Anthropic | null = null;

export function receiptScanConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** null when the model declined; throws on API errors (the caller turns them into a message). */
export async function readReceipt(mediaType: "image/jpeg" | "image/png" | "image/webp", base64: string): Promise<ReceiptReading | null> {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    // Reading a receipt is simple extraction, so a low effort keeps it fast and cheap.
    output_config: { effort: "low", format: betaZodOutputFormat(ReceiptSchema) },
    // If a safety check declines the request, the API retries it on a suitable model by itself.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}
