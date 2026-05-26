---
name: api-service
description: Wire up a backend endpoint in this project — axios call + DTOs + a React Query `useMutation`/`useQuery` hook — following the convention established under `src/api/services/auth/login`. Use this skill whenever the user mentions adding an API call, a new endpoint, a service, a fetch, a POST/GET/PATCH/DELETE, a mutation, a query, a custom hook for an endpoint, hitting the backend, useMutation/useQuery, DTOs, Axios, React Query, integrating with swagger types, or anything along those lines — even if they don't say "service" explicitly. Phrases like "add login API", "wire up users endpoint", "fetch current user", "POST to /projects", "create the hook for forgot password", or "call the backend from this form" must all trigger this skill.
---

# API service pattern — `src/api/services/<domain>/<action>/`

This project speaks to the backend through a strict three-file convention. The canonical example is **login** (`src/api/services/auth/login/`). Every new endpoint follows the same shape so call sites stay uniform and the React Query cache behaves predictably.

```
src/api/services/<domain>/<action>/
├── <action>.ts          # the bare async function (axios call)
├── <action>.dto.ts      # request/response types — aliased from the codegen
└── use<Action>.ts       # the React Query hook the UI consumes
```

Three files, never two, never one. The split exists so:

- **`<action>.ts`** is the only place that touches `axios`. It is dumb and testable: it takes the request DTO, returns the response DTO. No navigation, no toasts, no React.
- **`<action>.dto.ts`** isolates types so a swagger regen doesn't ripple into the hook or the UI. When the backend lies (it does — see below), the override lives here, not anywhere else.
- **`use<Action>.ts`** is the React-aware layer: side effects (`navigate`, `toast`, `queryClient.invalidateQueries`), pending/error state, and the public surface the UI gets to import.

## The supporting cast

| File | Role |
|---|---|
| `src/api/client.ts` | Single shared axios instance. `baseURL = VITE_API_URL`. Request/response interceptors are stubbed here — add auth headers, refresh logic, global error mapping in this file, not at call sites. |
| `src/api/types/Api.ts` | **Generated** by `npm run gen:api` from the backend swagger (`swagger-typescript-api`). Never edit by hand — it's overwritten. |
| `src/constants/endpoints.ts` | URL strings, grouped by domain. Endpoints are also React Query `mutationKey`/`queryKey` values, so they must live here, not as string literals in services. |
| `src/constants/messages.ts` | `ERROR_MESSAGES` / `SUCCESS_MESSAGES` codes (`ERR001`, `SC001`, …). Any user-facing toast string for known cases comes from here. |
| `src/utils/toast` | `toast.success/error/warning/info` wrappers around notistack. Hooks call these in `onError`/`onSuccess`. |
| `src/context/QueryProvider/queryClient.ts` | Shared `QueryClient` (5 min `gcTime`, 60s `staleTime`, retry 1 on queries, retry 0 on mutations). Mounted at the app root in `main.tsx`. |

---

## Step 0 — Generate or extend the types

Before writing the service, make sure the request body/response shape exists in `src/api/types/Api.ts`. If the backend already exposes the endpoint in swagger, regenerate:

```bash
npm run gen:api
# or with a custom spec URL:
SWAGGER_URL=https://api-i4f.dev.gdev.group/docs/?format=openapi npm run gen:api
```

This rewrites `src/api/types/Api.ts` only. If the backend hasn't shipped yet, hand-roll the type in your `*.dto.ts` and add a `TODO` comment so you remember to replace it after regen.

**Heads up — swagger lies sometimes.** The backend's swagger reuses request schemas as response schemas in places (e.g., `EmailOnlyLogin` is listed as the 200 body for `/auth/login/`, but the API actually returns `{ key }`). In those cases the DTO file overrides the generated type and leaves a comment explaining why. See `login.dto.ts` for the template — copy the comment style.

---

## Step 1 — Add the URL to `src/constants/endpoints.ts`

```ts
export const endpoints = {
  auth: {
    login: '/auth/login/',
    forgotPassword: '/auth/send-password-reset-code/'
    // add yours here
  },
  users: {
    currentPermissions: '/users/current/permissions/'
  }
};
```

URLs end with a trailing slash — that's how the backend is configured. Don't drop it.

These constants double as React Query keys. Using them everywhere (instead of literal strings) means a rename in this file is enough to invalidate every related cache entry.

---

## Step 2 — Write the DTO file

`src/api/services/<domain>/<action>/<action>.dto.ts`:

```ts
import type { EmailOnlyLogin } from '@api/types/Api';

export type LoginRequestDTO = EmailOnlyLogin;

// Backend swagger reuses EmailOnlyLogin as the 200 response schema, but the
// actual API returns { auth_token }. Override until the spec is fixed.
export interface LoginResponseDTO {
  key: string;
}
```

Rules:

- The local DTO is always named `<Action>RequestDTO` / `<Action>ResponseDTO`. Even if it's just a type alias of a generated type, **keep the alias** — the UI imports the DTO name, never the generated name. That way swap-outs (e.g., swagger renames `EmailOnlyLogin` to `LoginCredentials`) stay local to this file.
- If the endpoint has no request body, omit `RequestDTO`. If no response body, use `export type <Action>ResponseDTO = void` (see `forgotPassword.dto.ts`).
- Prefer `type` for unions/aliases, `interface` for object shapes that may be extended. The codebase uses both.

---

## Step 3 — Write the axios call

`src/api/services/<domain>/<action>/<action>.ts`:

```ts
import api from '@api/client';
import type { LoginRequestDTO, LoginResponseDTO } from '@api/services/auth/login/login.dto';

import { endpoints } from '@constants/endpoints';

export const login = async (data: LoginRequestDTO): Promise<LoginResponseDTO> =>
  await api.post<LoginResponseDTO>(endpoints.auth.login, data).then((res) => res.data);
```

Conventions:

- The function name matches the folder name (`login`, `forgotPassword`, `checkResetCode`). No prefix.
- **Return `res.data`, not the full `AxiosResponse`.** The hook layer should never see axios internals — the only place we leak axios is when handling errors via `isAxiosError` (see Step 4).
- When the response is empty (`void`), don't return at all — just `await` and let TS infer `Promise<void>`. See `forgotPassword.ts`:

  ```ts
  export const forgotPassword = async (data: ForgotPasswordRequestDTO): Promise<ForgotPasswordResponseDTO> => {
    await api.post<ForgotPasswordResponseDTO>(endpoints.auth.forgotPassword, data);
  };
  ```

- Use the typed verb: `api.post<LoginResponseDTO>(…)`, `api.get<UserDTO>(…)`. This tightens `res.data` to the expected shape.
- Imports always go through aliases (`@api/...`, `@constants/...`) — never `../../../`.

---

## Step 4 — Write the React Query hook

This is where business behavior lives. The shape is rigid on purpose: every hook returns `{ handle<Action>, responseData, isPending<Action>, error }` so call sites read the same way regardless of which endpoint they hit.

### Mutation (POST/PATCH/PUT/DELETE)

`src/api/services/<domain>/<action>/use<Action>.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { isAxiosError } from 'axios';

import { login } from '@api/services/auth/login/login';

import { endpoints } from '@constants/endpoints';
import { ERROR_MESSAGES } from '@constants/messages';
import { routes } from '@constants/routes';
import { AUTH_TOKEN_KEY } from '@constants/storage';
import { toast } from '@utils/toast';

export const useLogin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, error, mutate, isPending } = useMutation({
    mutationFn: login,
    mutationKey: [endpoints.auth.login],
    onSuccess: (response) => {
      localStorage.setItem(AUTH_TOKEN_KEY, response.key);
      navigate(routes.projects);
      queryClient.invalidateQueries({ queryKey: [endpoints.users.currentPermissions] });
    },
    onError: (err) => {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const message = status === 401 ? ERROR_MESSAGES.ERR003 : err instanceof Error ? err.message : 'Unexpected error';
      toast.error(message);
    }
  });

  return {
    handleLogin: mutate,
    responseData: data,
    isPendingLogin: isPending,
    error
  };
};
```

Why each piece is there:

- **`mutationKey: [endpoints.auth.<action>]`** — used by React Query for dedup and devtools labels. Wrapping the endpoint in an array (not `endpoints.auth.login` directly) is React Query v5 contract.
- **`onSuccess` does the side effects, not the page.** The UI just calls `handleLogin(data)`. Navigation, token persistence, and cache invalidation belong to the hook so behavior is identical wherever the hook is used.
- **`queryClient.invalidateQueries({ queryKey: [endpoints.X] })`** — invalidate every query whose key starts with that endpoint. If a mutation changes data another screen reads, list its endpoint here. If you don't, the user sees stale data until a manual refetch.
- **`onError` narrows axios errors with `isAxiosError`.** Use this to map HTTP statuses to localized error codes (`ERR003` for 401, etc.). Don't reach into `err.response.data` directly without the guard — TS won't help you and runtime can blow up.
- **The fallback `'Unexpected error'`** is the only inline string in the hook. Everything user-facing should come from `ERROR_MESSAGES`/`SUCCESS_MESSAGES` once you know which code applies.
- **Return shape** — `handle<Action>` (the trigger), `responseData` (renamed from `data` so it doesn't clash with form `data`), `isPending<Action>` (renamed so two hooks on the same page don't collide), `error` (raw). Stick to these names; UI code relies on them being consistent.

#### Minimal mutation (no navigation/cache work)

When all you need is a fire-and-forget toast on error, the body shrinks — see `useForgotPassword.ts`:

```ts
export const useForgotPassword = () => {
  const { data, error, mutate, isPending } = useMutation({
    mutationFn: forgotPassword,
    mutationKey: [endpoints.auth.forgotPassword],
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unexpected error');
    }
  });

  return {
    handleForgotPassword: mutate,
    responseData: data,
    isPendingForgotPassword: isPending,
    error
  };
};
```

#### When the error should redirect, not toast

If a failure of the call has semantic meaning (e.g., the reset code being invalid means "this link is expired"), redirect in `onError` instead of toasting. See `useCheckResetCode.ts`:

```ts
onError: () => {
  navigate(routes.auth.linkExpired, { replace: true });
}
```

Same hook shape, different reaction. Keep the decision inside the hook.

### Query (GET)

There's no canonical query yet in the auth services (login flow is all mutations), but the file layout is identical. The hook uses `useQuery` instead:

```ts
import { useQuery } from '@tanstack/react-query';

import { getCurrentPermissions } from '@api/services/users/currentPermissions/currentPermissions';
import { endpoints } from '@constants/endpoints';

export const useCurrentPermissions = () => {
  const { data, error, isPending, refetch } = useQuery({
    queryFn: getCurrentPermissions,
    queryKey: [endpoints.users.currentPermissions]
  });

  return {
    permissions: data,
    isPendingPermissions: isPending,
    error,
    refetch
  };
};
```

Notes:

- `queryKey` is also `[endpoints.X]` so mutations can invalidate by the same key.
- Don't pass `enabled: !!something` flags into the public hook — accept a `params` argument and shape the key from it (`queryKey: [endpoints.X, params]`). This keeps cache entries distinct per input.
- Queries inherit defaults from `queryClient.ts`: `staleTime: 60_000`, `gcTime: 300_000`, `refetchOnWindowFocus: false`, `retry: 1`. Override only when the endpoint really needs it.

---

## Step 5 — Consume from the page

The UI calls the hook, does nothing else interesting. From `LoginPage`:

```tsx
const { handleLogin, isPendingLogin } = useLogin();

const formMethods = useForm<LoginFormValues>({
  resolver: zodResolver(loginSchema),
  mode: 'onChange',
  defaultValues: { email: '', password: '' }
});

const onSubmit = (data: LoginFormValues) => {
  handleLogin(data);
};

// later in JSX:
<Button type="submit" disabled={!isValid || isPendingLogin}>Confirm</Button>
```

Patterns to keep:

- The form values type comes from the Zod schema (`z.infer<typeof loginSchema>`) and is structurally compatible with the request DTO, so `handleLogin(data)` works without a cast.
- The button is disabled by both `!isValid` (form) and `isPendingLogin` (network). This prevents double-submits.
- The page doesn't try/catch — error handling is the hook's job.
- The page doesn't read `responseData` for login (the hook navigates on success). It would read `responseData` for an endpoint where the success path stays on the same screen.

---

## Auth, headers, and the axios client

`src/api/client.ts` is the only place that touches axios config:

```ts
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' }
});
```

The interceptors are currently pass-throughs. When you need to attach the auth token to outgoing requests, add it here, not in every service:

```ts
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});
```

Same goes for global 401 → logout, refresh-token rotation, request IDs, etc. One interceptor, all services benefit.

Auth state itself lives in `localStorage` under `AUTH_TOKEN_KEY` (from `@constants/storage`). The `PrivateRoute`/`PublicRoute` HOCs in `src/components/hocs/` read it directly to gate route trees.

---

## Mutation chains across hooks

If a mutation's success should warm another query, **don't refetch manually in the page**. Invalidate inside the mutation's `onSuccess`:

```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [endpoints.projects.list] });
  queryClient.invalidateQueries({ queryKey: [endpoints.projects.stats] });
}
```

Page code stays declarative; whatever data is on screen will refresh next render.

If you need optimistic updates, do them with `onMutate`/`onError`/`onSettled` inside the hook, not in the page. The page's mental model is "submit + show pending". Anything more belongs in the hook.

---

## Naming cheat sheet

| Folder/file | Examples |
|---|---|
| Folder | `login`, `forgotPassword`, `checkResetCode`, `currentPermissions` (camelCase, no `use` prefix) |
| Service function | `login`, `forgotPassword`, `checkResetCode` (matches folder) |
| Request DTO | `LoginRequestDTO`, `ForgotPasswordRequestDTO` |
| Response DTO | `LoginResponseDTO` (or `= void` if empty) |
| Hook file | `useLogin.ts`, `useForgotPassword.ts` |
| Hook export | `useLogin`, returning `{ handleLogin, responseData, isPendingLogin, error }` |
| Mutation key | `[endpoints.auth.login]` (always wrapped in an array) |

---

## Quick checklist before declaring a service done

- [ ] URL added to `src/constants/endpoints.ts` (with trailing slash if backend expects it)
- [ ] Three files exist in `src/api/services/<domain>/<action>/`
- [ ] Service function returns `res.data` (or nothing for void responses)
- [ ] DTOs alias the generated types from `@api/types/Api`; overrides have a comment explaining why
- [ ] Hook uses `mutationKey`/`queryKey` of `[endpoints.X]`, not a raw string
- [ ] Side effects (navigate, toast, invalidate) live inside the hook, not the page
- [ ] Hook returns `{ handle<Action>, responseData, isPending<Action>, error }`
- [ ] Error path narrows axios errors with `isAxiosError` when status code matters
- [ ] User-facing error/success strings come from `ERROR_MESSAGES`/`SUCCESS_MESSAGES`
- [ ] All imports use aliases (`@api/...`, `@constants/...`, `@utils/...`)
- [ ] `npm run build` passes (`tsc -b` catches DTO/hook drift)
- [ ] `npm run lint` clean — no `console.log`, type-only imports use `import type`, single-quotes, semicolons, 120-col width
