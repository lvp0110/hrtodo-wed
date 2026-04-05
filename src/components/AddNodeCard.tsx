import { Handle, Position } from "@xyflow/react";
import { ADD_NODE_WIDTH, ADD_NODE_HEIGHT } from "#/lib/orgTreeLayout";

export function AddNodeCard() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        style={{ width: ADD_NODE_WIDTH, height: ADD_NODE_HEIGHT }}
        className="group flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 cursor-pointer transition-colors shadow-sm"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-current transition-colors">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className="text-sm font-medium">Добавить отдел</span>
      </div>
    </>
  );
}
