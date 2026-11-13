const crypto = require("crypto");

const STATUSES = new Set(["accepting", "limited", "full", "call", "unknown"]);

function config() {
  return {
    baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function headers(key, extra = {}) {
  return { apikey: key, ...(!key.startsWith("sb_") ? { Authorization: `Bearer ${key}` } : {}), ...extra };
}

function validExternalId(value) {
  return typeof value === "string" && value.length >= 2 && value.length <= 128 && /^[\p{L}\p{N}._-]+$/u.test(value);
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

async function loadAmbulance(baseUrl, key, externalId) {
  const fields = [
    "id", "external_id", "name", "provider", "city", "region", "phone", "email",
    "capacity_status", "accepts_new", "earliest_date", "slots_30d", "note_public",
    "capacity_updated_at", "capacity_valid_until", "last_verified_at", "data_status",
  ].join(",");
  const url = `${baseUrl}/rest/v1/ambulances?select=${encodeURIComponent(fields)}&external_id=eq.${encodeURIComponent(externalId)}&active=eq.true&limit=1`;
  const result = await fetch(url, { headers: headers(key), signal: AbortSignal.timeout(8000) });
  if (!result.ok) throw new Error(`Supabase returned ${result.status}`);
  return (await result.json())[0] || null;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const { baseUrl, key } = config();
  if (!baseUrl || !key) return response.status(503).json({ error: "Data source is not configured" });

  const externalId = request.method === "GET" ? request.query.ambulance : request.body?.ambulance;
  if (!validExternalId(externalId)) return response.status(400).json({ error: "Invalid ambulance identifier" });

  if (request.method === "GET") {
    try {
      const ambulance = await loadAmbulance(baseUrl, key, externalId);
      if (!ambulance) return response.status(404).json({ error: "Ambulance not found" });
      delete ambulance.id;
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json(ambulance);
    } catch (error) {
      console.error("Failed to load capacity portal", error.message);
      return response.status(502).json({ error: "Capacity portal is temporarily unavailable" });
    }
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const body = request.body && typeof request.body === "object" ? request.body : {};
  const token = body.token;
  const status = body.status;
  const earliestDate = parseDate(body.earliestDate);
  const slots = body.slots30d === "" || body.slots30d == null ? null : Number(body.slots30d);
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token) || !STATUSES.has(status) || note.length > 240 || (body.note != null && typeof body.note !== "string")) {
    return response.status(400).json({ error: "Invalid capacity update" });
  }
  if (earliestDate === undefined || (slots !== null && (!Number.isInteger(slots) || slots < 0 || slots > 99))) {
    return response.status(400).json({ error: "Invalid date or slot count" });
  }

  const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if ((status === "accepting" || status === "limited") && earliestDate && earliestDate < today) {
    return response.status(400).json({ error: "Date cannot be in the past" });
  }
  const validUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const accepting = status === "accepting" || status === "limited" ? true : status === "full" ? false : null;
  const allowsDate = status === "accepting" || status === "limited";
  const patch = {
    capacity_status: status,
    accepts_new: accepting,
    earliest_date: allowsDate ? earliestDate : null,
    slots_30d: allowsDate ? slots : null,
    note_public: note || null,
    capacity_updated_at: now.toISOString(),
    capacity_valid_until: validUntil,
    updated_at: now.toISOString(),
  };
  if (body.confirmContacts === true) {
    patch.last_verified_at = now.toISOString().slice(0, 10);
    patch.data_status = "verified_provider";
  }

  try {
    const updateUrl = `${baseUrl}/rest/v1/ambulances?external_id=eq.${encodeURIComponent(externalId)}&active=eq.true&select=${encodeURIComponent("id,external_id,name,capacity_status,accepts_new,earliest_date,slots_30d,note_public,capacity_updated_at,capacity_valid_until,last_verified_at,data_status")}`;
    const updateResult = await fetch(updateUrl, {
      method: "PATCH",
      headers: headers(key, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
        "x-capacity-token-hash": tokenHash,
      }),
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(8000),
    });
    if (!updateResult.ok) throw new Error(`Supabase update returned ${updateResult.status}`);
    const updated = (await updateResult.json())[0];
    if (!updated) return response.status(403).json({ error: "Link is invalid or no longer active" });

    delete updated.id;
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ updated: true, ambulance: updated });
  } catch (error) {
    console.error("Failed to update capacity", error.message);
    return response.status(502).json({ error: "Capacity update could not be saved" });
  }
};
