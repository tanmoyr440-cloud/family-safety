import * as React from "react";
import { useNotifications, type NotificationLogItem } from "../api/useNotifications";
import {
  NotificationFilterBar,
  type NotificationFilters,
} from "../components/NotificationFilterBar";
import { NotificationLogTable } from "../components/NotificationLogTable";
import { PacketPreviewTabs } from "@/features/packet/components/PacketPreviewTabs";
import { ShareManagementCard } from "@/features/packet/components/ShareManagementCard";
import { Skeleton } from "@/shared/ui/Skeleton";
import { Card, CardContent } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { SendEmergencyAlertDialog } from "../components/SendEmergencyAlertDialog";
import { AlertCircle, Bell, Eye, Mail, RefreshCw, Share2 } from "lucide-react";

export const NotificationsPage: React.FC = () => {
  const { data: notifications, isLoading, error, refetch, isFetching } = useNotifications();
  const [activeTab, setActiveTab] = React.useState<"log" | "preview" | "shares">("log");
  const [isSendDialogOpen, setIsSendDialogOpen] = React.useState(false);

  const [filters, setFilters] = React.useState<NotificationFilters>({
    channel: "ALL",
    status: "ALL",
    search: "",
  });

  const filteredItems = (notifications || []).filter((item: NotificationLogItem) => {
    if (filters.channel !== "ALL" && item.channel.toUpperCase() !== filters.channel) {
      return false;
    }
    if (filters.status !== "ALL" && item.status.toUpperCase() !== filters.status) {
      return false;
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const matchRecipient = item.recipient_label.toLowerCase().includes(q);
      const matchTemplate = item.template.toLowerCase().includes(q);
      if (!matchRecipient && !matchTemplate) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-600" aria-hidden="true" />
            Emergency Notifications & Preview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate parent notifications, inspect delivery logs, and manage emergency packet share
            links.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setIsSendDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Send Emergency Alert Email
        </Button>
      </div>

      {/* Main Subtabs Navigation */}
      <div
        className="flex rounded-2xl bg-slate-200/70 p-1.5 w-fit"
        role="tablist"
        aria-label="Notification sections"
      >
        <button
          type="button"
          role="tab"
          id="tab-log"
          aria-controls="tabpanel-log"
          aria-selected={activeTab === "log"}
          onClick={() => setActiveTab("log")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "log"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          Delivery Log
        </button>

        <button
          type="button"
          role="tab"
          id="tab-preview"
          aria-controls="tabpanel-preview"
          aria-selected={activeTab === "preview"}
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "preview"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          Preview as Parent
        </button>

        <button
          type="button"
          role="tab"
          id="tab-shares"
          aria-controls="tabpanel-shares"
          aria-selected={activeTab === "shares"}
          onClick={() => setActiveTab("shares")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "shares"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Active Packet Shares
        </button>
      </div>

      {/* TAB 1: DELIVERY LOG */}
      {activeTab === "log" && (
        <div id="tabpanel-log" role="tabpanel" aria-labelledby="tab-log" className="space-y-4">
          <NotificationFilterBar filters={filters} onChange={setFilters} />

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="space-y-3" aria-label="Loading notifications">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          )}

          {/* Error State with Retry */}
          {!isLoading && error && (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="space-y-2">
                    <h2 className="text-base font-semibold text-red-900">
                      Unable to load delivery log
                    </h2>
                    <p className="text-sm text-red-700">
                      {error.message || "A network or server error occurred. Please try again."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      disabled={isFetching}
                      className="mt-2 border-red-200 text-red-800 hover:bg-red-100"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
                      Retry
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Log Table */}
          {!isLoading && !error && <NotificationLogTable items={filteredItems} />}
        </div>
      )}

      {/* TAB 2: PREVIEW AS PARENT */}
      {activeTab === "preview" && (
        <div id="tabpanel-preview" role="tabpanel" aria-labelledby="tab-preview">
          <PacketPreviewTabs />
        </div>
      )}

      {/* TAB 3: ACTIVE PACKET SHARES */}
      {activeTab === "shares" && (
        <div id="tabpanel-shares" role="tabpanel" aria-labelledby="tab-shares">
          <ShareManagementCard />
        </div>
      )}

      {/* Send Emergency Alert Modal */}
      <SendEmergencyAlertDialog
        open={isSendDialogOpen}
        onOpenChange={setIsSendDialogOpen}
      />
    </div>
  );
};
