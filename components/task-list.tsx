'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useTasks } from '@/src/hooks/use-tasks';
import type { Task } from '@/src/schemas/task';
import { TaskRow } from './task-row';
import { TaskCreateDialog } from './task-create-dialog';
import { TaskDrawer } from './task-drawer';

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done';
type SortKey = 'priority' | 'newest' | 'oldest';

const STATUS_VALUES = ['all', 'todo', 'in_progress', 'done'] as const;
const SORT_VALUES = ['priority', 'newest', 'oldest'] as const;
const PRIORITY_RANK: Record<Task['priority'], number> = {
  high: 3,
  medium: 2,
  low: 1
};
const DEFAULT_STATUS: StatusFilter = 'all';
const DEFAULT_SORT: SortKey = 'newest';

function parseStatus(v: string | null): StatusFilter {
  return (STATUS_VALUES as readonly string[]).includes(v ?? '')
    ? (v as StatusFilter)
    : DEFAULT_STATUS;
}
function parseSort(v: string | null): SortKey {
  return (SORT_VALUES as readonly string[]).includes(v ?? '')
    ? (v as SortKey)
    : DEFAULT_SORT;
}

export function TaskList() {
  const router = useRouter();
  const params = useSearchParams();
  const status = parseStatus(params.get('status'));
  const sort = parseSort(params.get('sort'));
  const query = params.get('q') ?? '';
  const openTaskIdParam = params.get('open');
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: tasks, isLoading } = useTasks();

  const setParam = (
    key: 'status' | 'sort' | 'q' | 'open',
    value: string | null,
    defaultValue?: string
  ) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  };

  const topLevel = useMemo(
    () => (tasks ?? []).filter((t) => t.parentId === null),
    [tasks]
  );

  const counts = useMemo(() => {
    const byStatus = topLevel.reduce<Record<Task['status'], number>>(
      (acc, task) => ({ ...acc, [task.status]: acc[task.status] + 1 }),
      { todo: 0, in_progress: 0, done: 0 }
    );
    return { all: topLevel.length, ...byStatus };
  }, [topLevel]);

  const filtered = useMemo(() => {
    let list = topLevel;
    if (status !== 'all') list = list.filter((t) => t.status === status);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === 'newest')
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sort === 'oldest')
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (sort === 'priority')
      sorted.sort(
        (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
      );
    return sorted;
  }, [topLevel, status, query, sort]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleClose = () => setParam('open', null);
  const handleOpenTask = (id: string) => setParam('open', id);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(v) => setParam('status', v, DEFAULT_STATUS)}
        >
          <TabsList>
            <TabsTrigger value="all">
              All{' '}
              <span className="ml-1 text-[10px] opacity-60">{counts.all}</span>
            </TabsTrigger>
            <TabsTrigger value="todo">
              Todo{' '}
              <span className="ml-1 text-[10px] opacity-60">{counts.todo}</span>
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              In progress{' '}
              <span className="ml-1 text-[10px] opacity-60">
                {counts.in_progress}
              </span>
            </TabsTrigger>
            <TabsTrigger value="done">
              Done{' '}
              <span className="ml-1 text-[10px] opacity-60">{counts.done}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Search…  /"
            className="h-9 w-[180px]"
            aria-label="Search tasks"
          />
          <Select
            value={sort}
            onValueChange={(v) => setParam('sort', v, DEFAULT_SORT)}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue>
                {(v: string) =>
                  (
                    ({
                      priority: 'Priority',
                      newest: 'Newest',
                      oldest: 'Oldest'
                    }) as Record<string, string>
                  )[v] ?? v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
          <TaskCreateDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={() => handleOpenTask(t.id)} />
          ))}
        </div>
      ) : query.trim() || status !== 'all' ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tasks match your filter.
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tasks yet. Run{' '}
          <code className="rounded bg-muted px-1">npm run seed</code> for sample
          data, or create one.
        </div>
      )}

      <TaskDrawer taskId={openTaskIdParam} onClose={handleClose} />
    </>
  );
}
