module.exports = async function handler(request, response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) return response.status(503).json({ error: "Data source is not configured" });

  const fields = [
    "external_id", "name", "provider", "region", "district", "city", "address", "phone", "email",
    "website", "physicians", "insurers", "opening_hours", "source_url", "data_status", "last_verified_at",
    "contact_note", "age_min", "age_max", "accepts_new", "earliest_date", "slots_30d",
    "note_public", "capacity_status", "capacity_updated_at", "capacity_valid_until",
  ].join(",");
  const url = `${baseUrl}/rest/v1/ambulances?select=${encodeURIComponent(fields)}&active=eq.true&is_demo=eq.false&order=city.asc,name.asc&limit=250`;

  try {
    const result = await fetch(url, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`Supabase returned ${result.status}`);
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const data = (await result.json()).map((item) => {
      const contactTime = item.last_verified_at ? new Date(`${item.last_verified_at}T00:00:00Z`).getTime() : 0;
      const capacityUntil = item.capacity_valid_until ? new Date(item.capacity_valid_until).getTime() : 0;
      return {
        ...item,
        contact_stale: !contactTime || now - contactTime > ninetyDays,
        capacity_stale: !capacityUntil || capacityUntil < now,
      };
    });
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    return response.status(200).json(data);
  } catch (error) {
    console.error("Failed to load ambulances", error.message);
    return response.status(502).json({ error: "Ambulances are temporarily unavailable" });
  }
};
