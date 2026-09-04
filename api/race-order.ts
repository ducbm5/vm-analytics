import axios from "axios";
import { DEFAULT_RACE_ORDER, DEFAULT_GOOGLE_SCRIPT_URL } from "../constants/raceOrder";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    try {
      const scriptRes = await axios.get(DEFAULT_GOOGLE_SCRIPT_URL, { timeout: 6000 });
      if (scriptRes.data && Array.isArray(scriptRes.data.order) && scriptRes.data.order.length > 0) {
        const order = scriptRes.data.order.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
        return res.json({
          order,
          googleScriptUrl: DEFAULT_GOOGLE_SCRIPT_URL,
          googleSheetTsvUrl: "",
          updatedAt: new Date().toISOString(),
          syncSource: "google_apps_script"
        });
      }
    } catch (e) {
      // Fallback
    }

    return res.json({
      order: DEFAULT_RACE_ORDER,
      googleScriptUrl: DEFAULT_GOOGLE_SCRIPT_URL,
      googleSheetTsvUrl: "",
      updatedAt: null,
      syncSource: "default"
    });
  }

  if (req.method === "POST") {
    const { order, googleScriptUrl } = req.body || {};
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: "Order must be an array" });
    }
    const cleanOrder = order.map((r: any) => String(r).trim().toUpperCase()).filter(Boolean);
    const targetScriptUrl = googleScriptUrl || DEFAULT_GOOGLE_SCRIPT_URL;

    let googleSheetSyncResult: any = null;
    if (targetScriptUrl && targetScriptUrl.startsWith("http")) {
      try {
        await axios.post(
          targetScriptUrl,
          JSON.stringify({ order: cleanOrder, action: "saveOrder" }),
          { headers: { "Content-Type": "text/plain;charset=utf-8" }, timeout: 8000 }
        );
        googleSheetSyncResult = { success: true, message: "Đã lưu vào Google Sheet!" };
      } catch (err: any) {
        googleSheetSyncResult = { success: false, message: "Lỗi đồng bộ: " + err.message };
      }
    }

    return res.json({
      success: true,
      order: cleanOrder,
      googleScriptUrl: targetScriptUrl,
      updatedAt: new Date().toISOString(),
      googleSheetSyncResult
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
