"use client";
import React, { useState, useEffect, type ChangeEvent } from "react";
import { Formik, Form, Field, ErrorMessage, type FormikHelpers } from "formik";
import * as Yup from "yup";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { toast } from "sonner";
import Image from "next/image";
import {
  Plus,
  X,
  UploadCloud,
  ImageOff,
  Calendar as CalendarIcon,
  Package,
  User,
  Mail,
  Phone,
  PackageSearch,
  Search,
} from "lucide-react";

const productSchema = Yup.object().shape({
  name: Yup.string().min(3).max(100).required("Name is required"),
  description: Yup.string()
    .min(10)
    .max(500)
    .required("Description is required"),
  category: Yup.string().required("Category is required"),
  originalPrice: Yup.number().min(0).required("Original price is required"),
  discountedPrice: Yup.number()
    .min(0)
    .required("Discounted price is required")
    .test(
      "is-less-than-original",
      "Must be ≤ original price",
      function (value) {
        return value <= this.parent.originalPrice;
      }
    ),
  discountPercentage: Yup.number().min(0).max(100),
  expiryDate: Yup.date()
    .min(new Date(), "Expiry date must be in the future")
    .required("Expiry date is required"),
  availableQuantity: Yup.number().min(1).required("Quantity is required"),
  isAvailable: Yup.boolean(),
  status: Yup.string().oneOf([
    "active",
    "sold-out",
    "expired",
    "draft",
    "unavailable",
  ]),
});

const statuses = ["active", "Sold-Out", "Expired", "Draft", "Unavailable"];

// Consistent field styling — neutral border by default, orange only on focus
const fieldClass =
  "w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100";
const labelClass = "mb-1.5 block text-sm font-medium text-neutral-700";
const errorClass = "mt-1 text-xs font-medium text-red-500";

const statusStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "sold-out": "bg-red-50 text-red-700 border border-red-200",
  expired: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  draft: "bg-blue-50 text-blue-700 border border-blue-200",
  unavailable: "bg-amber-50 text-amber-700 border border-amber-200",
};

const formatPrice = (value: number) => `Rs. ${value.toFixed(2)}`;

type Category = {
  _id: string;
  name: string;
};

type Seller = {
  name?: string;
  email?: string;
  phoneNumber?: string;
};

type Product = {
  _id: string;
  imageName?: string;
  name: string;
  description: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  category?: Category | string;
  status: string;
  expiryDate: string;
  availableQuantity: number;
  sellerId?: Seller;
};

type ProductFormValues = {
  name: string;
  description: string;
  category: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  expiryDate: string;
  availableQuantity: number;
  isAvailable: boolean;
  status: string;
};

type ReduxUser = {
  isLoggedIn?: boolean;
  role?: string;
  email?: string;
  _id?: string;
};

const Products = () => {
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const user = useSelector((state: { user: ReduxUser }) => state.user);
  const { isLoggedIn, role, _id } = user;

  const fetchCategories = async () => {
    const { data } = await axios.get(`${API_BASE_URL}/categories`);
    setCategories(data);
  };

  const [products, setProducts] = useState<Product[]>([]);
  const fetchProducts = async () => {
    const { data } = await axios.get(
      `${API_BASE_URL}/products?sellerId=${_id}`
    );
    setProducts(data);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line
  }, []);

  const dispatch = useDispatch();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  const initialValues = {
    name: "",
    description: "",
    category: "",
    originalPrice: 0,
    discountedPrice: 0,
    discountPercentage: 0,
    expiryDate: "",
    availableQuantity: 1,
    isAvailable: true,
    status: "draft",
  };

  const [uplodedFiles, setUplodedFiles] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const handleSubmit = async (
    values: ProductFormValues,
    { setSubmitting, resetForm }: FormikHelpers<ProductFormValues>
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!values.discountPercentage && values.originalPrice > 0) {
        values.discountPercentage =
          ((values.originalPrice - values.discountedPrice) /
            values.originalPrice) *
          100;
      }
      const formData = new FormData();
      if (uplodedFiles) {
        formData.append("uplodedFiles", uplodedFiles);
      }
      formData.append("name", values.name);
      formData.append("description", values.description);
      formData.append("category", values.category);
      formData.append("originalPrice", String(values.originalPrice));
      formData.append("discountedPrice", String(values.discountedPrice));
      formData.append("discountPercentage", String(values.discountPercentage));
      formData.append("expiryDate", values.expiryDate);
      formData.append("availableQuantity", String(values.availableQuantity));
      formData.append("isAvailable", String(values.isAvailable));
      formData.append("status", values.status);
      if (_id) {
        formData.append("sellerId", _id);
      }

      const { data } = await axios.post(`${API_BASE_URL}/products`, formData);
      if (data) fetchProducts();
      toast.success("Product added successfully!");
      resetForm();
      setUplodedFiles(null);
      setShowForm(false);
    } catch (err: unknown) {
      console.error("Error adding product:", err);
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.error || "Failed to add product"
        : "Failed to add product";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
      setIsLoading(false);
    }
  };

  const totalProducts = products.length;
  const activeCount = products.filter((p) => p.status?.toLowerCase() === "active").length;
  const soldOutCount = products.filter((p) => p.status?.toLowerCase() === "sold-out").length;
  const lowStockCount = products.filter(
    (p) =>
      p.status?.toLowerCase() === "active" &&
      p.availableQuantity > 0 &&
      p.availableQuantity <= 5
  ).length;

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase());
    const matchesStatus =
      statusFilter === "all" || product.status?.toLowerCase() === statusFilter;
    const productCategoryId =
      typeof product.category === "object" ? product.category?._id : product.category;
    const matchesCategory = categoryFilter === "all" || productCategoryId === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="min-h-screen w-full bg-neutral-50 px-8 py-12">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* Page header — title on the left, primary action on the right */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-8 flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Your Products
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Manage your listings and keep your menu fresh for buyers.
            </p>
          </div>

          {isLoggedIn && role === "seller" ? (
            <Button
              onClick={() => setShowForm(!showForm)}
              disabled={isLoading}
              className="gap-2 self-start rounded-full bg-orange-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 sm:self-auto"
            >
              {showForm ? (
                <>
                  <X className="h-4 w-4" /> Close Form
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add New Food Product
                </>
              )}
            </Button>
          ) : (
            <p className="text-sm font-medium text-red-500">
              Only sellers can add products. Please log in as a seller.
            </p>
          )}
        </motion.div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            <strong className="font-semibold">Error: </strong>
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-4 text-sm text-neutral-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
            Loading products...
          </div>
        )}

        {/* Stat strip — quick read on catalog health at a glance */}
        {totalProducts > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-8 border-b border-neutral-200 pb-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Total Products
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
                {totalProducts}
              </p>
            </div>
            <div className="h-10 w-px bg-neutral-200" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Active
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
                {activeCount}
              </p>
            </div>
            <div className="h-10 w-px bg-neutral-200" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Low Stock
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">
                {lowStockCount}
              </p>
            </div>
            <div className="h-10 w-px bg-neutral-200" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Sold Out
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-600">
                {soldOutCount}
              </p>
            </div>
          </div>
        )}

        {/* Add product form */}
        <AnimatePresence>
          {showForm && isLoggedIn && role === "seller" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-12 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
            >
              <div className="border-b border-neutral-100 px-8 py-5">
                <h2 className="text-lg font-semibold text-neutral-900">New Product</h2>
                <p className="text-sm text-neutral-500">
                  Fill in the details below — required fields are marked as you go.
                </p>
              </div>

              <Formik
                initialValues={initialValues}
                validationSchema={productSchema}
                onSubmit={handleSubmit}
                enableReinitialize={true}
              >
                {({ isSubmitting, setFieldValue, values }) => (
                  <Form className="space-y-8 px-8 py-6">
                    {/* Basic details */}
                    <fieldset className="space-y-4">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        Basic Details
                      </legend>
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                          <label className={labelClass}>Product Name</label>
                          <Field
                            type="text"
                            name="name"
                            className={fieldClass}
                            placeholder="e.g. Steam Chicken Momo"
                          />
                          <ErrorMessage name="name" component="div" className={errorClass} />
                        </div>

                        <div>
                          <label className={labelClass}>Category</label>
                          <Field as="select" name="category" className={fieldClass}>
                            <option value="" disabled>
                              Select a category
                            </option>
                            {categories.map((cat) => (
                              <option key={cat._id} value={cat._id}>
                                {cat.name}
                              </option>
                            ))}
                          </Field>
                          <ErrorMessage name="category" component="div" className={errorClass} />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Description</label>
                        <Field
                          as="textarea"
                          name="description"
                          className={`${fieldClass} h-28 resize-none`}
                          placeholder="Describe your food product — ingredients, taste, what makes it special"
                        />
                        <ErrorMessage name="description" component="div" className={errorClass} />
                      </div>

                      <div>
                        <label className={labelClass}>Product Image</label>
                        <label
                          htmlFor="productImageInput"
                          className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-sm text-neutral-500 transition-colors hover:border-orange-400 hover:bg-orange-50"
                        >
                          <UploadCloud className="h-5 w-5 shrink-0 text-neutral-400" />
                          {uplodedFiles ? (
                            <span className="truncate font-medium text-neutral-700">
                              {uplodedFiles.name}
                            </span>
                          ) : (
                            <span>Click to upload a photo of the dish (JPG or PNG)</span>
                          )}
                        </label>
                        <input
                          id="productImageInput"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setUplodedFiles(e.target.files?.[0] ?? null)
                          }
                        />
                      </div>
                    </fieldset>

                    {/* Pricing */}
                    <fieldset className="space-y-4">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        Pricing &amp; Discount
                      </legend>
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        <div>
                          <label className={labelClass}>Original Price (Rs.)</label>
                          <Field
                            type="number"
                            name="originalPrice"
                            className={fieldClass}
                            placeholder="0.00"
                          />
                          <ErrorMessage name="originalPrice" component="div" className={errorClass} />
                        </div>

                        <div>
                          <label className={labelClass}>Discounted Price (Rs.)</label>
                          <Field
                            type="number"
                            name="discountedPrice"
                            className={fieldClass}
                            placeholder="0.00"
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              setFieldValue("discountedPrice", e.target.value);
                              const original = values.originalPrice;
                              const discounted = parseFloat(e.target.value);
                              if (original > 0 && discounted <= original) {
                                setFieldValue(
                                  "discountPercentage",
                                  ((original - discounted) / original) * 100
                                );
                              } else {
                                setFieldValue("discountPercentage", 0);
                              }
                            }}
                          />
                          <ErrorMessage name="discountedPrice" component="div" className={errorClass} />
                        </div>

                        <div>
                          <label className={labelClass}>Discount</label>
                          <Field
                            type="number"
                            name="discountPercentage"
                            readOnly
                            value={
                              values.discountPercentage
                                ? values.discountPercentage.toFixed(2)
                                : ""
                            }
                            className={`${fieldClass} cursor-not-allowed bg-neutral-100 text-neutral-500`}
                            placeholder="Calculated automatically"
                          />
                          <ErrorMessage name="discountPercentage" component="div" className={errorClass} />
                        </div>
                      </div>
                    </fieldset>

                    {/* Availability */}
                    <fieldset className="space-y-4">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        Availability
                      </legend>
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        <div>
                          <label className={labelClass}>Expiry Date</label>
                          <Field type="date" name="expiryDate" className={fieldClass} />
                          <ErrorMessage name="expiryDate" component="div" className={errorClass} />
                        </div>

                        <div>
                          <label className={labelClass}>Available Quantity</label>
                          <Field
                            type="number"
                            name="availableQuantity"
                            className={fieldClass}
                            placeholder="1"
                          />
                          <ErrorMessage name="availableQuantity" component="div" className={errorClass} />
                        </div>

                        <div>
                          <label className={labelClass}>Status</label>
                          <Field as="select" name="status" className={fieldClass}>
                            {statuses.map((status) => (
                              <option key={status} value={status.toLowerCase()}>
                                {status}
                              </option>
                            ))}
                          </Field>
                          <ErrorMessage name="status" component="div" className={errorClass} />
                        </div>
                      </div>

                      <label className="flex w-fit items-center gap-2 text-sm font-medium text-neutral-700">
                        <Field
                          type="checkbox"
                          name="isAvailable"
                          className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                        />
                        Available for purchase
                      </label>
                    </fieldset>

                    <div className="flex justify-end border-t border-neutral-100 pt-6">
                      <Button
                        type="submit"
                        disabled={isSubmitting || isLoading}
                        className="rounded-full bg-orange-600 px-8 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
                      >
                        {isSubmitting || isLoading ? "Submitting..." : "Submit Product"}
                      </Button>
                    </div>
                  </Form>
                )}
              </Formik>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product listing */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-neutral-900">Available Food Products</h2>
            {totalProducts > 0 && (
              <span className="text-sm text-neutral-500">
                {filteredProducts.length} of {totalProducts}
              </span>
            )}
          </div>

          {totalProducts > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 sm:w-56"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-8 text-sm text-neutral-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status.toLowerCase()}>
                    {status}
                  </option>
                ))}
              </select>

              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-8 text-sm text-neutral-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="all">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {totalProducts === 0 && !isLoading && !error ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
            <PackageSearch className="mb-3 h-10 w-10 text-neutral-300" />
            <p className="text-neutral-500">No products available yet.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
            <Search className="mb-3 h-10 w-10 text-neutral-300" />
            <p className="text-neutral-500">No products match your filters.</p>
            <button
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setCategoryFilter("all");
              }}
              className="mt-3 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const categoryName =
                typeof product.category === "object" ? product.category?.name : undefined;
              const statusKey = product.status?.toLowerCase();

              return (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                    {product.imageName ? (
                      <Image
                        src={`http://localhost:8080/images/${product.imageName}`}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) =>
                          (e.currentTarget.src =
                            "https://placehold.co/600x450/f5f5f5/a3a3a3?text=No+Image")
                        }
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-300">
                        <ImageOff className="h-8 w-8" />
                        <span className="text-xs font-medium">No image available</span>
                      </div>
                    )}

                    {product.discountPercentage > 0 && (
                      <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                        {product.discountPercentage.toFixed(0)}% OFF
                      </span>
                    )}

                    <span
                      className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                        statusStyles[statusKey] ||
                        "border border-neutral-200 bg-white text-neutral-600"
                      }`}
                    >
                      {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-5">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold leading-snug text-neutral-900">
                        {product.name}
                      </h3>
                    </div>

                    {categoryName && (
                      <span className="mb-2 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {categoryName}
                      </span>
                    )}

                    <p className="mb-4 line-clamp-2 text-sm text-neutral-500">
                      {product.description}
                    </p>

                    <div className="mb-4 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-neutral-900">
                        {formatPrice(product.discountedPrice)}
                      </span>
                      {product.discountPercentage > 0 && (
                        <span className="text-sm text-neutral-400 line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 text-sm text-neutral-600">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-4 w-4 text-neutral-400" />
                        {new Date(product.expiryDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-neutral-400" />
                        Qty: {product.availableQuantity}
                      </div>
                    </div>

                    {/* Seller info */}
                    <div className="space-y-1.5 rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-neutral-400" />
                        {product.sellerId?.name || "Unknown Seller"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-neutral-400" />
                        {product.sellerId?.email || "No email provided"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-neutral-400" />
                        {product.sellerId?.phoneNumber || "No phone number provided"}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;