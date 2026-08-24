"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircleIcon,
  Clock,
  RefreshCw,
  Sun,
  Moon,
  X,
  ShoppingBag,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Pie,
  PieChart,
  Line,
  LineChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Order = {
  createdAt: string;
  status?: string;
  quantity?: number;
  paymentMethod?: string;
  productId?: {
    name?: string;
    discountedPrice?: number;
  };
};

type StatusChartItem = {
  name: string;
  value: number;
  fill: string;
};

type RevenueChartItem = {
  date: string;
  totalRevenue: number;
  sortKey: number;
};

type ProductSalesChartItem = {
  name: string;
  quantitySold: number;
  fill: string;
};

const Dashboard = () => {
  const router = useRouter();
  const { _id } = useSelector((state: { user: { _id?: string } }) => state.user);
  const [kycStatus, setKycStatus] = useState({
    isKycSubmitted: false,
    isKycApproved: false,
  });
  const [ordersData, setOrdersData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [orderStatusChartData, setOrderStatusChartData] = useState<StatusChartItem[]>([]);
  const [dailyRevenueChartData, setDailyRevenueChartData] = useState<RevenueChartItem[]>([]);
  const [productSalesChartData, setProductSalesChartData] = useState<ProductSalesChartItem[]>([]);
  const [paymentMethodChartData, setPaymentMethodChartData] = useState<StatusChartItem[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Which chart is shown inside each panel (collapses 4 boxes into 2)
  const [leftView, setLeftView] = useState<"status" | "payment">("status");
  const [rightView, setRightView] = useState<"revenue" | "sales">("revenue");

  const orangePalette = ["#F97316", "#EA580C", "#C2410C", "#9A3412", "#7C2D12"];

  //1.ensures orders is an array, 2. filters orders by date range, 3.stores filter data on processedOrders for generating charts data
  const processChartData = (orders: Order[]) => {
    const filteredOrders = Array.isArray(orders) ? orders : [];
    let processedOrders = filteredOrders;

    if (startDate && endDate) {
      processedOrders = filteredOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        return orderDate >= startOfDay && orderDate <= endOfDay;
      });
    }
   

    //counts the same status order
    const statusCounts = processedOrders.reduce<Record<string, number>>((acc, order) => {
      if (order.status) acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    //creates objects with name status and counts
    const statusData = Object.keys(statusCounts).map((status, index) => ({
      name: status,
      value: statusCounts[status],
      fill: orangePalette[index % orangePalette.length],
    }));
    setOrderStatusChartData(statusData);

    //for dalily reveneu chart
    const dailyRevenueMap = processedOrders.reduce<
      Record<string, { totalRevenue: number; originalDate: Date }>
    >((acc, order) => {
      if (
        order.productId &&
        typeof order.productId.discountedPrice !== "undefined" &&
        typeof order.quantity !== "undefined"
      ) {
        const dateObj = new Date(order.createdAt);
        const dateKey = dateObj.toISOString().split("T")[0];
        const revenue = order.quantity * order.productId.discountedPrice;

        if (!acc[dateKey]) {
          acc[dateKey] = { totalRevenue: 0, originalDate: dateObj };
        }
        acc[dateKey].totalRevenue += revenue;
      }
      return acc;
    }, {});

    const revenueData = Object.keys(dailyRevenueMap)
      .map((dateKey) => ({
        date: new Date(dateKey).toLocaleString("en-US", { month: "short", day: "numeric" }), //like aug1,jan12 ect
        totalRevenue: dailyRevenueMap[dateKey].totalRevenue,
        sortKey: dailyRevenueMap[dateKey].originalDate.getTime(), //(earliest to latest).
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
    setDailyRevenueChartData(revenueData);

    //for product sale chart
    const productSales = processedOrders.reduce<Record<string, number>>((acc, order) => {
      const productName = order.productId?.name || "Unknown Product";
      if (order.quantity) {
        acc[productName] = (acc[productName] || 0) + order.quantity;
      }
      return acc;
    }, {});
    const productSalesData = Object.keys(productSales).map((name, index) => ({
      name,
      quantitySold: productSales[name],
      fill: orangePalette[index % orangePalette.length],
    }));
    setProductSalesChartData(productSalesData);

    // for payment methods chart
    const paymentMethodCounts = processedOrders.reduce<Record<string, number>>((acc, order) => {
      if (order.paymentMethod) {
        acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1;
      }
      return acc;
    }, {});
    const paymentMethodData = Object.keys(paymentMethodCounts).map((method, index) => ({
      name: method,
      value: paymentMethodCounts[method],
      fill: orangePalette[index % orangePalette.length],
    }));
    setPaymentMethodChartData(paymentMethodData);
  };

  const fetchChartData = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/orders?sellerId=${_id}`
      );
      const orders = Array.isArray(data.orders) ? data.orders : [];
      setOrdersData(orders);
      processChartData(orders);
    } catch (err) {
      console.error("Error fetching chart data:", err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchKycStatus = async () => {
      try {
        const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/kycs/${_id}`);
        setKycStatus(data);
      } catch (error) {
        console.error("Failed to fetch KYC status", error);
      }
    };

    if (_id) {
      fetchKycStatus();
      fetchChartData();
    }
  }, [_id]);

  useEffect(() => {
    if (Array.isArray(ordersData)) {
      processChartData(ordersData);
    }
  }, [startDate, endDate, ordersData]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const totalOrders = ordersData.length;
  const totalRevenue = dailyRevenueChartData.reduce((sum, data) => sum + data.totalRevenue, 0);
  const hasDateFilter = Boolean(startDate || endDate);

  // Same date-range filter the charts use, applied to the recent orders list
  const filteredOrders = (() => {
    if (!startDate || !endDate) return ordersData;
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    return ordersData.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startOfDay && orderDate <= endOfDay;
    });
  })();

  const recentOrders = [...filteredOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const statusStyles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    processing: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    cancelled: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  const getStatusStyle = (status?: string) =>
    (status && statusStyles[status.toLowerCase()]) ||
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300";
     const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Small reusable segmented control used inside each chart panel
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

  const EmptyState = ({ label }: { label: string }) => (
    <div className="flex h-[220px] items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
      {label}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="mx-auto max-w-[1600px] px-8 py-8">
          <Skeleton className="mb-8 h-9 w-48" />
          <div className="mb-8 flex gap-8 border-b border-neutral-200 pb-6 dark:border-neutral-800">
            <Skeleton className="h-14 w-32" />
            <Skeleton className="h-14 w-32" />
          </div>
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800"
              >
                <Skeleton className="mb-4 h-6 w-32" />
                <Skeleton className="h-[220px] w-full" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
            <Skeleton className="mb-4 h-6 w-32" />
            <Skeleton className="h-40 w-full" />
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
          <AlertTitle className="font-semibold text-red-800 dark:text-red-200">
            Error
          </AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-neutral-50 dark:bg-neutral-950", darkMode && "dark")}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-8 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
              Seller Dashboard
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {getGreeting()} — here&apos;s how your store is doing today,{" "}
              {format(new Date(), "EEEE, MMM d")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              <ShoppingBag className="h-4 w-4 text-orange-500" />
              {totalOrders} Orders
            </span>

            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              <Wallet className="h-4 w-4 text-emerald-500" />
              NPR {totalRevenue.toFixed(2)}
            </span>

            {kycStatus.isKycApproved && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Verified Seller
              </span>
            )}

            <div className="ml-1 flex items-center gap-1 border-l border-neutral-200 pl-2 dark:border-neutral-800">
              <button
                onClick={fetchChartData}
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
      </header>

      <main className="mx-auto max-w-[1600px] px-8 py-8">
        {/* KYC Alerts */}
        {kycStatus.isKycSubmitted && !kycStatus.isKycApproved && (
          <Alert className="mb-6 rounded-lg border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/30">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="font-semibold text-blue-800 dark:text-blue-200">
              KYC Under Review
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Your documents are being reviewed. This typically takes 24–48 hours.
            </AlertDescription>
          </Alert>
        )}

        {!kycStatus.isKycSubmitted && !kycStatus.isKycApproved && (
          <Alert className="mb-6 rounded-lg border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/30">
            <AlertCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="font-semibold text-amber-800 dark:text-amber-200">
              Complete your KYC
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <p className="mb-3">To access all features, please complete your KYC verification.</p>
              <Button
                onClick={() => router.push("/seller/kyc")}
                size="sm"
                className="bg-orange-600 font-medium text-white hover:bg-orange-700"
              >
                Fill KYC now
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {kycStatus.isKycApproved && (
          <>
            {/* Stat strip + date filter — replaces the old boxed summary card */}
            <div className="mb-8 flex flex-col gap-6 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Total Orders
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                    {totalOrders}
                  </p>
                </div>
                <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-800" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Total Revenue
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                    NPR {totalRevenue.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
              </div>
            </div>

            {/* Two panels instead of four boxes — each panel switches chart via a tab */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left panel: Order Status / Payment Methods */}
              <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                    {leftView === "status" ? "Order Status" : "Payment Methods"}
                  </h2>
                  <SegmentedControl
                    value={leftView}
                    onChange={(v) => setLeftView(v as "status" | "payment")}
                    options={[
                      { label: "Status", value: "status" },
                      { label: "Payment", value: "payment" },
                    ]}
                  />
                </div>

                {leftView === "status" ? (
                  orderStatusChartData.length > 0 ? (
                    <ChartContainer
                      config={{ value: { label: "Orders", color: orangePalette[0] } }}
                      className="h-[220px] w-full"
                    >
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent className="rounded-lg border border-neutral-200 bg-white p-3 shadow-md dark:border-neutral-700 dark:bg-neutral-800" />}
                        />
                        <Pie
                          data={orderStatusChartData}
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
                    <EmptyState label="No order status data available" />
                  )
                ) : paymentMethodChartData.length > 0 ? (
                  <ChartContainer
                    config={{ value: { label: "Orders", color: orangePalette[3] } }}
                    className="h-[220px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent className="rounded-lg border border-neutral-200 bg-white p-3 shadow-md dark:border-neutral-700 dark:bg-neutral-800" />}
                      />
                      <Pie
                        data={paymentMethodChartData}
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
                  <EmptyState label="No payment method data available" />
                )}
              </div>

              {/* Right panel: Daily Revenue / Product Sales */}
              <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                    {rightView === "revenue" ? "Daily Revenue (NPR)" : "Product Sales"}
                  </h2>
                  <SegmentedControl
                    value={rightView}
                    onChange={(v) => setRightView(v as "revenue" | "sales")}
                    options={[
                      { label: "Revenue", value: "revenue" },
                      { label: "Sales", value: "sales" },
                    ]}
                  />
                </div>

                {rightView === "revenue" ? (
                  dailyRevenueChartData.length > 0 ? (
                    <ChartContainer
                      config={{ totalRevenue: { label: "Revenue", color: orangePalette[1] } }}
                      className="h-[220px] w-full"
                    >
                      <LineChart data={dailyRevenueChartData} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
                        <CartesianGrid vertical={false} stroke={darkMode ? "#333" : "#eee"} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          minTickGap={20}
                          fontSize={12}
                          stroke={darkMode ? "#a3a3a3" : "#737373"}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `${value}`}
                          tickMargin={8}
                          fontSize={12}
                          stroke={darkMode ? "#a3a3a3" : "#737373"}
                        />
                        <ChartTooltip
                          cursor={{ stroke: orangePalette[1], strokeWidth: 1 }}
                          content={<ChartTooltipContent className="rounded-lg border border-neutral-200 bg-white p-3 shadow-md dark:border-neutral-700 dark:bg-neutral-800" />}
                        />
                        <Line
                          dataKey="totalRevenue"
                          type="monotone"
                          stroke={orangePalette[1]}
                          strokeWidth={2}
                          dot={{ r: 3, fill: orangePalette[1] }}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <EmptyState label="No revenue data available" />
                  )
                ) : productSalesChartData.length > 0 ? (
                  <ChartContainer
                    config={{ quantitySold: { label: "Quantity Sold", color: orangePalette[2] } }}
                    className="h-[220px] w-full"
                  >
                    <BarChart data={productSalesChartData} margin={{ left: 12, right: 12, top: 10, bottom: 30 }}>
                      <CartesianGrid vertical={false} stroke={darkMode ? "#333" : "#eee"} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        fontSize={12}
                        height={50}
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
                        cursor={{ fill: orangePalette[2], opacity: 0.08 }}
                        content={<ChartTooltipContent className="rounded-lg border border-neutral-200 bg-white p-3 shadow-md dark:border-neutral-700 dark:bg-neutral-800" />}
                      />
                      <Bar dataKey="quantitySold" fill={orangePalette[2]} radius={4} maxBarSize={28} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <EmptyState label="No product sales data available" />
                )}
              </div>
            </div>

            {/* Recent Orders — fills the remaining page space with real, scrolling data */}
            <div className="mt-6 rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                  Recent Orders
                </h2>
                {hasDateFilter && (
                  <span className="text-xs text-neutral-400">Filtered by selected date range</span>
                )}
              </div>

              {recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        <th className="px-6 py-3 font-medium">Product</th>
                        <th className="px-6 py-3 font-medium">Qty</th>
                        <th className="px-6 py-3 font-medium">Payment</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 text-right font-medium">Amount</th>
                        <th className="px-6 py-3 text-right font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {recentOrders.map((order, index) => {
                        const amount =
                          order.quantity && order.productId?.discountedPrice
                            ? order.quantity * order.productId.discountedPrice
                            : undefined;
                        return (
                          <tr
                            key={index}
                            className="text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
                          >
                            <td className="px-6 py-3 font-medium text-neutral-900 dark:text-white">
                              {order.productId?.name || "Unknown Product"}
                            </td>
                            <td className="px-6 py-3 tabular-nums">{order.quantity ?? "—"}</td>
                            <td className="px-6 py-3">{order.paymentMethod || "—"}</td>
                            <td className="px-6 py-3">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                  getStatusStyle(order.status)
                                )}
                              >
                                {order.status || "Unknown"}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums">
                              {amount !== undefined ? `NPR ${amount.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-6 py-3 text-right text-neutral-500 dark:text-neutral-400">
                              {format(new Date(order.createdAt), "MMM d, yyyy")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState label="No orders in the selected range" />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;