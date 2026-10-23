"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { avatarCategory, specialtyAvatarPath, type AvatarStyle } from "../avatar";

type Props = {
  name: string;
  jobTitle?: string | null;
  path?: string | null;
  avatarStyle?: AvatarStyle | string | null;
  size?: number;
  className?: string;
};

export function EmployeeAvatar({ name, jobTitle, path, avatarStyle, size = 40, className = "" }: Props) {
  const [signedAvatar, setSignedAvatar] = useState({ path: "", url: "" });
  const category = avatarCategory(jobTitle);

  useEffect(() => {
    let isMounted = true;
    if (!path || !isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return;

    const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
    void supabase.storage
      .from("employee-avatars")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (isMounted) setSignedAvatar({ path, url: data?.signedUrl ?? "" });
      });

    return () => {
      isMounted = false;
    };
  }, [path]);

  const signedUrl = signedAvatar.path === path ? signedAvatar.url : "";

  const style = {
    width: size,
    height: size,
    borderRadius: "50%",
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: signedUrl ? "#e2e8f0" : `${category.color}18`,
    color: category.color,
    border: `1px solid ${category.color}33`,
    fontWeight: 700,
    fontSize: Math.max(11, Math.round(size * 0.34)),
    lineHeight: 1,
  } as const;

  if (signedUrl) {
    return (
      <img
        className={className}
        src={signedUrl}
        alt={`Foto de ${name}`}
        style={{ ...style, objectFit: "cover" }}
      />
    );
  }

  const specialtyAvatar = specialtyAvatarPath(avatarStyle, category.key);

  return (
    <img
      className={className}
      src={specialtyAvatar}
      alt={`Avatar ilustrado de ${category.label} para ${name}`}
      title={jobTitle || category.label}
      style={{ ...style, objectFit: "cover" }}
    />
  );
}