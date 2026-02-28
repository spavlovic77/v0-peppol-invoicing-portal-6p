/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Ensure compiled schematron SEF files are included in Vercel serverless bundles
  outputFileTracingIncludes: {
    '/api/invoice/generate': ['./lib/schematron/**/*.sef.json'],
  },
}

export default nextConfig
