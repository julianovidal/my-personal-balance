import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, MonitorIcon, MoonIcon, PencilIcon, PlusIcon, SunIcon, Trash2Icon, XIcon } from "lucide-react"

import { api } from "@/api/client"
import { useTheme } from "@/components/theme-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAuth } from "@/contexts/AuthContext"
import { getApiErrorMessage } from "@/lib/auth-errors"
import { getInitials } from "@/lib/nav"
import type { Tag } from "@/types"

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const

export function ProfilePage() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4">
        <AccountCard />
        <AppearanceCard />
      </div>
      <TagsCard className="lg:col-span-2" />
    </div>
  )
}

function AccountCard() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your name and email can't be changed here yet.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Avatar className="size-12 rounded-lg">
          <AvatarFallback className="rounded-lg text-base">
            {getInitials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <dl className="grid min-w-0 text-sm">
          <dt className="sr-only">Name</dt>
          <dd className="truncate font-medium">{user.name}</dd>
          <dt className="sr-only">Email</dt>
          <dd className="truncate text-muted-foreground">{user.email}</dd>
        </dl>
      </CardContent>
    </Card>
  )
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>System follows your device setting.</CardDescription>
      </CardHeader>
      <CardContent>
        <ToggleGroup
          aria-label="Theme"
          variant="outline"
          value={[theme]}
          onValueChange={(values) => {
            const next = THEMES.find((t) => t.value === values[0])
            if (next) setTheme(next.value)
          }}
        >
          {THEMES.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label}>
              <Icon />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  )
}

function useTagMutations() {
  const qc = useQueryClient()
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ["tags"] })
    qc.invalidateQueries({ queryKey: ["transactions"] })
  }
  const create = useMutation({
    mutationFn: (label: string) => api.post("/tags", { label }),
    onSuccess,
  })
  const update = useMutation({
    mutationFn: ({ id, label }: { id: number; label: string }) => api.put(`/tags/${id}`, { label }),
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/tags/${id}`),
    onSuccess,
  })
  return { create, update, remove }
}

function TagsCard({ className }: { className?: string }) {
  const { data: tags = [], isPending, isError, error } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await api.get<Tag[]>("/tags")).data,
  })
  const { create, update, remove } = useTagMutations()
  const [newLabel, setNewLabel] = useState("")
  const [editing, setEditing] = useState<{ id: number; label: string } | null>(null)
  const [toDelete, setToDelete] = useState<Tag | null>(null)

  const mutationError = create.error ?? update.error ?? remove.error

  const submitNew = (event: FormEvent) => {
    event.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    create.mutate(label, { onSuccess: () => setNewLabel("") })
  }

  const saveEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const label = editing.label.trim()
    if (!label) return
    update.mutate({ id: editing.id, label }, { onSuccess: () => setEditing(null) })
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>Used to categorize transactions and train the classifier.</CardDescription>
        <CardAction>
          <Badge variant="outline">{tags.length} {tags.length === 1 ? "tag" : "tags"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submitNew} className="flex gap-2">
          <label htmlFor="new-tag" className="sr-only">
            New tag label
          </label>
          <Input
            id="new-tag"
            placeholder="New tag, e.g. Groceries"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <Button type="submit" disabled={!newLabel.trim() || create.isPending}>
            <PlusIcon />
            Add tag
          </Button>
        </form>

        {mutationError && (
          <p role="alert" className="text-sm text-destructive">
            {getApiErrorMessage(mutationError)}
          </p>
        )}

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead className="w-28 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending &&
                [0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={2}>
                      <Skeleton className="h-5 w-40" />
                    </TableCell>
                  </TableRow>
                ))}
              {isError && (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center text-destructive">
                    Couldn't load tags. {getApiErrorMessage(error)}
                  </TableCell>
                </TableRow>
              )}
              {!isPending && !isError && tags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                    No tags yet. Add your first one above.
                  </TableCell>
                </TableRow>
              )}
              {tags.map((tag) =>
                editing?.id === tag.id ? (
                  <TableRow key={tag.id}>
                    <TableCell colSpan={2}>
                      <form onSubmit={saveEdit} className="flex items-center gap-2">
                        <label htmlFor={`edit-tag-${tag.id}`} className="sr-only">
                          New name for {tag.label}
                        </label>
                        <Input
                          id={`edit-tag-${tag.id}`}
                          autoFocus
                          value={editing.label}
                          onChange={(e) => setEditing({ id: tag.id, label: e.target.value })}
                          onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                          className="h-8"
                        />
                        <Button
                          type="submit"
                          size="icon"
                          aria-label="Save"
                          disabled={!editing.label.trim() || update.isPending}
                        >
                          <CheckIcon />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Cancel"
                          onClick={() => setEditing(null)}
                        >
                          <XIcon />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium">{tag.label}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Rename ${tag.label}`}
                        onClick={() => setEditing({ id: tag.id, label: tag.label })}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${tag.label}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setToDelete(tag)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag "{toDelete?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Transactions with this tag will become untagged. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
              }
            >
              {remove.isPending ? "Deleting..." : "Delete tag"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
