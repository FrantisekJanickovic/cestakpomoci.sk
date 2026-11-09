module.exports = async function handler(request, response) {
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
    "contact_note", "accepts_new", "earliest_date", "capacity_updated_at",
  ].join(",");
  const url = `${baseUrl}/rest/v1/ambulances?select=${encodeURIComponent(fields)}&active=eq.true&is_demo=eq.false&order=city.asc,name.asc&limit=250`;

  try {
    const result = await fetch(url, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
    });
    if (!result.ok) throw new Error(`Supabase returned ${result.status}`);
    const data = await result.json();
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    return response.status(200).json(data);
  } catch (error) {
    console.error("Failed to load ambulances", error.message);
    return response.status(502).json({ error: "Ambulances are temporarily unavailable" });
  }
};
