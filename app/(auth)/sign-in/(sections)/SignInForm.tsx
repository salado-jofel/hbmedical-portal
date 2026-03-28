"use client";

import React, { useActionState, useState, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Divider,
  Input,
  Spinner,
} from "@heroui/react";
import { Mail, Lock, Eye, EyeOff, UserPlus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "../(services)/actions";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import { useSearchParams } from "next/navigation";
import { HBLogo } from "@/app/(components)/HBLogo";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(signIn, null);
  const [formValues, setFormValues] = useState({ email: "", password: "" });

  const isFormValid =
    formValues.email.trim() !== "" && formValues.password.trim() !== "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (state?.error) {
      setFormValues((prev) => ({ ...prev, password: "" }));
    }
  }, [state]);

  const router = useRouter();

  const searchParams = useSearchParams();
  const qbError = searchParams.get("error");

  return (
    <Card
      shadow="lg"
      radius="lg"
      className="w-full max-w-md select-none bg-content1/80 backdrop-blur-2xl border border-white/15 bg-transparent"
    >
      <CardBody className="p-8 md:p-10 gap-0">
        {/* Logo */}
        <div className="relative z-10 mb-8 flex items-center justify-center py-10">
          <HBLogo variant="dark" size="lg" />
        </div>

        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            {/* Email field */}
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="Enter your email"
              variant="bordered"
              color="default"
              size="lg"
              radius="lg"
              value={formValues.email}
              onChange={handleChange}
              startContent={
                <Mail className="w-4 h-4 text-primary pointer-events-none flex-shrink-0" />
              }
            />

            {/* Password field */}
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              label="Password"
              placeholder="Enter your password"
              variant="bordered"
              color="primary"
              size="lg"
              radius="lg"
              value={formValues.password}
              onChange={handleChange}
              startContent={
                <Lock className="w-4 h-4 text-primary pointer-events-none flex-shrink-0" />
              }
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-foreground/35 hover:text-primary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
            />

            {state?.error && <ErrorAlert errorMessage={state.error} />}
          </div>

          {/* Remember me */}
          <Checkbox name="remember" color="primary" size="sm">
            <span className="text-foreground/50">Remember me</span>
          </Checkbox>

          <div className="flex flex-col gap-3 pt-1">
            {/* Primary CTA */}
            <Button
              type="submit"
              color="primary"
              size="lg"
              radius="lg"
              fullWidth
              isDisabled={!isFormValid || isPending}
              isLoading={isPending}
              spinner={<Spinner size="sm" color="white" />}
              className="font-bold"
            >
              {isPending ? "Signing in..." : "Sign In"}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <Divider className="flex-1" />
              <span className="text-xs uppercase tracking-widest text-foreground/30">
                or
              </span>
              <Divider className="flex-1" />
            </div>

            {/* Secondary CTA */}
            <Button
              variant="bordered"
              size="lg"
              radius="lg"
              fullWidth
              className="font-bold border-white/15"
              onPress={() => router.push("/sign-up")}
            >
              <UserPlus className="w-5 h-5" /> Create New Account
            </Button>
          </div>
        </form>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground/35 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Main Site
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
