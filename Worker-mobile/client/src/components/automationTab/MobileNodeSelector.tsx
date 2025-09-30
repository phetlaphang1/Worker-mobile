import { useState } from "react";
import { X, Search, ChevronRight, Plus } from "lucide-react";
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
        className="fixed inset-0 bg-black/60 z-[100] animate-in fade-in backdrop-blur-sm"
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-[101] animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
        {/* Header with search and close */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Node</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10">
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-base rounded-2xl border-2"
            />
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {filteredPalette.map((p) => (
            <button
              key={p.kind}
              onClick={() => handleSelectNode(p.kind)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 active:scale-[0.97] transition-all"
              style={{ minHeight: '80px' }}
            >
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                {p.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold text-gray-900 dark:text-white">{p.label}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{p.description}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
