import * as React from "react";
import { Filter, Search } from "lucide-react";

export interface NotificationFilters {
  channel: string;
  status: string;
  search: string;
}

export interface NotificationFilterBarProps {
  filters: NotificationFilters;
  onChange: (filters: NotificationFilters) => void;
}

export const NotificationFilterBar: React.FC<NotificationFilterBarProps> = ({
  filters,
  onChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-xs">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          aria-label="Search notifications by recipient or template"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search by recipient or template..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium">Filter:</span>
        </div>

        {/* Channel select */}
        <select
          value={filters.channel}
          onChange={(e) => onChange({ ...filters, channel: e.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by delivery channel"
        >
          <option value="ALL">All Channels</option>
          <option value="SMS">SMS</option>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
        </select>

        {/* Status select */}
        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by delivery status"
        >
          <option value="ALL">All Statuses</option>
          <option value="DELIVERED">Delivered</option>
          <option value="SENT">Sent</option>
          <option value="QUEUED">Queued</option>
          <option value="FAILED">Failed</option>
          <option value="DEAD">Dead (Exhausted)</option>
        </select>
      </div>
    </div>
  );
};
