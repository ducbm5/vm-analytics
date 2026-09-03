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
  RotateCcw, 
  Search, 
  Check, 
  Save, 
  Sparkles,
  SlidersHorizontal,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_RACE_ORDER = [
  "NA26", "QN26", "VT26", "NT26", "PT26",
  "SS26", "DN26", "CT26", "CG26", "OM24",
  "HUE26", "HCM26", "AS26", "HP25", "HN25",
  "CT25", "NT25", "DN25", "QN25", "HL25",
  "NA25", "AS25", "HUE25", "HCM25"
];

interface RaceOrderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrder: string[];
  allDetectedRaces: string[];
  onSave: (newOrder: string[]) => Promise<void>;
  updatedAt?: string | null;
}

export function RaceOrderSettingsModal({
  isOpen,
  onClose,
  currentOrder,
  allDetectedRaces,
  onSave,
  updatedAt
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
      // Add any detected races not in order
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
    const yr = "20" + match[0];
    return yr;
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

  // Quick actions
  const prioritize2026 = () => {
    const r26 = items.filter(r => r.endsWith("26"));
    const others = items.filter(r => !r.endsWith("26"));
    setItems([...r26, ...others]);
  };

  const sortByYearDesc = () => {
    const sorted = [...items].sort((a, b) => {
      const yrA = parseInt(a.replace(/\D/g, "") || "0", 10);
      const yrB = parseInt(b.replace(/\D/g, "") || "0", 10);
      if (yrA !== yrB) return yrB - yrA;
      return a.localeCompare(b);
    });
    setItems(sorted);
  };

  const sortAlphabetical = () => {
    setItems([...items].sort((a, b) => a.localeCompare(b)));
  };

  const resetToDefault = () => {
    const combined = [...DEFAULT_RACE_ORDER];
    allDetectedRaces.forEach(r => {
      const upper = r.toUpperCase().trim();
      if (upper && !combined.includes(upper)) {
        combined.push(upper);
      }
    });
    setItems(combined);
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

  // Save changes to backend server
  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await onSave(items);
      setStatusMessage({
        type: "success",
        text: "Đã lưu thứ tự giải thành công! Mọi máy tính truy cập trang sẽ áp dụng ngay thứ tự này."
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: "Không thể lưu thứ tự giải lên máy chủ: " + (err.message || "Lỗi mạng")
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
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b-2 border-[#141414] bg-white shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
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

            {/* Quick prominent Save Button at Header */}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-none bg-[#ee3260] text-white hover:bg-[#141414] font-mono text-xs uppercase font-bold h-8 px-3.5 shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
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
        </DialogHeader>

        {/* Action Controls & Filters */}
        <div className="p-3 sm:p-4 border-b border-[#141414] bg-[#f5efe3] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#141414]/50" />
              <Input
                placeholder="Tìm mã giải (vd: NA, QN, 26...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 rounded-none border-[#141414] bg-white font-mono text-xs focus-visible:ring-1 focus-visible:ring-[#141414]"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#141414]/50 hover:text-[#141414]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Year Filter */}
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "Tất cả" },
                { id: "2026", label: "2026" },
                { id: "2025", label: "2025" },
                { id: "2019-2024", label: "19-24" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setYearFilter(tab.id)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-mono font-bold uppercase border transition-colors cursor-pointer",
                    yearFilter === tab.id
                      ? "bg-[#141414] text-white border-[#141414]"
                      : "bg-white text-[#141414] border-[#141414]/40 hover:bg-[#141414]/10"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-mono text-[#141414]/60 uppercase font-bold mr-1">Xếp nhanh:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={prioritize2026}
              className="h-6 px-2 text-[10px] font-mono uppercase bg-white border-[#141414] hover:bg-[#141414] hover:text-white rounded-none cursor-pointer"
            >
              <Sparkles className="w-2.5 h-2.5 mr-1 text-[#ee3260]" /> Đưa 2026 lên đầu
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sortByYearDesc}
              className="h-6 px-2 text-[10px] font-mono uppercase bg-white border-[#141414] hover:bg-[#141414] hover:text-white rounded-none cursor-pointer"
            >
              Năm mới nhất trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sortAlphabetical}
              className="h-6 px-2 text-[10px] font-mono uppercase bg-white border-[#141414] hover:bg-[#141414] hover:text-white rounded-none cursor-pointer"
            >
              Tên A-Z
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              className="h-6 px-2 text-[10px] font-mono uppercase bg-white border-[#141414] hover:bg-[#141414] hover:text-white rounded-none cursor-pointer ml-auto"
            >
              <RotateCcw className="w-2.5 h-2.5 mr-1" /> Mặc định
            </Button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={cn(
            "p-3 text-xs font-mono border-b flex items-center gap-2",
            statusMessage.type === "success" 
              ? "bg-[#ecfdf5] border-[#10b981] text-[#065f46]" 
              : "bg-[#fef2f2] border-[#ef4444] text-[#991b1b]"
          )}>
            {statusMessage.type === "success" ? <Check className="w-4 h-4 text-[#10b981]" /> : <X className="w-4 h-4 text-[#ef4444]" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Race List (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-1.5">
          <div className="text-[11px] font-mono text-[#141414]/60 mb-2 flex items-center justify-between">
            <span>Kéo thả dòng hoặc dùng các nút mũi tên để điều chỉnh thứ tự:</span>
            <span>Tổng cộng: {items.length} giải</span>
          </div>

          {filteredIndices.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-[#141414]/50 border border-dashed border-[#141414]/30 bg-white/50">
              Không tìm thấy giải chạy nào phù hợp với bộ lọc tìm kiếm.
            </div>
          ) : (
            filteredIndices.map(({ race, originalIndex }) => {
              const yr = getRaceYear(race);
              const is2026 = yr === "2026";
              const isDragging = draggedIndex === originalIndex;
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
                    "flex items-center justify-between p-2 sm:p-2.5 border transition-all bg-white select-none",
                    isDragging && "opacity-40 border-dashed border-[#ee3260] bg-[#faf6ee]",
                    isOver && "border-2 border-[#141414] bg-[#ee3260]/10",
                    !isDragging && !isOver && "border-[#141414]/20 hover:border-[#141414] hover:shadow-xs"
                  )}
                >
                  {/* Left: Drag Handle, Position & Race Info */}
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="cursor-grab active:cursor-grabbing text-[#141414]/40 hover:text-[#141414] p-0.5">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Rank Badge */}
                    <span className="font-mono text-xs font-bold w-7 text-[#141414]/60">
                      #{originalIndex + 1}
                    </span>

                    {/* Race Code Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "font-mono text-xs font-black px-2 py-0.5 border uppercase",
                        is2026 
                          ? "bg-[#141414] text-white border-[#141414]" 
                          : "bg-[#faf6ee] text-[#141414] border-[#141414]/30"
                      )}>
                        {race}
                      </span>
                      <span className="text-[10px] font-mono text-[#141414]/60">
                        {yr}
                      </span>
                    </div>
                  </div>

                  {/* Right: Reorder Control Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={originalIndex === 0}
                      onClick={() => moveToTop(originalIndex)}
                      title="Đưa lên đầu danh sách"
                      className="h-7 w-7 p-0 rounded-none hover:bg-[#141414] hover:text-white cursor-pointer disabled:opacity-20"
                    >
                      <ChevronsUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={originalIndex === 0}
                      onClick={() => moveItem(originalIndex, originalIndex - 1)}
                      title="Di chuyển lên 1 bậc"
                      className="h-7 w-7 p-0 rounded-none hover:bg-[#141414] hover:text-white cursor-pointer disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={originalIndex === items.length - 1}
                      onClick={() => moveItem(originalIndex, originalIndex + 1)}
                      title="Di chuyển xuống 1 bậc"
                      className="h-7 w-7 p-0 rounded-none hover:bg-[#141414] hover:text-white cursor-pointer disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={originalIndex === items.length - 1}
                      onClick={() => moveToBottom(originalIndex)}
                      title="Đưa xuống cuối danh sách"
                      className="h-7 w-7 p-0 rounded-none hover:bg-[#141414] hover:text-white cursor-pointer disabled:opacity-20"
                    >
                      <ChevronsDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 sm:p-4 border-t-2 border-[#141414] bg-white shrink-0 sticky bottom-0 z-20 flex flex-row items-center justify-between sm:justify-between gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <div className="text-[11px] font-mono text-[#141414]/70">
            {hasChanges ? (
              <span className="text-[#ee3260] font-bold flex items-center gap-1">
                ● Có thay đổi thứ tự chưa lưu
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
              Hủy
            </Button>
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
