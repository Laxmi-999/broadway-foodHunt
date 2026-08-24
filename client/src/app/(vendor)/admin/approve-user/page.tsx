"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface KycItem {
  _id: string;
  seller: {
    name: string;
    email: string;
    phoneNumber: string;
    location: string;
  };
  status: string;
}

const getInitials = (name?: string) =>
  name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const avatarPalette = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
];

const UserApprovalCard = () => {
  const [kycs, setKycs] = useState<KycItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Session-only counters — the API only exposes the current pending queue,
  // so "reviewed" reflects actions taken in this session rather than a
  // persisted history that doesn't exist yet.
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  const fetchKycs = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/kycs?status=pending`);
      setKycs(data);
    } catch (error) {
      toast.error("Failed to fetch KYC data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycs();
  }, []);

  const handleApproval = async (id: string, action: "approve" | "reject") => {
    try {
      setProcessingIds((prev) => [...prev, id]);
      const { data } = await axios.patch(`${process.env.NEXT_PUBLIC_API_URL}/kycs/${id}`, {
        status: action,
      });
      if (data) {
        toast.success(`User ${action}d successfully`);
        setKycs((prev) => prev.filter((item) => item._id !== id));
        if (action === "approve") setApprovedCount((c) => c + 1);
        else setRejectedCount((c) => c + 1);
      }
    } catch (error) {
      toast.error(`Failed to ${action} user`);
    } finally {
      setProcessingIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const filteredKycs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return kycs;
    return kycs.filter(
      (item) =>
        item.seller?.name?.toLowerCase().includes(term) ||
        item.seller?.email?.toLowerCase().includes(term)
    );
  }, [kycs, searchTerm]);

  const stats = [
    {
      label: "Pending Review",
      value: kycs.length,
      icon: ShieldCheck,
      accent: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    },
    {
      label: "Approved",
      value: approvedCount,
      icon: UserCheck,
      accent: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "Rejected",
      value: rejectedCount,
      icon: UserX,
      accent: "text-red-600 bg-red-50 dark:bg-red-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            Seller Approval
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Review pending KYC submissions before sellers go live
          </p>
        </div>
        <button
          onClick={fetchKycs}
          aria-label="Refresh"
          className="grid h-9 w-9 place-items-center self-start rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:self-auto dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {label}
              </p>
              <span className={cn("grid h-8 w-8 place-items-center rounded-lg", accent)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Pending Requests
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {kycs.length} awaiting review
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border-neutral-300 pl-9 focus-visible:ring-orange-200 sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : kycs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
              <ClipboardCheck className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
              You&apos;re all caught up
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
              There are no seller KYC requests waiting on review right now. New submissions will
              show up here automatically.
            </p>
            <Button
              onClick={fetchKycs}
              variant="outline"
              size="sm"
              className="mt-5 border-neutral-300 dark:border-neutral-700"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Check again
            </Button>
          </div>
        ) : filteredKycs.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No requests match &quot;{searchTerm}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {filteredKycs.map((item, index) => (
                    <motion.tr
                      key={item._id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                              avatarPalette[index % avatarPalette.length]
                            )}
                          >
                            {getInitials(item.seller?.name)}
                          </span>
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-white">
                              {item.seller?.name || "Unnamed seller"}
                            </p>
                            <p className="text-xs text-neutral-400">ID: {item._id.slice(-8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-300">
                        {item.seller?.email || "—"}
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-300">
                        {item.seller?.phoneNumber || "—"}
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-300">
                        {item.seller?.location || "Not provided"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Pending
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => handleApproval(item._id, "approve")}
                            disabled={processingIds.includes(item._id)}
                            size="sm"
                            className="bg-orange-600 text-white hover:bg-orange-700"
                          >
                            {processingIds.includes(item._id) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            onClick={() => handleApproval(item._id, "reject")}
                            disabled={processingIds.includes(item._id)}
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-900/20"
                          >
                            {processingIds.includes(item._id) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserApprovalCard;