"use client";
import dynamic from "next/dynamic";

const LoginClient = dynamic(() => import("./LoginClient"), { ssr: false });

export default function LoginWrapper() {
  return <LoginClient />;
}
