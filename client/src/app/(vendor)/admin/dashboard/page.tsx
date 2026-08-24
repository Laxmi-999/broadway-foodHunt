"use client";

import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  CheckCircle2,
  ShoppingCart,
  Clock,
  RefreshCw,
  Moon,
  Sun,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Order = {
  createdAt: string;
  status?: string;
  price?: number;
};

type OrderData = { orders: Order[]; totalDbOrders: number };

// ---------------------------------------------------------------------------
// Design tokens — shared with the rest of the app (orange accent, neutral base)
// ---------------------------------------------------------------------------

const statusMeta: Record<string, { label: string; color: string }> = {
  Pending: { label: "Pending", color: "#F6A719" },
  "In Progress": { label: "In Progress", color: "#FB5700" },
  Completed: { label: "Completed", color: "#10B981" },
  Cancelled: { label: "Cancelled", color: "#EF4444" },
  Booked: { label: "Booked", color: "#8B5CF6" },
};

const chartConfig: ChartConfig = {
  count: { label: "Orders" },
  ...Object.fromEntries(
    Object.entries(statusMeta).map(([key, { label, color }]) => [key, { label, color }])
  ),
};

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "#FB5700" },
} satisfies ChartConfig;

const formatMoney = (value: number) =>
  `NPR ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Dashboard = () => {
  const [orderData, setOrderData] = useState<OrderData>({ orders: [], totalDbOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/orders`);
      setOrderData(response.data);
    } catch (err) {
      console.error("Error fetching order data:", err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const orders = orderData.orders ?? [];

  // All-time KPI totals — the four headline cards should never disagree with
  // each other, so they're all computed from the same unfiltered order list.
  const totalOrders = orderData.totalDbOrders;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0);
  const completedOrders = orders.filter((o) => o.status === "Completed").length;
  const pendingOrders = orders.filter((o) => o.status === "Pending").length;

  // Last-30-days slice, used only for the "current distribution" donut so its
  // "recent" framing stays honest rather than silently mixing scopes.
  const recentOrders = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return orders.filter((o) => new Date(o.createdAt) >= cutoff);
  }, [orders]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    recentOrders.forEach((o) => {
      if (o.status) counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(statusMeta)
      .map(([status, meta]) => ({ status, count: counts[status] || 0, fill: meta.color }))
      .filter((d) => d.count > 0);
  }, [recentOrders]);

  const revenueData = useMemo(() => {
    const monthlyTotals: Record<string, number> = {};
    orders.forEach((o) => {
      const month = new Date(o.createdAt).toLocaleString("default", { month: "short" });
      monthlyTotals[month] = (monthlyTotals[month] || 0) + (o.price || 0);
    });
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    // Trim trailing months with no data yet so the line doesn't trail off
    // into a flat, meaningless tail for months that haven't happened.
    const currentMonthIndex = new Date().getMonth();
    return months
      .slice(0, currentMonthIndex + 1)
      .map((month) => ({ month, revenue: monthlyTotals[month] || 0 }));
  }, [orders]);

  const revenueTrend = useMemo(() => {
    if (revenueData.length < 2) return null;
    const last = revenueData[revenueData.length - 1].revenue;
    const prev = revenueData[revenueData.length - 2].revenue;
    if (prev === 0) return null;
    return ((last - prev) / prev) * 100;
  }, [revenueData]);

  const EmptyState = ({ label }: { label: string }) => (
    <div className="flex h-[220px] items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
      {label}
    </div>
  );

  // -------------------------------------------------------------------------
  // Loading / error
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-8 h-4 w-72" />
        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Skeleton className="h-[380px] w-full rounded-xl xl:col-span-2" />
          <Skeleton className="h-[380px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 dark:bg-neutral-950">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900 dark:bg-red-900/30">
          <p className="font-semibold text-red-800 dark:text-red-200">Something went wrong</p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  const stats = [
    {
      label: "Total Orders",
      value: totalOrders.toLocaleString(),
      sub: `${recentOrders.length} in the last 30 days`,
      icon: ShoppingCart,
      accent: "text-orange-600 bg-orange-50 dark:bg-orange-500/10",
    },
    {
      label: "Total Revenue",
      value: formatMoney(totalRevenue),
      sub: `${formatMoney(revenueData[revenueData.length - 1]?.revenue || 0)} this month`,
      icon: BarChart3,
      accent: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    },
    {
      label: "Completed Orders",
      value: completedOrders.toLocaleString(),
      sub: totalOrders > 0 ? `${((completedOrders / totalOrders) * 100).toFixed(0)}% of all orders` : "—",
      icon: CheckCircle2,
      accent: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "Pending Orders",
      value: pendingOrders.toLocaleString(),
      sub: "Awaiting action",
      icon: Clock,
      accent: "text-violet-600 bg-violet-50 dark:bg-violet-500/10",
    },
  ];

  return (
    <div className={cn("min-h-screen bg-neutral-50 dark:bg-neutral-950", darkMode && "dark")}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Monitor your business performance and analytics
            </p>
          </div>
          <div className="flex items-center gap-1">
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

        {/* KPI cards */}
        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, sub, icon: Icon, accent }) => (
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
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{sub}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Revenue overview */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 xl:col-span-2 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                Revenue Overview
              </h2>
            </div>
            <p className="mb-5 text-xs text-neutral-500 dark:text-neutral-400">
              Monthly revenue for the current year
            </p>

            {revenueData.some((d) => d.revenue > 0) ? (
              <ChartContainer config={revenueChartConfig} className="h-[260px] w-full">
                <AreaChart data={revenueData} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FB5700" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#FB5700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={darkMode ? "#333" : "#eee"} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                    stroke={darkMode ? "#a3a3a3" : "#737373"}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                    stroke={darkMode ? "#a3a3a3" : "#737373"}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "#FB5700", strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Area
                    dataKey="revenue"
                    type="monotone"
                    stroke="#FB5700"
                    strokeWidth={2.5}
                    fill="url(#adminRevenueFill)"
                    dot={{ r: 3, fill: "#FB5700" }}
                    activeDot={{ r: 5, stroke: "#FB5700", strokeWidth: 2, fill: "#FFFFFF" }}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyState label="No revenue recorded yet" />
            )}

            <div className="mt-5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {revenueTrend !== null ? (
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium",
                    revenueTrend >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {revenueTrend >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {revenueTrend >= 0 ? "Trending up" : "Trending down"} by{" "}
                  {Math.abs(revenueTrend).toFixed(1)}% vs last month
                </div>
              ) : (
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  Not enough data yet for a month-over-month comparison
                </p>
              )}
              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                Showing total revenue for the year to date
              </p>
            </div>
          </div>

          {/* Order status */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                Order Status
              </h2>
            </div>
            <p className="mb-5 text-xs text-neutral-500 dark:text-neutral-400">
              Distribution over the last 30 days
            </p>

            {statusData.length > 0 ? (
              <>
                <div className="relative mx-auto max-w-[220px]">
                  <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[220px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
                      <Pie
                        data={statusData}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={62}
                        outerRadius={90}
                        strokeWidth={3}
                        stroke="#FFFFFF"
                        paddingAngle={statusData.length > 1 ? 2 : 0}
                      />
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                      {recentOrders.length}
                    </span>
                    <span className="text-[11px] text-neutral-400">orders</span>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  {statusData.map((item) => (
                    <div key={item.status} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        {item.status}
                      </span>
                      <span className="font-medium tabular-nums text-neutral-900 dark:text-white">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState label="No orders in the last 30 days" />
            )}

            <div className="mt-5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                Updated in real-time
              </div>
              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                Refresh to pull the latest order activity
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;