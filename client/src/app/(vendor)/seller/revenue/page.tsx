"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarIcon,
  CreditCard,
  Moon,
  RefreshCw,
  ShoppingBag,
  Sun,
  Trophy,
  Wallet,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderItem = {
  _id: string;
  name: string;
  quantity: number;
  discountedPrice: number;
};

type Order = {
  _id: string;
  bookedById?: { email: string };
  items: OrderItem[];
  price: number;
  status: "Pending" | "Preparing" | "Ready" | "Delivered" | "Cancelled";
  createdAt: string;
  paymentMethod: string;
};

type TrendPoint = { date: string; revenue: number; sortKey: number };
type BreakdownItem = { name: string; value: number; fill: string };

// ---------------------------------------------------------------------------
// Design tokens shared with the dashboard / orders pages
// ---------------------------------------------------------------------------

const orangePalette = ["#F97316", "#EA580C", "#C2410C", "#9A3412", "#7C2D12"];

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  preparing: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ready: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const getStatusStyle = (status?: string) =>
  (status && statusStyles[status.toLowerCase()]) ||
  "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300";

const formatMoney = (value: number) =>
  `NPR ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};
const endOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RevenuePage = () => {
  const { _id } = useSelector((state: { user: { _id?: string } }) => state.user);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [breakdownView, setBreakdownView] = useState<"items" | "payment">("items");

  // Default window: trailing 30 days, so the page opens with a real overview
  // instead of an empty state.
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d;
  });
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/orders?sellerId=${_id}`
      );
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      console.error("Error fetching revenue data:", err);
      setError("Failed to load revenue data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (_id) fetchOrders();
    // eslint-disable-next-line
  }, [_id]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const inRange = (order: Order, from?: Date, to?: Date) => {
    if (!from || !to) return true;
    const created = new Date(order.createdAt);
    return created >= startOfDay(from) && created <= endOfDay(to);
  };

  const currentOrders = useMemo(
    () => orders.filter((o) => inRange(o, startDate, endDate)),
    [orders, startDate, endDate]
  );

  // Equal-length preceding window, used purely for the trend arrows.
  const previousOrders = useMemo(() => {
    if (!startDate || !endDate) return [];
    const spanMs = endOfDay(endDate).getTime() - startOfDay(startDate).getTime();
    const prevEnd = new Date(startOfDay(startDate).getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    return orders.filter((o) => {
      const created = new Date(o.createdAt).getTime();
      return created >= prevStart.getTime() && created <= prevEnd.getTime();
    });
  }, [orders, startDate, endDate]);

  const revenueOf = (list: Order[]) =>
    list.filter((o) => o.status !== "Cancelled").reduce((sum, o) => sum + (o.price || 0), 0);

  const totalRevenue = revenueOf(currentOrders);
  const previousRevenue = revenueOf(previousOrders);
  const revenueDelta =
    previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : null;

  const billableOrders = currentOrders.filter((o) => o.status !== "Cancelled");
  const totalOrders = billableOrders.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const topItem = useMemo(() => {
    const counts: Record<string, number> = {};
    billableOrders.forEach((o) =>
      o.items?.forEach((item) => {
        counts[item.name] = (counts[item.name] || 0) + item.quantity;
      })
    );
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { name: sorted[0][0], qty: sorted[0][1] } : null;
  }, [billableOrders]);

  const trendData = useMemo<TrendPoint[]>(() => {
    const map = billableOrders.reduce<Record<string, { revenue: number; date: Date }>>(
      (acc, o) => {
        const d = new Date(o.createdAt);
        const key = d.toISOString().split("T")[0];
        if (!acc[key]) acc[key] = { revenue: 0, date: d };
        acc[key].revenue += o.price || 0;
        return acc;
      },
      {}
    );
    return Object.values(map)
      .map((v) => ({
        date: v.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: v.revenue,
        sortKey: v.date.getTime(),
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [billableOrders]);

  const itemBreakdown = useMemo<BreakdownItem[]>(() => {
    const counts: Record<string, number> = {};
    billableOrders.forEach((o) =>
      o.items?.forEach((item) => {
        counts[item.name] = (counts[item.name] || 0) + item.quantity;
      })
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], i) => ({ name, value, fill: orangePalette[i % orangePalette.length] }));
  }, [billableOrders]);

  const paymentBreakdown = useMemo<BreakdownItem[]>(() => {
    const counts: Record<string, number> = {};
    billableOrders.forEach((o) => {
      if (o.paymentMethod) counts[o.paymentMethod] = (counts[o.paymentMethod] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value], i) => ({
      name,
      value,
      fill: orangePalette[i % orangePalette.length],
    }));
  }, [billableOrders]);

  const recentTransactions = useMemo(
    () =>
      [...currentOrders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [currentOrders]
  );

  const hasDateFilter = Boolean(startDate || endDate);

  const EmptyState = ({ label }: { label: string }) => (
    <div className="flex h-[220px] items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
      {label}
    </div>
  );

  const SegmentedControl = ({
    options,
    value,
    onChange,
  }: {
    options: { label: string; value: string }[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="inline-flex items-center rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-neutral-50 px-8 py-12 dark:bg-neutral-950">
        <div className="mx-auto w-full max-w-[1600px]">
          <Skeleton className="mb-2 h-9 w-40" />
          <Skeleton className="mb-8 h-4 w-64" />
          <div className="mb-8 flex gap-8 border-b border-neutral-200 pb-6 dark:border-neutral-800">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-32" />
            ))}
          </div>
          <Skeleton className="mb-6 h-[280px] w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-[300px] w-full rounded-xl" />
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Alert
          variant="destructive"
          className="max-w-md rounded-lg border-red-200 bg-red-50 dark:bg-red-900/40"
        >
          <AlertCircleIcon className="h-5 w-5 text-red-600" />
          <AlertTitle className="font-semibold text-red-800 dark:text-red-200">Error</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className={cn("min-h-screen w-full bg-neutral-50 dark:bg-neutral-950", darkMode && "dark")}>
      <div className="mx-auto w-full max-w-[1600px] px-8 py-12">
        {/* Header — title + subtitle, date range, refresh / theme controls */}
        <div className="mb-8 flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
              Revenue
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {startDate && endDate
                ? `Showing ${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`
                : "Track your earnings, orders, and payout activity"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 justify-start border-neutral-300 text-sm font-normal dark:border-neutral-700",
                    !startDate && "text-neutral-500 dark:text-neutral-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-lg border-neutral-200 p-0 dark:border-neutral-800">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>

            <span className="text-sm text-neutral-400">–</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 justify-start border-neutral-300 text-sm font-normal dark:border-neutral-700",
                    !endDate && "text-neutral-500 dark:text-neutral-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-lg border-neutral-200 p-0 dark:border-neutral-800">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>

            {hasDateFilter && (
              <button
                onClick={clearDateFilter}
                aria-label="Clear date filter"
                className="grid h-9 w-9 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="ml-1 flex items-center gap-1 border-l border-neutral-200 pl-2 dark:border-neutral-800">
              <button
                onClick={fetchOrders}
                aria-label="Refresh"
                className="grid h-9 w-9 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={toggleDarkMode}
                aria-label="Toggle theme"
                className="grid h-9 w-9 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mb-8 flex flex-wrap items-center gap-8 border-b border-neutral-200 pb-6 dark:border-neutral-800">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <Wallet className="h-3.5 w-3.5 text-orange-500" /> Total Revenue
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                {formatMoney(totalRevenue)}
              </p>
              {revenueDelta !== null && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    revenueDelta >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {revenueDelta >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(revenueDelta).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-800" />
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <ShoppingBag className="h-3.5 w-3.5 text-blue-500" /> Total Orders
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {totalOrders}
            </p>
          </div>
          <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-800" />
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <CreditCard className="h-3.5 w-3.5 text-violet-500" /> Avg / Order
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {formatMoney(avgOrder)}
            </p>
          </div>
          <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-800" />
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <Trophy className="h-3.5 w-3.5 text-emerald-500" /> Top Item
            </p>
            <p className="mt-1 truncate text-2xl font-semibold text-neutral-900 dark:text-white">
              {topItem ? topItem.name : "—"}
            </p>
          </div>
        </div>

        {/* Hero: revenue trend */}
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                Revenue Trend
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Daily earnings across the selected period
              </p>
            </div>
          </div>

          {trendData.length > 0 ? (
            <ChartContainer
              config={{ revenue: { label: "Revenue", color: orangePalette[0] } }}
              className="h-[280px] w-full"
            >
              <AreaChart data={trendData} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={orangePalette[0]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={orangePalette[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={darkMode ? "#333" : "#eee"} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  fontSize={12}
                  stroke={darkMode ? "#a3a3a3" : "#737373"}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                  stroke={darkMode ? "#a3a3a3" : "#737373"}
                />
                <ChartTooltip
                  cursor={{ stroke: orangePalette[0], strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent className="rounded-lg border border-neutral-200 bg-white p-3 shadow-md dark:border-neutral-700 dark:bg-neutral-800" />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  stroke={orangePalette[0]}
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                  dot={{ r: 3, fill: orangePalette[0] }}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyState label="No revenue in this period" />
          )}
        </div>

        {/* Breakdown + payment method */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                {breakdownView === "items" ? "Top Selling Items" : "Payment Methods"}
              </h2>
              <SegmentedControl
                value={breakdownView}
                onChange={(v) => setBreakdownView(v as "items" | "payment")}
                options={[
                  { label: "Items", value: "items" },
                  { label: "Payment", value: "payment" },
                ]}
              />
            </div>

            {breakdownView === "items" ? (
              itemBreakdown.length > 0 ? (
                <ChartContainer
                  config={{ value: { label: "Units Sold", color: orangePalette[2] } }}
                  className="h-[220px] w-full"
                >
                  <BarChart
                    data={itemBreakdown}
                    layout="vertical"
                    margin={{ left: 12, right: 24, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} stroke={darkMode ? "#333" : "#eee"} />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={110}
                      fontSize={12}
                      stroke={darkMode ? "#a3a3a3" : "#737373"}
                    />
                    <ChartTooltip
                      cursor={{ fill: orangePalette[2], opacity: 0.08 }}
                      content={
                        <ChartTooltipContent className="rounded-lg border border-neutral-200 bg-white p-3 shadow-md dark:border-neutral-700 dark:bg-neutral-800" />
                      }
                    />
                    <Bar dataKey="value" fill={orangePalette[2]} radius={4} maxBarSize={18} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <EmptyState label="No item sales in this period" />
              )
            ) : paymentBreakdown.length > 0 ? (
              <ChartContainer
                config={{ value: { label: "Orders", color: orangePalette[1] } }}
                className="h-[220px] w-full"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent className="rounded-lg border border-neutral-200 bg-white p-3 shadow-md dark:border-neutral-700 dark:bg-neutral-800" />
                    }
                  />
                  <Pie
                    data={paymentBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    strokeWidth={2}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  />
                </PieChart>
              </ChartContainer>
            ) : (
              <EmptyState label="No payment data in this period" />
            )}
          </div>

          {/* Recent activity list */}
          <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                Recent Activity
              </h2>
            </div>
            {recentTransactions.length > 0 ? (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {recentTransactions.map((order) => (
                  <div
                    key={order._id}
                    className="flex items-center justify-between px-6 py-3.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {formatMoney(order.price)}{" "}
                        <span className="font-normal text-neutral-500 dark:text-neutral-400">
                          from {order.items?.[0]?.name ?? "Order"}
                          {order.items?.length > 1 ? ` +${order.items.length - 1} more` : ""}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {format(new Date(order.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        getStatusStyle(order.status)
                      )}
                    >
                      {order.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="No activity in this period" />
            )}
          </div>
        </div>

        {/* Full transactions table */}
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Transactions
            </h2>
            {hasDateFilter && (
              <span className="text-xs text-neutral-400">Filtered by selected date range</span>
            )}
          </div>

          {currentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    <th className="px-6 py-3 font-medium">Order</th>
                    <th className="px-6 py-3 font-medium">Items</th>
                    <th className="px-6 py-3 font-medium">Payment</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                    <th className="px-6 py-3 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {[...currentOrders]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((order) => (
                      <tr
                        key={order._id}
                        className="text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
                      >
                        <td className="px-6 py-3 font-mono text-xs text-neutral-500">
                          {order._id.slice(-8)}
                        </td>
                        <td className="px-6 py-3">
                          {order.items?.slice(0, 2).map((item) => (
                            <div key={item._id}>
                              {item.quantity}x {item.name}
                            </div>
                          ))}
                          {order.items?.length > 2 && (
                            <div className="text-xs text-neutral-500">
                              +{order.items.length - 2} more
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3">{order.paymentMethod || "—"}</td>
                        <td className="px-6 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                              getStatusStyle(order.status)
                            )}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-medium tabular-nums text-neutral-900 dark:text-white">
                          {formatMoney(order.price)}
                        </td>
                        <td className="px-6 py-3 text-right text-neutral-500 dark:text-neutral-400">
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No transactions in the selected range" />
          )}
        </div>
      </div>
    </div>
  );
};

export default RevenuePage;