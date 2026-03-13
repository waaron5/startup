type AdviceSlipResponse = {
  slip?: {
    id?: number;
    advice?: string;
  };
};

export async function fetchMissionIntel(): Promise<string> {
  const response = await fetch(`https://api.adviceslip.com/advice?t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Intel provider unavailable (${response.status}).`);
  }

  const payload = (await response.json()) as AdviceSlipResponse;
  const advice = payload.slip?.advice?.trim();

  if (!advice) {
    throw new Error("Intel provider returned an empty response.");
  }

  return advice;
}
