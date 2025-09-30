import { useState } from "react";
import { X, Search, ChevronRight } from "lucide-react";
import { NodeKind } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MobileNodeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (kind: NodeKind) => void;
  palette: Array<{
    kind: NodeKind;
    label: string;
    icon: React.ReactNode;
    description: string;
  }>;
}

export function MobileNodeSelector({
  isOpen,
  onClose,
  onSelectNode,
  palette,
}: MobileNodeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredPalette = palette.filter(
    (p) =>
      p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectNode = (kind: NodeKind) => {
    onSelectNode(kind);
    onClose();
    setSearchQuery("");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100] animate-in fade-in"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-[101] animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 rounded-t-3xl">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Add Automation Node
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base rounded-xl border-2 border-gray-200 focus:border-blue-400"
            />
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredPalette.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No nodes found</p>
            </div>
          ) : (
            filteredPalette.map((p) => (
              <button
                key={p.kind}
                onClick={() => handleSelectNode(p.kind)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 hover:shadow-md active:scale-[0.98] transition-all duration-200"
              >
                <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-600 dark:text-blue-400">
                  {p.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900 dark:text-white text-base">
                    {p.label}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {p.description}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}