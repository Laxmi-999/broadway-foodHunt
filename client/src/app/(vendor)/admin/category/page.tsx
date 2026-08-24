"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import EmojiPicker from "emoji-picker-react";
import {
  Calendar,
  Edit,
  EyeOff,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Category {
  _id: string;
  name: string;
  description: string;
  image?: string;
  itemCount?: number;
  status?: "active" | "inactive";
  emoji: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const emptyForm = { name: "", description: "", emoji: "" };

const formatDate = (value: string) => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy");
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/categories`);
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter(
      (category) =>
        category.name?.toLowerCase().includes(term) ||
        category.description?.toLowerCase().includes(term)
    );
  }, [categories, searchTerm]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const handleCreateCategory = async () => {
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    try {
      setSaving(true);
      await axios.post(`${API_URL}/categories`, formData);
      toast.success("Category created");
      await fetchCategories();
      setShowEmojiPicker(false);
      setFormData(emptyForm);
      setIsCreateDialogOpen(false);
    } catch (error) {
      toast.error("Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      emoji: category.emoji,
    });
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    try {
      setSaving(true);
      await axios.patch(`${API_URL}/categories/${editingCategory._id}`, formData);
      toast.success("Category updated");
      await fetchCategories();
      setEditingCategory(null);
      setShowEmojiPicker(false);
      setFormData(emptyForm);
    } catch (error) {
      toast.error("Failed to update category");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      setDeletingId(id);
      await axios.delete(`${API_URL}/categories/${id}`);
      toast.success("Category deleted");
      setCategories((prev) => prev.filter((c) => c._id !== id));
    } catch (error) {
      toast.error("Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Derived stats — guarded against fields the API may not return yet, so a
  // missing itemCount/status can never surface as "NaN" or a silently wrong 0.
  // -------------------------------------------------------------------------

  const totalItems = categories.reduce((sum, c) => sum + (c.itemCount || 0), 0);
  const activeCount = categories.filter((c) => (c.status ?? "active") === "active").length;
  const inactiveCount = categories.filter((c) => c.status === "inactive").length;

  const stats = [
    { label: "Total Categories", value: categories.length, icon: Layers, accent: "text-orange-600 bg-orange-50 dark:bg-orange-500/10" },
    { label: "Active", value: activeCount, icon: Package, accent: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Total Items", value: totalItems, icon: Package, accent: "text-blue-600 bg-blue-50 dark:bg-blue-500/10" },
    { label: "Inactive", value: inactiveCount, icon: EyeOff, accent: "text-neutral-500 bg-neutral-100 dark:bg-neutral-800" },
  ];

  // -------------------------------------------------------------------------
  // Shared category form (create + edit dialogs)
  // -------------------------------------------------------------------------

  const CategoryForm = ({ idPrefix }: { idPrefix: string }) => (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Category name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. Beverages"
          className="border-neutral-300 focus-visible:ring-orange-200"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What belongs in this category?"
          className="border-neutral-300 focus-visible:ring-orange-200"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-emoji`}>Icon</Label>
        <div className="relative">
          <button
            type="button"
            id={`${idPrefix}-emoji`}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-10 w-full items-center gap-2 rounded-md border border-neutral-300 px-3 text-left text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {formData.emoji ? (
              <>
                <span className="text-lg">{formData.emoji}</span>
                <span className="text-neutral-500">Change icon</span>
              </>
            ) : (
              <span className="text-neutral-400">Click to choose an emoji</span>
            )}
          </button>
          {showEmojiPicker && (
            <div className="absolute z-20 mt-2">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  setFormData({ ...formData, emoji: emojiData.emoji });
                  setShowEmojiPicker(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            Food Categories
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Manage your categories and keep the menu organized
          </p>
        </div>
        <button
          onClick={fetchCategories}
          aria-label="Refresh"
          className="grid h-9 w-9 place-items-center self-start rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:self-auto dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-5 lg:grid-cols-4">
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

      {/* Actions bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-neutral-300 pl-9 focus-visible:ring-orange-200"
          />
        </div>

        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setShowEmojiPicker(false);
              setFormData(emptyForm);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-orange-600 text-white hover:bg-orange-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create category</DialogTitle>
            </DialogHeader>
            <CategoryForm idPrefix="create" />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmojiPicker(false);
                  setFormData(emptyForm);
                  setIsCreateDialogOpen(false);
                }}
                className="border-neutral-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCategory}
                disabled={saving}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories table */}
      <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              All Categories
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {filteredCategories.length} of {categories.length} shown
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredCategories.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow
                    key={category._id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 text-lg dark:from-orange-500/10 dark:to-amber-500/10">
                          {category.emoji || "🍽️"}
                        </span>
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {category.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-neutral-500 dark:text-neutral-400">
                        {category.description || "No description yet."}
                      </p>
                    </TableCell>
                    <TableCell className="text-neutral-600 dark:text-neutral-300">
                      <span className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-neutral-400" />
                        {category.itemCount || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          (category.status ?? "active") === "active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                        )}
                      >
                        {category.status ?? "active"}
                      </span>
                    </TableCell>
                    <TableCell className="text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                        {formatDate(category.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog
                          open={editingCategory?._id === category._id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setEditingCategory(null);
                              setShowEmojiPicker(false);
                              setFormData(emptyForm);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                              className="border-neutral-300 dark:border-neutral-700"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[480px]">
                            <DialogHeader>
                              <DialogTitle>Edit category</DialogTitle>
                            </DialogHeader>
                            <CategoryForm idPrefix="edit" />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingCategory(null);
                                  setShowEmojiPicker(false);
                                  setFormData(emptyForm);
                                }}
                                className="border-neutral-300"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleUpdateCategory}
                                disabled={saving}
                                className="bg-orange-600 text-white hover:bg-orange-700"
                              >
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save changes
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete &quot;{category.name}&quot;?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This can&apos;t be undone. Items currently assigned to this
                                category will lose their category tag.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-neutral-300">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteCategory(category._id)}
                                disabled={deletingId === category._id}
                                className="bg-red-600 text-white hover:bg-red-700"
                              >
                                {deletingId === category._id && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-orange-50 dark:bg-orange-500/10">
              <Search className="h-7 w-7 text-orange-400" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
              No categories found
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
              {searchTerm
                ? `Nothing matches "${searchTerm}". Try a different search.`
                : "Get started by creating your first category."}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="mt-5 bg-orange-600 text-white hover:bg-orange-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add your first category
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}