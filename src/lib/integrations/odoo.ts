export async function searchOdooPartners(query: string) {
  const baseUrl = process.env.ODOO_BASE_URL;
  const database = process.env.ODOO_DATABASE;
  const apiKey = process.env.ODOO_API_KEY;
  if (!baseUrl || !database || !apiKey) throw new Error("Odoo JSON-2 is not configured");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/json/2/res.partner/search_read`, {
    method: "POST",
    headers: {
      Authorization: `bearer ${apiKey}`,
      "X-Odoo-Database": database,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domain: [["name", "ilike", query]], fields: ["id", "name", "email"], limit: 20 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Odoo ${response.status}`);
  return response.json() as Promise<Array<{ id: number; name: string; email?: string }>>;
}
