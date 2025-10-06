import { useState, useEffect } from "react";
import { Node } from "reactflow";
import { NodeData } from "./types";
import { Copy, Trash2, Edit, Info } from "lucide-react";

interface NodeContextMenuProps {
  node: Node<NodeData> | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onDuplicate: (node: Node<NodeData>) => void;
  onDelete: (nodeId: string) => void;
  onEdit: (nodeId: string) => void;
  onInfo: (node: Node<NodeData>) => void;
}

export const NodeContextMenu = ({
  node,
  position,
  onClose,
  onDuplicate,
  onDelete,
  onEdit,
  onInfo
}: NodeContextMenuProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (position && node) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [position, node]);

  useEffect(() => {
    const handleClick = () => {
      onClose();
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [visible, onClose]);

  if (!visible || !position || !node) return null;

  const menuItems = [
    {
      icon: <Edit className="w-4 h-4" />,
      label: "Edit Node",
      onClick: () => {
        onEdit(node.id);
        onClose();
      }
    },
    {
      icon: <Copy className="w-4 h-4" />,
      label: "Duplicate",
      onClick: () => {
        onDuplicate(node);
        onClose();
      }
    },
    {
      icon: <Info className="w-4 h-4" />,
      label: "Node Info",
      onClick: () => {
        onInfo(node);
        onClose();
      }
    },
    {
      divider: true
    },
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: "Delete",
      onClick: () => {
        onDelete(node.id);
        onClose();
      },
      destructive: true
    }
  ];

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => {
        if (item.divider) {
          return <div key={index} className="border-t border-gray-200 my-1" />;
        }

        return (
          <button
            key={index}
            className={`
              w-full px-3 py-2 text-sm flex items-center gap-2
              hover:bg-gray-100 transition-colors text-left
              ${item.destructive ? "text-red-600 hover:bg-red-50" : "text-gray-700"}
            `}
            onClick={item.onClick}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};