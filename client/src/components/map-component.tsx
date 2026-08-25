"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { socket } from "@/lib/socket";
import { Minus, Plus, ShoppingCart, Bell, Search } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import L from "leaflet";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "@/redux/reducerSlices/userSlice";
import axios from "axios";
import { toast } from "sonner";
import { addToCart } from "@/redux/reducerSlices/productSlice";
import MapSidebar from "./map-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface MapProps {
  position: [number, number];
  zoom?: number;
}

interface Product {
  _id: string;
  name: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  availableQuantity: number;
  quantity: number;
  category?: { emoji?: string };
  sellerId?: { _id?: string; coords?: { lat?: number; lng?: number } };
}

interface FoodCategory {
  _id?: string;
  name: string;
  emoji: string;
  locations: { name: string; coordinates: [number, number] }[];
  product_ids?: string[];
}

interface ReduxState {
  user: {
    _id?: string;
    isLoggedIn: boolean;
    userPreferences: string[];
  };
  product: {
    cart: Product[];
    aggregatedCart: Product[];
  };
}

const createEmojiIcon = (emoji = "🍽️", discountPercentage = 0, itemCount = 1) => {
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center">
        <div class="discount-text" style="font-size: 13px; font-weight: 700; color: #ef4444; text-shadow: 0 1px 2px rgba(0,0,0,0.15);">
          ${discountPercentage.toFixed(0)}% OFF
        </div>
        <div class="emoji-container" style="font-size: 42px; line-height: 1; position: relative;">
          ${emoji}
          <span class="ripple"></span>
          ${
            itemCount > 1
              ? `<span style="position:absolute; top:-4px; right:-10px; background:#ea580c; color:white; font-size:11px; font-weight:700; line-height:1; padding:3px 6px; border-radius:9999px; box-shadow:0 1px 2px rgba(0,0,0,0.25);">${itemCount}</span>`
              : ""
          }
        </div>
      </div>
      <style>
        .emoji-container { position: relative; display: inline-block; }
        .ripple {
          position: absolute; top: 50%; left: 50%;
          width: 18px; height: 18px;
          background: rgba(194, 65, 12, 0.8);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: ripple-effect 1.4s infinite;
          z-index: -1;
        }
        @keyframes ripple-effect {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; }
        }
        .discount-text {
          animation: pulse-text 1.2s infinite ease-in-out;
        }
        @keyframes pulse-text {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      </style>`,
    className: "custom-emoji-icon",
    iconSize: [56, 70],
    iconAnchor: [28, 70],
    popupAnchor: [0, -60],
  });
};

const MapComponent: React.FC<MapProps> = ({ position, zoom = 12 }) => {
  const { _id, isLoggedIn, userPreferences } = useSelector(
    (state: ReduxState) => state.user
  );
  const [productList, setProductList] = useState<Product[]>([]);
  const { cart: reduxCart } = useSelector((state: ReduxState) => state.product);
  const [productsOfSelectedCategory, setProductsOfSelectedCategory] = useState<FoodCategory[]>([]);
  const [newNotification, setNewNotification] = useState(false);
  const [isLoadingChips, setIsLoadingChips] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>({
    name: "",
    emoji: "",
    locations: [],
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodCategories, setFoodCategories] = useState<FoodCategory[]>([]);
  const fetchedRef = useRef(false);
  const dispatch = useDispatch();

  useEffect(() => {
    const handleOrderId = () => setNewNotification(true);
    socket.on("orderId", handleOrderId);
    return () => {
      void socket.off("orderId", handleOrderId);
    };
  }, []);

  const fetchProducts = async () => {
    if (!userPreferences?.length) return;
    try {
      const preferencesQuery = userPreferences.join(",");
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products?name=${preferencesQuery}&userId=${_id}`
      );
      setProductList(data.map((item: Product) => ({ ...item, quantity: 1 })));
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories`
      );
      setFoodCategories(data as FoodCategory[]);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProductsByProductIds = async (id?: string[]) => {
    const { data } = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/product-search?productIds=${id ? id?.join(",") : ""}`
    );
    const reducedArr: Product[] = data.map((item: Product) => ({
      ...item,
      quantity: 1,
    }));
    setProductList(reducedArr);
  };

  const fetchProductChip = async (catId = "") => {
    setIsLoadingChips(true);
    try {
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/product-chips?categoryId=${catId}`
      );
      if (data?.length > 0) {
        setSelectedCategory(data[0] as FoodCategory);
        if (catId) {
          fetchProductsByProductIds(data[0]?.product_ids);
        }
      }
      setProductsOfSelectedCategory(data as FoodCategory[]);
    } catch (err) {
      console.error("Failed to fetch product chips:", err);
    } finally {
      setIsLoadingChips(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchCategories();
    fetchProductChip();
    fetchProductsByProductIds();
  }, []);

  // Group products by their seller's coordinates so a seller with several
  // items gets ONE marker (with a multi-item popup) instead of one
  // exactly-overlapping marker per product.
  const sellerLocations = useMemo(() => {
    const groups = new Map<
      string,
      { lat: number; lng: number; items: Product[] }
    >();
    productList.forEach((item) => {
      const lat = item.sellerId?.coords?.lat;
      const lng = item.sellerId?.coords?.lng;
      if (!lat || !lng) return;
      const key = `${lat},${lng}`;
      if (!groups.has(key)) groups.set(key, { lat, lng, items: [] });
      groups.get(key)!.items.push(item);
    });
    return Array.from(groups.values());
  }, [productList]);

  const handleLogout = () => dispatch(logoutUser());

  const updateProduct = async (item: Product) => {
    const values = {
      availableQuantity: item.availableQuantity - item.quantity,
    };
    await axios.patch(
      `${process.env.NEXT_PUBLIC_API_URL}/products/update/${item._id}`,
      values
    );
  };

  const handlePlaceOrder = async (item: Product) => {
    const values = {
      bookedById: _id,
      productId: item._id,
      quantity: item.quantity,
      price: item.quantity * item.discountedPrice,
      paymentMethod: "Cash",
    };
    socket.emit("order", _id);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/orders`,
        values
      );
      toast(response.data.message);
      updateProduct(item);
    } catch (error) {
      console.error("Failed to place order:", error);
      toast("Failed to place order");
    }
    fetchProducts();
  };

  const handleCategoryClick = (category: FoodCategory) => {
    fetchProductsByProductIds(category.product_ids);
    setSelectedCategory(category);
    setIsSearchFocused(false);
  };

  const handleSidebarCategoryClick = (category: FoodCategory) => {
    fetchProductChip(category._id);
  };

  const handleDecrement = (clickedItem: Product) => {
    setProductList((prev) =>
      prev.map((item) =>
        item._id === clickedItem._id && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  };

  const handleIncrement = (clickedItem: Product) => {
    setProductList((prev) =>
      prev.map((item) =>
        item._id === clickedItem._id &&
        item.quantity < item.availableQuantity
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const generateCartCount = () =>
    reduxCart.reduce((total, item) => total + item.quantity, 0);

  const handleClick = async (item: Product) => {
    let totalCart = 0;
    reduxCart.forEach((cartItem: Product) => {
      if (cartItem._id === item._id) totalCart += cartItem.quantity;
    });
    if (item.quantity <= item.availableQuantity) {
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stock-count/${item._id}`
      );
      if (data.stockCount >= item.quantity && totalCart <= data.stockCount) {
        dispatch(addToCart(item));
      }
      setProductList((prev) =>
        prev.map((val) =>
          val._id === item._id
            ? {
                ...val,
                availableQuantity: val.availableQuantity - item.quantity,
              }
            : val
        )
      );
    }
  };

  return (
    <div className="relative w-full h-screen bg-slate-50">
      <MapSidebar
        foodCategories={foodCategories}
        selectedCategory={selectedCategory}
        onCategoryClick={handleSidebarCategoryClick}
      />

      <MapContainer
        center={position}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {sellerLocations.map((group, idx) => {
          // Badge the marker with the biggest discount in this seller's stack
          const bestItem = group.items.reduce((max, item) =>
            item.discountPercentage > max.discountPercentage ? item : max
          );
          const customIcon = createEmojiIcon(
            bestItem.category?.emoji,
            bestItem.discountPercentage,
            group.items.length
          );
          return (
            <Marker
              key={`${group.lat}-${group.lng}-${idx}`}
              position={[group.lat, group.lng]}
              icon={customIcon}
            >
              <Popup maxWidth={340} className="rounded-xl overflow-hidden">
                <Card className="border-0 shadow-none">
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      {group.items.length} {group.items.length === 1 ? "item" : "items"} from this seller
                    </p>
                    <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                      {group.items.map((item) => (
                        <div
                          key={item._id}
                          className="rounded-lg border border-slate-100 p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                              {item.name}
                            </h3>
                            <span className="shrink-0 text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                              {item.availableQuantity} left
                            </span>
                          </div>

                          {item.availableQuantity === 0 && (
                            <p className="text-xs text-red-500 font-medium">
                              Currently unavailable
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs text-slate-400 line-through">
                                रु {item.originalPrice}
                              </span>
                              <div className="text-base font-bold text-orange-600">
                                रु {item.discountedPrice}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 bg-slate-100 rounded-full p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-white"
                                onClick={() => handleDecrement(item)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-5 text-center text-xs font-semibold">
                                {item.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-white"
                                onClick={() => handleIncrement(item)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                              onClick={() => handleClick(item)}
                            >
                              Add to Cart
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                              disabled={item.availableQuantity < 1}
                              onClick={() => handlePlaceOrder(item)}
                            >
                              Place Order
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ========== TOP BAR ========== */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 pt-4 flex items-start justify-between gap-4">
          <div className="relative w-72 pointer-events-auto">
            <div className="flex items-center bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-400/50 transition">
              <Search className="h-4 w-4 text-slate-400 ml-3.5 shrink-0" />
              <Input
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-11 text-sm placeholder:text-slate-400"
                type="search"
                placeholder="Search offers for your meal..."
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              />
            </div>

            {isSearchFocused && (
              <Card className="absolute top-13 left-0 w-full mt-1.5 shadow-xl border-slate-200/80 rounded-2xl overflow-hidden z-[1001]">
                <CardHeader className="py-3 px-4 border-b bg-slate-50/80">
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    Suggested Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 max-h-64 overflow-y-auto">
                  {foodCategories.map((category, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="w-full justify-start h-10 rounded-xl hover:bg-orange-50 hover:text-orange-700"
                      onClick={() => handleCategoryClick(category)}
                    >
                      <span className="mr-2.5 text-lg">{category.emoji}</span>
                      <span className="text-sm font-medium">{category.name}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex-1 flex justify-center pointer-events-auto max-w-2xl">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex items-center gap-2 px-1 py-1">
                {isLoadingChips ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-10 w-28 rounded-full shrink-0 bg-white/80"
                    />
                  ))
                ) : (
                  productsOfSelectedCategory.map((category, index) => {
                    const isActive = selectedCategory.name === category.name;
                    return (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        className={`
                          shrink-0 rounded-full h-10 px-4 font-medium text-sm
                          transition-all duration-200 border
                          ${
                            isActive
                              ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200/60 hover:bg-orange-600"
                              : "bg-white/95 text-slate-700 border-slate-200/80 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700"
                          }
                        `}
                        onClick={() => handleCategoryClick(category)}
                      >
                        <span className="mr-1.5 text-base">{category.emoji}</span>
                        {category.name}
                      </Button>
                    );
                  })
                )}
              </div>
              <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>
          </div>

          <div className="flex items-center gap-2.5 pointer-events-auto">
            {isLoggedIn ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 rounded-full bg-white/95 border border-slate-200/80 shadow-sm hover:bg-slate-50"
                  onClick={() => setNewNotification(false)}
                >
                  <Bell className="h-4.5 w-4.5 text-slate-600" />
                  {newNotification && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  className="h-10 rounded-full bg-white/95 border-slate-200/80 shadow-sm hover:bg-slate-50 gap-2 px-4"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {generateCartCount()} items
                  </span>
                </Button>

                <Button
                  onClick={handleLogout}
                  className="h-10 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-sm px-5"
                >
                  Logout
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login">
                  <Button
                    variant="outline"
                    className="h-10 rounded-full bg-white/95 border-slate-200 shadow-sm"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="h-10 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-sm">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-white shadow-sm">
                  <AvatarImage
                    src="https://img.freepik.com/premium-vector/young-man-avatar-character-due-avatar-man-vector-icon-cartoon-illustration_1186924-4438.jpg?semt=ais_hybrid&w=740"
                    alt="User"
                  />
                  <AvatarFallback className="bg-orange-100 text-orange-700">
                    U
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Billing</DropdownMenuItem>
                <DropdownMenuItem>Team</DropdownMenuItem>
                <DropdownMenuItem>Subscription</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;