import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const githubBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  trailingSlash: isGitHubPages,
  basePath: isGitHubPages ? githubBasePath : "",
  assetPrefix: isGitHubPages ? githubBasePath : undefined,
  images: { unoptimized: isGitHubPages },
};

export default nextConfig;
