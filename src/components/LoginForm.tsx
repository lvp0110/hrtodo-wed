import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, authQueries } from "#/services/api";
import type { LoginRequest } from "#/types/api";

/**
 * Форма входа. Рендерится условно в __root, отдельной страницы /login нет.
 * Бэк выдаёт HttpOnly access_token и csrf_token cookies, поэтому ничего
 * вручную в localStorage сохранять не нужно — достаточно инвалидации
 * authQueries.session, чтобы __root перерисовался с авторизованным состоянием.
 */
export function LoginForm() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginRequest>({
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (res) => {
      // Кладём пользователя в кеш сразу, чтобы избежать лишнего GET /auth/session.
      queryClient.setQueryData(authQueries.session.queryKey, res.data);
    },
  });

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Авторизация
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Используйте email для входа
          </p>
        </div>

        <form
          onSubmit={handleSubmit((data) => loginMutation.mutate(data))}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              autoFocus
              autoComplete="username"
              placeholder="you@example.com"
              {...register("email", {
                required: "Обязательное поле",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Некорректный email",
                },
              })}
              className={`${inputClass} ${errors.email ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Пароль <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password", { required: "Обязательное поле" })}
              className={`${inputClass} ${errors.password ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          {loginMutation.isError && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {loginMutation.error instanceof Error
                ? loginMutation.error.message
                : "Не удалось войти"}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid || loginMutation.isPending}
            className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loginMutation.isPending ? "Входим…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
