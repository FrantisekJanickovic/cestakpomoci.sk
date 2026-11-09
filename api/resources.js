module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) return response.status(503).json({ error: "Data source is not configured" });

  const fields = [
    "external_id", "title", "owner_name", "owner_type", "audience", "audience_raw",
    "age_groups", "age_raw", "age_min", "age_max", "topics", "topics_raw",
    "resource_format", "support_level", "access_type", "registration_type", "price_type",
    "language_code", "evidence_level", "hub_priority", "learning_phase", "source_url", "checked_at",
  ].join(",");
  const url = `${baseUrl}/rest/v1/content_resources?select=${encodeURIComponent(fields)}&is_published=eq.true&order=title.asc&limit=500`;

  try {
    const result = await fetch(url, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
    });
    if (!result.ok) throw new Error(`Supabase returned ${result.status}`);
    const data = await result.json();
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return response.status(200).json(data);
  } catch (error) {
    console.error("Failed to load resources", error.message);
    return response.status(502).json({ error: "Resources are temporarily unavailable" });
  }
};
