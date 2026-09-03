import React, { useState, useEffect, useMemo } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowUp, 
  ArrowDown, 
  ChevronsUp, 
  ChevronsDown, 
  GripVertical, 
  Search, 
  Save, 
  SlidersHorizontal,
  X,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_RACE_ORDER } from "@/constants/raceOrder";
export { DEFAULT_RACE_ORDER };

interface RaceOrderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrder: string[];
  allDetectedRaces: string[];
  onSave: (newOrder: string[], scriptUrl?: string, tsvUrl?: string) => Promise<any>;
  updatedAt?: string | null;
  initialGoogleScriptUrl?: string;
  initialGoogleSheetTsvUrl?: string;
}

export function RaceOrderSettingsModal({
  isOpen,
  onClose,
  currentOrder,
  allDetectedRaces,
  onSave,
  updatedAt,
  initialGoogleScriptUrl = "",
  initialGoogleSheetTsvUrl = ""
}: RaceOrderSettingsModalProps) {
  const [items, setItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Initialize and merge currentOrder with allDetectedRaces
  useEffect(() => {
    if (isOpen) {
      const base = currentOrder && currentOrder.length > 0 ? currentOrder : DEFAULT_RACE_ORDER;
      const combined = [...base];
      allDetectedRaces.forEach(r => {
        const upper = r.toUpperCase().trim();
        if (upper && !combined.includes(upper)) {
          combined.push(upper);
        }
      });
      setItems(combined);
      setStatusMessage(null);
      setSearchTerm("");
      setYearFilter("all");
    }
  }, [isOpen, currentOrder, allDetectedRaces]);

  const hasChanges = useMemo(() => {
    if (items.length !== currentOrder.length) return true;
    return items.some((item, idx) => item !== currentOrder[idx]);
  }, [items, currentOrder]);

  const getRaceYear = (race: string): string => {
    const match = race.match(/\d{2}$/);
    if (!match) return "Khác";
    return "20" + match[0];
  };

  // Reorder helpers
  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    const newItems = [...items];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);
    setItems(newItems);
  };

  const moveToTop = (index: number) => {
    moveItem(index, 0);
  };

  const moveToBottom = (index: number) => {
    moveItem(index, items.length - 1);
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      moveItem(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Save changes to backend server (and automatically sync to Google Sheet in background)
  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const result = await onSave(items, initialGoogleScriptUrl, initialGoogleSheetTsvUrl);
      
      if (result?.googleSheetSyncResult && !result.googleSheetSyncResult.success) {
        setStatusMessage({
          type: "error",
          text: "Đã lưu thứ tự nhưng đồng bộ Google Sheet báo lỗi: " + result.googleSheetSyncResult.message
        });
      } else {
        setStatusMessage({
          type: "success",
          text: "✅ Đã lưu thứ tự các giải thành công!"
        });
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: "Không thể lưu thứ tự: " + (err.message || "Lỗi mạng")
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered display
  const filteredIndices = useMemo(() => {
    return items
      .map((race, index) => ({ race, originalIndex: index }))
      .filter(({ race }) => {
        const matchesSearch = !searchTerm || race.toLowerCase().includes(searchTerm.toLowerCase().trim());
        const raceYear = getRaceYear(race);
        let matchesYear = true;
        if (yearFilter === "2026") matchesYear = raceYear === "2026";
        else if (yearFilter === "2025") matchesYear = raceYear === "2025";
        else if (yearFilter === "2019-2024") {
          const yNum = parseInt(raceYear, 10);
          matchesYear = !isNaN(yNum) && yNum >= 2019 && yNum <= 2024;
        }
        return matchesSearch && matchesYear;
      });
  }, [items, searchTerm, yearFilter]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 bg-[#faf6ee] text-[#141414] border-2 border-[#141414] rounded-none shadow-[6px_6px_0px_0px_#141414] overflow-hidden">
        {/* Header - Simple & Clean without redundant buttons */}
        <DialogHeader className="p-4 sm:p-5 border-b-2 border-[#141414] bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-6">
            <div className="p-1.5 bg-[#141414] text-white shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="font-serif font-black text-lg sm:text-xl uppercase tracking-tight text-[#141414]">
                Cài đặt thứ tự các giải chạy
              </DialogTitle>
              <DialogDescription className="font-mono text-[11px] text-[#141414]/70 mt-0.5">
                Kéo thả hoặc dùng mũi tên để sắp xếp thứ tự hiển thị ưu tiên
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Status banner */}
        {statusMessage && (
          <div className={cn(
            "p-3 text-xs font-mono border-b border-[#141414] flex items-center gap-2 shrink-0 transition-all",
            statusMessage.type === "success" ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-red-100 text-red-900 border-red-300"
          )}>
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="p-3 sm:px-4 bg-[#faf6ee] border-b border-[#141414]/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#141414]/50" />
            <Input
              type="text"
              placeholder="Tìm mã giải (vd: NA, QN, 26...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 rounded-none border-[#141414]/40 bg-white font-mono text-xs focus-visible:ring-1 focus-visible:ring-[#141414]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#141414]/40 hover:text-[#141414]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {(["all", "2026", "2025", "2019-2024"] as const).map((yr) => (
              <button
                key={yr}
                onClick={() => setYearFilter(yr)}
                className={cn(
                  "px-2.5 py-1 font-mono text-[10px] uppercase font-bold border transition-colors cursor-pointer",
                  yearFilter === yr
                    ? "bg-[#141414] text-white border-[#141414]"
                    : "bg-white text-[#141414]/70 border-[#141414]/30 hover:bg-[#141414]/5"
                )}
              >
                {yr === "all" ? "Tất cả" : yr}
              </button>
            ))}
          </div>
        </div>

        {/* Race List (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-1.5">
          <div className="text-[11px] font-mono text-[#141414]/60 mb-2 flex items-center justify-between">
            <span>Kéo thả dòng hoặc dùng các nút mũi tên để điều chỉnh thứ tự:</span>
            <span>Tổng cộng: {items.length} giải</span>
          </div>

          {filteredIndices.length === 0 ? (
            <div className="p-8 text-center text-sm font-mono text-[#141414]/50 border border-dashed border-[#141414]/30">
              Không tìm thấy giải nào khớp với "{searchTerm}"
            </div>
          ) : (
            filteredIndices.map(({ race, originalIndex }) => {
              const isTop5 = originalIndex < 5;
              const isTop1 = originalIndex === 0;
              const raceYear = getRaceYear(race);
              const is2026 = raceYear === "2026";
              const isDragged = draggedIndex === originalIndex;
              const isOver = dragOverIndex === originalIndex;

              return (
                <div
                  key={race}
                  draggable
                  onDragStart={(e) => handleDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDrop={(e) => handleDrop(e, originalIndex)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center justify-between p-2 sm:px-3 bg-white border border-[#141414] transition-all group select-none",
                    isTop1 && "border-l-4 border-l-[#ee3260]",
                    isTop5 && !isTop1 && "border-l-2 border-l-[#ee3260]",
                    isDragged && "opacity-40 scale-[0.98]",
                    isOver && "border-t-2 border-t-[#ee3260] bg-[#fff5f7]"
                  )}
                >
                  {/* Left side: Drag handle + Index + Code */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div 
                      className="cursor-grab active:cursor-grabbing text-[#141414]/40 hover:text-[#141414] p-1 -ml-1 transition-colors"
                      title="Giữ chuột và kéo để đổi vị trí"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className={cn(
                      "w-6 h-6 flex items-center justify-center font-mono text-xs font-bold shrink-0",
                      isTop1 ? "bg-[#ee3260] text-white" :
                      isTop5 ? "bg-[#141414] text-white" : "bg-[#faf6ee] text-[#141414] border border-[#141414]/20"
                    )}>
                      {originalIndex + 1}
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-black text-sm tracking-wider text-[#141414]">
                        {race}
                      </span>
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.2 border",
                        is2026 ? "bg-[#141414] text-white border-[#141414]" : "bg-neutral-100 text-neutral-600 border-neutral-300"
                      )}>
                        {raceYear}
                      </span>
                    </div>
                  </div>

                  {/* Right side: Movement Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveToTop(originalIndex)}
                      disabled={originalIndex === 0}
                      title="Đưa lên đầu danh sách (#1)"
                      className="h-7 w-7 rounded-none hover:bg-[#141414] hover:text-white text-[#141414]/70 disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronsUp className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(originalIndex, originalIndex - 1)}
                      disabled={originalIndex === 0}
                      title="Lên 1 bậc"
                      className="h-7 w-7 rounded-none hover:bg-[#141414] hover:text-white text-[#141414]/70 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(originalIndex, originalIndex + 1)}
                      disabled={originalIndex === items.length - 1}
                      title="Xuống 1 bậc"
                      className="h-7 w-7 rounded-none hover:bg-[#141414] hover:text-white text-[#141414]/70 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveToBottom(originalIndex)}
                      disabled={originalIndex === items.length - 1}
                      title="Đưa xuống cuối danh sách"
                      className="h-7 w-7 rounded-none hover:bg-[#141414] hover:text-white text-[#141414]/70 disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronsDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer - Only ONE Save Button alongside Close */}
        <DialogFooter className="p-3 sm:p-4 border-t-2 border-[#141414] bg-white shrink-0 sticky bottom-0 z-20 flex flex-row items-center justify-between sm:justify-between gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <div className="text-[11px] font-mono text-[#141414]/70">
            {hasChanges ? (
              <span className="text-[#ee3260] font-bold flex items-center gap-1">
                Có thay đổi chưa lưu
              </span>
            ) : (
              <span>Thứ tự hiện tại đã lưu</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-none border-2 border-[#141414] font-mono text-xs uppercase font-bold h-8 px-3 hover:bg-[#141414]/10 cursor-pointer"
            >
              Đóng
            </Button>

            {/* The ONLY Save Button */}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-none bg-[#ee3260] text-white hover:bg-[#141414] font-mono text-xs uppercase font-bold h-8 px-4 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu thứ tự</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
