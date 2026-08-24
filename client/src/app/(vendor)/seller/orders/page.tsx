"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bell, ChefHat, Clock, Eye, MoreHorizontal, Search, User } from "lucide-react";
import axios from "axios";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type OrderStatus = "Pending" | "Preparing" | "Ready" | "Delivered" | "Cancelled";

interface OrderItem {
  _id: string;
  name: string;
  quantity: number;
  discountedPrice: number;
}

interface Order {
  _id: string;
  bookedById: { email: string };
  items: OrderItem[];
  price: number;
  status: OrderStatus;
  createdAt: string;
  paymentMethod: string;
}

const statusColors: Record<OrderStatus, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Preparing: "bg-blue-50 text-blue-700 border-blue-200",
  Ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Delivered: "bg-neutral-100 text-neutral-600 border-neutral-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

const formatPrice = (value: number) => `Rs. ${value.toFixed(2)}`;

export default function SellerOrderPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Pagination logic with ellipses
  const generatePaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, page - halfVisible);
    let endPage = Math.min(totalPages, page + halfVisible);

    if (endPage - startPage + 1 < maxVisiblePages) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      } else {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key="1">
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage(1);
            }}
            className={page === 1 ? "bg-orange-600 text-white hover:bg-orange-700" : ""}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage(i);
            }}
            className={page === i ? "bg-orange-600 text-white hover:bg-orange-700" : ""}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage(totalPages);
            }}
            className={page === totalPages ? "bg-orange-600 text-white hover:bg-orange-700" : ""}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await axios.patch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}`, {
        status: newStatus,
      });
      setOrders(
        orders.map((order) => (order._id === orderId ? { ...order, status: newStatus } : order))
      );
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  const fetchOrders = async () => {
    try {
      const {
        data: { orders, totalDbOrders },
      } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/orders?pageSize=5&page=${page}`);
      setOrders(orders);
      setTotalOrders(totalDbOrders);
      setTotalPages(Math.ceil(totalDbOrders / 5));
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line
  }, [page]);

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case "Pending":
        return <Clock className="h-3.5 w-3.5" />;
      case "Preparing":
        return <ChefHat className="h-3.5 w-3.5" />;
      case "Ready":
        return <Bell className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  // These reflect only the currently loaded page (5 orders) since the API
  // doesn't yet expose global status/revenue aggregates — labeled accordingly below.
  const pendingCount = orders.filter((o) => o.status === "Pending").length;
  const preparingCount = orders.filter((o) => o.status === "Preparing").length;
  const readyCount = orders.filter((o) => o.status === "Ready").length;
  const pageRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.bookedById?.email?.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      order._id.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen w-full bg-neutral-50 px-8 py-12">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* Page header */}
        <div className="mb-8 flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Order Management
            </h1>
            <p className="mt-1 text-sm text-neutral-500">Manage your restaurant orders</p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700">
            <Bell className="h-4 w-4 text-orange-500" />
            {totalOrders} Total Orders
          </span>
        </div>

        {/* Stat strip — pending/preparing/ready reflect the current page only */}
        <div className="mb-8 flex flex-wrap items-center gap-8 border-b border-neutral-200 pb-6">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <Clock className="h-3.5 w-3.5 text-amber-500" /> Pending
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
              {pendingCount}
            </p>
            <p className="text-[11px] text-neutral-400">on this page</p>
          </div>
          <div className="h-10 w-px bg-neutral-200" />
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <ChefHat className="h-3.5 w-3.5 text-blue-500" /> Preparing
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
              {preparingCount}
            </p>
            <p className="text-[11px] text-neutral-400">on this page</p>
          </div>
          <div className="h-10 w-px bg-neutral-200" />
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <Bell className="h-3.5 w-3.5 text-emerald-500" /> Ready
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
              {readyCount}
            </p>
            <p className="text-[11px] text-neutral-400">on this page</p>
          </div>
          <div className="h-10 w-px bg-neutral-200" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Revenue</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
              {formatPrice(pageRevenue)}
            </p>
            <p className="text-[11px] text-neutral-400">on this page</p>
          </div>
        </div>

        {/* Orders panel */}
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Orders</h2>
              <p className="text-xs text-neutral-500">{totalOrders} total</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  placeholder="Search by email or order ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border-neutral-300 pl-9 focus-visible:ring-orange-200 sm:w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full border-neutral-300 sm:w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Preparing">Preparing</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-neutral-500">
                      No orders match your search or filter on this page.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order._id}>
                      <TableCell className="font-mono text-xs text-neutral-500">
                        {order._id.slice(-8)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-neutral-400" />
                          <span className="font-medium text-neutral-800">
                            {order.bookedById?.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-sm">
                          {order.items?.slice(0, 2).map((item) => (
                            <div key={item._id}>
                              {item.quantity}x {item.name}
                            </div>
                          ))}
                          {order.items?.length > 2 && (
                            <div className="text-xs text-neutral-500">
                              +{order.items.length - 2} more items
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-neutral-900">
                        {formatPrice(order.price)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`flex w-fit items-center gap-1 ${statusColors[order.status]}`}
                        >
                          {getStatusIcon(order.status)}
                          <span>{order.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-neutral-500">
                        {new Date(order.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {order.status === "Pending" && (
                                <DropdownMenuItem
                                  onClick={() => updateOrderStatus(order._id, "Preparing")}
                                >
                                  Start Preparing
                                </DropdownMenuItem>
                              )}
                              {order.status === "Preparing" && (
                                <DropdownMenuItem
                                  onClick={() => updateOrderStatus(order._id, "Ready")}
                                >
                                  Mark as Ready
                                </DropdownMenuItem>
                              )}
                              {order.status === "Ready" && (
                                <DropdownMenuItem
                                  onClick={() => updateOrderStatus(order._id, "Delivered")}
                                >
                                  Mark as Delivered
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => updateOrderStatus(order._id, "Cancelled")}
                              >
                                Cancel Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center border-t border-neutral-100 px-6 py-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                    className={page === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>

                {generatePaginationItems()}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                    className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">
                Order Details — {selectedOrder._id.slice(-8)}
              </h2>
              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Customer Info */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-neutral-900">
                  Customer Information
                </h3>
                <div className="space-y-1.5 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-700">
                  <p>
                    <span className="font-medium text-neutral-900">Email:</span>{" "}
                    {selectedOrder.bookedById?.email}
                  </p>
                  <p>
                    <span className="font-medium text-neutral-900">Payment Method:</span>{" "}
                    {selectedOrder.paymentMethod}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-neutral-900">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-neutral-900">{item.name}</p>
                        <p className="text-neutral-500">Quantity: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-neutral-900">
                        {formatPrice(item.quantity * item.discountedPrice)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="flex items-center justify-between border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">
                <span>Total Amount</span>
                <span>{formatPrice(selectedOrder.price)}</span>
              </div>

              {/* Status Update Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedOrder.status === "Pending" && (
                  <Button
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => {
                      updateOrderStatus(selectedOrder._id, "Preparing");
                      setSelectedOrder(null);
                    }}
                  >
                    Start Preparing
                  </Button>
                )}
                {selectedOrder.status === "Preparing" && (
                  <Button
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => {
                      updateOrderStatus(selectedOrder._id, "Ready");
                      setSelectedOrder(null);
                    }}
                  >
                    Mark as Ready
                  </Button>
                )}
                {selectedOrder.status === "Ready" && (
                  <Button
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => {
                      updateOrderStatus(selectedOrder._id, "Delivered");
                      setSelectedOrder(null);
                    }}
                  >
                    Mark as Delivered
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => {
                    updateOrderStatus(selectedOrder._id, "Cancelled");
                    setSelectedOrder(null);
                  }}
                >
                  Cancel Order
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}