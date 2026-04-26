"use client";

import dynamic from "next/dynamic";
import type { BlogPostLocation } from "@/lib/blog";

const BlogMiniMap = dynamic(() => import("./BlogMiniMap"), { ssr: false });

interface Props {
  primaryLocation: BlogPostLocation;
  secondaryLocations?: BlogPostLocation[];
  zoom?: number;
}

export default function BlogMiniMapWrapper(props: Props) {
  return <BlogMiniMap {...props} />;
}
