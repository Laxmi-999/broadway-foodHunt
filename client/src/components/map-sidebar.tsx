"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, X, Heart, UserCog, Clock } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import OrderDetailPopup from "./order-detail-pop";

interface Category {
  name: string;
  emoji: string;
  locations: { name: string; coordinates: [number, number] }[];
  _id?: string;
}

interface OrderItem {
  _id?: string;
  productId: { name: string };
  description?: string;
  price?: number;
  status?: string;
}

interface SidebarProps {
  foodCategories: Category[];
  selectedCategory: Category;
  onCategoryClick: (category: Category) => void;
}

const MapSidebar: React.FC<SidebarProps> = ({
  foodCategories,
  onCategoryClick,
}) => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get(
        process.env.NEXT_PUBLIC_API_URL + "/orders/"
      );
      if (data && Array.isArray(data.data)) {
        setOrders(data.data);
      } else if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setOrders([]);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const statusColorMap: Record<string, string> = {
    Pending: "bg-slate-100 text-slate-600",
    "In Progress": "bg-blue-50 text-blue-600",
    Completed: "bg-emerald-50 text-emerald-600",
    Cancelled: "bg-red-50 text-red-600",
    Booked: "bg-purple-50 text-purple-600",
  };

  const handleOrderMouseEnter = (orderId?: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (orderId) setHoveredOrderId(orderId);
  };

  const handleOrderMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredOrderId(null);
    }, 2500);
  };

  const handlePopupMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handlePopupMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredOrderId(null);
    }, 2500);
  };

  const handleClosePopup = () => {
    setHoveredOrderId(null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  return (
    <>
      {/* Mini Sidebar Rail */}
      <motion.div
        initial={{ x: 0 }}
        className="fixed top-0 left-0 w-[72px] h-full z-[1002] flex flex-col items-center py-5
                   bg-gradient-to-b from-orange-500 to-orange-600 shadow-xl"
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-2xl text-white hover:bg-white/20 mb-8"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-center gap-6">
          {[
            { icon: Heart, label: "Favorites", action: () => {} },
            { icon: Clock, label: "Recent", action: () => {} },
            {
              icon: UserCog,
              label: "Preferences",
              action: () => router.push("/user-preferences"),
            },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-2xl text-white hover:bg-white/20"
                onClick={item.action}
              >
                <item.icon className="h-5 w-5" />
              </Button>
              <span className="text-[10px] font-medium text-white/90 tracking-wide">
                {item.label}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Expanded Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[1002]"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed top-0 left-0 w-[300px] h-full z-[1003] bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-orange-600 tracking-tight">
                  Food Hunt
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Orders Section */}
              <div className="px-5 pt-4 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Your Orders
                </h3>
              </div>

              <ScrollArea className="flex-1 px-3">
                {orders.length > 0 ? (
                  <div className="space-y-2 pb-4">
                    {orders.map((item) => (
                      <div
                        key={item._id || `order-${item.productId?.name}`}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 cursor-pointer
                                   hover:bg-orange-50/60 hover:border-orange-100 transition-colors"
                        onMouseEnter={() => handleOrderMouseEnter(item._id)}
                        onMouseLeave={handleOrderMouseLeave}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-800 leading-snug">
                            {item.productId?.name || "Unknown Product"}
                          </h4>
                          {item.status && (
                            <span
                              className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                statusColorMap[item.status] ||
                                "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {item.description || "No description"}
                        </p>
                        <p className="text-sm font-bold text-orange-600 mt-2">
                          रु {item.price?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    No orders yet
                  </p>
                )}
              </ScrollArea>

              {/* Categories Section */}
              <div className="border-t border-slate-100 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Categories
                </h3>
                <ScrollArea className="h-[160px]">
                  <div className="space-y-1 pr-2">
                    {foodCategories.map((item, index) => (
                      <Button
                        key={`category-${item.name}-${index}`}
                        variant="ghost"
                        className="w-full justify-start h-10 rounded-xl hover:bg-orange-50 hover:text-orange-700 text-slate-700"
                        onClick={() => {
                          onCategoryClick(item);
                          setIsOpen(false);
                        }}
                      >
                        <span className="mr-2.5 text-lg">{item.emoji}</span>
                        <span className="text-sm font-medium">{item.name}</span>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Order Detail Popup */}
      {hoveredOrderId && (
        <div
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        >
          <OrderDetailPopup
            orderId={hoveredOrderId}
            onClose={handleClosePopup}
          />
        </div>
      )}
    </>
  );
};

export default MapSidebar;