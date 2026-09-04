import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const AUTH_TOKEN_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2-6kiwov9POZLPZEB7pBY6ced8BJZ8JEhpCg3PuYTY21TxawztC7gnEMQm2hVB3MB1cYXsDtu2UoI/pub?gid=1000314409&single=true&output=tsv";

  // API route to get current token
  app.get("/api/token", (req, res) => {
    res.json({ token: "898989" });
  });

  const RACE_ORDER_FILE = path.join(process.cwd(), "race-order.json");
  const DEFAULT_RACE_ORDER = [
    "HP26", "DN26", "NA26", "QN26", "VT26", "NT26", "PT26", "SS26", "CT26", "CG26", "OM24",
    "HUE26", "HCM26", "AS26", "HP25", "HN25", "CT25", "NT25", "DN25", "QN25", "HL25",
    "NA25", "AS25", "HUE25", "HCM25"
  ];
  const DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxP1amqLWOVLWEwAYNV5t74PN-iAEoK320DgTdhxtD0F-UNRYH7S1Xt6bISPBsRiGE/exec";

  // API route to get synchronized race order
  app.get("/api/race-order", async (req, res) => {
    try {
      const fileData = await fs.readFile(RACE_ORDER_FILE, "utf-8");
      const parsed = JSON.parse(fileData);
      let order = parsed.order || DEFAULT_RACE_ORDER;
      const googleScriptUrl = parsed.googleScriptUrl || "";
      const googleSheetTsvUrl = parsed.googleSheetTsvUrl || "";
      let updatedAt = parsed.updatedAt || null;
      let syncSource = "local";

      // If user has configured Google Sheet TSV URL, fetch fresh race order from it
      if (googleSheetTsvUrl && typeof googleSheetTsvUrl === "string" && googleSheetTsvUrl.trim().startsWith("http")) {
        try {
          const tsvRes = await axios.get(googleSheetTsvUrl.trim(), { timeout: 8000 });
          if (tsvRes.data && typeof tsvRes.data === "string") {
            const lines = tsvRes.data.split("\n").map((l: string) => l.trim()).filter(Boolean);
            const parsedCodes: string[] = [];
            for (let i = 0; i < lines.length; i++) {
              const cols = lines[i].split(/[\t,]/);
              const code = cols[0]?.trim().toUpperCase();
              if (i === 0 && (code === "RACE_CODE" || code === "RACE" || code === "MÃ" || code === "MÃ GIẢI" || code === "MÃ_GIẢI")) {
                continue;
              }
              if (code && code.length >= 2 && !parsedCodes.includes(code)) {
                parsedCodes.push(code);
              }
            }
            if (parsedCodes.length > 0) {
              order = parsedCodes;
              syncSource = "google_sheet_tsv";
            }
          }
        } catch (tsvErr: any) {
          console.warn("Could not fetch race order from Google Sheet TSV:", tsvErr.message);
        }
      } else if (googleScriptUrl && typeof googleScriptUrl === "string" && googleScriptUrl.trim().startsWith("http")) {
        // Automatically check Google Apps Script if connected
        try {
          const scriptRes = await axios.get(googleScriptUrl.trim(), { timeout: 4000, maxRedirects: 5 });
          if (scriptRes.data && Array.isArray(scriptRes.data.order) && scriptRes.data.order.length > 0) {
            order = scriptRes.data.order.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
            syncSource = "google_apps_script";
          }
        } catch (scriptErr: any) {
          // Silent fallback to saved file order
        }
      }

      if (Array.isArray(order) && order.length > 0) {
        return res.json({ 
          order, 
          googleScriptUrl, 
          googleSheetTsvUrl, 
          updatedAt, 
          syncSource 
        });
      }
    } catch (err) {
      // File not found or read error, fallback to default
    }
    res.json({ 
      order: DEFAULT_RACE_ORDER, 
      googleScriptUrl: DEFAULT_GOOGLE_SCRIPT_URL, 
      googleSheetTsvUrl: "", 
      updatedAt: null, 
      syncSource: "default" 
    });
  });

  // API route to save synchronized race order
  app.post("/api/race-order", async (req, res) => {
    try {
      const { order, googleScriptUrl, googleSheetTsvUrl } = req.body;
      if (!Array.isArray(order)) {
        return res.status(400).json({ error: "Order must be an array of race names." });
      }
      const cleanOrder = order.map((r: any) => String(r).trim().toUpperCase()).filter(Boolean);
      
      let googleSheetSyncResult: { success: boolean; message: string } | null = null;
      const scriptUrl = typeof googleScriptUrl === "string" ? googleScriptUrl.trim() : "";
      const tsvUrl = typeof googleSheetTsvUrl === "string" ? googleSheetTsvUrl.trim() : "";

      // If Google Apps Script Web App URL is provided, send race order to Google Sheet
      if (scriptUrl && scriptUrl.startsWith("http")) {
        try {
          const scriptRes = await axios.post(
            scriptUrl,
            JSON.stringify({ order: cleanOrder, action: "saveOrder" }),
            {
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              timeout: 15000,
              maxRedirects: 5
            }
          );
          const data = scriptRes.data;
          googleSheetSyncResult = {
            success: true,
            message: (data && data.message) ? data.message : "Đã đồng bộ sang Google Sheet thành công!"
          };
        } catch (scriptErr: any) {
          console.error("Error saving to Google Apps Script:", scriptErr.message);
          googleSheetSyncResult = {
            success: false,
            message: "Lỗi kết nối Google Apps Script: " + (scriptErr.response?.data?.message || scriptErr.message)
          };
        }
      }

      const payload = {
        order: cleanOrder,
        googleScriptUrl: scriptUrl,
        googleSheetTsvUrl: tsvUrl,
        updatedAt: new Date().toISOString(),
        googleSheetSyncResult
      };

      await fs.writeFile(RACE_ORDER_FILE, JSON.stringify(payload, null, 2), "utf-8");
      
      res.json({ 
        success: true, 
        order: cleanOrder, 
        googleScriptUrl: scriptUrl,
        googleSheetTsvUrl: tsvUrl,
        updatedAt: payload.updatedAt,
        googleSheetSyncResult
      });
    } catch (err: any) {
      console.error("Error saving race order:", err);
      res.status(500).json({ error: "Failed to save race order: " + err.message });
    }
  });

  // API route to pull latest order from Google Apps Script or TSV
  app.post("/api/race-order/pull", async (req, res) => {
    try {
      const fileData = await fs.readFile(RACE_ORDER_FILE, "utf-8");
      const parsed = JSON.parse(fileData);
      const scriptUrl = req.body.googleScriptUrl || parsed.googleScriptUrl || "";
      const tsvUrl = req.body.googleSheetTsvUrl || parsed.googleSheetTsvUrl || "";

      let pulledOrder: string[] = [];
      let source = "";

      // 1. Try TSV if available
      if (tsvUrl && typeof tsvUrl === "string" && tsvUrl.trim().startsWith("http")) {
        try {
          const tsvRes = await axios.get(tsvUrl.trim(), { timeout: 8000 });
          if (tsvRes.data && typeof tsvRes.data === "string") {
            const lines = tsvRes.data.split("\n").map((l: string) => l.trim()).filter(Boolean);
            for (let i = 0; i < lines.length; i++) {
              const cols = lines[i].split(/[\t,]/);
              const code = cols[0]?.trim().toUpperCase();
              if (i === 0 && (code === "RACE_CODE" || code === "RACE" || code === "MÃ" || code === "MÃ GIẢI")) continue;
              if (code && code.length >= 2 && !pulledOrder.includes(code)) {
                pulledOrder.push(code);
              }
            }
            if (pulledOrder.length > 0) source = "tsv";
          }
        } catch (e: any) {
          console.warn("TSV pull error:", e.message);
        }
      }

      // 2. Try Apps Script GET if TSV didn't produce
      if (pulledOrder.length === 0 && scriptUrl && typeof scriptUrl === "string" && scriptUrl.trim().startsWith("http")) {
        try {
          const getRes = await axios.get(scriptUrl.trim(), { timeout: 10000, maxRedirects: 5 });
          if (getRes.data && Array.isArray(getRes.data.order) && getRes.data.order.length > 0) {
            pulledOrder = getRes.data.order.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
            source = "google_apps_script";
          }
        } catch (e: any) {
          console.warn("Script GET pull error:", e.message);
        }
      }

      if (pulledOrder.length > 0) {
        const payload = {
          ...parsed,
          order: pulledOrder,
          googleScriptUrl: scriptUrl,
          googleSheetTsvUrl: tsvUrl,
          updatedAt: new Date().toISOString()
        };
        await fs.writeFile(RACE_ORDER_FILE, JSON.stringify(payload, null, 2), "utf-8");
        return res.json({ success: true, order: pulledOrder, source, count: pulledOrder.length });
      }

      res.status(404).json({ error: "Không thể lấy thứ tự giải từ Google Sheet. Vui lòng kiểm tra lại URL." });
    } catch (err: any) {
      res.status(500).json({ error: "Lỗi đồng bộ từ Google Sheet: " + err.message });
    }
  });

  // Google Sheet TSV URLs by year
  const SECRET_ACCESS_KEY = process.env.APPS_SCRIPT_KEY || "ducbm900966559155";
  const SHEET_URLS: Record<string, string> = {
    "2026": `https://script.google.com/macros/s/AKfycbwm9XwqLMyFurcmxGsrS2REsW0Vj8tkhY8rEGCm-emKJ_mnwPILper8krABUs8ddqzuDw/exec?key=${SECRET_ACCESS_KEY}`,
    "2025": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTo87xTtp5O_M6MybyxLFCea6ZdUie-dUW1IJFURUeCxjIYOadAITO0erURBImxPGa1EVNeGS61IGLQ/pub?gid=0&single=true&output=tsv",
    "2019-2024": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTp_JE6mxA6rQyrQ6coXbYmeL2DVozUC9PbYDMkywZ-1R5kVo7N9cd_-53Bw4uLoWb1jzpbqqjsx6xN/pub?gid=0&single=true&output=tsv"
  };

  // API route to fetch marathon data from Google Sheets TSV
  app.get("/api/marathon-data", async (req, res) => {
    try {
      const yearParam = (req.query.year as string) || "2026";
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
        const fallbackUrl = `https://script.google.com/macros/s/AKfycbwm9XwqLMyFurcmxGsrS2REsW0Vj8tkhY8rEGCm-emKJ_mnwPILper8krABUs8ddqzuDw/exec?key=vm_analytics_secret_2026_@key`;
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
      
      // Simple TSV to JSON parser
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
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching marathon data:", error);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  // API route for AI Analysis
  app.post("/api/analyze", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "GEMINI_API_KEY is not configured. Please configure it in your Settings > Secrets panel." });
    }

    const { stats } = req.body;
    if (!stats) {
      return res.status(400).json({ error: "Missing statistical data for analysis." });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const dataContext = JSON.stringify(stats, null, 2);

      const prompt = `
Bạn là một Chuyên gia Phân tích Dữ liệu Kinh doanh (Business Data Analyst) và là Giám đốc Chiến lược cho các giải chạy Marathon quy mô lớn.

Dưới đây là dữ liệu thống kê từ hệ thống quản lý giải chạy hiện tại:
\`\`\`json
${dataContext}
\`\`\`

Nhiệm vụ của bạn: Hãy đọc và phân tích kỹ các số liệu thống kê ở trên để lập một BÁO CÁO ĐÁNH GIÁ HIỆU SUẤT & ĐỀ XUẤT CHIẾN LƯỢC. Báo cáo cần chia rõ thành các mục sau:

1. Đánh giá Doanh thu & Cự ly Mũi nhọn:
- Giải chạy nào đang là "gà đẻ trứng vàng" mang lại doanh thu lớn nhất? Cự ly nào (5KM, 10KM, 21KM, 42KM) đang đóng góp dòng tiền mạnh nhất hệ thống?
- Có cự ly nào có lượng người đăng ký ít nhưng doanh thu mang lại lại cao đột biến không?

2. Phân tích Hành vi Mua vé (Sales Stages):
- Nhận xét về việc lượng vé tập trung khổng lồ ở giai đoạn "Super Early Bird" và sụt giảm mạnh ở các giai đoạn sau. Điều này phản ánh tâm lý gì của runner và ảnh hưởng thế nào đến dòng tiền (Cash flow) của ban tổ chức?
- Phân tích trường hợp đặc biệt của giải AS26 (chỉ bán ở "Giai đoạn duy nhất") và giải SS26 (có lượng BIB lớn ở bảng cự ly nhưng doanh thu bằng 0 ở bảng doanh thu). Hãy đưa ra các giả thuyết vận hành cho 2 trường hợp này.

3. Chân dung Khách hàng & Cơ hội Tài trợ (Demographics):
- Dựa trên dữ liệu Nhóm tuổi (Độ tuổi nào chiếm doanh thu cao nhất?) và Giới tính (Tỷ lệ Nam/Nữ), hãy phác họa chân dung khách hàng mục tiêu lý tưởng.
- Đề xuất 3 ý tưởng/hoạt động truyền thông hoặc gói quyền lợi để thu hút thêm runner Nữ và nhóm tuổi trẻ (18-24).

4. Địa lý & Chiến lược B2B:
- Nhận xét về top các tỉnh thành có lượng runner đông đảo (Tây Ninh, Đồng Tháp, Vĩnh Long...). Ban tổ chức nên làm gì để tối ưu khâu hậu cần (Logistics) hoặc kích cầu du lịch địa phương?
- Với việc đăng ký Nhóm/Doanh nghiệp chiếm tỉ lệ lớn, hãy đề xuất chiến lược B2B chi tiết để giữ chân và mở rộng tệp khách hàng doanh nghiệp này cho mùa giải sau.

Yêu cầu về kỹ năng đầu ra:
- Phân tích sâu sắc, có số liệu dẫn chứng cụ thể từ dữ liệu được cung cấp ở trên (không nói chung chung).
- Nhìn ra được các "điểm nghẽn" hoặc "bất thường" trong vận hành dựa trên số liệu.
- Trình bày rõ ràng bằng tiếng Việt dưới dạng Markdown có cấu trúc chuyên nghiệp, sử dụng các tiêu đề, bảng tóm tắt hoặc bullet point để dễ theo dõi.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      res.json({ analysis: response.text });
    } catch (err: any) {
      console.error("Gemini analysis failed:", err);
      res.status(500).json({ error: "Phân tích dữ liệu bằng AI thất bại: " + err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
