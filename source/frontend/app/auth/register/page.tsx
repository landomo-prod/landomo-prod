"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

export default function RegisterPage() {
  const { signUp, signInWithGoogle, signInWithFacebook, signInWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUp(email, password);
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-4 text-3xl font-black text-gray-900">Check your email</h1>
          <p className="mb-6 text-sm font-medium text-gray-500">
            We sent a confirmation link to <strong className="text-gray-900">{email}</strong>.
            Click the link to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="text-sm font-bold text-[#84CC16] hover:text-[#6aaa10]"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-3xl font-black text-gray-900">
          Create Account
        </h1>

        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>

          <button
            type="button"
            onClick={() => signInWithFacebook()}
            className="w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-transparent bg-[#1877F2] text-white hover:bg-[#166FE5]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M18 9a9 9 0 10-10.406 8.89v-6.29H5.309V9h2.285V7.017c0-2.255 1.343-3.501 3.4-3.501.984 0 2.014.176 2.014.176v2.215h-1.135c-1.118 0-1.467.694-1.467 1.406V9h2.496l-.399 2.6h-2.097v6.29A9.002 9.002 0 0018 9z"/>
            </svg>
            Sign up with Facebook
          </button>

          <button
            type="button"
            onClick={() => signInWithApple()}
            className="w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-transparent bg-black text-white hover:bg-gray-800"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M14.94 9.88c-.02-2.15 1.75-3.18 1.83-3.23-1-1.46-2.55-1.66-3.1-1.68-1.32-.13-2.57.78-3.24.78-.67 0-1.7-.76-2.8-.74A4.14 4.14 0 004.14 7.3c-1.49 2.58-.38 6.4 1.07 8.5.71 1.03 1.56 2.18 2.67 2.14 1.07-.04 1.47-.69 2.77-.69 1.29 0 1.66.69 2.78.67 1.15-.02 1.88-1.05 2.58-2.08.82-1.19 1.15-2.35 1.17-2.41-.03-.01-2.24-.86-2.24-3.43zM12.83 3.32A4.07 4.07 0 0013.76.08a4.15 4.15 0 00-2.68 1.39 3.88 3.88 0 00-.97 2.82 3.43 3.43 0 002.72-1.07z"/>
            </svg>
            Sign up with Apple
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-4 font-medium text-gray-400">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-bold text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16]"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#84CC16] py-3 text-sm font-black text-white transition-colors hover:bg-[#6aaa10] disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-bold text-[#84CC16] hover:text-[#6aaa10]">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
