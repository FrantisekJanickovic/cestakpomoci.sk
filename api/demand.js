const REGIONS = new Set([
  "Bratislavský", "Trnavský", "Trenčiansky", "Nitriansky",
  "Žilinský", "Banskobystrický", "Prešovský", "Košický", "Celé Slovensko",
]);
const AGE_BANDS = new Set(["0-5", "6-11", "12-18"]);
const TOPICS = new Set([
  "anxiety", "mood", "self_harm", "adhd", "behaviour", "bullying",
  "eating", "relationships", "stress", "school", "trauma", "general",
]);
const AUDIENCES = new Set(["child", "parent", "teacher", "professional"]);
const SUPPORT_TYPES = new Set(["materials", "ambulance", "either"]);
const URGENCIES = new Set(["information", "soon", "urgent_non_emergency"]);
const SOURCES = new Set(["guided_journey", "availability_search"]);

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) return response.status(503).json({ error: "Data source is not configured" });

  const body = request.body && typeof request.body === "object" ? request.body : {};
  if (body.website) return response.status(204).end();
  // Crisis requests must never be recorded as analytics.
  if (body.urgency === "emergency" || body.urgency === "crisis") return response.status(204).end();

  const payload = {
    region: body.region,
    age_band: body.ageBand,
    radius_km: Number(body.radiusKm),
    result_count: Number(body.resultCount),
    topic: body.topic,
    audience: body.audience,
    support_type: body.supportType,
    urgency: body.urgency,
    source: body.source || "guided_journey",
  };

  const valid = REGIONS.has(payload.region)
    && AGE_BANDS.has(payload.age_band)
    && Number.isInteger(payload.radius_km) && payload.radius_km >= 5 && payload.radius_km <= 300
    && Number.isInteger(payload.result_count) && payload.result_count >= 0 && payload.result_count <= 100
    && TOPICS.has(payload.topic)
    && AUDIENCES.has(payload.audience)
    && SUPPORT_TYPES.has(payload.support_type)
    && URGENCIES.has(payload.urgency)
    && SOURCES.has(payload.source);

  if (!valid) return response.status(400).json({ error: "Invalid aggregate demand data" });

  try {
    const result = await fetch(`${baseUrl}/rest/v1/demands`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        ...(!publishableKey.startsWith("sb_") ? { Authorization: `Bearer ${publishableKey}` } : {}),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`Supabase returned ${result.status}`);
    response.setHeader("Cache-Control", "no-store");
    return response.status(202).json({ accepted: true });
  } catch (error) {
    console.error("Failed to record anonymous demand", error.message);
    return response.status(502).json({ error: "Demand signal could not be recorded" });
  }
};
