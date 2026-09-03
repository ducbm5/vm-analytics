import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import { Participant } from "./types";
import { RaceOrderSettingsModal, DEFAULT_RACE_ORDER } from "@/components/RaceOrderSettingsModal";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Calendar as CalendarIcon, 
  Filter, 
  Search, 
  Activity, 
  DollarSign,
  Trash2,
  RefreshCw,
  PieChart as PieIcon,
  Globe,
  MapPin,
  Users,
  Brain,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { format, parse, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";

const DEFAULT_TOKEN = "898989";

const isVietnam = (nat: string) => {
  const n = nat.toLowerCase().trim();
  return n === "việt nam" || n === "vietnam" || n === "vn" || n.includes("viet");
};

const isHanoi = (prov: string) => {
  const p = prov.toLowerCase().trim();
  return p.includes("hà nội") || p.includes("hanoi") || p === "hn";
};

const isHcm = (prov: string) => {
  const p = prov.toLowerCase().trim();
  return p.includes("hồ chí minh") || p.includes("ho chi minh") || p.includes("hcm") || p.includes("sài gòn") || p.includes("sai gon");
};

interface DashboardSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  description?: string;
  rightElement?: React.ReactNode;
}

function DashboardSection({ title, icon, children, description, rightElement }: DashboardSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-[#141414] pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 border border-[#141414] bg-[#141414] text-white">
            {icon}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-black uppercase tracking-tight leading-none text-[#141414]">{title}</h2>
            {description && <p className="text-[10px] font-mono text-[#141414]/60 uppercase tracking-wider mt-0.5">{description}</p>}
          </div>
        </div>
        {rightElement}
      </div>
      <div className="border border-[#141414] overflow-hidden bg-[#faf6ee] shadow-[2px_2px_0px_0px_rgba(20,20,20,0.1)]">
        {children}
      </div>
    </section>
  );
}

interface SortableHeadProps {
  title: React.ReactNode;
  sortKey: string;
  currentSort: { key: string; dir: "asc" | "desc" };
  onSort: (key: string) => void;
  align?: "left" | "center" | "right";
  className?: string;
}

const SortableHead: React.FC<SortableHeadProps> = ({
  title,
  sortKey,
  currentSort,
  onSort,
  align = "left",
  className = "",
}) => {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead
      onClick={() => onSort(sortKey)}
      className={cn(
        "col-header text-[var(--bg)] cursor-pointer select-none hover:bg-white/10 transition-colors py-3.5",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1.5",
          align === "center" && "justify-center",
          align === "right" && "justify-end",
          align === "left" && "justify-start"
        )}
      >
        <span>{title}</span>
        {isActive ? (
          currentSort.dir === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5 shrink-0 text-amber-300" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 shrink-0 text-amber-300" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 shrink-0 opacity-40 hover:opacity-100" />
        )}
      </div>
    </TableHead>
  );
};

const getRaceIndexWithList = (raceName: string, orderList: string[]): number => {
  const upper = raceName.toUpperCase().trim();
  const list = orderList && orderList.length > 0 ? orderList : DEFAULT_RACE_ORDER;
  const idx = list.indexOf(upper);
  return idx !== -1 ? idx : 999;
};

const compareRacesWithList = (raceA: string, raceB: string, orderList: string[], dir: "asc" | "desc" = "asc"): number => {
  const idxA = getRaceIndexWithList(raceA, orderList);
  const idxB = getRaceIndexWithList(raceB, orderList);

  let diff = 0;
  if (idxA !== idxB) {
    diff = idxA - idxB;
  } else {
    diff = raceA.localeCompare(raceB, "vi");
  }

  return dir === "asc" ? diff : -diff;
};

const parseLastUpdateDate = (dateStr: string): Date | null => {
  if (!dateStr || !dateStr.trim()) return null;
  const str = dateStr.trim();

  // Pattern 1: DD/MM/YYYY or DD/MM/YYYY HH:mm:ss or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    if (month > 12 && day <= 12) {
      const d = new Date(year, day - 1, month, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d;
    } else {
      const d = new Date(year, month - 1, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Pattern 2: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;

    const d = new Date(year, month - 1, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  return null;
};

const SHEET_URLS: Record<string, string> = {
  "2026": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRJBVKWZmPFfnWYSPbIa_-aSNI0XJ2xk-TJ0Syo1VcqhjzcMZaK9GwhFIhkPqVQpQ2zQIO4fVa5G_F/pub?gid=0&single=true&output=tsv",
  "2025": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTo87xTtp5O_M6MybyxLFCea6ZdUie-dUW1IJFURUeCxjIYOadAITO0erURBImxPGa1EVNeGS61IGLQ/pub?gid=0&single=true&output=tsv",
  "2019-2024": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTp_JE6mxA6rQyrQ6coXbYmeL2DVozUC9PbYDMkywZ-1R5kVo7N9cd_-53Bw4uLoWb1jzpbqqjsx6xN/pub?gid=0&single=true&output=tsv"
};

const getSheetKeyForYear = (year: string): string => {
  if (year === "2019-2024") return "2019-2024";
  const num = parseInt(year, 10);
  if (!isNaN(num) && num >= 2019 && num <= 2024) {
    return "2019-2024";
  }
  return year;
};

const parseTsvData = (tsvData: string): Participant[] => {
  const lines = tsvData.split("\n");
  const result: Participant[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].split("\t");
    if (currentLine.length === 0 || !currentLine[0]?.trim()) continue;
    
    const obj: Participant = {
      RACE: currentLine[0]?.trim() || "",
      DISTANCE: currentLine[1]?.trim() || "",
      GENDER: currentLine[2]?.trim() || "",
      TXNAMOUNT: currentLine[3]?.trim() || "0",
      AGE: currentLine[4]?.trim() || "",
      AGE_GROUP: currentLine[5]?.trim() || "",
      NATIONALITY: currentLine[6]?.trim() || "",
      PROVINCE_CITY: currentLine[7]?.trim() || "",
      REGISTRATION_TYPE: currentLine[8]?.trim() || "",
      LAST_UPDATE: currentLine[9]?.trim() || "",
      STAGE: currentLine[10]?.trim() || "",
      PARTNER_2: currentLine[11]?.trim() || "",
      PARTNER: currentLine[9]?.trim() || ""
    };
    result.push(obj);
  }
  return result;
};

const fetchYearData = async (year: string): Promise<Participant[]> => {
  const sheetKey = getSheetKeyForYear(year);
  const url = SHEET_URLS[sheetKey];
  if (!url) return [];
  const cacheBuster = `&t=${Date.now()}`;
  const response = await fetch(url + cacheBuster);
  if (!response.ok) throw new Error(`Không thể tải dữ liệu năm ${year}`);
  const tsvText = await response.text();
  return parseTsvData(tsvText);
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState(false);

  const [loadedData, setLoadedData] = useState<Record<string, Participant[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingYear, setLoadingYear] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth State
  const [validToken, setValidToken] = useState(DEFAULT_TOKEN);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Filters
  const [selectedRaces, setSelectedRaces] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedDistance, setSelectedDistance] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedAges, setSelectedAges] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");

  const data = useMemo(() => {
    return Object.values(loadedData).flat();
  }, [loadedData]);

  // Synchronized Cross-Device Race Ordering
  const [raceOrder, setRaceOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("vm_race_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_RACE_ORDER;
  });
  const [raceOrderUpdatedAt, setRaceOrderUpdatedAt] = useState<string | null>(null);
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>(() => {
    try {
      return localStorage.getItem("vm_google_script_url") || "https://script.google.com/macros/s/AKfycbxxP1amqLWOVLWEwAYNV5t74PN-iAEoK320DgTdhxtD0F-UNRYH7S1Xt6bISPBsRiGE/exec";
    } catch (e) {
      return "https://script.google.com/macros/s/AKfycbxxP1amqLWOVLWEwAYNV5t74PN-iAEoK320DgTdhxtD0F-UNRYH7S1Xt6bISPBsRiGE/exec";
    }
  });
  const [googleSheetTsvUrl, setGoogleSheetTsvUrl] = useState<string>(() => {
    try {
      return localStorage.getItem("vm_google_sheet_tsv_url") || "";
    } catch (e) {
      return "";
    }
  });
  const [isRaceOrderModalOpen, setIsRaceOrderModalOpen] = useState(false);

  const fetchRaceOrder = async () => {
    try {
      const res = await axios.get("/api/race-order");
      if (res.data?.order && Array.isArray(res.data.order)) {
        setRaceOrder(res.data.order);
        setRaceOrderUpdatedAt(res.data.updatedAt || null);
        if (typeof res.data.googleScriptUrl === "string") setGoogleScriptUrl(res.data.googleScriptUrl);
        if (typeof res.data.googleSheetTsvUrl === "string") setGoogleSheetTsvUrl(res.data.googleSheetTsvUrl);
        return;
      }
    } catch (err) {
      console.warn("API /api/race-order không khả dụng hoặc trả về 404 (chế độ Static Host/GitHub Pages), thử đồng bộ trực tiếp từ Google Apps Script...");
    }

    // Fallback: If server is 404 (e.g. GitHub Pages or Vercel static build), fetch directly from Apps Script
    const scriptToFetch = googleScriptUrl || "https://script.google.com/macros/s/AKfycbxxP1amqLWOVLWEwAYNV5t74PN-iAEoK320DgTdhxtD0F-UNRYH7S1Xt6bISPBsRiGE/exec";
    if (scriptToFetch && scriptToFetch.startsWith("http")) {
      try {
        const scriptRes = await axios.get(scriptToFetch, { timeout: 8000 });
        if (scriptRes.data && Array.isArray(scriptRes.data.order) && scriptRes.data.order.length > 0) {
          const freshOrder = scriptRes.data.order.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
          setRaceOrder(freshOrder);
          setRaceOrderUpdatedAt(new Date().toISOString());
          try {
            localStorage.setItem("vm_race_order", JSON.stringify(freshOrder));
          } catch (e) {}
        }
      } catch (scriptErr: any) {
        console.warn("Direct Google Apps Script fetch also failed:", scriptErr.message);
      }
    }
  };

  const handleSaveRaceOrder = async (newOrder: string[], scriptUrl?: string, tsvUrl?: string) => {
    const sUrl = scriptUrl !== undefined ? scriptUrl : googleScriptUrl;
    const tUrl = tsvUrl !== undefined ? tsvUrl : googleSheetTsvUrl;

    // Save to local storage first for resilient client-side persistence (e.g. GitHub Pages / Vercel / Cloud Run)
    try {
      localStorage.setItem("vm_race_order", JSON.stringify(newOrder));
      if (sUrl) localStorage.setItem("vm_google_script_url", sUrl);
      if (tUrl) localStorage.setItem("vm_google_sheet_tsv_url", tUrl);
    } catch (e) {
      // LocalStorage error ignore
    }

    setRaceOrder(newOrder);
    setRaceOrderUpdatedAt(new Date().toISOString());

    // Send to backend API if available
    try {
      const res = await axios.post("/api/race-order", { 
        order: newOrder,
        googleScriptUrl: sUrl,
        googleSheetTsvUrl: tUrl
      });
      if (res.data?.order && Array.isArray(res.data.order)) {
        setRaceOrder(res.data.order);
        setRaceOrderUpdatedAt(res.data.updatedAt || null);
        if (typeof res.data.googleScriptUrl === "string") setGoogleScriptUrl(res.data.googleScriptUrl);
        if (typeof res.data.googleSheetTsvUrl === "string") setGoogleSheetTsvUrl(res.data.googleSheetTsvUrl);
      }
      return res.data;
    } catch (apiErr: any) {
      // If server returns 404 (e.g. deployed as pure static site on GitHub Pages / Vercel without Node backend)
      // Directly sync with Google Apps Script Web App from the browser!
      console.warn("Server API /api/race-order not available or 404. Falling back to direct Google Apps Script call.", apiErr.message);
      if (sUrl && sUrl.startsWith("http")) {
        try {
          await axios.post(
            sUrl,
            JSON.stringify({ order: newOrder, action: "saveOrder" }),
            { headers: { "Content-Type": "text/plain;charset=utf-8" } }
          );
          return { success: true, order: newOrder, googleSheetSyncResult: { success: true, message: "Đã lưu vào Google Sheet!" } };
        } catch (scriptErr: any) {
          console.warn("Direct Google Apps Script call failed:", scriptErr.message);
        }
      }
      return { success: true, order: newOrder };
    }
  };

  const compareRaces = useCallback((raceA: string, raceB: string, dir: "asc" | "desc" = "asc"): number => {
    return compareRacesWithList(raceA, raceB, raceOrder, dir);
  }, [raceOrder]);

  const allDetectedRaces = useMemo(() => {
    const set = new Set<string>();
    Object.values(loadedData).forEach(arr => {
      arr.forEach(p => {
        if (p.RACE) set.add(p.RACE.toUpperCase().trim());
      });
    });
    data.forEach(p => {
      if (p.RACE) set.add(p.RACE.toUpperCase().trim());
    });
    return Array.from(set);
  }, [loadedData, data]);

  useEffect(() => {
    fetchRaceOrder();
  }, []);

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingSteps = [
    "Đang tổng hợp dữ liệu BIB và cơ cấu giải chạy...",
    "Đang tính toán chi tiết doanh thu theo cự ly...",
    "Đang phân tích hành vi mua vé qua các giai đoạn...",
    "Đang phác họa chân dung runner mục tiêu...",
    "Đang lập đề xuất chiến lược du lịch địa phương & B2B...",
    "Đang biên soạn báo cáo phân tích toàn diện..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (aiLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [aiLoading]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput === validToken) {
      localStorage.setItem("marathon_auth_token", validToken);
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("marathon_auth_token");
    setIsAuthenticated(false);
    setTokenInput("");
  };

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStr = format(now, "yyyy-MM-dd");
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7days") {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setStartDate(format(past, "yyyy-MM-dd"));
      setEndDate(format(now, "yyyy-MM-dd"));
    } else if (preset === "30days") {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      setStartDate(format(past, "yyyy-MM-dd"));
      setEndDate(format(now, "yyyy-MM-dd"));
    } else if (preset === "thisMonth") {
      const startM = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(startM, "yyyy-MM-dd"));
      setEndDate(format(now, "yyyy-MM-dd"));
    }
  };

  const resetFilters = () => {
    setSelectedRaces([]);
    setSelectedYear("2026");
    setSelectedDistance("all");
    setSelectedStage("all");
    setSelectedGender("all");
    setSelectedAges([]);
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setDatePreset("all");
  };

  const handleYearChange = async (targetYear: string) => {
    setSelectedYear(targetYear);
    setSelectedRaces([]);

    const sheetKeysToFetch = new Set<string>();

    if (targetYear === "all") {
      if (!loadedData["2026"]) sheetKeysToFetch.add("2026");
      if (!loadedData["2025"]) sheetKeysToFetch.add("2025");
      if (!loadedData["2019-2024"]) sheetKeysToFetch.add("2019-2024");
    } else {
      const key = getSheetKeyForYear(targetYear);
      if (!loadedData[key]) {
        sheetKeysToFetch.add(key);
      }
    }

    const keysArray = Array.from(sheetKeysToFetch);
    if (keysArray.length > 0) {
      setLoadingYear(keysArray.join(", "));
      try {
        const fetchedResults = await Promise.all(
          keysArray.map(async (key) => ({ key, data: await fetchYearData(key) }))
        );
        setLoadedData(prev => {
          const updated = { ...prev };
          fetchedResults.forEach(item => {
            updated[item.key] = item.data;
          });
          return updated;
        });
      } catch (err) {
        console.error("Error loading year data:", err);
      } finally {
        setLoadingYear(null);
      }
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      const loadedKeys = Object.keys(loadedData);
      const keysToRefresh = loadedKeys.length > 0 ? loadedKeys : ["2026"];
      
      const [refreshedResults] = await Promise.all([
        Promise.all(keysToRefresh.map(async (key) => ({ key, data: await fetchYearData(key) }))),
        fetchRaceOrder()
      ]);

      setLoadedData(prev => {
        const updated = { ...prev };
        refreshedResults.forEach(item => {
          updated[item.key] = item.data;
        });
        return updated;
      });
    } catch (err) {
      console.error("Lỗi cập nhật dữ liệu:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const generateAiAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const racesSummary: Record<string, any> = {};
      
      filteredData.forEach(p => {
        const r = p.RACE || "Unknown";
        if (!racesSummary[r]) {
          racesSummary[r] = {
            name: r,
            participantsCount: 0,
            revenue: 0,
            distances: {} as Record<string, number>,
            stages: {} as Record<string, number>,
          };
        }
        racesSummary[r].participantsCount += 1;
        const amt = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");
        racesSummary[r].revenue += amt;

        const dist = p.DISTANCE || "Unknown";
        racesSummary[r].distances[dist] = (racesSummary[r].distances[dist] || 0) + 1;

        const stg = p.STAGE || "Unknown";
        racesSummary[r].stages[stg] = (racesSummary[r].stages[stg] || 0) + 1;
      });

      const formattedRaces = Object.values(racesSummary).map((r: any) => ({
        raceName: r.name,
        participantsCount: r.participantsCount,
        revenue: `${r.revenue.toLocaleString()} VND`,
        distances: r.distances,
        stages: r.stages
      }));

      const topProvinces = provinceStats.slice(0, 8).map(p => ({
        name: p.name,
        participants: p.count,
        revenue: `${p.revenue.toLocaleString()} VND`
      }));

      const ageGroups = ageGroupStats.map(a => ({
        group: a.name,
        participants: a.count,
        revenue: `${a.revenue.toLocaleString()} VND`
      }));

      const gender = genderStats.map(g => ({
        gender: g.name,
        participants: g.value,
        percentage: `${g.percentage}%`,
        revenue: `${g.revenue.toLocaleString()} VND`
      }));

      const registrationTypes = registrationTypeStats.map(r => ({
        type: r.name,
        participants: r.value,
        percentage: `${r.percentage}%`,
        revenue: `${r.revenue.toLocaleString()} VND`
      }));

      const statsPayload = {
        totalParticipants: filteredData.length,
        totalRevenue: `${filteredData.reduce((acc, curr) => acc + parseFloat(curr.TXNAMOUNT?.replace(/,/g, "") || "0"), 0).toLocaleString()} VND`,
        races: formattedRaces,
        topProvinces,
        ageGroups,
        genderStats: gender,
        registrationTypeStats: registrationTypes,
        currentFilters: {
          races: selectedRaces.length === 0 ? "All" : selectedRaces.join(", "),
          year: selectedYear,
          distance: selectedDistance,
          stage: selectedStage,
          gender: selectedGender,
          age: selectedAges.length === 0 ? "All" : selectedAges.join(", "),
          search: searchTerm || "None"
        }
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats: statsPayload }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const textText = await res.text();
        console.error("Non-JSON response:", textText);
        throw new Error(
          "Máy chủ trả về phản hồi không hợp lệ (Không phải JSON). " +
          "Nếu bạn chạy trên Vercel, nguyên nhân thường do: " +
          "1. Chưa cấu hình GEMINI_API_KEY trong Environment Variables của Vercel. " +
          "2. Vercel không tự động chạy file backend Express server.ts (Vercel cần cấu hình vercel.json hoặc chuyển tiếp API sang Serverless Functions). " +
          "Hãy kiểm tra Vercel logs để biết chi tiết!"
        );
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Phân tích thất bại");
      }

      const responseData = await res.json();
      setAiAnalysis(responseData.analysis);
    } catch (err: any) {
      console.error("Analysis generation failed:", err);
      setAiError(err.message || "Đã xảy ra lỗi trong quá trình phân tích số liệu.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = () => {
      const token = "898989";
      setValidToken(token);
      const saved = localStorage.getItem("marathon_auth_token");
      if (saved === token) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        if (saved) {
          localStorage.removeItem("marathon_auth_token");
          setAuthError(true);
        }
      }
      setIsAuthChecking(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const loadInitial = async () => {
        setLoading(true);
        setError(null);
        try {
          const res2026 = await fetchYearData("2026");
          setLoadedData({ "2026": res2026 });
        } catch (err) {
          console.error("Error fetching 2026 marathon data:", err);
          setError("Không thể tải dữ liệu từ Google Sheets. Vui lòng kiểm tra kết nối mạng.");
        } finally {
          setLoading(false);
        }
      };

      loadInitial();
    }
  }, [isAuthenticated]);

  const latestDataUpdate = useMemo(() => {
    let maxDate: Date | null = null;
    let maxStr = "";
    data.forEach((p) => {
      if (p.LAST_UPDATE) {
        const d = parseLastUpdateDate(p.LAST_UPDATE);
        if (d && (!maxDate || d > maxDate)) {
          maxDate = d;
          maxStr = p.LAST_UPDATE;
        }
      }
    });
    if (maxDate) {
      try {
        return format(maxDate, "dd/MM/yyyy HH:mm");
      } catch {
        return maxStr;
      }
    }
    return maxStr || null;
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((p) => {
      const matchesRace = selectedRaces.length === 0 || (p.RACE && selectedRaces.includes(p.RACE));
      const matchesDistance = selectedDistance === "all" || p.DISTANCE === selectedDistance;
      const matchesStage = selectedStage === "all" || p.STAGE === selectedStage;
      
      const matchesYear = selectedYear === "all" || (() => {
        if (!p.RACE) return false;
        const match = p.RACE.match(/\d{2}$/);
        const yr = match ? "20" + match[0] : "Khác";
        if (selectedYear === "2019-2024") {
          const yrNum = parseInt(yr, 10);
          return yrNum >= 2019 && yrNum <= 2024;
        }
        return yr === selectedYear;
      })();

      const matchesGender = selectedGender === "all" || (() => {
        const g = p.GENDER?.toUpperCase().trim();
        if (selectedGender === "M") return g === "M" || g === "NAM";
        if (selectedGender === "F") return g === "F" || g === "NU" || g === "NỮ";
        if (selectedGender === "Other") return g !== "M" && g !== "NAM" && g !== "F" && g !== "NU" && g !== "NỮ" && g !== undefined && g !== "";
        return false;
      })();

      const matchesAge = selectedAges.length === 0 || (p.AGE && selectedAges.includes(p.AGE.trim()));

      const matchesSearch = 
        !searchTerm ||
        p.RACE?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDate = (() => {
        if (!startDate && !endDate) return true;
        if (!p.LAST_UPDATE) return true;
        const pDate = parseLastUpdateDate(p.LAST_UPDATE);
        if (!pDate) return true;

        if (startDate) {
          const startParts = startDate.split("-").map(Number);
          const start = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);
          if (pDate < start) return false;
        }
        if (endDate) {
          const endParts = endDate.split("-").map(Number);
          const end = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999);
          if (pDate > end) return false;
        }
        return true;
      })();

      return matchesRace && matchesYear && matchesDistance && matchesStage && matchesGender && matchesAge && matchesSearch && matchesDate;
    });
  }, [data, selectedRaces, selectedYear, selectedDistance, selectedStage, selectedGender, selectedAges, searchTerm, startDate, endDate]);

  // Revenue Calculation
  const revenueStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    
    filteredData.forEach((p) => {
      const raceName = p.RACE || "Unknown";
      const distance = p.DISTANCE || "Unknown";
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");

      if (!stats[raceName]) stats[raceName] = {};
      stats[raceName][distance] = (stats[raceName][distance] || 0) + amount;
    });

    return stats;
  }, [filteredData]);

  // BIB Stats by Stage
  const bibStageStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    filteredData.forEach((p) => {
      const raceName = p.RACE || "Unknown";
      const stage = p.STAGE || "Unknown";
      if (!stats[raceName]) stats[raceName] = {};
      stats[raceName][stage] = (stats[raceName][stage] || 0) + 1;
    });
    return stats;
  }, [filteredData]);

  // BIB Stats by Distance
  const bibDistanceStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    filteredData.forEach((p) => {
      const raceName = p.RACE || "Unknown";
      const distance = p.DISTANCE || "Unknown";
      if (!stats[raceName]) stats[raceName] = {};
      stats[raceName][distance] = (stats[raceName][distance] || 0) + 1;
    });
    return stats;
  }, [filteredData]);

  // Nationality Statistics (Viet Nam vs International grouping)
  const nationalityGroupStats = useMemo(() => {
    let vnCount = 0;
    let vnRevenue = 0;
    let intlCount = 0;
    let intlRevenue = 0;

    filteredData.forEach((p) => {
      const nat = p.NATIONALITY?.trim() || "";
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");
      
      if (isVietnam(nat)) {
        vnCount += 1;
        vnRevenue += amount;
      } else {
        intlCount += 1;
        intlRevenue += amount;
      }
    });

    const total = vnCount + intlCount;

    return {
      vietnam: {
        count: vnCount,
        revenue: vnRevenue,
        percentage: total > 0 ? ((vnCount / total) * 100).toFixed(1) : "0",
      },
      international: {
        count: intlCount,
        revenue: intlRevenue,
        percentage: total > 0 ? ((intlCount / total) * 100).toFixed(1) : "0",
      },
      total,
    };
  }, [filteredData]);

  // Nationality Statistics
  const nationalityStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    filteredData.forEach((p) => {
      const nationality = p.NATIONALITY?.trim() || "Chưa xác định";
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");
      if (!stats[nationality]) {
        stats[nationality] = { count: 0, revenue: 0 };
      }
      stats[nationality].count += 1;
      stats[nationality].revenue += amount;
    });
    return Object.entries(stats)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Province/City Statistics
  const provinceStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    filteredData.forEach((p) => {
      let province = p.PROVINCE_CITY?.trim() || "Chưa xác định";
      if (province === "") province = "Chưa xác định";
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");
      if (!stats[province]) {
        stats[province] = { count: 0, revenue: 0 };
      }
      stats[province].count += 1;
      stats[province].revenue += amount;
    });
    return Object.entries(stats)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Province/City Group Statistics (HN, HCM, Others)
  const provinceGroupStats = useMemo(() => {
    let hnCount = 0;
    let hnRevenue = 0;
    let hcmCount = 0;
    let hcmRevenue = 0;
    let otherCount = 0;
    let otherRevenue = 0;

    filteredData.forEach((p) => {
      const province = p.PROVINCE_CITY?.trim() || "Chưa xác định";
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");

      if (isHanoi(province)) {
        hnCount += 1;
        hnRevenue += amount;
      } else if (isHcm(province)) {
        hcmCount += 1;
        hcmRevenue += amount;
      } else {
        otherCount += 1;
        otherRevenue += amount;
      }
    });

    const total = hnCount + hcmCount + otherCount;

    return {
      hanoi: {
        count: hnCount,
        revenue: hnRevenue,
        percentage: total > 0 ? ((hnCount / total) * 100).toFixed(1) : "0",
      },
      hcm: {
        count: hcmCount,
        revenue: hcmRevenue,
        percentage: total > 0 ? ((hcmCount / total) * 100).toFixed(1) : "0",
      },
      others: {
        count: otherCount,
        revenue: otherRevenue,
        percentage: total > 0 ? ((otherCount / total) * 100).toFixed(1) : "0",
      },
      total,
    };
  }, [filteredData]);

  // Age Group Statistics
  const ageGroupStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    filteredData.forEach((p) => {
      const ageGroup = p.AGE_GROUP?.trim() || "Chưa xác định";
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");
      if (!stats[ageGroup]) {
        stats[ageGroup] = { count: 0, revenue: 0 };
      }
      stats[ageGroup].count += 1;
      stats[ageGroup].revenue += amount;
    });
    return Object.entries(stats)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Exact AGE Statistics
  const exactAgeStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    filteredData.forEach((p) => {
      const ageStr = p.AGE?.trim() || "Chưa xác định";
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");
      if (!stats[ageStr]) {
        stats[ageStr] = { count: 0, revenue: 0 };
      }
      stats[ageStr].count += 1;
      stats[ageStr].revenue += amount;
    });
    return Object.entries(stats)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Gender Statistics and Chart Data
  const genderStats = useMemo(() => {
    let maleCount = 0;
    let maleRevenue = 0;
    let femaleCount = 0;
    let femaleRevenue = 0;
    let otherCount = 0;
    let otherRevenue = 0;

    filteredData.forEach((p) => {
      const gender = p.GENDER?.toUpperCase().trim();
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");
      
      if (gender === "M" || gender === "NAM") {
        maleCount += 1;
        maleRevenue += amount;
      } else if (gender === "F" || gender === "NU" || gender === "NỮ") {
        femaleCount += 1;
        femaleRevenue += amount;
      } else {
        otherCount += 1;
        otherRevenue += amount;
      }
    });

    const total = maleCount + femaleCount + otherCount;

    return [
      { name: "M", value: maleCount, revenue: maleRevenue, percentage: total > 0 ? ((maleCount / total) * 100).toFixed(1) : "0" },
      { name: "F", value: femaleCount, revenue: femaleRevenue, percentage: total > 0 ? ((femaleCount / total) * 100).toFixed(1) : "0" },
      { name: "Other", value: otherCount, revenue: otherRevenue, percentage: total > 0 ? ((otherCount / total) * 100).toFixed(1) : "0" },
    ].filter(item => item.value > 0);
  }, [filteredData]);

  // Registration Type Statistics (Group vs Individual)
  const registrationTypeStats = useMemo(() => {
    let individualCount = 0;
    let individualRevenue = 0;
    let groupCount = 0;
    let groupRevenue = 0;
    let otherCount = 0;
    let otherRevenue = 0;

    filteredData.forEach((p) => {
      const type = p.REGISTRATION_TYPE?.toUpperCase().trim() || "";
      const amount = parseFloat(p.TXNAMOUNT?.replace(/,/g, "") || "0");

      if (type === "CÁ NHÂN" || type === "CA NHAN" || type === "INDIVIDUAL" || type === "CÂN NHÂN" || type === "CÁNHÂN") {
        individualCount += 1;
        individualRevenue += amount;
      } else if (type === "NHÓM" || type === "NHOM" || type === "GROUP" || type.includes("NHÓM") || type.includes("NHOM") || type.includes("GROUP")) {
        groupCount += 1;
        groupRevenue += amount;
      } else if (type !== "") {
        // Any specific partner registration code or non-individual is considered a group registration
        groupCount += 1;
        groupRevenue += amount;
      } else {
        otherCount += 1;
        otherRevenue += amount;
      }
    });

    const total = individualCount + groupCount + otherCount;

    return [
      { name: "Đơn", value: individualCount, revenue: individualRevenue, percentage: total > 0 ? ((individualCount / total) * 100).toFixed(1) : "0" },
      { name: "Nhóm", value: groupCount, revenue: groupRevenue, percentage: total > 0 ? ((groupCount / total) * 100).toFixed(1) : "0" },
      { name: "Khác", value: otherCount, revenue: otherRevenue, percentage: total > 0 ? ((otherCount / total) * 100).toFixed(1) : "0" },
    ].filter(item => item.value > 0);
  }, [filteredData]);

  // Table Sorting States
  const [revSort, setRevSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'race', dir: 'asc' });
  const [stageSort, setStageSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'race', dir: 'asc' });
  const [distSort, setDistSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'race', dir: 'asc' });
  const [natSort, setNatSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'count', dir: 'desc' });
  const [provSort, setProvSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'count', dir: 'desc' });
  const [ageSort, setAgeSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'count', dir: 'desc' });
  const [exactAgeSort, setExactAgeSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'count', dir: 'desc' });

  const ageGroupTableRef = useRef<HTMLDivElement>(null);
  const [ageGroupHeight, setAgeGroupHeight] = useState<number | undefined>(undefined);

  const handleSortToggle = (
    current: { key: string; dir: 'asc' | 'desc' },
    setSort: React.Dispatch<React.SetStateAction<{ key: string; dir: 'asc' | 'desc' }>>,
    key: string,
    defaultDir: 'asc' | 'desc' = 'asc'
  ) => {
    if (current.key === key) {
      setSort({ key, dir: current.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ key, dir: defaultDir });
    }
  };

  const sortedRevenueData = useMemo(() => {
    const items = Object.entries(revenueStats).map(([race, dists]) => {
      const rowTotal = Object.values(dists).reduce((a, b) => a + b, 0);
      return { race, dists, rowTotal };
    });

    items.sort((a, b) => {
      if (revSort.key === 'race') {
        return compareRaces(a.race, b.race, revSort.dir);
      }
      let valA = 0;
      let valB = 0;

      if (revSort.key === 'total') {
        valA = a.rowTotal;
        valB = b.rowTotal;
      } else {
        valA = a.dists[revSort.key] || 0;
        valB = b.dists[revSort.key] || 0;
      }

      return revSort.dir === 'asc' ? valA - valB : valB - valA;
    });

    return items;
  }, [revenueStats, revSort, compareRaces]);

  const sortedStageData = useMemo(() => {
    const items = Object.entries(bibStageStats).map(([race, stages]) => {
      const rowTotal = Object.values(stages).reduce((a, b) => a + b, 0);
      return { race, stages, rowTotal };
    });

    items.sort((a, b) => {
      if (stageSort.key === 'race') {
        return compareRaces(a.race, b.race, stageSort.dir);
      }
      let valA = 0;
      let valB = 0;

      if (stageSort.key === 'total') {
        valA = a.rowTotal;
        valB = b.rowTotal;
      } else {
        valA = a.stages[stageSort.key] || 0;
        valB = b.stages[stageSort.key] || 0;
      }

      return stageSort.dir === 'asc' ? valA - valB : valB - valA;
    });

    return items;
  }, [bibStageStats, stageSort, compareRaces]);

  const sortedBibDistData = useMemo(() => {
    const items = Object.entries(bibDistanceStats).map(([race, dists]) => {
      const rowTotal = Object.values(dists).reduce((a, b) => a + b, 0);
      return { race, dists, rowTotal };
    });

    items.sort((a, b) => {
      if (distSort.key === 'race') {
        return compareRaces(a.race, b.race, distSort.dir);
      }
      let valA = 0;
      let valB = 0;

      if (distSort.key === 'total') {
        valA = a.rowTotal;
        valB = b.rowTotal;
      } else {
        valA = a.dists[distSort.key] || 0;
        valB = b.dists[distSort.key] || 0;
      }

      return distSort.dir === 'asc' ? valA - valB : valB - valA;
    });

    return items;
  }, [bibDistanceStats, distSort, compareRaces]);

  const sortedNationalityData = useMemo(() => {
    const items = [...nationalityStats];
    items.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      if (natSort.key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (natSort.key === 'count') {
        valA = a.count;
        valB = b.count;
      } else if (natSort.key === 'revenue') {
        valA = a.revenue;
        valB = b.revenue;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return natSort.dir === 'asc' ? valA.localeCompare(valB, 'vi') : valB.localeCompare(valA, 'vi');
      }
      return natSort.dir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return items;
  }, [nationalityStats, natSort]);

  const sortedProvinceData = useMemo(() => {
    const items = [...provinceStats];
    items.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      if (provSort.key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (provSort.key === 'count') {
        valA = a.count;
        valB = b.count;
      } else if (provSort.key === 'revenue') {
        valA = a.revenue;
        valB = b.revenue;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return provSort.dir === 'asc' ? valA.localeCompare(valB, 'vi') : valB.localeCompare(valA, 'vi');
      }
      return provSort.dir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return items;
  }, [provinceStats, provSort]);

  const sortedAgeData = useMemo(() => {
    const items = [...ageGroupStats];
    items.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      if (ageSort.key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (ageSort.key === 'count') {
        valA = a.count;
        valB = b.count;
      } else if (ageSort.key === 'revenue') {
        valA = a.revenue;
        valB = b.revenue;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return ageSort.dir === 'asc' ? valA.localeCompare(valB, 'vi') : valB.localeCompare(valA, 'vi');
      }
      return ageSort.dir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return items;
  }, [ageGroupStats, ageSort]);

  const sortedExactAgeData = useMemo(() => {
    const items = [...exactAgeStats];
    items.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      if (exactAgeSort.key === 'name') {
        const numA = parseInt(a.name, 10);
        const numB = parseInt(b.name, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return exactAgeSort.dir === 'asc' ? numA - numB : numB - numA;
        }
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (exactAgeSort.key === 'count') {
        valA = a.count;
        valB = b.count;
      } else if (exactAgeSort.key === 'revenue') {
        valA = a.revenue;
        valB = b.revenue;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return exactAgeSort.dir === 'asc' ? valA.localeCompare(valB, 'vi') : valB.localeCompare(valA, 'vi');
      }
      return exactAgeSort.dir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return items;
  }, [exactAgeStats, exactAgeSort]);

  useEffect(() => {
    if (!ageGroupTableRef.current) return;
    const el = ageGroupTableRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setAgeGroupHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [sortedAgeData]);

  const allDistances = useMemo(() => {
    const dists = new Set<string>();
    data.forEach(p => { if (p.DISTANCE) dists.add(p.DISTANCE); });
    return Array.from(dists).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [data]);

  const allStages = useMemo(() => {
    const stages = new Set<string>();
    data.forEach(p => { if (p.STAGE) stages.add(p.STAGE); });

    const getStageRank = (stageName: string): number => {
      const s = stageName.trim().toUpperCase();
      if (s === "SEB" || s.includes("SUPER EARLY BIRD") || s.includes("SUPER EARLY")) return 1;
      if (s === "EB" || s.includes("EARLY BIRD") || s.includes("EARLY")) return 2;
      if (s === "RE" || s.includes("REGULAR") || s.includes("CHUẨN") || s.includes("CHÍNH THỨC")) return 3;
      if (s.includes("LATE") || s.includes("MUỘN")) return 4;
      if (s.includes("OTHER") || s.includes("KHÁC") || s.includes("DUY NHẤT") || s.includes("SINGLE") || s.includes("GIAI ĐOẠN DUY NHẤT")) return 5;
      if (s.includes("IMPORT") || s.includes("NHẬP")) return 6;
      return 99;
    };

    return Array.from(stages).sort((a, b) => {
      const rankA = getStageRank(a);
      const rankB = getStageRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
  }, [data]);

  const allAges = useMemo(() => {
    const ages = new Set<string>();
    data.forEach(p => {
      const a = p.AGE?.trim();
      if (a) ages.add(a);
    });
    return Array.from(ages).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, "vi");
    });
  }, [data]);

  const allRaceNames = useMemo(() => {
    const names = new Set<string>();
    data.forEach(p => {
      if (p.RACE) {
        if (selectedYear === "all") {
          names.add(p.RACE);
        } else if (selectedYear === "2019-2024") {
          const match = p.RACE.match(/\d{2}$/);
          const yrNum = match ? parseInt("20" + match[0], 10) : 0;
          if (yrNum >= 2019 && yrNum <= 2024) {
            names.add(p.RACE);
          }
        } else {
          const match = p.RACE.match(/\d{2}$/);
          const yr = match ? "20" + match[0] : "Khác";
          if (yr === selectedYear) {
            names.add(p.RACE);
          }
        }
      }
    });
    return Array.from(names).sort((a, b) => compareRaces(a, b, 'asc'));
  }, [data, selectedYear, compareRaces]);

  const allYears = useMemo(() => {
    const years = new Set<string>(["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"]);
    data.forEach(p => {
      if (p.RACE) {
        const match = p.RACE.match(/\d{2}$/);
        if (match) {
          years.add("20" + match[0]);
        }
      }
    });
    return Array.from(years).sort().reverse();
  }, [data]);

  const topRaceStat = useMemo(() => {
    if (sortedStageData.length === 0) return { name: "-", count: 0, percentage: "0" };
    const sorted = [...sortedStageData].sort((a, b) => b.rowTotal - a.rowTotal);
    const top = sorted[0];
    const pct = filteredData.length > 0 ? ((top.rowTotal / filteredData.length) * 100).toFixed(1) : "0";
    return { name: top.race, count: top.rowTotal, percentage: pct };
  }, [sortedStageData, filteredData.length]);

  const genderOverview = useMemo(() => {
    let male = 0;
    let female = 0;
    genderStats.forEach(g => {
      const name = g.name.toLowerCase();
      if (name.includes("nam") || name === "m") {
        male += g.value;
      } else if (name.includes("nữ") || name.includes("nu") || name === "f") {
        female += g.value;
      }
    });
    const total = male + female || 1;
    const malePct = ((male / total) * 100).toFixed(1);
    const femalePct = ((female / total) * 100).toFixed(1);
    return { male, female, malePct, femalePct };
  }, [genderStats]);

  const regTypeOverview = useMemo(() => {
    let indiv = 0;
    let group = 0;
    registrationTypeStats.forEach(r => {
      const name = r.name.toLowerCase();
      if (name.includes("nhóm") || name.includes("group")) {
        group += r.value;
      } else {
        indiv += r.value;
      }
    });
    const total = indiv + group || 1;
    const indivPct = ((indiv / total) * 100).toFixed(1);
    const groupPct = ((group / total) * 100).toFixed(1);
    return { indiv, group, indivPct, groupPct };
  }, [registrationTypeStats]);

  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg)]">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="font-mono text-sm uppercase tracking-widest">Verifying Security...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="inline-block p-3 border border-[var(--line)] mb-4">
              <Activity className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-serif italic uppercase tracking-tighter">Security Access</h1>
            <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Authorized Personnel Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="col-header">Access Token</Label>
              <Input 
                type="password"
                placeholder="Enter security token..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className={cn(
                  "rounded-none border-[var(--line)] bg-white/50 font-mono text-center text-lg tracking-[0.5em]",
                  authError && "border-red-500 ring-1 ring-red-500"
                )}
              />
              {authError && (
                <p className="text-[10px] font-mono text-red-600 uppercase text-center">Invalid Token. Access Denied.</p>
              )}
            </div>
            <Button type="submit" className="w-full rounded-none bg-[var(--ink)] text-[var(--bg)] font-mono uppercase py-6 text-sm tracking-widest">
              Verify & Enter
            </Button>
          </form>

          <div className="pt-8 border-t border-[var(--line)] opacity-20 text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest">Marathon Revenue Intelligence v2.2.0</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg)]">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="font-mono text-sm uppercase tracking-widest">Synchronizing Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* FT Graphic Top Bar */}
      <div className="w-full bg-[#141414] text-[#f2ece2] font-mono text-[10px] sm:text-[11px] px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#141414]">
        <div className="flex items-center gap-2">
          <span className="bg-[#ee3260] text-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
            FT STYLE
          </span>
          <span className="font-bold tracking-wider">FINANCIAL TIMES DATA GRAPHIC</span>
        </div>
        <div className="hidden md:flex items-center gap-3 opacity-80 text-[10px]">
          {latestDataUpdate && <span>LAST UPDATE: {latestDataUpdate}</span>}
          <span>|</span>
          <span>AUTOSYNC: ACTIVE</span>
        </div>
        <div className="font-bold tracking-wider text-[#ee3260]">
          {filteredData.length.toLocaleString()} RUNNERS RECORDED
        </div>
      </div>

      {/* Main Header */}
      <header className="border-b-2 border-[#141414] pb-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#ee3260] font-bold flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-[#ee3260]" />
            MARATHON REVENUE & PARTICIPANT ANALYTICS
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRaceOrderModalOpen(true)}
              className="text-[10px] font-mono uppercase border border-[#141414] rounded-none h-7 px-3 bg-white text-[#141414] hover:bg-[#141414] hover:text-white transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
              title="Cài đặt thứ tự các giải chạy (Đồng bộ máy chủ)"
            >
              <SlidersHorizontal className="w-3 h-3 text-[#ee3260]" />
              Thứ tự giải
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={isRefreshing || loading}
              className="text-[10px] font-mono uppercase border border-[#141414] rounded-none h-7 px-3 bg-[#141414] text-white hover:bg-[#ee3260] hover:text-white transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Đang cập nhật..." : "Cập nhật"}
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleLogout} 
              className="text-[10px] font-mono uppercase opacity-60 hover:opacity-100 border border-[#141414]/30 rounded-none h-7 px-3 bg-white/40 cursor-pointer"
            >
              Logout
            </Button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl font-serif font-black tracking-tight uppercase leading-none text-[#141414]">
              MARATHON ANALYTICS
            </h1>
            <p className="text-xs font-serif italic text-[#141414]/70 mt-2 max-w-2xl">
              Dữ liệu đăng ký tham gia tổng hợp. Phân tích chi tiết theo cự ly, giới tính (Nam / Nữ) và giải chạy.
            </p>
          </div>
          <div className="text-right border-l-2 border-[#141414] pl-4 py-1">
            <p className="text-[10px] font-mono opacity-60 uppercase font-bold">FILTERED TOTAL REVENUE</p>
            <p className="text-2xl sm:text-3xl font-serif font-black text-[#141414]">
              {Object.values(revenueStats).reduce((acc, curr) => acc + Object.values(curr).reduce((a, b) => a + b, 0), 0).toLocaleString()} <span className="text-sm font-mono font-normal">VND</span>
            </p>
          </div>
        </div>
      </header>

      {/* I. CHỈ SỐ TỔNG QUAN (KEY DATA GRAPHIC METRICS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#141414] pb-1.5">
          <span className="font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#141414]">
            <span>📈</span> I. KEY DATA GRAPHIC METRICS
          </span>
          <span className="font-mono text-[10px] opacity-60 uppercase font-bold">
            SAMPLE SIZE: {filteredData.length.toLocaleString()} RUNNERS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Box 1 */}
          <div className="border border-[#141414] bg-[#faf6ee] p-4 flex flex-col justify-between space-y-3 relative shadow-[2px_2px_0px_0px_rgba(20,20,20,0.1)]">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono uppercase font-bold text-[#141414]/70 flex items-center gap-1">
                <Users className="w-3 h-3 text-[#141414]" /> TOTAL RUNNERS
              </span>
              <span className="bg-[#141414] text-white px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase">
                TOTAL
              </span>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-serif font-black text-[#141414] tracking-tight">
                {filteredData.length.toLocaleString()}
              </p>
              <p className="text-[10px] font-mono opacity-60 mt-1">
                {((filteredData.length / (data.length || 1)) * 100).toFixed(1)}% of total system dataset
              </p>
            </div>
            <div className="w-full h-2 bg-[#141414]/10 border border-[#141414]/20 overflow-hidden">
              <div className="h-full bg-[#141414] w-full" />
            </div>
          </div>

          {/* Box 2 */}
          <div className="border border-[#141414] bg-[#faf6ee] p-4 flex flex-col justify-between space-y-3 relative shadow-[2px_2px_0px_0px_rgba(20,20,20,0.1)]">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono uppercase font-bold text-[#141414]/70 flex items-center gap-1">
                <Activity className="w-3 h-3 text-[#141414]" /> TOP RACE
              </span>
              <span className="bg-[#141414] text-white px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase">
                TOP 1
              </span>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-serif font-black text-[#141414] tracking-tight truncate">
                {topRaceStat.name}
              </p>
              <p className="text-[10px] font-mono opacity-60 mt-1">
                {topRaceStat.count.toLocaleString()} RUNNERS ({topRaceStat.percentage}%)
              </p>
            </div>
            <div className="w-full h-2 bg-[#141414]/10 border border-[#141414]/20 overflow-hidden">
              <div className="h-full bg-[#141414]" style={{ width: `${Math.min(100, parseFloat(topRaceStat.percentage))}%` }} />
            </div>
          </div>

          {/* Box 3 */}
          <div className="border border-[#141414] bg-[#faf6ee] p-4 flex flex-col justify-between space-y-3 relative shadow-[2px_2px_0px_0px_rgba(20,20,20,0.1)]">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono uppercase font-bold text-[#141414]/70 flex items-center gap-1">
                <Users className="w-3 h-3 text-[#141414]" /> GENDER RATIO
              </span>
              <span className="bg-[#141414] text-white px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase">
                M / F
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-black text-[#141414]">M {genderOverview.malePct}%</span>
                <span className="text-sm font-serif italic text-[#ee3260]">/ F {genderOverview.femalePct}%</span>
              </div>
              <p className="text-[10px] font-mono opacity-60 mt-1">
                {genderOverview.male.toLocaleString()} M vs {genderOverview.female.toLocaleString()} F
              </p>
            </div>
            <div className="w-full h-2 bg-[#ee3260] border border-[#141414]/20 overflow-hidden flex">
              <div className="h-full bg-[#141414]" style={{ width: `${genderOverview.malePct}%` }} />
            </div>
          </div>

          {/* Box 4 */}
          <div className="border border-[#141414] bg-[#faf6ee] p-4 flex flex-col justify-between space-y-3 relative shadow-[2px_2px_0px_0px_rgba(20,20,20,0.1)]">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono uppercase font-bold text-[#141414]/70 flex items-center gap-1">
                <PieIcon className="w-3 h-3 text-[#141414]" /> REGISTRATION TYPE
              </span>
              <span className="bg-[#141414] text-white px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase">
                TYPE
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-black text-[#141414]">ĐƠN {regTypeOverview.indivPct}%</span>
                <span className="text-sm font-serif italic text-[#ee3260]">/ NHÓM {regTypeOverview.groupPct}%</span>
              </div>
              <p className="text-[10px] font-mono opacity-60 mt-1">
                {regTypeOverview.indiv.toLocaleString()} Đơn vs {regTypeOverview.group.toLocaleString()} Nhóm
              </p>
            </div>
            <div className="w-full h-2 bg-[#ee3260] border border-[#141414]/20 overflow-hidden flex">
              <div className="h-full bg-[#141414]" style={{ width: `${regTypeOverview.indivPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#141414] pb-1.5">
          <span className="font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#141414]">
            <span>⚙️</span> DATA FILTERS
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-mono text-[10px] font-bold text-[#141414]">
              Showing: {filteredData.length.toLocaleString()} / {data.length.toLocaleString()} Runners
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefreshData}
              disabled={isRefreshing || loading}
              className="rounded-none border-[#141414] font-mono text-[10px] uppercase font-bold gap-1.5 h-6 px-2.5 bg-[#141414] text-white hover:bg-[#ee3260] hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Đang cập nhật..." : "Cập nhật"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetFilters}
              className="rounded-none border-[#141414] font-mono text-[10px] uppercase gap-1.5 h-6 px-2 hover:bg-[#141414] hover:text-[#f2ece2] transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Reset Filters
            </Button>
          </div>
        </div>

        <div className="bg-[#faf6ee] p-5 border border-[#141414] shadow-[2px_2px_0px_0px_rgba(20,20,20,0.1)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {/* Race Name */}
            <div className="space-y-1">
              <Label className="font-mono text-[10px] font-bold uppercase text-[#141414] flex items-center gap-1">
                1. RACE
              </Label>
              <Popover>
                <PopoverTrigger 
                  className="w-full justify-between rounded-none border border-[#141414] bg-[#f2ece2] font-mono text-xs h-9 px-2.5 hover:bg-white cursor-pointer text-left flex items-center"
                >
                  <span className="truncate">
                    {selectedRaces.length === 0 
                      ? "All Races" 
                      : selectedRaces.length === 1 
                        ? selectedRaces[0] 
                        : `${selectedRaces.length} races selected`}
                  </span>
                  <Filter className="w-3.5 h-3.5 ml-1.5 opacity-60 shrink-0" />
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-3 bg-[#faf6ee] rounded-none border border-[#141414] font-mono text-xs max-h-[320px] overflow-y-auto space-y-2 shadow-xl" align="start">
                  <div className="flex items-center justify-between border-b border-[#141414]/20 pb-1.5 mb-1.5">
                    <span className="font-bold uppercase tracking-wider">Select Races</span>
                    {selectedRaces.length > 0 && (
                      <button 
                        onClick={() => setSelectedRaces([])} 
                        className="text-[10px] uppercase underline opacity-70 hover:opacity-100"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 p-1 hover:bg-[#141414]/5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedRaces.length === 0}
                        onChange={() => setSelectedRaces([])}
                        className="rounded-none border-[#141414] accent-[#141414]"
                      />
                      <span className={cn(selectedRaces.length === 0 && "font-bold")}>ALL RACES</span>
                    </label>
                    {allRaceNames.map(name => {
                      const isChecked = selectedRaces.includes(name);
                      return (
                        <label key={name} className="flex items-center gap-2 p-1 hover:bg-[#141414]/5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedRaces(selectedRaces.filter(r => r !== name));
                              } else {
                                setSelectedRaces([...selectedRaces, name]);
                              }
                            }}
                            className="rounded-none border-[#141414] accent-[#141414]"
                          />
                          <span className={cn(isChecked && "font-bold")}>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Year */}
            <div className="space-y-1">
              <Label className="font-mono text-[10px] font-bold uppercase text-[#141414] flex items-center justify-between">
                <span>2. YEAR</span>
                {loadingYear && <span className="text-[#ee3260] text-[9px] font-bold animate-pulse">Đang tải {loadingYear}...</span>}
              </Label>
              <select 
                className="w-full bg-[#f2ece2] border border-[#141414] px-2.5 py-1 text-xs font-mono focus:outline-none focus:bg-white h-9 transition-colors"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
              >
                <option value="2026">2026 (Mặc định)</option>
                <option value="2025">2025 {!loadedData["2025"] ? "(Tải khi chọn)" : " (Đã tải)"}</option>
                <option value="2024">2024 {!loadedData["2019-2024"] ? "(Tải khi chọn)" : " (Đã tải)"}</option>
                <option value="2023">2023 {!loadedData["2019-2024"] ? "(Tải khi chọn)" : " (Đã tải)"}</option>
                <option value="2022">2022 {!loadedData["2019-2024"] ? "(Tải khi chọn)" : " (Đã tải)"}</option>
                <option value="2021">2021 {!loadedData["2019-2024"] ? "(Tải khi chọn)" : " (Đã tải)"}</option>
                <option value="2020">2020 {!loadedData["2019-2024"] ? "(Tải khi chọn)" : " (Đã tải)"}</option>
                <option value="2019">2019 {!loadedData["2019-2024"] ? "(Tải khi chọn)" : " (Đã tải)"}</option>
                <option value="all">Tất cả các năm (2019 - 2026)</option>
              </select>
            </div>

            {/* Distance */}
            <div className="space-y-1">
              <Label className="font-mono text-[10px] font-bold uppercase text-[#141414] flex items-center gap-1">
                3. DISTANCE
              </Label>
              <select 
                className="w-full bg-[#f2ece2] border border-[#141414] px-2.5 py-1 text-xs font-mono focus:outline-none focus:bg-white h-9 transition-colors"
                value={selectedDistance}
                onChange={(e) => setSelectedDistance(e.target.value)}
              >
                <option value="all">All Distances</option>
                {allDistances.map(d => <option key={d} value={d}>{d}km</option>)}
              </select>
            </div>

            {/* Stage */}
            <div className="space-y-1">
              <Label className="font-mono text-[10px] font-bold uppercase text-[#141414] flex items-center gap-1">
                4. STAGE
              </Label>
              <select 
                className="w-full bg-[#f2ece2] border border-[#141414] px-2.5 py-1 text-xs font-mono focus:outline-none focus:bg-white h-9 transition-colors"
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
              >
                <option value="all">All Stages</option>
                {allStages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <Label className="font-mono text-[10px] font-bold uppercase text-[#141414] flex items-center gap-1">
                5. GENDER
              </Label>
              <select 
                className="w-full bg-[#f2ece2] border border-[#141414] px-2.5 py-1 text-xs font-mono focus:outline-none focus:bg-white h-9 transition-colors"
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
              >
                <option value="all">All Genders</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>

            {/* Age */}
            <div className="space-y-1">
              <Label className="font-mono text-[10px] font-bold uppercase text-[#141414] flex items-center gap-1">
                6. AGE
              </Label>
              <Popover>
                <PopoverTrigger 
                  className="w-full justify-between rounded-none border border-[#141414] bg-[#f2ece2] font-mono text-xs h-9 px-2.5 hover:bg-white cursor-pointer text-left flex items-center"
                >
                  <span className="truncate">
                    {selectedAges.length === 0 
                      ? "All Ages" 
                      : selectedAges.length === 1 
                        ? selectedAges[0] 
                        : `${selectedAges.length} ages selected`}
                  </span>
                  <Filter className="w-3.5 h-3.5 ml-1.5 opacity-60 shrink-0" />
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-3 bg-[#faf6ee] rounded-none border border-[#141414] font-mono text-xs max-h-[320px] overflow-y-auto space-y-2 shadow-xl" align="start">
                  <div className="flex items-center justify-between border-b border-[#141414]/20 pb-1.5 mb-1.5">
                    <span className="font-bold uppercase tracking-wider">Select Ages</span>
                    {selectedAges.length > 0 && (
                      <button 
                        onClick={() => setSelectedAges([])} 
                        className="text-[10px] uppercase underline opacity-70 hover:opacity-100"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 p-1 hover:bg-[#141414]/5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedAges.length === 0}
                        onChange={() => setSelectedAges([])}
                        className="rounded-none border-[#141414] accent-[#141414]"
                      />
                      <span className={cn(selectedAges.length === 0 && "font-bold")}>ALL AGES</span>
                    </label>
                    {allAges.map(age => {
                      const isChecked = selectedAges.includes(age);
                      return (
                        <label key={age} className="flex items-center gap-2 p-1 hover:bg-[#141414]/5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedAges(selectedAges.filter(a => a !== age));
                              } else {
                                setSelectedAges([...selectedAges, age]);
                              }
                            }}
                            className="rounded-none border-[#141414] accent-[#141414]"
                          />
                          <span className={cn(isChecked && "font-bold")}>{age}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Last Update */}
            <div className="space-y-1">
              <Label className="font-mono text-[10px] font-bold uppercase text-[#141414] flex items-center gap-1">
                7. LAST UPDATE
              </Label>
              <select 
                className="w-full bg-[#f2ece2] border border-[#141414] px-2.5 py-1 text-xs font-mono focus:outline-none focus:bg-white h-9 transition-colors"
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>

            {/* Search */}
            <div className="space-y-1">
              <Label className="font-mono text-[10px] font-bold uppercase text-[#141414] flex items-center gap-1">
                8. SEARCH
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50" />
                <Input 
                  placeholder="Search by Race..." 
                  className="pl-8 rounded-none border border-[#141414] bg-[#f2ece2] focus:ring-0 focus:bg-white font-mono text-xs h-9 transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {(datePreset === "custom" || startDate || endDate) && (
            <div className="flex flex-wrap items-center gap-4 pt-2.5 border-t border-[#141414]/20">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-mono uppercase font-bold text-[#141414]">From:</Label>
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="rounded-none border border-[#141414] bg-[#f2ece2] font-mono text-xs h-8 w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-mono uppercase font-bold text-[#141414]">To:</Label>
                <Input 
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="rounded-none border border-[#141414] bg-[#f2ece2] font-mono text-xs h-8 w-36"
                />
              </div>
              {(startDate || endDate) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setDatePreset("all");
                  }}
                  className="text-[10px] font-mono uppercase underline opacity-80 hover:opacity-100 h-8 text-[#141414]"
                >
                  Clear Date Filter
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BIB by Distance */}
      <DashboardSection 
        title="BIBs by Distance" 
        icon={<Filter className="w-5 h-5" />}
        description="Participant distribution across distances"
      >
        <div className="max-h-[420px] overflow-auto border border-[var(--line)]/10">
          <Table>
            <TableHeader className="bg-[var(--ink)] sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-none">
                <SortableHead 
                  title="Race" 
                  sortKey="race" 
                  currentSort={distSort} 
                  onSort={(k) => handleSortToggle(distSort, setDistSort, k, 'asc')} 
                />
                {allDistances.map(d => (
                  <SortableHead 
                    key={d} 
                    title={d.toLowerCase().includes("k") ? d : `${d}km`} 
                    sortKey={d} 
                    currentSort={distSort} 
                    onSort={(k) => handleSortToggle(distSort, setDistSort, k, 'desc')} 
                    align="center" 
                  />
                ))}
                <SortableHead 
                  title="Total" 
                  sortKey="total" 
                  currentSort={distSort} 
                  onSort={(k) => handleSortToggle(distSort, setDistSort, k, 'desc')} 
                  align="right" 
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBibDistData.map(({ race, dists, rowTotal }) => (
                <TableRow key={race} className="data-row">
                  <TableCell className="font-serif italic text-base">{race}</TableCell>
                  {allDistances.map(d => {
                    const count = dists[d] || 0;
                    const percentage = rowTotal > 0 && count ? ((count / rowTotal) * 100).toFixed(1) : "0";
                    return (
                      <TableCell key={d} className="data-value text-center">
                        {count ? (
                          <>
                            {count} <span className="opacity-40 text-[10px]">| {percentage}%</span>
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="data-value text-right font-bold bg-black/5">
                    {rowTotal}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DashboardSection>

      {/* BIB by Stage */}
      <DashboardSection 
        title="BIBs by Stage" 
        icon={<Activity className="w-5 h-5" />}
        description="Registration count per sales stage"
      >
        <div className="max-h-[420px] overflow-auto border border-[var(--line)]/10">
          <Table>
            <TableHeader className="bg-[var(--ink)] sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-none">
                <SortableHead 
                  title="Race" 
                  sortKey="race" 
                  currentSort={stageSort} 
                  onSort={(k) => handleSortToggle(stageSort, setStageSort, k, 'asc')} 
                />
                {allStages.map(s => (
                  <SortableHead 
                    key={s} 
                    title={s} 
                    sortKey={s} 
                    currentSort={stageSort} 
                    onSort={(k) => handleSortToggle(stageSort, setStageSort, k, 'desc')} 
                    align="right" 
                  />
                ))}
                <SortableHead 
                  title="Total BIB" 
                  sortKey="total" 
                  currentSort={stageSort} 
                  onSort={(k) => handleSortToggle(stageSort, setStageSort, k, 'desc')} 
                  align="right" 
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStageData.map(({ race, stages, rowTotal }) => (
                <TableRow key={race} className="data-row">
                  <TableCell className="font-serif italic text-base">{race}</TableCell>
                  {allStages.map(s => {
                    const count = stages[s] || 0;
                    const pct = rowTotal > 0 && count ? ((count / rowTotal) * 100).toFixed(1) : "0";
                    return (
                      <TableCell key={s} className="data-value text-right">
                        {count ? (
                          <>
                            {count} <span className="opacity-40 text-[10px]">| {pct}%</span>
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="data-value text-right font-bold bg-black/5">
                    {rowTotal}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DashboardSection>

      {/* Revenue Table */}
      <DashboardSection 
        title="Revenue Breakdown" 
        icon={<DollarSign className="w-5 h-5" />}
        description="Total revenue split by race and distance"
      >
        <div className="max-h-[420px] overflow-auto border border-[var(--line)]/10">
          <Table>
            <TableHeader className="bg-[var(--ink)] sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-none">
                <SortableHead 
                  title="Race Name" 
                  sortKey="race" 
                  currentSort={revSort} 
                  onSort={(k) => handleSortToggle(revSort, setRevSort, k, 'asc')} 
                />
                {allDistances.map(d => (
                  <SortableHead 
                    key={d} 
                    title={d.toLowerCase().includes("k") ? d : `${d}km`} 
                    sortKey={d} 
                    currentSort={revSort} 
                    onSort={(k) => handleSortToggle(revSort, setRevSort, k, 'desc')} 
                    align="right" 
                  />
                ))}
                <SortableHead 
                  title="Total (VND)" 
                  sortKey="total" 
                  currentSort={revSort} 
                  onSort={(k) => handleSortToggle(revSort, setRevSort, k, 'desc')} 
                  align="right" 
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRevenueData.map(({ race, dists, rowTotal }) => (
                <TableRow key={race} className="data-row">
                  <TableCell className="font-serif italic text-base">{race}</TableCell>
                  {allDistances.map(d => {
                    const val = dists[d];
                    const pct = rowTotal > 0 && val ? ((val / rowTotal) * 100).toFixed(1) : "0";
                    return (
                      <TableCell key={d} className="data-value text-right">
                        {val ? (
                          <>
                            {val.toLocaleString()}{" "}
                            <span className="opacity-40 text-[10px]">| {pct}%</span>
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="data-value text-right font-bold bg-black/5">
                    {rowTotal.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DashboardSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Nationality Stats */}
        <DashboardSection 
          title="Nationality Statistics" 
          icon={<Globe className="w-5 h-5" />}
          description="Distribution and revenue by runner nationality"
        >
          {/* Vietnam vs International Segment Summary Cards */}
          <div className="grid grid-cols-2 gap-4 p-4 border-b border-[var(--line)]/10 bg-white/40">
            <div className="p-3 border border-[var(--line)]/10 bg-white/60">
              <div className="text-[10px] font-mono uppercase opacity-50 tracking-wider">Việt Nam (Domestic)</div>
              <div className="flex items-baseline justify-between mt-1">
                <div className="text-lg font-serif italic">{nationalityGroupStats.vietnam.count.toLocaleString()} <span className="text-xs font-mono opacity-60">BIBs</span></div>
                <div className="text-xs font-mono font-bold text-slate-700">{nationalityGroupStats.vietnam.percentage}%</div>
              </div>
              <div className="text-[10px] font-mono mt-1 opacity-60 font-medium">{nationalityGroupStats.vietnam.revenue.toLocaleString()} VND</div>
            </div>
            <div className="p-3 border border-[var(--line)]/10 bg-white/60">
              <div className="text-[10px] font-mono uppercase opacity-50 tracking-wider">Quốc Tế (International)</div>
              <div className="flex items-baseline justify-between mt-1">
                <div className="text-lg font-serif italic">{nationalityGroupStats.international.count.toLocaleString()} <span className="text-xs font-mono opacity-60">BIBs</span></div>
                <div className="text-xs font-mono font-bold text-slate-700">{nationalityGroupStats.international.percentage}%</div>
              </div>
              <div className="text-[10px] font-mono mt-1 opacity-60 font-medium">{nationalityGroupStats.international.revenue.toLocaleString()} VND</div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-[var(--line)]/10">
            <Table>
              <TableHeader className="bg-[var(--ink)] sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-none">
                  <SortableHead 
                    title="Quốc tịch" 
                    sortKey="name" 
                    currentSort={natSort} 
                    onSort={(k) => handleSortToggle(natSort, setNatSort, k, 'asc')} 
                    align="left"
                    className="py-3"
                  />
                  <SortableHead 
                    title="BIBs" 
                    sortKey="count" 
                    currentSort={natSort} 
                    onSort={(k) => handleSortToggle(natSort, setNatSort, k, 'desc')} 
                    align="center"
                    className="py-3"
                  />
                  <SortableHead 
                    title="Ratio" 
                    sortKey="count" 
                    currentSort={natSort} 
                    onSort={(k) => handleSortToggle(natSort, setNatSort, k, 'desc')} 
                    align="center"
                    className="py-3"
                  />
                  <SortableHead 
                    title="Revenue (VND)" 
                    sortKey="revenue" 
                    currentSort={natSort} 
                    onSort={(k) => handleSortToggle(natSort, setNatSort, k, 'desc')} 
                    align="right"
                    className="py-3"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedNationalityData.map((item) => {
                  const percentage = filteredData.length > 0 ? ((item.count / filteredData.length) * 100).toFixed(1) : "0";
                  return (
                    <TableRow key={item.name} className="data-row">
                      <TableCell className="font-serif italic font-medium">{item.name}</TableCell>
                      <TableCell className="data-value text-center font-bold">{item.count}</TableCell>
                      <TableCell className="data-value text-center opacity-60 text-[10px]">{percentage}%</TableCell>
                      <TableCell className="data-value text-right font-mono">{item.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DashboardSection>

        {/* Province Stats */}
        <DashboardSection 
          title="Province/City Statistics" 
          icon={<MapPin className="w-5 h-5" />}
          description="Regional runner participation and sales volume"
        >
          {/* Hanoi vs HCM vs Others Segment Summary Cards */}
          <div className="grid grid-cols-3 gap-3 p-4 border-b border-[var(--line)]/10 bg-white/40">
            <div className="p-3 border border-[var(--line)]/10 bg-white/60">
              <div className="text-[10px] font-mono uppercase opacity-50 tracking-wider">Hà Nội</div>
              <div className="flex items-baseline justify-between mt-1">
                <div className="text-base md:text-lg font-serif italic">{provinceGroupStats.hanoi.count.toLocaleString()} <span className="text-[10px] font-mono opacity-60">BIBs</span></div>
                <div className="text-[10px] font-mono font-bold text-slate-700">{provinceGroupStats.hanoi.percentage}%</div>
              </div>
              <div className="text-[10px] font-mono mt-1 opacity-60 font-medium">{provinceGroupStats.hanoi.revenue.toLocaleString()} VND</div>
            </div>
            <div className="p-3 border border-[var(--line)]/10 bg-white/60">
              <div className="text-[10px] font-mono uppercase opacity-50 tracking-wider">TP. Hồ Chí Minh</div>
              <div className="flex items-baseline justify-between mt-1">
                <div className="text-base md:text-lg font-serif italic">{provinceGroupStats.hcm.count.toLocaleString()} <span className="text-[10px] font-mono opacity-60">BIBs</span></div>
                <div className="text-[10px] font-mono font-bold text-slate-700">{provinceGroupStats.hcm.percentage}%</div>
              </div>
              <div className="text-[10px] font-mono mt-1 opacity-60 font-medium">{provinceGroupStats.hcm.revenue.toLocaleString()} VND</div>
            </div>
            <div className="p-3 border border-[var(--line)]/10 bg-white/60">
              <div className="text-[10px] font-mono uppercase opacity-50 tracking-wider">Tỉnh thành khác</div>
              <div className="flex items-baseline justify-between mt-1">
                <div className="text-base md:text-lg font-serif italic">{provinceGroupStats.others.count.toLocaleString()} <span className="text-[10px] font-mono opacity-60">BIBs</span></div>
                <div className="text-[10px] font-mono font-bold text-slate-700">{provinceGroupStats.others.percentage}%</div>
              </div>
              <div className="text-[10px] font-mono mt-1 opacity-60 font-medium">{provinceGroupStats.others.revenue.toLocaleString()} VND</div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-[var(--line)]/10">
            <Table>
              <TableHeader className="bg-[var(--ink)] sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-none">
                  <SortableHead 
                    title="Tỉnh / Thành phố" 
                    sortKey="name" 
                    currentSort={provSort} 
                    onSort={(k) => handleSortToggle(provSort, setProvSort, k, 'asc')} 
                    align="left"
                    className="py-3"
                  />
                  <SortableHead 
                    title="BIBs" 
                    sortKey="count" 
                    currentSort={provSort} 
                    onSort={(k) => handleSortToggle(provSort, setProvSort, k, 'desc')} 
                    align="center"
                    className="py-3"
                  />
                  <SortableHead 
                    title="Ratio" 
                    sortKey="count" 
                    currentSort={provSort} 
                    onSort={(k) => handleSortToggle(provSort, setProvSort, k, 'desc')} 
                    align="center"
                    className="py-3"
                  />
                  <SortableHead 
                    title="Revenue (VND)" 
                    sortKey="revenue" 
                    currentSort={provSort} 
                    onSort={(k) => handleSortToggle(provSort, setProvSort, k, 'desc')} 
                    align="right"
                    className="py-3"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProvinceData.map((item) => {
                  const percentage = filteredData.length > 0 ? ((item.count / filteredData.length) * 100).toFixed(1) : "0";
                  return (
                    <TableRow key={item.name} className="data-row">
                      <TableCell className="font-serif italic font-medium">{item.name}</TableCell>
                      <TableCell className="data-value text-center font-bold">{item.count}</TableCell>
                      <TableCell className="data-value text-center opacity-60 text-[10px]">{percentage}%</TableCell>
                      <TableCell className="data-value text-right font-mono">{item.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DashboardSection>
      </div>

      {/* Age Group & AGE Statistics Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <DashboardSection 
          title="Age Group Statistics" 
          icon={<Users className="w-5 h-5" />}
          description="Participation stats grouped by age categories"
        >
          <div ref={ageGroupTableRef} className="border border-[var(--line)]/10 overflow-x-auto">
            <Table>
              <TableHeader className="bg-[var(--ink)] sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-none">
                  <SortableHead 
                    title="Nhóm tuổi" 
                    sortKey="name" 
                    currentSort={ageSort} 
                    onSort={(k) => handleSortToggle(ageSort, setAgeSort, k, 'asc')} 
                    align="left"
                    className="py-3"
                  />
                  <SortableHead 
                    title="BIBs" 
                    sortKey="count" 
                    currentSort={ageSort} 
                    onSort={(k) => handleSortToggle(ageSort, setAgeSort, k, 'desc')} 
                    align="center"
                    className="py-3"
                  />
                  <SortableHead 
                    title="Ratio" 
                    sortKey="count" 
                    currentSort={ageSort} 
                    onSort={(k) => handleSortToggle(ageSort, setAgeSort, k, 'desc')} 
                    align="center"
                    className="py-3"
                  />
                  <SortableHead 
                    title="Revenue (VND)" 
                    sortKey="revenue" 
                    currentSort={ageSort} 
                    onSort={(k) => handleSortToggle(ageSort, setAgeSort, k, 'desc')} 
                    align="right"
                    className="py-3"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAgeData.map((item) => {
                  const percentage = filteredData.length > 0 ? ((item.count / filteredData.length) * 100).toFixed(1) : "0";
                  return (
                    <TableRow key={item.name} className="data-row">
                      <TableCell className="font-serif italic font-medium">{item.name}</TableCell>
                      <TableCell className="data-value text-center font-bold">{item.count}</TableCell>
                      <TableCell className="data-value text-center opacity-60 text-[10px]">{percentage}%</TableCell>
                      <TableCell className="data-value text-right font-mono">{item.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DashboardSection>

        <DashboardSection 
          title="AGE Statistics" 
          icon={<Users className="w-5 h-5" />}
          description="Participation stats by individual exact age"
        >
          <div 
            className="overflow-y-auto border border-[var(--line)]/10"
            style={{ height: ageGroupHeight ? `${ageGroupHeight}px` : undefined }}
          >
            <Table>
              <TableHeader className="bg-[var(--ink)] sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-none">
                  <SortableHead 
                    title="Tuổi" 
                    sortKey="name" 
                    currentSort={exactAgeSort} 
                    onSort={(k) => handleSortToggle(exactAgeSort, setExactAgeSort, k, 'asc')} 
                    align="left"
                    className="py-3"
                  />
                  <SortableHead 
                    title="BIBs" 
                    sortKey="count" 
                    currentSort={exactAgeSort} 
                    onSort={(k) => handleSortToggle(exactAgeSort, setExactAgeSort, k, 'desc')} 
                    align="center"
                    className="py-3"
                  />
                  <SortableHead 
                    title="Ratio" 
                    sortKey="count" 
                    currentSort={exactAgeSort} 
                    onSort={(k) => handleSortToggle(exactAgeSort, setExactAgeSort, k, 'desc')} 
                    align="center"
                    className="py-3"
                  />
                  <SortableHead 
                    title="Revenue (VND)" 
                    sortKey="revenue" 
                    currentSort={exactAgeSort} 
                    onSort={(k) => handleSortToggle(exactAgeSort, setExactAgeSort, k, 'desc')} 
                    align="right"
                    className="py-3"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExactAgeData.map((item) => {
                  const percentage = filteredData.length > 0 ? ((item.count / filteredData.length) * 100).toFixed(1) : "0";
                  return (
                    <TableRow key={item.name} className="data-row">
                      <TableCell className="font-serif italic font-medium">{item.name}</TableCell>
                      <TableCell className="data-value text-center font-bold">{item.count}</TableCell>
                      <TableCell className="data-value text-center opacity-60 text-[10px]">{percentage}%</TableCell>
                      <TableCell className="data-value text-right font-mono">{item.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DashboardSection>
      </div>

      {/* Visual Charts Row: Gender and Registration Type Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Gender Donut Chart */}
        <DashboardSection 
          title="Gender Demographics" 
          icon={<PieIcon className="w-5 h-5" />}
          description="Gender distribution of registered runners"
        >
          <div className="p-6 bg-white/20 backdrop-blur-sm min-h-[24rem] flex flex-col justify-center">
            {genderStats.length === 0 ? (
              <div className="text-center font-mono text-sm opacity-40 uppercase py-12">
                No Gender Data Available
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {genderStats.map((entry, index) => {
                          const colors = ["#141414", "#ee3260", "#71717a"];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ 
                          background: "#faf6ee", 
                          border: "1px solid #141414", 
                          fontFamily: "monospace", 
                          fontSize: "11px",
                          borderRadius: "0px"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4 font-mono text-xs uppercase tracking-wider">
                  {genderStats.map((entry, index) => {
                    const colors = ["bg-[#141414]", "bg-[#ee3260]", "bg-[#71717a]"];
                    return (
                      <div key={entry.name} className="flex flex-col p-3 border border-[#141414]/20 bg-[#f2ece2] hover:bg-white transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-3.5 h-3.5 ${colors[index % colors.length]}`} />
                            <span className="font-bold text-sm tracking-tight text-[#141414]">{entry.name}</span>
                          </div>
                          <span className="font-bold text-sm text-[#141414]">{entry.value} BIBs</span>
                        </div>
                        <div className="flex justify-between text-[10px] opacity-60 text-[#141414]">
                          <span>Ratio: {entry.percentage}%</span>
                          <span>{entry.revenue.toLocaleString()} VND</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DashboardSection>

        {/* Ticket Sales by Registration Type (Group vs Individual) */}
        <DashboardSection 
          title="Registration Type Statistics" 
          icon={<PieIcon className="w-5 h-5" />}
          description="Ticket sales distribution (Group vs Individual)"
        >
          <div className="p-6 bg-[#faf6ee] backdrop-blur-sm min-h-[24rem] flex flex-col justify-center">
            {registrationTypeStats.length === 0 ? (
              <div className="text-center font-mono text-sm opacity-40 uppercase py-12">
                No Registration Type Data Available
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={registrationTypeStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {registrationTypeStats.map((entry, index) => {
                          const colors = ["#141414", "#ee3260", "#71717a"];
                          return <Cell key={`cell-reg-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ 
                          background: "#faf6ee", 
                          border: "1px solid #141414", 
                          fontFamily: "monospace", 
                          fontSize: "11px",
                          borderRadius: "0px"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4 font-mono text-xs uppercase tracking-wider">
                  {registrationTypeStats.map((entry, index) => {
                    const colors = ["bg-[#141414]", "bg-[#ee3260]", "bg-[#71717a]"];
                    return (
                      <div key={entry.name} className="flex flex-col p-3 border border-[#141414]/20 bg-[#f2ece2] hover:bg-white transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-3.5 h-3.5 ${colors[index % colors.length]}`} />
                            <span className="font-bold text-sm tracking-tight text-[#141414]">{entry.name}</span>
                          </div>
                          <span className="font-bold text-sm text-[#141414]">{entry.value} BIBs</span>
                        </div>
                        <div className="flex justify-between text-[10px] opacity-60 text-[#141414]">
                          <span>Ratio: {entry.percentage}%</span>
                          <span>{entry.revenue.toLocaleString()} VND</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DashboardSection>
      </div>

      {/* AI Analysis Section */}
      <DashboardSection
        title="AI Business Analysis & Strategy Report"
        icon={<Brain className="w-5 h-5" />}
        description="Báo cáo phân tích hiệu suất kinh doanh & Đề xuất chiến lược vận hành từ AI"
        rightElement={
          <Button
            onClick={generateAiAnalysis}
            disabled={aiLoading}
            className="rounded-none bg-[var(--ink)] text-[var(--bg)] hover:bg-[var(--ink)]/80 font-mono text-xs uppercase py-2 px-4 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? "Đang phân tích..." : "Phân tích dữ liệu bằng AI"}
          </Button>
        }
      >
        <div className="p-6 md:p-8 bg-white/20 backdrop-blur-sm min-h-[12rem] flex flex-col justify-center">
          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Activity className="w-10 h-10 animate-spin opacity-60" />
              <div className="text-center font-mono text-xs uppercase tracking-wider space-y-1">
                <p className="font-bold text-slate-800">{loadingSteps[loadingStep]}</p>
                <p className="opacity-40">Mô hình AI đang xử lý dữ liệu...</p>
              </div>
            </div>
          ) : aiError ? (
            <div className="p-4 border border-red-500/20 bg-red-500/5 text-red-700 font-mono text-xs uppercase tracking-wider text-center space-y-3">
              <p>Lỗi: {aiError}</p>
              <Button
                variant="outline"
                onClick={generateAiAnalysis}
                className="mx-auto rounded-none border-red-500/30 text-red-700 hover:bg-red-500/10 font-mono text-[10px]"
              >
                Thử lại
              </Button>
            </div>
          ) : aiAnalysis ? (
            <div className="prose prose-slate max-w-none text-slate-800 space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--line)]/10 pb-4 mb-6">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-500">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Báo cáo vừa được cập nhật tức thì
                </div>
                {filteredData.length !== data.length && (
                  <Badge variant="secondary" className="rounded-none font-mono text-[9px] uppercase">
                    Dựa trên bộ lọc hiện tại
                  </Badge>
                )}
              </div>
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-serif italic uppercase tracking-tight text-slate-950 mt-8 mb-4 border-b border-slate-300 pb-2 leading-tight">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-serif italic uppercase tracking-tight text-slate-900 mt-6 mb-3 leading-snug">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-mono uppercase tracking-wider text-slate-800 font-bold mt-5 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-slate-800 inline-block" />
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm text-slate-700 leading-relaxed font-sans mb-4">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-6 text-sm text-slate-700 space-y-2 font-sans mb-4">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-6 text-sm text-slate-700 space-y-2 font-sans mb-4">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">
                      {children}
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-slate-950">
                      {children}
                    </strong>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4 border border-slate-200">
                      <table className="w-full border-collapse text-xs font-mono bg-white/40">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-slate-100/70 border-b border-slate-200">
                      {children}
                    </thead>
                  ),
                  th: ({ children }) => (
                    <th className="border border-slate-200 p-2 text-left text-slate-900 font-bold uppercase tracking-wider">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-slate-200 p-2 text-slate-700">
                      {children}
                    </td>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-slate-400 pl-4 italic my-4 text-slate-600 bg-slate-50/50 py-2 pr-2">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {aiAnalysis}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-10 space-y-5">
              <Brain className="w-12 h-12 mx-auto text-slate-300 stroke-[1.2]" />
              <div className="space-y-2">
                <h3 className="text-sm font-mono uppercase tracking-wider text-slate-700 font-bold">Chưa có phân tích dữ liệu</h3>
                <p className="text-xs text-slate-500 font-sans max-w-md mx-auto leading-relaxed">
                  Bấm nút bên dưới để khởi chạy hệ thống phân tích AI. Mô hình sẽ đọc trực tiếp các số liệu thống kê hiện tại của giải chạy để tạo báo cáo chiến lược kinh doanh toàn diện.
                </p>
              </div>
              <Button
                onClick={generateAiAnalysis}
                className="mx-auto rounded-none bg-[var(--ink)] text-[var(--bg)] hover:bg-[var(--ink)]/80 font-mono text-xs uppercase py-3 px-6 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Khởi tạo báo cáo phân tích AI
              </Button>
            </div>
          )}
        </div>
      </DashboardSection>


      {/* Footer */}
      <footer className="pt-10 border-t border-[var(--line)] flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono uppercase tracking-widest opacity-40">
        <p>© 2026 VnExpress Marathon Analytics Dashboard</p>
        <div className="flex gap-6">
          <span>Source: Google Sheets TSV</span>
          <span>Auto-Sync: Active</span>
        </div>
      </footer>
      {/* Race Order Settings Modal (Cross-Device Synchronized) */}
      <RaceOrderSettingsModal
        isOpen={isRaceOrderModalOpen}
        onClose={() => setIsRaceOrderModalOpen(false)}
        currentOrder={raceOrder}
        allDetectedRaces={allDetectedRaces}
        onSave={handleSaveRaceOrder}
        updatedAt={raceOrderUpdatedAt}
        initialGoogleScriptUrl={googleScriptUrl}
        initialGoogleSheetTsvUrl={googleSheetTsvUrl}
      />
    </div>
  );
}
