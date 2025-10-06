import { useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { NodeKind } from "./types";
import { Input } from "@/components/ui/input";

interface NodePaletteProps {
  palette: Array<{
    kind: NodeKind;
    label: string;
    icon: React.ReactNode;
    description: string;
  }>;
  onDragStart: (event: React.DragEvent, nodeKind: NodeKind) => void;
}

export function NodePalette({ palette, onDragStart }: NodePaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["mobile", "web", "control"])
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Categorize nodes
  const categories = {
    mobile: {
      title: "Mobile Actions",
      nodes: palette.filter((p) =>
        p.kind.startsWith("Mobile")
      ),
    },
    web: {
      title: "Web Actions",
      nodes: palette.filter(
        (p) =>
          ["GoTo", "Click", "Type", "ScrollTo", "Select", "Extract"].includes(p.kind)
      ),
    },
    control: {
      title: "Control Flow",
      nodes: palette.filter(
        (p) => ["Wait", "Loop", "If", "Else"].includes(p.kind)
      ),
    },
  };

  const filteredCategories = Object.entries(categories).map(([key, cat]) => ({
    key,
    ...cat,
    nodes: cat.nodes.filter(
      (p) =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  }));

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Node Palette
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCategories.map((category) => {
          if (category.nodes.length === 0) return null;

          const isExpanded = expandedCategories.has(category.key);

          return (
            <div key={category.key} className="space-y-1">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.key)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {category.title}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {category.nodes.length}
                </span>
              </button>

              {/* Category Nodes */}
              {isExpanded && (
                <div className="space-y-1 ml-2">
                  {category.nodes.map((node) => (
                    <div
                      key={node.kind}
                      draggable
                      onDragStart={(e) => onDragStart(e, node.kind)}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 hover:shadow-md cursor-grab active:cursor-grabbing transition-all group"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {node.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {node.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {node.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
          <p className="font-medium">💡 Tip: Kéo thả node vào canvas</p>
          <p className="mt-1">Click vào node để chỉnh sửa cấu hình</p>
        </div>
      </div>
    </div>
  );
}
