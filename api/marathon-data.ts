import axios from "axios";

const SECRET_ACCESS_KEY = process.env.APPS_SCRIPT_KEY || "ducbm900966559155";
const APPS_SCRIPT_2026_URL = "https://script.google.com/macros/s/AKfycbwm9XwqLMyFurcmxGsrS2REsW0Vj8tkhY8rEGCm-emKJ_mnwPILper8krABUs8ddqzuDw/exec";

const SHEET_URLS: Record<string, string> = {
  "2026": `${APPS_SCRIPT_2026_URL}?key=${SECRET_ACCESS_KEY}`,
  "2025": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTo87xTtp5O_M6MybyxLFCea6ZdUie-dUW1IJFURUeCxjIYOadAITO0erURBImxPGa1EVNeGS61IGLQ/pub?gid=0&single=true&output=tsv",
  "2019-2024": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTp_JE6mxA6rQyrQ6coXbYmeL2DVozUC9PbYDMkywZ-1R5kVo7N9cd_-53Bw4uLoWb1jzpbqqjsx6xN/pub?gid=0&single=true&output=tsv"
};

export default async function handler(req: any, res: any) {
  // CORS & Security headers
  const referer = (req.headers["referer"] as string) || "";
  const origin = (req.headers["origin"] as string) || "";

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Security check: Only allow vm-analytics.vercel.app, localhost, or vercel preview deployments
  const isAllowed = 
    !referer || // direct server-to-server or same-site
    referer.includes("vm-analytics.vercel.app") ||
    referer.includes("localhost") ||
    referer.includes("127.0.0.1") ||
    referer.includes(".vercel.app") ||
    referer.includes("run.app") ||
    origin.includes("vm-analytics.vercel.app") ||
    origin.includes("localhost") ||
    origin.includes(".vercel.app");

  if (!isAllowed) {
    return res.status(403).json({ error: "Access Denied: Unauthorized origin" });
  }

  try {
    const yearParam = (req.query?.year as string) || "2026";
    let key = yearParam;
    const yrNum = parseInt(yearParam, 10);
    if (!isNaN(yrNum) && yrNum >= 2019 && yrNum <= 2024) {
      key = "2019-2024";
    }

    let url = SHEET_URLS[key] || SHEET_URLS["2026"];
    let response = await axios.get(url, { timeout: 25000 });
    let tsvData = response.data;

    // If Google Apps Script returned 403 (because user hasn't deployed new key yet), try secondary key
    if (typeof tsvData === "string" && tsvData.includes("403 Forbidden") && key === "2026") {
      const fallbackUrl = `${APPS_SCRIPT_2026_URL}?key=vm_analytics_secret_2026_@key`;
      try {
        const fallbackRes = await axios.get(fallbackUrl, { timeout: 25000 });
        if (typeof fallbackRes.data === "string" && !fallbackRes.data.includes("403 Forbidden")) {
          tsvData = fallbackRes.data;
        }
      } catch (e) {}
    }

    if (typeof tsvData !== "string" || tsvData.includes("403 Forbidden")) {
      return res.status(500).json({ error: "Invalid TSV data or Access Denied from Google Apps Script" });
    }

    // Parse TSV to participant objects
    const lines = tsvData.split("\n");
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i].split("\t");
      if (currentLine.length === 0 || !currentLine[0]?.trim()) continue;

      const obj: any = {
        RACE: currentLine[0]?.trim() || "",
        DISTANCE: currentLine[1]?.trim() || "",
        GENDER: currentLine[2]?.trim() || "",
        TXNAMOUNT: currentLine[3]?.trim() || "0",
        AGE: currentLine[4]?.trim() || "",
        AGE_GROUP: currentLine[5]?.trim() || "",
        NATIONALITY: currentLine[6]?.trim() || "",
        PROVINCE_CITY: currentLine[7]?.trim() || "",
        REGISTRATION_TYPE: currentLine[8]?.trim() || "",
        PARTNER: currentLine[9]?.trim() || "",
        STAGE: currentLine[10]?.trim() || "",
        PARTNER_2: currentLine[11]?.trim() || ""
      };
      result.push(obj);
    }

    // Cache control: cache on CDN for 5 minutes, stale-while-revalidate for 30 minutes
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    return res.json(result);
  } catch (error: any) {
    console.error("API Marathon Data Error:", error.message);
    return res.status(500).json({ error: "Failed to fetch marathon data: " + error.message });
  }
}
