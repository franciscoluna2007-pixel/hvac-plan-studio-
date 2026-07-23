export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const appId = process.env.GOOGLE_APP_ID;

  if (!clientId || !apiKey || !appId) {
    return Response.json(
      { error: "Google Drive is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { clientId, apiKey, appId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
