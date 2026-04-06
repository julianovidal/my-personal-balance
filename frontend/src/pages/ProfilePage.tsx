import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { getTheme, setTheme } from "@/lib/theme";
import { Tag } from "@/types";

const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [theme, setThemeState] = useState(getTheme());
  const [tagLabel, setTagLabel] = useState("");
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await api.get<Tag[]>("/tags")).data
  });

  const createTag = useMutation({
    mutationFn: async () => {
      if (editingTag) {
        await api.put(`/tags/${editingTag.id}`, { label: tagLabel });
      } else {
        await api.post("/tags", { label: tagLabel });
      }
    },
    onSuccess: () => {
      setEditingTag(null);
      setTagLabel("");
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    }
  });

  const removeTag = useMutation({
    mutationFn: async (id: number) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      setTagToDelete(null);
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    }
  });

  const confirmDeleteTag = () => {
    if (!tagToDelete) return;
    removeTag.mutate(tagToDelete.id);
  };

  const startEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setTagLabel(tag.label);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setThemeState(nextTheme);
  };

  return (
    <div className="space-y-4">
      <Card className="max-w-xl p-5">
        <h2 className="mb-3 text-xl font-semibold">Profile</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
          <Button variant="outline" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </Button>
        </div>
      </Card>

      <Card className="max-w-3xl p-5">
        <h2 className="mb-3 text-xl font-semibold">Tags</h2>

        <form
          className="mb-4 grid gap-3 md:grid-cols-3"
          onSubmit={(e) => { e.preventDefault(); createTag.mutate(); }}
        >
          <div className="md:col-span-2">
            <Label className={labelClass}>Label</Label>
            <Input value={tagLabel} onChange={(e) => setTagLabel(e.target.value)} required />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              {editingTag ? "Update tag" : "Create tag"}
            </Button>
          </div>
        </form>

        {editingTag ? (
          <Button
            variant="outline"
            className="mb-4"
            onClick={() => {
              setEditingTag(null);
              setTagLabel("");
            }}
          >
            Cancel tag edit
          </Button>
        ) : null}

        <div className="grid gap-2 md:grid-cols-3">
          {tags.map((tag) => (
            <div key={tag.id} className="rounded-lg border border-border p-3">
              <p className="font-medium">{tag.label}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" onClick={() => startEditTag(tag)}>Edit</Button>
                <Button variant="destructive" onClick={() => setTagToDelete(tag)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Delete tag confirmation dialog */}
      <Dialog open={Boolean(tagToDelete)} onOpenChange={(open) => { if (!open) setTagToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete tag{" "}
              <span className="font-semibold text-foreground">{tagToDelete?.label}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTagToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDeleteTag} disabled={removeTag.isPending}>
                {removeTag.isPending ? "Deleting..." : "Delete tag"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
